import { loadGuidelines, experienceCategoryFor } from '../knowledge/index.js'
import * as trainingProfileService from './trainingProfileService.js'
import { GOAL_FOR_OUTCOME, type PrimaryOutcome } from '../lib/trainingVocab.js'

// Serves the versioned, cited rule set filtered to the user's stored profile.
// The server never assembles a plan — it hands the client the numbers, the
// evidence tier behind each one, and the citations, so any MCP client works
// from the same facts.
//
// The rule file is still keyed on the deprecated `goal` vocabulary until it
// moves to 2.0.0 (r3-amendment §8.3), so the profile's `primaryOutcome` is
// projected back onto a goal to select rules. Two outcomes have no projection
// and therefore no rules; that is reported, not papered over.

export type GuidelineOverrides = {
  goal?: string
  primaryOutcome?: string
  experienceLevel?: number
}

export async function getTrainingGuidelines(userId: number, overrides: GuidelineOverrides = {}) {
  const file = loadGuidelines()
  const profile = await trainingProfileService.getTrainingProfile(userId)

  const primaryOutcome = overrides.primaryOutcome ?? profile.primaryOutcome
  // Explicit goal override still wins — it is the older, narrower request.
  const goal = overrides.goal ?? (primaryOutcome ? GOAL_FOR_OUTCOME[primaryOutcome as PrimaryOutcome] : null)
  const experienceLevel = overrides.experienceLevel ?? profile.experienceLevel
  const experienceCategory = experienceCategoryFor(experienceLevel, file)

  // An outcome the rule file cannot express yet. Falling back to a neighbouring
  // goal would silently serve hypertrophy numbers to someone training for
  // stress relief, which is the failure the outcome split exists to prevent.
  const outcomeUnsupported = primaryOutcome != null && goal == null

  const missingProfileFields = [
    ...(primaryOutcome ? [] : ['primaryOutcome']),
    ...(experienceLevel != null ? [] : ['experienceLevel']),
    ...(profile.daysPerWeek != null ? [] : ['daysPerWeek']),
    ...(profile.minutesPerSession != null ? [] : ['minutesPerSession']),
    ...(profile.equipmentLoadsUnknown ? ['equipment.loads'] : []),
  ]

  const applicable = file.variables.filter(v => {
    // Unknown goal/experience → only rules that apply universally, so an
    // empty profile still yields honest (if generic) guidance.
    const goalOk = v.goals === null || (goal != null && v.goals.includes(goal as never))
    const expOk = v.experience === null || (experienceCategory != null && v.experience.includes(experienceCategory))
    // Population-restricted rules (older adults) are withheld from users the
    // studied population doesn't cover; served when age is unknown so the
    // client can ask.
    const ageOk = v.appliesFromAge == null || profile.age == null || profile.age >= v.appliesFromAge
    return goalOk && expOk && ageOk
  })

  const citationKeys = new Set(applicable.flatMap(v => v.citationKeys))

  return {
    rulesVersion: file.version,
    rulesUpdated: file.updated,
    profileUsed: {
      primaryOutcome,
      /** @deprecated the goal the outcome was projected onto to select rules. */
      goal,
      experienceLevel,
      experienceCategory,
      experienceCategoryNote: file.experienceLevelMapping.note,
      daysPerWeek: profile.daysPerWeek,
      minutesPerSession: profile.minutesPerSession,
      age: profile.age,
    },
    outcomeUnsupported,
    outcomeNote: outcomeUnsupported
      ? `No rules are published for "${primaryOutcome}" yet — only rules that apply to every outcome are returned. Do not substitute numbers from another outcome; say what is missing instead.`
      : null,
    missingProfileFields,
    guidelines: applicable.map(v => ({
      key: v.key,
      goals: v.goals,
      experience: v.experience,
      value: v.value,
      recommendation: v.recommendation,
      finding: v.finding,
      evidenceTier: v.evidenceTier,
      citations: v.citationKeys,
      caveats: v.caveats,
      population: v.population ?? null,
    })),
    citations: Object.fromEntries(
      [...citationKeys].sort().map(key => [key, file.citations[key]])
    ),
  }
}
