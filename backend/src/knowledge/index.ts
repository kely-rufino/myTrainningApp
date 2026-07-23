import rawGuidelines from './training-guidelines.v1.json' with { type: 'json' }
import { guidelinesFileSchema, type GuidelinesFile, type ExperienceCategory } from './schema.js'

let cached: GuidelinesFile | null = null

// Parse once, at first use. An invalid rule file is a startup-class bug —
// fail loudly rather than serve unvalidated numbers.
export function loadGuidelines(): GuidelinesFile {
  if (!cached) cached = guidelinesFileSchema.parse(rawGuidelines)
  return cached
}

export function experienceCategoryFor(level: number | null, file: GuidelinesFile): ExperienceCategory | null {
  if (level == null) return null
  const mapping = file.experienceLevelMapping
  for (const category of ['novice', 'intermediate', 'advanced'] as const) {
    const [min, max] = mapping[category]
    if (level >= min && level <= max) return category
  }
  return null
}
