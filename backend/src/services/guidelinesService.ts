import { loadGuidelines, experienceCategoryFor } from '../knowledge/index.js'
import * as trainingProfileService from './trainingProfileService.js'

// Serves the versioned, cited rule set filtered to the user's stored profile.
// The server never assembles a plan — it hands the client the numbers, the
// evidence tier behind each one, and the citations, so any MCP client works
// from the same facts.

export type GuidelineOverrides = {
  goal?: string
  experienceLevel?: number
}

export async function getTrainingGuidelines(userId: number, overrides: GuidelineOverrides = {}) {
  const file = loadGuidelines()
  const profile = await trainingProfileService.getTrainingProfile(userId)

  const goal = overrides.goal ?? profile.goal
  const experienceLevel = overrides.experienceLevel ?? profile.experienceLevel
  const experienceCategory = experienceCategoryFor(experienceLevel, file)

  const missingProfileFields = [
    ...(goal ? [] : ['goal']),
    ...(experienceLevel != null ? [] : ['experienceLevel']),
    ...(profile.daysPerWeek != null ? [] : ['daysPerWeek']),
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
      goal,
      experienceLevel,
      experienceCategory,
      experienceCategoryNote: file.experienceLevelMapping.note,
      daysPerWeek: profile.daysPerWeek,
      age: profile.age,
    },
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
