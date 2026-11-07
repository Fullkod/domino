// Edge Function `game-action`: the only authority of the game (BUSINESS_LOGIC.md §5.6).
// Clients send intentions (start, play tile/side, pass, tick); this function validates them with
// the pure rules engine and persists the result through service-role RPCs (atomic, versioned).
//
// Actions (POST JSON, user JWT in Authorization):
//   { action: 'start', tableId }            buy-in when everyone is ready, then deal
//   { action: 'play', gameId, tile, side }  place a tile
//   { action: 'pass', gameId }              pass (only without a legal play)
//   { action: 'tick', gameId }              resolve an expired turn / resume a stalled game

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  applyMove,
  autoMove,
  deal,
  findOpening,
  nextHandStarter,
  type HandResult,
  type HandState,
  type MaxPip,
  type Move,
  type PlacedTile,
  type PlayerCount,
  type RuleConfig,
  type Seat,
  type Tile,
} from '../_shared/domino/index.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Seconds of grace after a deadline before the server plays for the player. */
const DEADLINE_GRACE_MS = 1000
/** Consecutive expired turns that count as abandoning the game (BUSINESS_LOGIC.md §4.4). */
const ABANDON_TIMEOUTS = 3

class GameError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code)
  }
}

interface GameRow {
  id: string
  status: string
  players: number
  max_pip: number
  target_points: number
  scoring: string
  score_team0: number
  score_team1: number
  hand_no: number
}

interface HandRow {
  id: string
  hand_no: number
  starter_seat: number
  turn_seat: number
  board: PlacedTile[]
  left_end: number | null
  right_end: number | null
  passes_in_row: number
  required_opening: Tile | null
  status: 'playing' | 'finished'
  result: HandResult | null
  turn_deadline: string | null
  version: number
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

function secureRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32
}

function isTile(value: unknown): value is Tile {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((n) => Number.isInteger(n) && n >= 0 && n <= 9) &&
    value[0] <= value[1]
  )
}

function ruleConfig(game: GameRow): RuleConfig {
  return {
    maxPip: game.max_pip as MaxPip,
    targetPoints: game.target_points,
    scoring: game.scoring as RuleConfig['scoring'],
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: auth } = await db.auth.getUser(token)
    const userId = auth.user?.id
    if (!userId) throw new GameError('not_authenticated', 401)

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body.action !== 'string') throw new GameError('invalid_request')

    switch (body.action) {
      case 'start':
        if (typeof body.tableId !== 'string') throw new GameError('invalid_request')
        return json(await start(db, userId, body.tableId))
      case 'play':
        if (typeof body.gameId !== 'string' || !isTile(body.tile) || (body.side !== 'left' && body.side !== 'right')) {
          throw new GameError('invalid_request')
        }
        return json(await playerMove(db, userId, body.gameId, { type: 'play', tile: body.tile, side: body.side }))
      case 'pass':
        if (typeof body.gameId !== 'string') throw new GameError('invalid_request')
        return json(await playerMove(db, userId, body.gameId, { type: 'pass' }))
      case 'tick':
        if (typeof body.gameId !== 'string') throw new GameError('invalid_request')
        return json(await tick(db, userId, body.gameId))
      default:
        throw new GameError('invalid_request')
    }
  } catch (err) {
    if (err instanceof GameError) return json({ error: err.code }, err.status)
    console.error(err)
    return json({ error: 'server_error' }, 500)
  }
})

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function start(db: SupabaseClient, userId: string, tableId: string) {
  const { data: seat } = await db.from('table_seats').select('seat').eq('table_id', tableId).eq('user_id', userId).maybeSingle()
  if (!seat) throw new GameError('not_seated', 403)

  const { data: table } = await db.from('game_tables').select('status, current_game_id').eq('id', tableId).single()
  let gameId: string | null = table?.status === 'playing' ? table.current_game_id : null

  if (!gameId) {
    const { data, error } = await db.rpc('start_game', { p_table: tableId })
    if (error) {
      // Someone else started it first, or not everyone is ready yet.
      if (/table_not_ready|table_not_startable/.test(error.message)) return { started: false }
      throw error
    }
    if (!data) return { started: false, reason: 'insufficient_chips' }
    gameId = data as string
  }

  await ensureProgress(db, gameId)
  return { started: true, gameId }
}

async function playerMove(db: SupabaseClient, userId: string, gameId: string, move: Move) {
  const game = await loadGame(db, gameId)
  if (game.status !== 'playing') throw new GameError('game_not_playing')
  const seat = await seatOf(db, gameId, userId)
  const { hand, state } = await loadHand(db, game)
  if (!hand || state === null || hand.status !== 'playing') throw new GameError('hand_finished')

  const outcome = applyMove(state, seat, move, ruleConfig(game))
  if (!outcome.ok) throw new GameError(outcome.error)

  await persist(db, hand, seat, move, outcome.state, move.type === 'play' ? 'play' : 'pass', 0)
  if (outcome.state.status === 'finished') await ensureProgress(db, gameId)
  return { ok: true }
}

async function tick(db: SupabaseClient, userId: string, gameId: string) {
  const game = await loadGame(db, gameId)
  if (game.status !== 'playing') return { ok: true, status: game.status }
  await seatOf(db, gameId, userId) // only players at the table can nudge it

  const { hand, state } = await loadHand(db, game)
  if (!hand || hand.status === 'finished' || state === null) {
    await ensureProgress(db, gameId)
    return { ok: true }
  }
  if (!hand.turn_deadline || Date.parse(hand.turn_deadline) + DEADLINE_GRACE_MS > Date.now()) {
    return { ok: true, waiting: true }
  }

  const seat = hand.turn_seat as Seat
  const { data: player } = await db
    .from('game_players')
    .select('user_id, team, consecutive_timeouts')
    .eq('game_id', gameId)
    .eq('seat', seat)
    .single()
  if (!player) throw new GameError('seat_not_found', 500)
  const timeouts = player.consecutive_timeouts + 1

  if (timeouts >= ABANDON_TIMEOUTS) {
    if (game.hand_no <= 1) {
      const { error } = await db.rpc('cancel_game_first_hand_abandon', { p_game: gameId, p_leaver: player.user_id })
      if (error && !/game_not_playing/.test(error.message)) throw error
    } else {
      const { error } = await db.rpc('finish_game', {
        p_game: gameId,
        p_winner_team: 1 - player.team,
        p_reason: 'abandoned',
      })
      if (error) throw error
    }
    return { ok: true, abandoned: seat }
  }

  const move = autoMove(state, seat)
  const outcome = applyMove(state, seat, move, ruleConfig(game))
  if (!outcome.ok) throw new GameError(outcome.error, 500)
  await persist(db, hand, seat, move, outcome.state, move.type === 'play' ? 'timeout_play' : 'timeout_pass', timeouts)
  if (outcome.state.status === 'finished') await ensureProgress(db, gameId)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Progress: deal the next hand or finish the game. Safe to call repeatedly.
// ---------------------------------------------------------------------------

async function ensureProgress(db: SupabaseClient, gameId: string) {
  const game = await loadGame(db, gameId)
  if (game.status !== 'playing') return
  const { hand } = await loadHand(db, game)
  const players = game.players as PlayerCount

  if (!hand) {
    await dealHand(db, game, true, 0)
    return
  }
  if (hand.status !== 'finished') return

  // Scores were already added atomically by save_move when the hand finished.
  const scores: [number, number] = [game.score_team0, game.score_team1]
  const winnerTeam = scores[0] >= game.target_points ? 0 : scores[1] >= game.target_points ? 1 : null
  if (winnerTeam !== null) {
    const { error } = await db.rpc('finish_game', { p_game: gameId, p_winner_team: winnerTeam, p_reason: 'target_reached' })
    if (error) throw error
    return
  }
  await dealHand(db, game, false, nextHandStarter(hand.starter_seat as Seat, players))
}

async function dealHand(db: SupabaseClient, game: GameRow, isFirstHand: boolean, fallbackStarter: Seat) {
  const { hands } = deal(game.max_pip as MaxPip, secureRandom, game.players as PlayerCount)
  const { starter, requiredOpening } = findOpening(hands, isFirstHand, fallbackStarter)
  const { error } = await db.rpc('save_new_hand', {
    p_game: game.id,
    p_starter: starter,
    p_required_opening: requiredOpening,
    p_tiles: hands,
  })
  // Another request dealt it first: nothing to do.
  if (error && !/hand_in_progress|duplicate key/.test(error.message)) throw error
}

// ---------------------------------------------------------------------------
// Loading and persisting
// ---------------------------------------------------------------------------

async function loadGame(db: SupabaseClient, gameId: string): Promise<GameRow> {
  const { data } = await db
    .from('games')
    .select('id, status, players, max_pip, target_points, scoring, score_team0, score_team1, hand_no')
    .eq('id', gameId)
    .maybeSingle()
  if (!data) throw new GameError('game_not_found', 404)
  return data as GameRow
}

async function seatOf(db: SupabaseClient, gameId: string, userId: string): Promise<Seat> {
  const { data } = await db.from('game_players').select('seat').eq('game_id', gameId).eq('user_id', userId).maybeSingle()
  if (!data) throw new GameError('not_in_game', 403)
  return data.seat as Seat
}

async function loadHand(db: SupabaseClient, game: GameRow): Promise<{ hand: HandRow | null; state: HandState | null }> {
  const { data: hand } = await db
    .from('hands')
    .select(
      'id, hand_no, starter_seat, turn_seat, board, left_end, right_end, passes_in_row, required_opening, status, result, turn_deadline, version',
    )
    .eq('game_id', game.id)
    .order('hand_no', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!hand) return { hand: null, state: null }

  const { data: tiles } = await db.from('hand_tiles').select('seat, tiles').eq('hand_id', hand.id).order('seat')
  if (!tiles || tiles.length !== game.players) return { hand: hand as HandRow, state: null }

  const row = hand as HandRow
  const state: HandState = {
    hands: tiles.map((t) => t.tiles as Tile[]),
    board: row.board,
    ends: row.left_end === null || row.right_end === null ? null : { left: row.left_end, right: row.right_end },
    turn: row.turn_seat as Seat,
    starter: row.starter_seat as Seat,
    requiredOpening: row.required_opening,
    passesInRow: row.passes_in_row,
    status: row.status,
    result: row.result,
  }
  return { hand: row, state }
}

async function persist(
  db: SupabaseClient,
  hand: HandRow,
  seat: Seat,
  move: Move,
  next: HandState,
  kind: 'play' | 'pass' | 'timeout_play' | 'timeout_pass',
  timeouts: number,
) {
  const { data: saved, error } = await db.rpc('save_move', {
    p_hand: hand.id,
    p_expected_version: hand.version,
    p_seat: seat,
    p_kind: kind,
    p_tile: move.type === 'play' ? move.tile : null,
    p_side: move.type === 'play' ? move.side : null,
    p_state: {
      turn_seat: next.turn,
      board: next.board,
      left_end: next.ends?.left ?? null,
      right_end: next.ends?.right ?? null,
      tile_counts: next.hands.map((h) => h.length),
      passes_in_row: next.passesInRow,
      status: next.status,
      result: next.result,
    },
    p_seat_tiles: move.type === 'play' ? next.hands[seat] : null,
    p_timeouts: timeouts,
  })
  if (error) throw error
  if (!saved) throw new GameError('conflict', 409)
}
