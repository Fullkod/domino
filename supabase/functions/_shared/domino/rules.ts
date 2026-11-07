import { handPips, isDouble, nextSeat, pips, playerCount, sameTile, seatsFor, teamOf } from './tiles.ts'
import type {
  GameScore,
  HandResult,
  HandState,
  Move,
  MoveOutcome,
  PlayerCount,
  RuleConfig,
  Seat,
  Side,
  Team,
  Tile,
} from './types.ts'

/**
 * Who opens a hand (BUSINESS_LOGIC.md §5.1).
 * First hand of a game: the holder of the highest double, forced to open with it;
 * if nobody holds a double, `fallbackStarter` opens freely.
 * Later hands: `fallbackStarter` (the caller rotates it) opens freely.
 */
export function findOpening(
  hands: readonly (readonly Tile[])[],
  isFirstHand: boolean,
  fallbackStarter: Seat,
): { starter: Seat; requiredOpening: Tile | null } {
  if (!isFirstHand) return { starter: fallbackStarter, requiredOpening: null }

  let best: { seat: Seat; tile: Tile } | null = null
  for (const seat of seatsFor(playerCount(hands))) {
    for (const tile of hands[seat]) {
      if (isDouble(tile) && (best === null || tile[0] > best.tile[0])) best = { seat, tile }
    }
  }
  return best
    ? { starter: best.seat, requiredOpening: best.tile }
    : { starter: fallbackStarter, requiredOpening: null }
}

export function startHand(hands: Tile[][], starter: Seat, requiredOpening: Tile | null): HandState {
  if (starter >= playerCount(hands)) throw new Error(`starter ${starter} is not at the table`)
  return {
    hands: hands.map((hand) => [...hand]),
    board: [],
    ends: null,
    turn: starter,
    starter,
    requiredOpening,
    passesInRow: 0,
    status: 'playing',
    result: null,
  }
}

function fits(tile: Tile, end: number): boolean {
  return tile[0] === end || tile[1] === end
}

export function legalMoves(state: HandState, seat: Seat): Move[] {
  if (state.status !== 'playing' || state.turn !== seat) return []
  const hand = state.hands[seat]

  if (state.ends === null) {
    const openers = state.requiredOpening
      ? hand.filter((tile) => sameTile(tile, state.requiredOpening!))
      : hand
    return openers.map((tile) => ({ type: 'play', tile, side: 'left' }))
  }

  const moves: Move[] = []
  for (const tile of hand) {
    if (fits(tile, state.ends.left)) moves.push({ type: 'play', tile, side: 'left' })
    // Same tile on the other end only adds a choice when the result differs.
    if (fits(tile, state.ends.right) && !(state.ends.left === state.ends.right && fits(tile, state.ends.left))) {
      moves.push({ type: 'play', tile, side: 'right' })
    }
  }
  return moves.length > 0 ? moves : [{ type: 'pass' }]
}

export function canPlay(state: HandState, seat: Seat): boolean {
  return legalMoves(state, seat).some((move) => move.type === 'play')
}

function scoreHand(
  hands: readonly (readonly Tile[])[],
  winnerTeam: Team,
  scoring: RuleConfig['scoring'],
): number {
  return seatsFor(playerCount(hands)).filter((seat) => scoring === 'all_hands' || teamOf(seat) !== winnerTeam).reduce(
    (sum: number, seat) => sum + handPips(hands[seat]),
    0,
  )
}

/** Blocked hand: the side of the lowest-count player wins; a tie across sides voids it. */
function resolveBlocked(hands: readonly (readonly Tile[])[], scoring: RuleConfig['scoring']): HandResult {
  const seats = seatsFor(playerCount(hands))
  const counts = seats.map((seat) => handPips(hands[seat]))
  const lowest = Math.min(...counts)
  const lowestSeats = seats.filter((seat) => counts[seat] === lowest)
  const teams = new Set(lowestSeats.map(teamOf))
  if (teams.size > 1) return { kind: 'void', winnerTeam: null, winnerSeat: null, points: 0 }

  const winnerSeat = lowestSeats[0]
  const winnerTeam = teamOf(winnerSeat)
  return { kind: 'blocked', winnerTeam, winnerSeat, points: scoreHand(hands, winnerTeam, scoring) }
}

function place(state: HandState, seat: Seat, tile: Tile, side: Side): HandState {
  const hands = state.hands.map((hand, i) => (i === seat ? hand.filter((t) => !sameTile(t, tile)) : hand))

  let oriented: [number, number]
  let ends: { left: number; right: number }
  if (state.ends === null) {
    oriented = [tile[0], tile[1]]
    ends = { left: tile[0], right: tile[1] }
  } else if (side === 'left') {
    const outer = tile[0] === state.ends.left ? tile[1] : tile[0]
    oriented = [outer, state.ends.left]
    ends = { left: outer, right: state.ends.right }
  } else {
    const outer = tile[0] === state.ends.right ? tile[1] : tile[0]
    oriented = [state.ends.right, outer]
    ends = { left: state.ends.left, right: outer }
  }

  const placed = { tile, seat, oriented }
  const board = side === 'left' && state.ends !== null ? [placed, ...state.board] : [...state.board, placed]
  return { ...state, hands, board, ends, requiredOpening: null, passesInRow: 0 }
}

/**
 * Validates and applies one move. Never mutates `state`.
 * The server is the only caller allowed to persist the result (BUSINESS_LOGIC.md §5.6).
 */
export function applyMove(state: HandState, seat: Seat, move: Move, config: RuleConfig): MoveOutcome {
  if (state.status !== 'playing') return { ok: false, error: 'hand_finished' }
  if (state.turn !== seat) return { ok: false, error: 'not_your_turn' }
  const players = playerCount(state.hands)

  if (move.type === 'pass') {
    if (canPlay(state, seat)) return { ok: false, error: 'cannot_pass_with_legal_move' }
    const passesInRow = state.passesInRow + 1
    if (passesInRow >= players) {
      return {
        ok: true,
        state: { ...state, passesInRow, status: 'finished', result: resolveBlocked(state.hands, config.scoring) },
      }
    }
    return { ok: true, state: { ...state, passesInRow, turn: nextSeat(seat, players) } }
  }

  const { tile, side } = move
  if (!state.hands[seat].some((t) => sameTile(t, tile))) return { ok: false, error: 'tile_not_in_hand' }
  if (state.ends === null) {
    if (state.requiredOpening && !sameTile(tile, state.requiredOpening)) {
      return { ok: false, error: 'must_play_opening' }
    }
  } else if (!fits(tile, side === 'left' ? state.ends.left : state.ends.right)) {
    return { ok: false, error: 'tile_does_not_fit' }
  }

  const next = place(state, seat, tile, side)
  if (next.hands[seat].length === 0) {
    const winnerTeam = teamOf(seat)
    const result: HandResult = {
      kind: 'domino',
      winnerTeam,
      winnerSeat: seat,
      points: scoreHand(next.hands, winnerTeam, config.scoring),
    }
    return { ok: true, state: { ...next, status: 'finished', result } }
  }
  return { ok: true, state: { ...next, turn: nextSeat(seat, players) } }
}

/**
 * Move played by the server when a turn times out (BUSINESS_LOGIC.md §5.5):
 * pass if there is no play, otherwise the highest-scoring playable tile.
 */
export function autoMove(state: HandState, seat: Seat): Move {
  const plays = legalMoves(state, seat).filter((move): move is PlayMove => move.type === 'play')
  if (plays.length === 0) return { type: 'pass' }
  return plays.reduce((best, move) => (pips(move.tile) > pips(best.tile) ? move : best))
}

type PlayMove = Extract<Move, { type: 'play' }>

/** Adds a finished hand to the game score and tells whether the game is over. */
export function addHandToScore(scores: readonly [number, number], result: HandResult, config: RuleConfig): GameScore {
  const next: [number, number] = [scores[0], scores[1]]
  if (result.winnerTeam !== null) next[result.winnerTeam] += result.points

  const winnerTeam: Team | null =
    next[0] >= config.targetPoints ? 0 : next[1] >= config.targetPoints ? 1 : null
  return { scores: next, finished: winnerTeam !== null, winnerTeam }
}

/** Later hands rotate the opener by one seat. */
export function nextHandStarter(previousStarter: Seat, players: PlayerCount = 4): Seat {
  return nextSeat(previousStarter, players)
}

/** What a given seat may see: its own tiles and only the tile counts of the others. */
export function viewFor(state: HandState, seat: Seat) {
  return {
    myTiles: state.hands[seat],
    tileCounts: state.hands.map((hand) => hand.length),
    board: state.board,
    ends: state.ends,
    turn: state.turn,
    status: state.status,
    result: state.result,
  }
}
