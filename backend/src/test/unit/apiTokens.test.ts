import { describe, it, expect } from 'vitest'
import { generateToken, hashToken } from '../../lib/apiTokens.js'

describe('generateToken', () => {
  it('starts with the mcp_ prefix', () => {
    expect(generateToken()).toMatch(/^mcp_/)
  })

  it('generates a different token every call', () => {
    expect(generateToken()).not.toBe(generateToken())
  })
})

describe('hashToken', () => {
  it('is deterministic', () => {
    const raw = generateToken()
    expect(hashToken(raw)).toBe(hashToken(raw))
  })

  it('produces a 64-char hex sha256 digest', () => {
    expect(hashToken('anything')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('differs for different inputs', () => {
    expect(hashToken('a')).not.toBe(hashToken('b'))
  })
})
