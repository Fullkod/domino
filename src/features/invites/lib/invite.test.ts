import { describe, expect, it } from 'vitest'
import { cleanCode } from './invite'

describe('cleanCode', () => {
  it('accepts six letters or digits, in any case', () => {
    expect(cleanCode(' ab12cd ')).toBe('AB12CD')
  })
  it('rejects anything else', () => {
    expect(cleanCode('ABC')).toBeNull()
    expect(cleanCode('ABC-12')).toBeNull()
    expect(cleanCode(null)).toBeNull()
  })
})
