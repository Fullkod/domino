// Snake layout for the line of play, as tiles lie on a real table.
// The opening tile sits in the middle; the right arm grows to the right and turns downward at
// the edge, the left arm grows to the left and turns upward. Each turn is a vertical "corner"
// tile hanging from the last tile, so the direction of the chain is always visible.
// Pure (no imports) so it is easy to test.

/** Pips of a placed tile in board order, left to right (`PlacedTile.oriented`). */
export type OrientedPips = readonly [number, number]

export interface LaidTile {
  /** Index in the board array. */
  index: number
  x: number
  y: number
  w: number
  h: number
  vertical: boolean
  /** Top value when vertical, left value when horizontal. */
  first: number
  /** Bottom value when vertical, right value when horizontal. */
  second: number
}

export interface ChainLayout {
  tiles: LaidTile[]
  width: number
  height: number
  half: number
}

interface ArmTile {
  index: number
  /** Value touching the previous tile of the arm. */
  near: number
  far: number
}

function layArm(
  seq: ArmTile[],
  startX: number,
  startDir: 1 | -1,
  down: 1 | -1,
  openingIsDouble: boolean,
  width: number,
  half: number,
  margin: number,
  out: LaidTile[],
) {
  const H = half
  let x = startX
  let dir = startDir
  let y = 0
  let prevDouble = openingIsDouble
  for (const t of seq) {
    const double = t.near === t.far
    const w = double ? H : 2 * H
    const fits = dir > 0 ? x + w <= width - margin : x - w >= margin
    if (fits) {
      const left = dir > 0 ? x : x - w
      if (double) {
        out.push({ index: t.index, x: left, y: y - H, w: H, h: 2 * H, vertical: true, first: t.near, second: t.far })
      } else {
        out.push({
          index: t.index,
          x: left,
          y: y - H / 2,
          w: 2 * H,
          h: H,
          vertical: false,
          first: dir > 0 ? t.near : t.far,
          second: dir > 0 ? t.far : t.near,
        })
      }
      x += dir * w
      prevDouble = double
      continue
    }
    // Corner: a vertical tile hanging from the end of the row, then the row runs back.
    const offset = prevDouble ? H : H / 2
    const left = dir > 0 ? x - H : x
    const top = down > 0 ? y + offset : y - offset - 2 * H
    out.push({
      index: t.index,
      x: left,
      y: top,
      w: H,
      h: 2 * H,
      vertical: true,
      first: down > 0 ? t.near : t.far,
      second: down > 0 ? t.far : t.near,
    })
    y += down * (offset + 1.5 * H)
    x = dir > 0 ? left : left + H
    dir = dir > 0 ? -1 : 1
    prevDouble = false
  }
}

/** Lays out the chain for a given half-tile size. Coordinates start at (0, 0). */
export function layoutChainAt(
  board: readonly OrientedPips[],
  openingIndex: number,
  width: number,
  half: number,
  margin = 2,
): ChainLayout {
  const H = half
  if (board.length === 0) return { tiles: [], width, height: 0, half }
  const o = Math.min(Math.max(openingIndex, 0), board.length - 1)
  const [oa, ob] = board[o]
  const openingIsDouble = oa === ob
  const cx = width / 2
  const tiles: LaidTile[] = []
  if (openingIsDouble) {
    tiles.push({ index: o, x: cx - H / 2, y: -H, w: H, h: 2 * H, vertical: true, first: oa, second: ob })
  } else {
    tiles.push({ index: o, x: cx - H, y: -H / 2, w: 2 * H, h: H, vertical: false, first: oa, second: ob })
  }
  const ow = openingIsDouble ? H : 2 * H

  const right: ArmTile[] = []
  for (let i = o + 1; i < board.length; i++) right.push({ index: i, near: board[i][0], far: board[i][1] })
  const leftArm: ArmTile[] = []
  for (let i = o - 1; i >= 0; i--) leftArm.push({ index: i, near: board[i][1], far: board[i][0] })

  layArm(right, cx + ow / 2, 1, 1, openingIsDouble, width, H, margin, tiles)
  layArm(leftArm, cx - ow / 2, -1, -1, openingIsDouble, width, H, margin, tiles)

  const minY = Math.min(...tiles.map((t) => t.y))
  const maxY = Math.max(...tiles.map((t) => t.y + t.h))
  for (const t of tiles) t.y -= minY
  tiles.sort((p, q) => p.index - q.index)
  return { tiles, width, height: maxY - minY, half }
}

/**
 * Picks the largest tile size (from `maxHalf` down to `minHalf`) whose layout fits in
 * `maxHeight`; falls back to the smallest size.
 */
export function layoutChain(
  board: readonly OrientedPips[],
  openingIndex: number,
  width: number,
  { maxHalf = 22, minHalf = 12, maxHeight = 280 }: { maxHalf?: number; minHalf?: number; maxHeight?: number } = {},
): ChainLayout {
  // The width must hold a few tiles per row or the snake would only turn.
  const top = Math.max(minHalf, Math.min(maxHalf, Math.floor(width / 8)))
  let layout = layoutChainAt(board, openingIndex, width, top)
  for (let half = top - 1; half >= minHalf && layout.height > maxHeight; half--) {
    layout = layoutChainAt(board, openingIndex, width, half)
  }
  return layout
}
