import { describe, expect, it } from 'vitest'
import { timeAgo } from './time'

describe('timeAgo', () => {
  const now = Date.parse('2026-11-07T20:00:00Z')
  const ago = (ms: number) => new Date(now - ms).toISOString()

  it('uses the largest whole unit', () => {
    expect(timeAgo(ago(20_000), now)).toBe('ahora')
    expect(timeAgo(ago(5 * 60_000), now)).toBe('hace 5 min')
    expect(timeAgo(ago(2 * 3_600_000 + 59 * 60_000), now)).toBe('hace 2 h')
    expect(timeAgo(ago(26 * 3_600_000), now)).toBe('hace 1 día')
    expect(timeAgo(ago(3 * 86_400_000), now)).toBe('hace 3 días')
    expect(timeAgo(ago(65 * 86_400_000), now)).toBe('hace 2 meses')
    expect(timeAgo(ago(800 * 86_400_000), now)).toBe('hace 2 años')
  })

  it('treats future dates (clock skew) as now', () => {
    expect(timeAgo(new Date(now + 30_000).toISOString(), now)).toBe('ahora')
  })
})
