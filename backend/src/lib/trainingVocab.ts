import { z } from 'zod'

// Closed vocabularies for the training profile. Same rationale as
// exerciseTaxonomy.ts: free-text here would make guideline/injury tools
// unable to key off the values.

export const GOALS = ['hypertrophy', 'strength', 'general_fitness', 'endurance'] as const

// Common, non-acute, training-relevant conditions — the injury rule set
// (knowledge-base doc §4.5) attaches exclusions/substitutes to these keys.
// This is not diagnosis: it's "user says their X bothers them" granularity.
export const INJURY_CONDITIONS = [
  'shoulder_impingement',
  'rotator_cuff_issue',
  'low_back_pain',
  'patellofemoral_pain',
  'knee_pain_general',
  'elbow_tendinopathy',
  'wrist_pain',
  'hip_impingement',
  'achilles_tendinopathy',
  'ankle_instability',
  'hamstring_strain',
  'neck_pain',
] as const

export type Goal = (typeof GOALS)[number]
export type InjuryCondition = (typeof INJURY_CONDITIONS)[number]

export const goalSchema = z.enum(GOALS)
export const injuryConditionSchema = z.enum(INJURY_CONDITIONS)
export const experienceLevelSchema = z.number().int().min(1).max(10)
export const daysPerWeekSchema = z.number().int().min(1).max(7)
