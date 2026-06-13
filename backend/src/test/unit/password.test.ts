import { describe, it, expect } from 'vitest'
import { hasSequentialDigits, passwordSchema } from '../../lib/password.js'

describe('hasSequentialDigits', () => {
  it('detects 4 consecutive ascending digits', () => {
    expect(hasSequentialDigits('pass1234')).toBe(true)
  })

  it('detects a sequence that is not at the start', () => {
    expect(hasSequentialDigits('abc3456xyz')).toBe(true)
  })

  it('returns false for non-sequential digits', () => {
    expect(hasSequentialDigits('pass1357')).toBe(false)
  })

  it('returns false when there are no digits', () => {
    expect(hasSequentialDigits('password')).toBe(false)
  })

  it('returns false for only 3 consecutive digits', () => {
    expect(hasSequentialDigits('pass123!')).toBe(false)
  })
})

describe('passwordSchema', () => {
  it('accepts a valid strong password', () => {
    expect(passwordSchema.safeParse('Secure@57!').success).toBe(true)
  })

  it('rejects a password shorter than 8 characters', () => {
    const result = passwordSchema.safeParse('Ab@1')
    expect(result.success).toBe(false)
  })

  it('rejects a password with no uppercase letter', () => {
    const result = passwordSchema.safeParse('secure@57!')
    expect(result.success).toBe(false)
  })

  it('rejects a password with no special character', () => {
    const result = passwordSchema.safeParse('Secure57Xx')
    expect(result.success).toBe(false)
  })

  it('rejects a password with sequential digits', () => {
    const result = passwordSchema.safeParse('Secure@1234')
    expect(result.success).toBe(false)
  })
})
