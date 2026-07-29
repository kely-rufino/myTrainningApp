import { z } from 'zod'

// Closed vocabularies for the training profile. Same rationale as
// exerciseTaxonomy.ts: free-text here would make guideline/injury tools
// unable to key off the values.

// **Deprecated.** `goal` collapsed three independent axes — the desired
// outcome, the modality it implies, and the user's adherence state — into one
// enum, and `general_fitness` matched almost no rules as a result
// (knowledge-base-r3-amendment.md §1). Superseded by PRIMARY_OUTCOMES below.
// Kept for one release: the column still exists as a read-only alias so MCP
// clients and the frontend keep working, and the guidelines file is still
// keyed on these values until it moves to 2.0.0 (r3-amendment §8.3).
export const GOALS = ['hypertrophy', 'strength', 'general_fitness', 'endurance'] as const

export const PRIMARY_OUTCOMES = [
  'hypertrophy',
  'strength',
  'endurance',
  'body_composition',
  'mental_health_cognition',
  // WHO-floor: "be healthy", with no more specific target than that.
  'general_health',
] as const

// Why an exercise is excluded, from a closed list so `find_substitute` can
// rank on it (r3-amendment §2.3, §4.11): `pain` routes through the constraint
// layer, `equipment` prefers lower absolute-load options, `dislike` prefers a
// different exercise family rather than a near-identical variant.
export const EXCLUSION_REASONS = ['dislike', 'pain', 'equipment', 'space', 'boredom', 'time'] as const

export const LIFE_STRESS_LEVELS = ['low', 'moderate', 'high'] as const

export const ADHERENCE_TIERS = ['onboarding', 'building', 'established'] as const

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
export type PrimaryOutcome = (typeof PRIMARY_OUTCOMES)[number]
export type ExclusionReason = (typeof EXCLUSION_REASONS)[number]
export type LifeStressLevel = (typeof LIFE_STRESS_LEVELS)[number]
export type AdherenceTier = (typeof ADHERENCE_TIERS)[number]
export type InjuryCondition = (typeof INJURY_CONDITIONS)[number]

export const goalSchema = z.enum(GOALS)
export const primaryOutcomeSchema = z.enum(PRIMARY_OUTCOMES)
export const exclusionReasonSchema = z.enum(EXCLUSION_REASONS)
export const lifeStressLevelSchema = z.enum(LIFE_STRESS_LEVELS)
export const adherenceTierSchema = z.enum(ADHERENCE_TIERS)
export const injuryConditionSchema = z.enum(INJURY_CONDITIONS)
export const experienceLevelSchema = z.number().int().min(1).max(10)
export const daysPerWeekSchema = z.number().int().min(1).max(7)
export const minutesPerSessionSchema = z.number().int().min(5).max(240)
export const typicalSleepHoursSchema = z.number().min(0).max(24)

// ── goal ↔ primaryOutcome ─────────────────────────────────────────────────

/** Migration direction: every legacy `goal` has an outcome. 1:1 by design. */
export const OUTCOME_FOR_GOAL: Record<Goal, PrimaryOutcome> = {
  hypertrophy: 'hypertrophy',
  strength: 'strength',
  endurance: 'endurance',
  general_fitness: 'general_health',
}

/**
 * Reverse direction, and deliberately partial. The guidelines file is still
 * keyed on GOALS until it moves to 2.0.0, so an outcome has to be projected
 * back onto a goal to select rules. Two outcomes have no legacy goal to project
 * onto and therefore no rules yet:
 *
 *  - `body_composition` — rules are pending the §8.3 outcome migration.
 *  - `mental_health_cognition` — the evidence block is gated on the §3.1
 *    verification pass, so there is nothing to serve.
 *
 * `null` here means "no rules exist for this outcome", which the guidelines
 * service reports rather than silently falling back to a neighbouring goal.
 * Quietly serving hypertrophy numbers to someone training for stress relief is
 * the exact failure this vocabulary split exists to prevent.
 */
export const GOAL_FOR_OUTCOME: Record<PrimaryOutcome, Goal | null> = {
  hypertrophy: 'hypertrophy',
  strength: 'strength',
  endurance: 'endurance',
  general_health: 'general_fitness',
  body_composition: null,
  mental_health_cognition: null,
}
