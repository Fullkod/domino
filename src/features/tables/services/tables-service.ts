import { FunctionsHttpError } from '@supabase/supabase-js'
import type { PlacedTile, Side, Tile } from '@engine/types'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/shared/types/database'

type Tables = Database['public']['Tables']
export type GameTable = Tables['game_tables']['Row']
export type Template = Tables['table_templates']['Row']
export type Game = Tables['games']['Row']

function db() {
  return createClient()
}

function must<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error
  return result.data
}

export async function getMySeat(userId: string) {
  return must(await db().from('table_seats').select('table_id, seat').eq('user_id', userId).maybeSingle())
}

export async function joinTable(templateId: string): Promise<string> {
  const rows = must(await db().rpc('join_table', { p_template: templateId })) ?? []
  if (!rows[0]) throw new Error('table_not_available')
  return rows[0].joined_table_id
}

export async function leaveTable() {
  must(await db().rpc('leave_table'))
}

export async function setReady(ready: boolean) {
  must(await db().rpc('set_ready', { p_ready: ready }))
}

// ---------------------------------------------------------------------------
// Table + game view (everything a seated player may see; RLS hides other hands)
// ---------------------------------------------------------------------------

export interface SeatView {
  seat: number
  userId: string
  name: string
  ready: boolean
}

export interface PlayerView {
  seat: number
  userId: string
  name: string
  team: number
  payout: number
  refunded: boolean
}

export interface HandView {
  id: string
  handNo: number
  turnSeat: number
  starterSeat: number
  board: PlacedTile[]
  ends: { left: number; right: number } | null
  tileCounts: number[]
  requiredOpening: Tile | null
  status: 'playing' | 'finished'
  result: { kind: 'domino' | 'blocked' | 'void'; winnerTeam: number | null; winnerSeat: number | null; points: number } | null
  turnDeadline: string | null
  /** Optimistic-lock counter of the row; a higher version is newer state. */
  version: number
  /** First tile of the hand (centre of the drawn board); null while unknown. */
  openingTile: Tile | null
}

export interface TableView {
  table: GameTable
  template: Template
  seats: SeatView[]
  game: Game | null
  players: PlayerView[]
  hand: HandView | null
  myTiles: Tile[]
}

export async function loadTableView(tableId: string, userId: string): Promise<TableView | null> {
  const table = must(await db().from('game_tables').select('*').eq('id', tableId).maybeSingle())
  if (!table) return null

  const [template, seats, game] = await Promise.all([
    db().from('table_templates').select('*').eq('id', table.template_id).single(),
    db().from('table_seats').select('seat, user_id, is_ready, profiles(display_name)').eq('table_id', tableId).order('seat'),
    table.current_game_id
      ? db().from('games').select('*').eq('id', table.current_game_id).single()
      : Promise.resolve({ data: null, error: null }),
  ])

  const view: TableView = {
    table,
    template: must(template) as Template,
    seats: (must(seats) ?? []).map((s) => ({
      seat: s.seat,
      userId: s.user_id,
      name: (s.profiles as { display_name: string } | null)?.display_name ?? '—',
      ready: s.is_ready,
    })),
    game: must(game),
    players: [],
    hand: null,
    myTiles: [],
  }
  if (!view.game) return view

  const [players, hand] = await Promise.all([
    db()
      .from('game_players')
      .select('seat, user_id, team, payout, refunded, profiles(display_name)')
      .eq('game_id', view.game.id)
      .order('seat'),
    db().from('hands').select('*').eq('game_id', view.game.id).order('hand_no', { ascending: false }).limit(1).maybeSingle(),
  ])
  view.players = (must(players) ?? []).map((p) => ({
    seat: p.seat,
    userId: p.user_id,
    name: (p.profiles as { display_name: string } | null)?.display_name ?? '—',
    team: p.team ?? p.seat % 2,
    payout: p.payout,
    refunded: p.refunded,
  }))

  const h = must(hand)
  if (h) {
    view.hand = toHandView(h)
    const me = view.players.find((p) => p.userId === userId)
    const [mine, opening] = await Promise.all([
      // RLS only returns the caller's own row.
      me
        ? db().from('hand_tiles').select('tiles').eq('hand_id', h.id).eq('seat', me.seat).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      view.hand.board.length > 0 ? loadOpeningTile(h.id) : Promise.resolve(null),
    ])
    view.myTiles = ((must(mine)?.tiles ?? []) as unknown as Tile[]).slice()
    view.hand.openingTile = opening
  }
  return view
}

type HandRow = Tables['hands']['Row']

/** Maps a `hands` row (from a query or a Realtime payload) to the client view. */
export function toHandView(h: HandRow, openingTile: Tile | null = null): HandView {
  return {
    id: h.id,
    handNo: h.hand_no,
    turnSeat: h.turn_seat,
    starterSeat: h.starter_seat,
    board: (h.board ?? []) as unknown as PlacedTile[],
    ends: h.left_end === null || h.right_end === null ? null : { left: h.left_end, right: h.right_end },
    tileCounts: h.tile_counts,
    requiredOpening: h.required_opening as unknown as Tile | null,
    status: h.status as HandView['status'],
    result: h.result as unknown as HandView['result'],
    turnDeadline: h.turn_deadline,
    version: h.version,
    openingTile,
  }
}

// The opening tile never changes during a hand: fetched once per hand.
const openingCache = new Map<string, Tile>()

async function loadOpeningTile(handId: string): Promise<Tile | null> {
  const cached = openingCache.get(handId)
  if (cached) return cached
  const { data } = await db()
    .from('moves')
    .select('tile')
    .eq('hand_id', handId)
    .in('kind', ['play', 'timeout_play'])
    .order('seq')
    .limit(1)
    .maybeSingle()
  const tile = (data?.tile ?? null) as unknown as Tile | null
  if (tile) openingCache.set(handId, tile)
  return tile
}

export interface TableListeners {
  /** Something at the table changed: reload the view. */
  onChange: () => void
  /** A hand row of the current game was inserted or updated (applied before the reload). */
  onHand?: (row: HandRow) => void
  /** The caller's own tiles changed (RLS only delivers the caller's rows). */
  onTiles?: (row: { hand_id: string; seat: number; tiles: Tile[] }) => void
}

/**
 * Calls the listeners whenever anything visible at the table changes. Hand and tile payloads
 * are handed over as they arrive so the board updates without waiting for a reload.
 * Resubscribe when the current game changes so hand updates are filtered to that game.
 */
export function subscribeTable(tableId: string, gameId: string | null, listeners: TableListeners): () => void {
  const { onChange, onHand, onTiles } = listeners
  const supabase = db()
  let channel = supabase
    .channel(`table:${tableId}:${gameId ?? 'none'}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_tables', filter: `id=eq.${tableId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'table_seats', filter: `table_id=eq.${tableId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `table_id=eq.${tableId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hand_tiles' }, (payload) => {
      const row = payload.new as { hand_id?: string; seat?: number; tiles?: unknown }
      if (onTiles && row?.hand_id && typeof row.seat === 'number' && Array.isArray(row.tiles)) {
        onTiles({ hand_id: row.hand_id, seat: row.seat, tiles: row.tiles as Tile[] })
      }
      onChange()
    })
  if (gameId) {
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'hands', filter: `game_id=eq.${gameId}` },
      (payload) => {
        const row = payload.new as Partial<HandRow> | null
        if (onHand && row?.id) onHand(row as HandRow)
        onChange()
      },
    )
  }
  channel.subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}

// ---------------------------------------------------------------------------
// Game server (Edge Function `game-action`)
// ---------------------------------------------------------------------------

type GameAction =
  | { action: 'start'; tableId: string }
  | { action: 'play'; gameId: string; tile: Tile; side: Side }
  | { action: 'pass'; gameId: string }
  | { action: 'tick'; gameId: string }

export async function gameAction(body: GameAction): Promise<Record<string, unknown>> {
  const { data, error } = await db().functions.invoke('game-action', { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = (await error.context.json().catch(() => null)) as { error?: string } | null
      throw new Error(payload?.error ?? 'server_error')
    }
    throw error
  }
  return (data ?? {}) as Record<string, unknown>
}
