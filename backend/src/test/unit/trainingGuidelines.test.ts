import { describe, it, expect } from 'vitest'
import { loadGuidelines, experienceCategoryFor } from '../../knowledge/index.js'

// The rule file's contract: every number served by get_training_guidelines
// must be traceable. loadGuidelines() zod-parses the file (unknown citation
// keys, missing tiers, malformed values all throw), so simply loading it is
// the core assertion.

describe('training guidelines rule file', () => {
  it('validates against the schema (citations resolvable, tiers present)', () => {
    expect(() => loadGuidelines()).not.toThrow()
  })

  it('every variable has at least one citation with a URL', () => {
    const file = loadGuidelines()
    for (const variable of file.variables) {
      expect(variable.citationKeys.length).toBeGreaterThan(0)
      for (const key of variable.citationKeys) {
        expect(file.citations[key].url).toMatch(/^https?:\/\//)
      }
    }
  })

  it('experience mapping covers the full 1-10 scale without gaps', () => {
    const file = loadGuidelines()
    for (let level = 1; level <= 10; level++) {
      expect(experienceCategoryFor(level, file)).not.toBeNull()
    }
    expect(experienceCategoryFor(null, file)).toBeNull()
  })

  it('maps the documented category boundaries', () => {
    const file = loadGuidelines()
    expect(experienceCategoryFor(1, file)).toBe('novice')
    expect(experienceCategoryFor(3, file)).toBe('novice')
    expect(experienceCategoryFor(4, file)).toBe('intermediate')
    expect(experienceCategoryFor(7, file)).toBe('intermediate')
    expect(experienceCategoryFor(8, file)).toBe('advanced')
    expect(experienceCategoryFor(10, file)).toBe('advanced')
  })
})
