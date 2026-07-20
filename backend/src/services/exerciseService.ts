import { prisma } from '../lib/prisma.js'
import { httpError } from '../lib/httpError.js'

const exerciseSelect = { id: true, name: true, description: true, videoUrl: true }

// Exercises are a global library, not scoped to a user — any authenticated
// user/token can read and manage them. Preserved as-is from the REST API.

export function listExercises() {
  return prisma.exercise.findMany({
    select: exerciseSelect,
    orderBy: { name: 'asc' },
  })
}

export async function createExercise(data: { name: string; description?: string; videoUrl?: string | null }) {
  const exists = await prisma.exercise.findUnique({ where: { name: data.name } })
  if (exists) throw httpError(409, 'An exercise with that name already exists')
  return prisma.exercise.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      videoUrl: data.videoUrl ?? null,
    },
    select: exerciseSelect,
  })
}

export async function updateExercise(
  exerciseId: number,
  data: { name?: string; description?: string | null; videoUrl?: string | null }
) {
  const ex = await prisma.exercise.findUnique({ where: { id: exerciseId } })
  if (!ex) throw httpError(404, 'Not found')
  if (data.name && data.name !== ex.name) {
    const exists = await prisma.exercise.findUnique({ where: { name: data.name } })
    if (exists) throw httpError(409, 'An exercise with that name already exists')
  }
  return prisma.exercise.update({
    where: { id: ex.id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.videoUrl !== undefined && { videoUrl: data.videoUrl }),
    },
    select: exerciseSelect,
  })
}

export async function deleteExercise(exerciseId: number) {
  const ex = await prisma.exercise.findUnique({ where: { id: exerciseId } })
  if (!ex) throw httpError(404, 'Not found')
  const inUse = await prisma.workoutSessionBlock.count({ where: { exerciseId: ex.id } })
  if (inUse > 0) throw httpError(409, 'Exercise is used in a workout and cannot be deleted')
  await prisma.exercise.delete({ where: { id: ex.id } })
}
