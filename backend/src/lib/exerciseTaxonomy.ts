import { z } from 'zod'

// Closed vocabularies for the exercise taxonomy. SQLite has no enum support
// in Prisma, so the columns are plain strings and these lists are the single
// source of truth — every write path (REST and MCP) validates against them.
// Growing a list is a code change on purpose: silent vocabulary drift breaks
// filtering ("chest" vs "pectorals" makes an exercise invisible).

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'bodyweight',
  'machine',
  'cable',
  'bands',
  'bench',
  'pullup_bar',
  'ez_curl_bar',
  'medicine_ball',
  'exercise_ball',
  'foam_roll',
  'other',
] as const

export const MUSCLES = [
  'abdominals',
  'abductors',
  'adductors',
  'biceps',
  'calves',
  'chest',
  'forearms',
  'glutes',
  'hamstrings',
  'lats',
  'lower_back',
  'middle_back',
  'neck',
  'quadriceps',
  'shoulders',
  'traps',
  'triceps',
] as const

// The doc's eight patterns plus three pragmatic values (isolation,
// locomotion, mobility) — the library contains curls, cardio, and stretches,
// which don't map onto the compound patterns and would otherwise sit
// unfilterable at null.
export const MOVEMENT_PATTERNS = [
  'horizontal_push',
  'horizontal_pull',
  'vertical_push',
  'vertical_pull',
  'squat',
  'hinge',
  'lunge',
  'core',
  'carry',
  'isolation',
  'locomotion',
  'mobility',
] as const

export const SPACE_FOOTPRINTS = ['stationary', 'small_area', 'large_area'] as const

export const DIFFICULTIES = ['beginner', 'intermediate', 'expert'] as const

export type Equipment = (typeof EQUIPMENT)[number]
export type Muscle = (typeof MUSCLES)[number]
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number]
export type SpaceFootprint = (typeof SPACE_FOOTPRINTS)[number]
export type Difficulty = (typeof DIFFICULTIES)[number]

export const equipmentSchema = z.enum(EQUIPMENT)
export const muscleSchema = z.enum(MUSCLES)
export const movementPatternSchema = z.enum(MOVEMENT_PATTERNS)
export const spaceFootprintSchema = z.enum(SPACE_FOOTPRINTS)
export const difficultySchema = z.enum(DIFFICULTIES)

// Multi-valued taxonomy fields are stored as JSON-encoded string arrays.
export function encodeTags(tags: string[] | undefined | null): string | null {
  if (!tags || tags.length === 0) return null
  return JSON.stringify([...new Set(tags)].sort())
}

export function decodeTags(json: string | null): string[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : []
  } catch {
    return []
  }
}

// Aliases are matched case-insensitively by storing them normalized.
export function normalizeAlias(alias: string): string {
  return alias.trim().toLowerCase().replace(/\s+/g, ' ')
}
