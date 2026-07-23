import { prisma } from '../lib/prisma.js'
import { httpError } from '../lib/httpError.js'
import { decodeTags, encodeTags, normalizeAlias } from '../lib/exerciseTaxonomy.js'

// Exercises are a global library shared by all users. Reads are open to any
// authenticated user/token; writes are controlled: curated rows (the vetted
// library) are read-only — only uncurated rows (user/agent-created) can be
// edited or deleted. Promotion to curated is a maintainer action, not an
// API/MCP one.

const fullSelect = {
  id: true,
  name: true,
  description: true,
  videoUrl: true,
  equipment: true,
  primaryMuscle: true,
  secondaryMuscles: true,
  movementPattern: true,
  spaceFootprint: true,
  difficulty: true,
  source: true,
  isCurated: true,
} as const

// Compact projection for search results — never ship descriptions in lists.
const compactSelect = {
  id: true,
  name: true,
  movementPattern: true,
  primaryMuscle: true,
  equipment: true,
  difficulty: true,
  isCurated: true,
} as const

type ExerciseRow = {
  equipment: string | null
  secondaryMuscles?: string | null
  [key: string]: unknown
}

function decodeRow<T extends ExerciseRow>(row: T) {
  return {
    ...row,
    equipment: decodeTags(row.equipment),
    ...('secondaryMuscles' in row ? { secondaryMuscles: decodeTags(row.secondaryMuscles ?? null) } : {}),
  }
}

export type TaxonomyInput = {
  equipment?: string[]
  primaryMuscle?: string | null
  secondaryMuscles?: string[]
  movementPattern?: string | null
  spaceFootprint?: string | null
  difficulty?: string | null
}

export type SearchParams = {
  query?: string
  equipment?: string[] // any-of
  movementPattern?: string
  primaryMuscle?: string
  difficulty?: string
  spaceFootprint?: string
  includeUncurated?: boolean
  limit?: number
  offset?: number
}

export async function searchExercises(params: SearchParams = {}) {
  const {
    query,
    equipment,
    movementPattern,
    primaryMuscle,
    difficulty,
    spaceFootprint,
    includeUncurated = false,
    limit = 50,
    offset = 0,
  } = params

  const where = {
    ...(includeUncurated ? {} : { isCurated: true }),
    ...(movementPattern && { movementPattern }),
    ...(primaryMuscle && { primaryMuscle }),
    ...(difficulty && { difficulty }),
    ...(spaceFootprint && { spaceFootprint }),
    // equipment is a JSON array string — match any of the requested tags.
    ...(equipment?.length && {
      OR: equipment.map(tag => ({ equipment: { contains: `"${tag}"` } })),
    }),
    ...(query && {
      AND: [
        {
          OR: [
            { name: { contains: query } },
            { aliases: { some: { alias: { contains: normalizeAlias(query) } } } },
          ],
        },
      ],
    }),
  }

  const [total, rows] = await Promise.all([
    prisma.exercise.count({ where }),
    prisma.exercise.findMany({
      where,
      select: compactSelect,
      orderBy: { name: 'asc' },
      take: Math.min(limit, 100),
      skip: offset,
    }),
  ])

  return { total, limit: Math.min(limit, 100), offset, items: rows.map(decodeRow) }
}

export async function getExercise(exerciseId: number) {
  const ex = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    select: { ...fullSelect, aliases: { select: { alias: true } } },
  })
  if (!ex) throw httpError(404, 'Not found')
  const { aliases, ...rest } = ex
  return { ...decodeRow(rest), aliases: aliases.map(a => a.alias) }
}

// Full-record list kept for the app UI (ExercisePicker/ExercisesPage load the
// whole library today). MCP clients should use searchExercises instead.
export function listExercises() {
  return prisma.exercise.findMany({
    select: fullSelect,
    orderBy: { name: 'asc' },
  }).then(rows => rows.map(decodeRow))
}

async function assertNameAvailable(name: string) {
  const exists = await prisma.exercise.findUnique({ where: { name } })
  if (exists) throw httpError(409, 'An exercise with that name already exists')
  const alias = await prisma.exerciseAlias.findUnique({ where: { alias: normalizeAlias(name) } })
  if (alias) {
    throw httpError(409, `That name is an alias of an existing exercise (id ${alias.exerciseId}) — use it instead of creating a duplicate`)
  }
}

export async function createExercise(
  data: { name: string; description?: string; videoUrl?: string | null; source?: string } & TaxonomyInput
) {
  await assertNameAvailable(data.name)
  const created = await prisma.exercise.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      videoUrl: data.videoUrl ?? null,
      equipment: encodeTags(data.equipment),
      primaryMuscle: data.primaryMuscle ?? null,
      secondaryMuscles: encodeTags(data.secondaryMuscles),
      movementPattern: data.movementPattern ?? null,
      spaceFootprint: data.spaceFootprint ?? null,
      difficulty: data.difficulty ?? null,
      source: data.source ?? 'user',
      isCurated: false,
    },
    select: fullSelect,
  })
  return decodeRow(created)
}

export async function updateExercise(
  exerciseId: number,
  data: { name?: string; description?: string | null; videoUrl?: string | null } & TaxonomyInput
) {
  const ex = await prisma.exercise.findUnique({ where: { id: exerciseId } })
  if (!ex) throw httpError(404, 'Not found')
  if (ex.isCurated) throw httpError(403, 'Curated exercises are read-only')
  if (data.name && data.name !== ex.name) {
    await assertNameAvailable(data.name)
  }
  const updated = await prisma.exercise.update({
    where: { id: ex.id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.videoUrl !== undefined && { videoUrl: data.videoUrl }),
      ...(data.equipment !== undefined && { equipment: encodeTags(data.equipment) }),
      ...(data.primaryMuscle !== undefined && { primaryMuscle: data.primaryMuscle }),
      ...(data.secondaryMuscles !== undefined && { secondaryMuscles: encodeTags(data.secondaryMuscles) }),
      ...(data.movementPattern !== undefined && { movementPattern: data.movementPattern }),
      ...(data.spaceFootprint !== undefined && { spaceFootprint: data.spaceFootprint }),
      ...(data.difficulty !== undefined && { difficulty: data.difficulty }),
    },
    select: fullSelect,
  })
  return decodeRow(updated)
}

export async function deleteExercise(exerciseId: number) {
  const ex = await prisma.exercise.findUnique({ where: { id: exerciseId } })
  if (!ex) throw httpError(404, 'Not found')
  if (ex.isCurated) throw httpError(403, 'Curated exercises are read-only')
  const inUse = await prisma.workoutSessionBlock.count({ where: { exerciseId: ex.id } })
  if (inUse > 0) throw httpError(409, 'Exercise is used in a workout and cannot be deleted')
  await prisma.exercise.delete({ where: { id: ex.id } })
}
