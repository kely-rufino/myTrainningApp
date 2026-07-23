import { prisma } from '../lib/prisma.js'
import { decodeTags, encodeTags } from '../lib/exerciseTaxonomy.js'

// The training profile is the server-side home for the constraints every
// plan-building flow needs (experience, goal, equipment, space, injuries).
// Body metrics live on User; age is derived from dateOfBirth so it never
// goes stale.

export type TrainingProfileInput = {
  experienceLevel?: number | null
  goal?: string | null
  equipment?: string[]
  spaceConstraint?: string | null
  daysPerWeek?: number | null
  injuries?: string[]
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

function present(profile: {
  experienceLevel: number | null
  goal: string | null
  equipment: string | null
  spaceConstraint: string | null
  daysPerWeek: number | null
  injuries: string | null
  notes: string | null
  updatedAt: Date
} | null) {
  return {
    experienceLevel: profile?.experienceLevel ?? null,
    goal: profile?.goal ?? null,
    equipment: decodeTags(profile?.equipment ?? null),
    spaceConstraint: profile?.spaceConstraint ?? null,
    daysPerWeek: profile?.daysPerWeek ?? null,
    injuries: decodeTags(profile?.injuries ?? null),
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
  const fields = {
    ...(data.experienceLevel !== undefined && { experienceLevel: data.experienceLevel }),
    ...(data.goal !== undefined && { goal: data.goal }),
    ...(data.equipment !== undefined && { equipment: encodeTags(data.equipment) }),
    ...(data.spaceConstraint !== undefined && { spaceConstraint: data.spaceConstraint }),
    ...(data.daysPerWeek !== undefined && { daysPerWeek: data.daysPerWeek }),
    ...(data.injuries !== undefined && { injuries: encodeTags(data.injuries) }),
    ...(data.notes !== undefined && { notes: data.notes }),
  }

  await prisma.trainingProfile.upsert({
    where: { userId },
    create: { userId, ...fields },
    update: fields,
  })

  return getTrainingProfile(userId)
}
