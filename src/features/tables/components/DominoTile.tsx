// A domino tile drawn with pips on a 3×3 grid (values 0–9).
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

function Half({ value, size }: { value: number; size: 'sm' | 'md' }) {
  const dot = size === 'sm' ? 'h-1 w-1' : 'h-1.5 w-1.5'
  const box = size === 'sm' ? 'h-5 w-5 p-0.5' : 'h-8 w-8 p-1'
  return (
    <span className={`grid grid-cols-3 grid-rows-3 place-items-center ${box}`} aria-hidden>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={`${dot} rounded-full ${PIPS[value]?.includes(i) ? 'bg-neutral-900' : ''}`} />
      ))}
    </span>
  )
}

export function DominoTile({
  a,
  b,
  orientation = 'vertical',
  size = 'md',
  selected = false,
  disabled = false,
  onClick,
}: {
  a: number
  b: number
  orientation?: 'vertical' | 'horizontal'
  size?: 'sm' | 'md'
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  const vertical = orientation === 'vertical'
  const className = `inline-flex ${vertical ? 'flex-col' : 'flex-row'} items-center rounded-md border bg-neutral-100 shadow ${
    selected ? 'border-emerald-400 ring-2 ring-emerald-400 -translate-y-2' : 'border-neutral-300'
  } ${disabled ? 'opacity-40' : ''} transition`
  const divider = <span className={vertical ? 'h-px w-4/5 bg-neutral-400' : 'h-4/5 w-px self-stretch bg-neutral-400'} />
  const content = (
    <>
      <Half value={a} size={size} />
      {divider}
      <Half value={b} size={size} />
    </>
  )
  const label = `Ficha ${a}-${b}`
  if (!onClick) {
    return (
      <span className={className} role="img" aria-label={label}>
        {content}
      </span>
    )
  }
  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={selected}>
      {content}
    </button>
  )
}

/** Face-down tile count for other players. */
export function HiddenTiles({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-neutral-800 px-2 py-1 text-xs text-neutral-300">
      <span className="h-4 w-2.5 rounded-sm border border-neutral-500 bg-neutral-700" />
      {count}
    </span>
  )
}
