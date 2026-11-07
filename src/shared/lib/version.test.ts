import { describe, expect, it } from 'vitest'
import { compareVersions } from './version'

describe('compareVersions', () => {
  it('compares numerically, not as text', () => {
    expect(compareVersions('0.1.10', '0.1.9')).toBe(1)
    expect(compareVersions('0.1.9', '0.1.10')).toBe(-1)
  })
  it('treats missing parts as zero', () => {
    expect(compareVersions('1.0', '1.0.0')).toBe(0)
    expect(compareVersions('1', '0.9.9')).toBe(1)
  })
  it('ignores garbage parts', () => {
    expect(compareVersions('0.1.x', '0.1.0')).toBe(0)
  })
})
