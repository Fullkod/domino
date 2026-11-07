import { describe, expect, it } from 'vitest'
import { layoutChain, layoutChainAt, type LaidTile, type OrientedPips } from './board-layout'

/** A valid chain: each tile's right value equals the next tile's left value. */
function chain(values: number[]): OrientedPips[] {
  const out: OrientedPips[] = []
  for (let i = 0; i + 1 < values.length; i++) out.push([values[i], values[i + 1]])
  return out
}

interface HalfRect {
  x: number
  y: number
  s: number
  value: number
}

function halves(t: LaidTile): [HalfRect, HalfRect] {
  const s = Math.min(t.w, t.h)
  return t.vertical
    ? [
        { x: t.x, y: t.y, s, value: t.first },
        { x: t.x, y: t.y + s, s, value: t.second },
      ]
    : [
        { x: t.x, y: t.y, s, value: t.first },
        { x: t.x + s, y: t.y, s, value: t.second },
      ]
}

/** Two squares share part of an edge. */
function touching(p: HalfRect, q: HalfRect): boolean {
  const eps = 1e-6
  const overlapX = Math.min(p.x + p.s, q.x + q.s) - Math.max(p.x, q.x)
  const overlapY = Math.min(p.y + p.s, q.y + q.s) - Math.max(p.y, q.y)
  const sideBySide = Math.abs(overlapX) < eps && overlapY > eps
  const stacked = Math.abs(overlapY) < eps && overlapX > eps
  return sideBySide || stacked
}

function overlaps(p: LaidTile, q: LaidTile): boolean {
  const eps = 1e-6
  return (
    Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x) > eps &&
    Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y) > eps
  )
}

function check(board: OrientedPips[], opening: number, width: number, half: number) {
  const { tiles, height } = layoutChainAt(board, opening, width, half)
  expect(tiles).toHaveLength(board.length)
  tiles.forEach((t, i) => {
    expect(t.index).toBe(i)
    expect(t.x).toBeGreaterThanOrEqual(0)
    expect(t.x + t.w).toBeLessThanOrEqual(width)
    expect(t.y).toBeGreaterThanOrEqual(0)
    expect(t.y + t.h).toBeLessThanOrEqual(height + 1e-6)
    // Same pips as on the board, whatever the drawing direction.
    expect([t.first, t.second].sort()).toEqual([board[i][0], board[i][1]].sort())
  })
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) expect(overlaps(tiles[i], tiles[j]), `tiles ${i} and ${j} overlap`).toBe(false)
  }
  // Neighbours touch through the matching halves.
  for (let i = 0; i + 1 < tiles.length; i++) {
    const value = board[i][1]
    const a = halves(tiles[i]).filter((h) => h.value === value)
    const b = halves(tiles[i + 1]).filter((h) => h.value === value)
    expect(
      a.some((p) => b.some((q) => touching(p, q))),
      `tiles ${i} and ${i + 1} are not joined by ${value}`,
    ).toBe(true)
  }
}

describe('layoutChainAt', () => {
  const long = chain([3, 5, 5, 2, 6, 6, 1, 4, 4, 0, 3, 3, 6, 2, 2, 5, 1, 1, 0, 6, 4, 2, 0, 0, 5, 4, 3, 1])

  it('keeps a short chain on one line', () => {
    const board = chain([1, 2, 3, 4])
    const { tiles } = layoutChainAt(board, 1, 400, 20)
    expect(new Set(tiles.map((t) => t.y + t.h / 2)).size).toBe(1)
    check(board, 1, 400, 20)
  })

  it('snakes a long chain without overlaps and with joined neighbours', () => {
    for (const opening of [0, 5, 13, long.length - 1]) {
      for (const width of [300, 360, 420]) check(long, opening, width, 20)
    }
  })

  it('handles a double opening and doubles at the turns', () => {
    const board = chain([6, 6, 6, 3, 3, 3, 3, 1, 1, 1, 1, 5, 5, 5, 5, 2, 2, 2, 2, 0, 0, 0, 0, 4, 4])
    for (let opening = 0; opening < board.length; opening += 3) {
      for (const width of [220, 300, 360]) check(board, opening, width, 18)
    }
  })

  it('turns down on the right arm and up on the left arm', () => {
    const board = chain([0, 1, 2, 3, 4, 5, 6, 0, 2, 4, 6, 1, 3, 5, 0, 3, 6, 2, 5, 1, 4, 0, 4, 1])
    const opening = 11
    const { tiles } = layoutChainAt(board, opening, 300, 20)
    const centre = tiles[opening].y + tiles[opening].h / 2
    expect(tiles[board.length - 1].y).toBeGreaterThan(centre)
    expect(tiles[0].y + tiles[0].h).toBeLessThan(centre)
  })
})

describe('layoutChain', () => {
  it('shrinks the tiles to respect the maximum height', () => {
    const board = chain(Array.from({ length: 41 }, (_, i) => (i * 7) % 10))
    const layout = layoutChain(board, 20, 340, { maxHeight: 260 })
    expect(layout.height).toBeLessThanOrEqual(260)
    expect(layout.half).toBeLessThan(22)
  })
})
