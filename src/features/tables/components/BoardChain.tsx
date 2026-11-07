'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { layoutChain, type LaidTile, type OrientedPips } from '../lib/board-layout'

// Pip positions on a 3×3 grid (values 0–9), same as DominoTile.
const PIPS: Record<number, number[]> = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
  7: [0, 2, 3, 4, 5, 6, 8],
  8: [0, 1, 2, 3, 5, 6, 7, 8],
  9: [0, 1, 2, 3, 4, 5, 6, 7, 8],
}

function Pips({ x, y, size, value, vertical }: { x: number; y: number; size: number; value: number; vertical: boolean }) {
  return (
    <>
      {(PIPS[value] ?? []).map((cell) => {
        // Horizontal tiles turn the pattern a quarter so the 6 reads across the tile.
        const row = vertical ? Math.floor(cell / 3) : cell % 3
        const col = vertical ? cell % 3 : Math.floor(cell / 3)
        return (
          <circle
            key={cell}
            cx={x + size * (0.24 + 0.26 * col)}
            cy={y + size * (0.24 + 0.26 * row)}
            r={size * 0.085}
            fill="#171717"
          />
        )
      })}
    </>
  )
}

function Tile({ t, half, highlight }: { t: LaidTile; half: number; highlight: boolean }) {
  const inset = 0.75
  const [x2, y2] = t.vertical ? [t.x, t.y + half] : [t.x + half, t.y]
  return (
    <g className={highlight ? 'board-tile-new' : undefined}>
      <rect
        x={t.x + inset}
        y={t.y + inset}
        width={t.w - 2 * inset}
        height={t.h - 2 * inset}
        rx={half * 0.16}
        fill="#f5f5f5"
        stroke={highlight ? '#F2B705' : '#a3a3a3'}
        strokeWidth={highlight ? 2 : 1}
      />
      {t.vertical ? (
        <line x1={t.x + half * 0.18} x2={t.x + half * 0.82} y1={t.y + half} y2={t.y + half} stroke="#a3a3a3" strokeWidth={1} />
      ) : (
        <line x1={t.x + half} x2={t.x + half} y1={t.y + half * 0.18} y2={t.y + half * 0.82} stroke="#a3a3a3" strokeWidth={1} />
      )}
      <Pips x={t.x} y={t.y} size={half} value={t.first} vertical={t.vertical} />
      <Pips x={x2} y={y2} size={half} value={t.second} vertical={t.vertical} />
    </g>
  )
}

/**
 * The line of play drawn as on a real table: the opening tile in the middle, the chain turning
 * at the edges. `highlightIndex` marks the last tile played.
 */
export function BoardChain({
  board,
  openingIndex,
  highlightIndex,
}: {
  board: readonly OrientedPips[]
  openingIndex: number
  highlightIndex: number | null
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const layout = useMemo(() => (width > 0 ? layoutChain(board, openingIndex, width) : null), [board, openingIndex, width])

  return (
    <div ref={ref} className="w-full">
      {layout && (
        <svg
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          aria-label={`Mesa: ${board.map(([a, b]) => `${a}-${b}`).join(', ')}`}
          className="mx-auto block overflow-visible"
        >
          {layout.tiles.map((t) => (
            <Tile key={`${Math.min(t.first, t.second)}-${Math.max(t.first, t.second)}`} t={t} half={layout.half} highlight={t.index === highlightIndex} />
          ))}
        </svg>
      )}
    </div>
  )
}
