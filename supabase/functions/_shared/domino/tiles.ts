import type { MaxPip, PlayerCount, Seat, Team, Tile } from './types.ts'

export const SEATS: readonly Seat[] = [0, 1, 2, 3]
const ONE_VS_ONE_SEATS: readonly Seat[] = [0, 1]

export function seatsFor(players: PlayerCount): readonly Seat[] {
  return players === 2 ? ONE_VS_ONE_SEATS : SEATS
}

/** Number of players at the table, from the per-seat hands. */
export function playerCount(hands: readonly (readonly Tile[])[]): PlayerCount {
  if (hands.length !== 2 && hands.length !== 4) throw new Error(`unsupported player count: ${hands.length}`)
  return hands.length as PlayerCount
}

export function teamOf(seat: Seat): Team {
  return (seat % 2) as Team
}

export function nextSeat(seat: Seat, players: PlayerCount = 4): Seat {
  return ((seat + 1) % players) as Seat
}

/** Tiles dealt to each player (any table size): 7 with double-six, 10 with double-nine. */
export function handSize(maxPip: MaxPip): number {
  return maxPip === 6 ? 7 : 10
}

export function normalize(a: number, b: number): Tile {
  return a <= b ? [a, b] : [b, a]
}

export function sameTile(x: Tile, y: Tile): boolean {
  return x[0] === y[0] && x[1] === y[1]
}

export function isDouble(tile: Tile): boolean {
  return tile[0] === tile[1]
}

export function pips(tile: Tile): number {
  return tile[0] + tile[1]
}

export function handPips(hand: readonly Tile[]): number {
  return hand.reduce((sum, tile) => sum + pips(tile), 0)
}

/** Full set: 28 tiles for double-six, 55 for double-nine. */
export function tileSet(maxPip: MaxPip): Tile[] {
  const tiles: Tile[] = []
  for (let a = 0; a <= maxPip; a++) {
    for (let b = a; b <= maxPip; b++) tiles.push([a, b])
  }
  return tiles
}

/** Fisher–Yates. `random` returns [0, 1); inject a seeded one in tests. */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export interface Deal {
  hands: Tile[][]
  /** Tiles left face down. They are never drawn (BUSINESS_LOGIC.md §5.1). */
  undealt: Tile[]
}

export function deal(maxPip: MaxPip, random: () => number, players: PlayerCount = 4): Deal {
  const deck = shuffle(tileSet(maxPip), random)
  const size = handSize(maxPip)
  const hands = seatsFor(players).map((seat) => deck.slice(seat * size, (seat + 1) * size))
  return { hands, undealt: deck.slice(players * size) }
}
