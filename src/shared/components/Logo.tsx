import { BRAND } from '@/shared/constants/brand'

// Brand logos (brand manual §04): on dark backgrounds the hand goes without its square.
// Plain <img>: static export, the SVGs are already optimal.
const FILES = {
  horizontal: { src: '/brand/domino-horizontal-reversed.svg', ratio: 1112 / 220 },
  stacked: { src: '/brand/domino-stacked-reversed.svg', ratio: 375 / 378 },
  symbol: { src: '/brand/domino-symbol-reversed.svg', ratio: 1 },
} as const

export function Logo({ variant = 'horizontal', height }: { variant?: keyof typeof FILES; height: number }) {
  const { src, ratio } = FILES[variant]
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={BRAND.appName} height={height} width={Math.round(height * ratio)} className="block" />
  )
}
