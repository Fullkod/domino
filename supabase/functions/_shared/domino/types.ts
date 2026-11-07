// Pure domain types for the domino engine. No runtime dependencies so the same
// files run in the Edge Function (Deno) and in the app (Next.js / Vitest).
// Business rules: BUSINESS_LOGIC.md §5.

export type Seat = 0 | 1 | 2 | 3
/**
 * Seats 0 and 2 are team 0; seats 1 and 3 are team 1 (partners sit opposite).
 * One-vs-one uses seats 0 and 1 only, so each player is its own team.
 */
export type Team = 0 | 1
/** Pairs (4 players) or one-vs-one (2 players). Derived from the number of dealt hands. */
export type PlayerCount = 2 | 4
/** A tile is stored normalized: low pip first. */
export type Tile = readonly [number, number]
export type Side = 'left' | 'right'

export type MaxPip = 6 | 9
export type ScoringMode = 'all_hands' | 'opponents'

export interface RuleConfig {
  maxPip: MaxPip
  targetPoints: number
  scoring: ScoringMode
}

export interface PlacedTile {
  tile: Tile
  seat: Seat
  /** Pips in board order, left to right, as they lie on the table. */
  oriented: readonly [number, number]
}

export type Move = { type: 'play'; tile: Tile; side: Side } | { type: 'pass' }

export type HandEndKind = 'domino' | 'blocked' | 'void'

export interface HandResult {
  kind: HandEndKind
  /** null when the hand is void (blocked tie between teams). */
  winnerTeam: Team | null
  /** Seat that dominated, or lowest-count seat on a blocked hand. */
  winnerSeat: Seat | null
  points: number
}

export interface HandState {
  /** Per-seat hands. Server-only: never send other seats' tiles to a client. */
  hands: Tile[][]
  board: PlacedTile[]
  ends: { left: number; right: number } | null
  turn: Seat
  starter: Seat
  /** Tile the starter is forced to open with (first hand of a game), if any. */
  requiredOpening: Tile | null
  passesInRow: number
  status: 'playing' | 'finished'
  result: HandResult | null
}

export type MoveError =
  | 'hand_finished'
  | 'not_your_turn'
  | 'tile_not_in_hand'
  | 'tile_does_not_fit'
  | 'must_play_opening'
  | 'cannot_pass_with_legal_move'

export type MoveOutcome = { ok: true; state: HandState } | { ok: false; error: MoveError }

export interface GameScore {
  scores: [number, number]
  finished: boolean
  winnerTeam: Team | null
}
