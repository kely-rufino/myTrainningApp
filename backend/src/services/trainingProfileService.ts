import { prisma } from '../lib/prisma.js'
import { decodeTags, encodeTags } from '../lib/exerciseTaxonomy.js'
import {
  decodeInventory,
  encodeInventory,
  hasUnknownLoads,
  inventoryTypes,
  type EquipmentInventoryItem,
} from '../lib/equipmentInventory.js'
import {
  GOAL_FOR_OUTCOME,
  OUTCOME_FOR_GOAL,
  type ExclusionReason,
  type Goal,
  type PrimaryOutcome,
} from '../lib/trainingVocab.js'

// The training profile is the server-side home for the constraints every
// plan-building flow needs. Body metrics live on User; age is derived from
// dateOfBirth so it never goes stale.
//
// Rev 3 split `goal` into `primaryOutcome` + `secondaryOutcomes`, replaced the
// equipment tag array with a load inventory, and added exclusions, adherence
// state and recovery context (knowledge-base-r3-amendment.md §2). `goal` and
// the flat `equipment` array are still served as read-only aliases for one
// release so existing MCP clients do not break.

export type ExcludedExercise = {
  exerciseId: number
  reason: ExclusionReason
  addedAt: string
}

export type TrainingProfileInput = {
  experienceLevel?: number | null
  goal?: string | null
  primaryOutcome?: string | null
  secondaryOutcomes?: string[]
  equipment?: string[]
  equipmentInventory?: EquipmentInventoryItem[]
  spaceConstraint?: string | null
  daysPerWeek?: number | null
  minutesPerSession?: number | null
  injuries?: string[]
  excludedExercises?: { exerciseId: number; reason: ExclusionReason }[]
  adherenceTier?: string | null
  typicalSleepHours?: number | null
  lifeStressLevel?: string | null
  notes?: string | null
}

function ageFromDateOfBirth(dob: Date | null): number | null {
  if (!dob) return null
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const beforeBirthday =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())
  if (beforeBirthday) age--
  return age
}

function decodeExclusions(json: string | null): ExcludedExercise[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is ExcludedExercise =>
        typeof entry === 'object' && entry !== null && typeof entry.exerciseId === 'number'
    )
  } catch {
    return []
  }
}

/**
 * `addedAt` records when the user made the decision, so it belongs to the
 * entry rather than to the write that happened to carry it. Adding a second
 * exclusion must not restamp the first — the age of an exclusion is exactly
 * what tells a later review whether it is still current.
 */
function mergeExclusions(
  incoming: { exerciseId: number; reason: ExclusionReason }[],
  existing: ExcludedExercise[]
): ExcludedExercise[] {
  const previous = new Map(existing.map(entry => [entry.exerciseId, entry]))
  const now = new Date().toISOString()
  return incoming.map(entry => {
    const prior = previous.get(entry.exerciseId)
    // A changed reason is a new decision and gets a fresh date.
    const keepDate = prior != null && prior.reason === entry.reason
    return { ...entry, addedAt: keepDate ? prior!.addedAt : now }
  })
}

/**
 * Applies a flat tag list to an existing inventory: types that survive keep
 * whatever load data was recorded for them, new types arrive bare (loads
 * unknown), and types absent from the list are dropped.
 */
function mergeTagsIntoInventory(tags: string[], storedEquipment: string | null): EquipmentInventoryItem[] {
  const stored = new Map<string, EquipmentInventoryItem>(
    decodeInventory(storedEquipment).items.map(item => [item.type, item])
  )
  return tags.map(
    tag => stored.get(tag) ?? { type: tag as EquipmentInventoryItem['type'] }
  )
}

type ProfileRow = {
  experienceLevel: number | null
  goal: string | null
  primaryOutcome: string | null
  secondaryOutcomes: string | null
  equipment: string | null
  spaceConstraint: string | null
  daysPerWeek: number | null
  minutesPerSession: number | null
  injuries: string | null
  excludedExercises: string | null
  adherenceTier: string | null
  consecutiveWeeksOk: number | null
  typicalSleepHours: number | null
  lifeStressLevel: string | null
  notes: string | null
  updatedAt: Date
} | null

function present(profile: ProfileRow) {
  const inventory = decodeInventory(profile?.equipment ?? null)
  // The stored `goal` is only consulted for rows the migration has not
  // backfilled. Everything else reads through primaryOutcome, and `goal` is
  // *projected back* from it rather than returned from its own column — a
  // stored alias drifts the moment someone writes only the new field, which
  // is precisely what a legacy client would then read.
  const primaryOutcome =
    profile?.primaryOutcome ??
    (profile?.goal ? (OUTCOME_FOR_GOAL[profile.goal as Goal] ?? null) : null)
  const goal = primaryOutcome ? (GOAL_FOR_OUTCOME[primaryOutcome as PrimaryOutcome] ?? null) : null

  return {
    experienceLevel: profile?.experienceLevel ?? null,
    /** @deprecated read-only alias for primaryOutcome — removed next release. */
    goal,
    primaryOutcome,
    secondaryOutcomes: decodeTags(profile?.secondaryOutcomes ?? null),
    /** @deprecated flat tag view of equipmentInventory. */
    equipment: inventoryTypes(inventory),
    equipmentInventory: inventory.items,
    equipmentLoadsUnknown: hasUnknownLoads(inventory),
    spaceConstraint: profile?.spaceConstraint ?? null,
    daysPerWeek: profile?.daysPerWeek ?? null,
    minutesPerSession: profile?.minutesPerSession ?? null,
    injuries: decodeTags(profile?.injuries ?? null),
    excludedExercises: decodeExclusions(profile?.excludedExercises ?? null),
    adherenceTierOverride: profile?.adherenceTier ?? null,
    consecutiveWeeksOk: profile?.consecutiveWeeksOk ?? null,
    typicalSleepHours: profile?.typicalSleepHours ?? null,
    lifeStressLevel: profile?.lifeStressLevel ?? null,
    notes: profile?.notes ?? null,
    updatedAt: profile?.updatedAt.toISOString() ?? null,
  }
}

export async function getTrainingProfile(userId: number) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      weight: true,
      height: true,
      dateOfBirth: true,
      unitPreference: true,
      trainingProfile: true,
    },
  })

  return {
    ...present(user.trainingProfile),
    age: ageFromDateOfBirth(user.dateOfBirth),
    weight: user.weight,
    height: user.height,
    unitPreference: user.unitPreference,
  }
}

export async function updateTrainingProfile(userId: number, data: TrainingProfileInput) {
  const existing = await prisma.trainingProfile.findUnique({ where: { userId } })

  // The two outcome columns are written in lockstep so the deprecated alias
  // can never disagree with the field it aliases. An explicit `primaryOutcome`
  // wins; a write to `goal` alone is translated rather than ignored.
  const outcomeFields =
    data.primaryOutcome !== undefined
      ? {
          primaryOutcome: data.primaryOutcome,
          goal: data.primaryOutcome ? (GOAL_FOR_OUTCOME[data.primaryOutcome as PrimaryOutcome] ?? null) : null,
        }
      : data.goal !== undefined
        ? {
            goal: data.goal,
            primaryOutcome: data.goal ? (OUTCOME_FOR_GOAL[data.goal as Goal] ?? null) : null,
          }
        : {}

  const fields = {
    ...(data.experienceLevel !== undefined && { experienceLevel: data.experienceLevel }),
    ...outcomeFields,
    ...(data.secondaryOutcomes !== undefined && { secondaryOutcomes: encodeTags(data.secondaryOutcomes) }),
    ...(data.equipmentInventory !== undefined && { equipment: encodeInventory(data.equipmentInventory) }),
    // A legacy client writing the flat tag array knows the *types* the user
    // owns but nothing about loads. Overwriting the inventory with bare
    // entries would silently destroy load data the user already gave us, so
    // the tags are merged over the existing inventory instead.
    ...(data.equipmentInventory === undefined &&
      data.equipment !== undefined && {
        equipment: encodeInventory(mergeTagsIntoInventory(data.equipment, existing?.equipment ?? null)),
      }),
    ...(data.spaceConstraint !== undefined && { spaceConstraint: data.spaceConstraint }),
    ...(data.daysPerWeek !== undefined && { daysPerWeek: data.daysPerWeek }),
    ...(data.minutesPerSession !== undefined && { minutesPerSession: data.minutesPerSession }),
    ...(data.injuries !== undefined && { injuries: encodeTags(data.injuries) }),
    ...(data.excludedExercises !== undefined && {
      excludedExercises: JSON.stringify(
        mergeExclusions(data.excludedExercises, decodeExclusions(existing?.excludedExercises ?? null))
      ),
    }),
    ...(data.adherenceTier !== undefined && { adherenceTier: data.adherenceTier }),
    ...(data.typicalSleepHours !== undefined && { typicalSleepHours: data.typicalSleepHours }),
    ...(data.lifeStressLevel !== undefined && { lifeStressLevel: data.lifeStressLevel }),
    ...(data.notes !== undefined && { notes: data.notes }),
  }

  await prisma.trainingProfile.upsert({
    where: { userId },
    create: { userId, ...fields },
    update: fields,
  })

  return getTrainingProfile(userId)
}
