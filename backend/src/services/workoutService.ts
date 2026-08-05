import { randomUUID } from 'node:crypto'
import { prisma } from '../lib/prisma.js'
import { httpError } from '../lib/httpError.js'

const blockInclude = {
  exercise: { select: { id: true, name: true, videoUrl: true } },
  items: { orderBy: { order: 'asc' as const } },
}

const sessionInclude = {
  blocks: {
    orderBy: { order: 'asc' as const },
    include: blockInclude,
  },
}

const executionInclude = {
  workout: { select: { id: true, name: true } },
  session: {
    select: {
      id: true,
      name: true,
      order: true,
      blocks: {
        orderBy: { order: 'asc' as const },
        include: blockInclude,
      },
    },
  },
  blockExecutions: {
    select: {
      id: true,
      workoutSessionBlockItemId: true,
      reps: true,
      weight: true,
      duration: true,
    },
  },
}

// ── Ownership lookups ────────────────────────────────────────────────────────

export async function ownedWorkout(userId: number, workoutId: number) {
  return prisma.workout.findFirst({ where: { id: workoutId, userId } })
}

async function requireOwnedWorkout(userId: number, workoutId: number) {
  const w = await ownedWorkout(userId, workoutId)
  if (!w) throw httpError(404, 'Not found')
  return w
}

export async function ownedSession(userId: number, sessionId: number) {
  return prisma.workoutSession.findFirst({
    where: { id: sessionId, workout: { userId } },
    include: { workout: { select: { userId: true } }, _count: { select: { blocks: true } } },
  })
}

async function requireOwnedSession(userId: number, sessionId: number) {
  const s = await ownedSession(userId, sessionId)
  if (!s) throw httpError(404, 'Not found')
  return s
}

export async function ownedBlock(userId: number, blockId: number) {
  return prisma.workoutSessionBlock.findFirst({
    where: { id: blockId, session: { workout: { userId } } },
    include: { _count: { select: { items: true } } },
  })
}

async function requireOwnedBlock(userId: number, blockId: number) {
  const b = await ownedBlock(userId, blockId)
  if (!b) throw httpError(404, 'Not found')
  return b
}

export async function ownedItem(userId: number, itemId: number) {
  return prisma.workoutSessionBlockItem.findFirst({
    where: { id: itemId, block: { session: { workout: { userId } } } },
  })
}

async function requireOwnedItem(userId: number, itemId: number) {
  const item = await ownedItem(userId, itemId)
  if (!item) throw httpError(404, 'Not found')
  return item
}

async function requireOwnedExecution(userId: number, executionId: number) {
  const ex = await prisma.workoutExecution.findFirst({ where: { id: executionId, userId } })
  if (!ex) throw httpError(404, 'Not found')
  return ex
}

// ── Workouts ──────────────────────────────────────────────────────────────

export function listWorkouts(userId: number) {
  return prisma.workout.findMany({
    where: { userId },
    include: { _count: { select: { sessions: true } } },
    orderBy: { id: 'desc' },
  })
}

export async function createWorkout(userId: number, data: { name: string; instructions?: string }) {
  return prisma.workout.create({
    data: { name: data.name, instructions: data.instructions, userId },
  })
}

export async function getWorkout(userId: number, workoutId: number) {
  const w = await prisma.workout.findFirst({
    where: { id: workoutId, userId },
    include: { sessions: { orderBy: { order: 'asc' }, include: sessionInclude } },
  })
  if (!w) throw httpError(404, 'Not found')
  return w
}

export async function updateWorkout(
  userId: number,
  workoutId: number,
  data: { name?: string; instructions?: string | null }
) {
  const w = await requireOwnedWorkout(userId, workoutId)
  return prisma.workout.update({
    where: { id: w.id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.instructions !== undefined && { instructions: data.instructions }),
    },
  })
}

export async function deleteWorkout(userId: number, workoutId: number) {
  const w = await requireOwnedWorkout(userId, workoutId)

  // Delete in order (no cascade in schema):
  // block executions → items → blocks → workout executions → sessions → workout
  const blocks = await prisma.workoutSessionBlock.findMany({
    where: { session: { workoutId: w.id } },
    include: { items: { select: { id: true } } },
  })
  const itemIds = blocks.flatMap(b => b.items.map(i => i.id))
  if (itemIds.length > 0) {
    await prisma.workoutSessionBlockExecution.deleteMany({
      where: { workoutSessionBlockItemId: { in: itemIds } },
    })
    await prisma.workoutSessionBlockItem.deleteMany({ where: { id: { in: itemIds } } })
  }
  if (blocks.length > 0) {
    await prisma.workoutSessionBlock.deleteMany({
      where: { session: { workoutId: w.id } },
    })
  }
  await prisma.workoutExecution.deleteMany({ where: { workoutId: w.id } })
  await prisma.workoutSession.deleteMany({ where: { workoutId: w.id } })
  await prisma.workout.delete({ where: { id: w.id } })
}

// ── Sessions ──────────────────────────────────────────────────────────────

export async function createSession(userId: number, workoutId: number, name: string | undefined) {
  const w = await prisma.workout.findFirst({
    where: { id: workoutId, userId },
    include: { _count: { select: { sessions: true } } },
  })
  if (!w) throw httpError(404, 'Not found')
  const count = w._count.sessions
  return prisma.workoutSession.create({
    data: {
      workoutId: w.id,
      name: name ?? `Day ${count + 1}`,
      order: count + 1,
    },
    include: sessionInclude,
  })
}

export async function updateSession(userId: number, sessionId: number, name: string) {
  const s = await requireOwnedSession(userId, sessionId)
  return prisma.workoutSession.update({ where: { id: s.id }, data: { name } })
}

export async function deleteSession(userId: number, sessionId: number) {
  const s = await requireOwnedSession(userId, sessionId)

  // Delete in order: executions → items → blocks → session
  const blocks = await prisma.workoutSessionBlock.findMany({
    where: { sessionId: s.id },
    include: { items: { select: { id: true } } },
  })
  const itemIds = blocks.flatMap(b => b.items.map(i => i.id))
  if (itemIds.length > 0) {
    await prisma.workoutSessionBlockExecution.deleteMany({
      where: { workoutSessionBlockItemId: { in: itemIds } },
    })
    await prisma.workoutSessionBlockItem.deleteMany({ where: { id: { in: itemIds } } })
  }
  if (blocks.length > 0) {
    await prisma.workoutSessionBlock.deleteMany({ where: { sessionId: s.id } })
  }
  await prisma.workoutSession.delete({ where: { id: s.id } })
}

// ── Blocks ────────────────────────────────────────────────────────────────

export async function createBlock(
  userId: number,
  sessionId: number,
  data: { exerciseId: number; instructions?: string; supersetGroupId?: string; mode?: 'reps' | 'duration' }
) {
  const s = await requireOwnedSession(userId, sessionId)
  return prisma.workoutSessionBlock.create({
    data: {
      sessionId: s.id,
      exerciseId: data.exerciseId,
      instructions: data.instructions,
      supersetGroupId: data.supersetGroupId,
      mode: data.mode ?? 'reps',
      order: s._count.blocks + 1,
    },
    include: blockInclude,
  })
}

// Add to superset — creates a new block sharing the same supersetGroupId
export async function addSupersetBlock(userId: number, blockId: number, exerciseId: number) {
  const existing = await prisma.workoutSessionBlock.findFirst({
    where: { id: blockId, session: { workout: { userId } } },
    include: { session: { include: { _count: { select: { blocks: true } } } } },
  })
  if (!existing) throw httpError(404, 'Not found')

  // Assign a groupId if this block doesn't have one yet
  const groupId = existing.supersetGroupId ?? randomUUID()

  // Ensure the original block has the groupId
  if (!existing.supersetGroupId) {
    await prisma.workoutSessionBlock.update({
      where: { id: existing.id },
      data: { supersetGroupId: groupId },
    })
  }

  return prisma.workoutSessionBlock.create({
    data: {
      sessionId: existing.sessionId,
      exerciseId,
      supersetGroupId: groupId,
      order: existing.session._count.blocks + 1,
    },
    include: blockInclude,
  })
}

export async function updateBlock(
  userId: number,
  blockId: number,
  data: {
    exerciseId?: number
    instructions?: string | null
    notes?: string | null
    mode?: 'reps' | 'duration'
  }
) {
  const b = await requireOwnedBlock(userId, blockId)
  return prisma.workoutSessionBlock.update({
    where: { id: b.id },
    data: {
      ...(data.exerciseId !== undefined && { exerciseId: data.exerciseId }),
      ...(data.instructions !== undefined && { instructions: data.instructions }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.mode !== undefined && { mode: data.mode }),
    },
    include: blockInclude,
  })
}

export async function deleteBlock(userId: number, blockId: number) {
  const b = await requireOwnedBlock(userId, blockId)
  const groupId = b.supersetGroupId

  // Delete in order: executions → items → block (no cascade in schema)
  const items = await prisma.workoutSessionBlockItem.findMany({
    where: { blockId: b.id },
    select: { id: true },
  })
  if (items.length > 0) {
    const itemIds = items.map(i => i.id)
    await prisma.workoutSessionBlockExecution.deleteMany({
      where: { workoutSessionBlockItemId: { in: itemIds } },
    })
    await prisma.workoutSessionBlockItem.deleteMany({ where: { blockId: b.id } })
  }
  await prisma.workoutSessionBlock.delete({ where: { id: b.id } })

  // If this block was part of a superset and only 1 member remains, clear its groupId
  if (groupId) {
    const remaining = await prisma.workoutSessionBlock.findMany({
      where: { supersetGroupId: groupId },
      select: { id: true },
    })
    if (remaining.length === 1) {
      await prisma.workoutSessionBlock.update({
        where: { id: remaining[0].id },
        data: { supersetGroupId: null },
      })
    }
  }
}

// ── Items (sets) ──────────────────────────────────────────────────────────

export async function createItem(
  userId: number,
  blockId: number,
  data: { reps?: number | null; weight?: number | null; duration?: number | null; instructions?: string }
) {
  const b = await requireOwnedBlock(userId, blockId)
  return prisma.workoutSessionBlockItem.create({
    data: {
      blockId: b.id,
      reps: data.reps,
      weight: data.weight,
      duration: data.duration,
      instructions: data.instructions,
      order: b._count.items + 1,
    },
  })
}

export async function updateItem(
  userId: number,
  itemId: number,
  data: {
    reps?: number | null
    weight?: number | null
    duration?: number | null
    instructions?: string | null
  }
) {
  const item = await requireOwnedItem(userId, itemId)
  return prisma.workoutSessionBlockItem.update({
    where: { id: item.id },
    data: {
      reps: data.reps,
      weight: data.weight,
      duration: data.duration,
      ...(data.instructions !== undefined && { instructions: data.instructions }),
    },
  })
}

export async function deleteItem(userId: number, itemId: number) {
  const item = await requireOwnedItem(userId, itemId)
  await prisma.workoutSessionBlockItem.delete({ where: { id: item.id } })
}

// ── Calendar / Executions ─────────────────────────────────────────────────

export function getCalendar(userId: number, from: Date, to: Date) {
  const toEnd = new Date(to)
  toEnd.setHours(23, 59, 59, 999)
  return prisma.workoutExecution.findMany({
    where: { userId, date: { gte: from, lte: toEnd } },
    include: executionInclude,
    orderBy: { date: 'asc' },
  })
}

export async function createExecution(
  userId: number,
  data: { workoutId: number; sessionId?: number; date: string }
) {
  const w = await requireOwnedWorkout(userId, data.workoutId)
  return prisma.workoutExecution.create({
    data: {
      workoutId: w.id,
      sessionId: data.sessionId ?? null,
      userId,
      date: new Date(data.date),
    },
    include: executionInclude,
  })
}

export async function startExecution(userId: number, executionId: number) {
  const ex = await requireOwnedExecution(userId, executionId)
  return prisma.workoutExecution.update({
    where: { id: ex.id },
    data: { startedAt: new Date() },
    include: executionInclude,
  })
}

export async function finishExecution(userId: number, executionId: number) {
  const ex = await requireOwnedExecution(userId, executionId)
  return prisma.workoutExecution.update({
    where: { id: ex.id },
    data: { finishedAt: new Date() },
    include: executionInclude,
  })
}

export async function deleteExecution(userId: number, executionId: number) {
  const ex = await requireOwnedExecution(userId, executionId)
  await prisma.workoutSessionBlockExecution.deleteMany({ where: { workoutExecutionId: ex.id } })
  await prisma.workoutExecution.delete({ where: { id: ex.id } })
}

// Last logged set results per exercise, taken from the most recent earlier
// execution of the same user — keyed by exerciseId, sorted by set order
export async function getPreviousResults(userId: number, executionId: number) {
  const ex = await prisma.workoutExecution.findFirst({
    where: { id: executionId, userId },
    include: { session: { select: { blocks: { select: { exerciseId: true } } } } },
  })
  if (!ex) throw httpError(404, 'Not found')

  const exerciseIds = [...new Set(ex.session?.blocks.map(b => b.exerciseId) ?? [])]
  if (exerciseIds.length === 0) return {}

  const rows = await prisma.workoutSessionBlockExecution.findMany({
    where: {
      workoutSessionBlockItem: { block: { exerciseId: { in: exerciseIds } } },
      workoutExecution: {
        userId,
        OR: [{ date: { lt: ex.date } }, { date: ex.date, id: { lt: ex.id } }],
      },
    },
    select: {
      reps: true,
      weight: true,
      duration: true,
      workoutExecutionId: true,
      workoutSessionBlockItem: { select: { order: true, block: { select: { exerciseId: true } } } },
    },
    orderBy: [{ workoutExecution: { date: 'desc' } }, { workoutExecutionId: 'desc' }],
  })

  const result: Record<number, { order: number; reps: number | null; weight: number | null; duration: number | null }[]> = {}
  const chosenExecution = new Map<number, number>()
  for (const row of rows) {
    const exerciseId = row.workoutSessionBlockItem.block.exerciseId
    const chosen = chosenExecution.get(exerciseId)
    if (chosen === undefined) chosenExecution.set(exerciseId, row.workoutExecutionId)
    else if (chosen !== row.workoutExecutionId) continue
    ;(result[exerciseId] ??= []).push({
      order: row.workoutSessionBlockItem.order,
      reps: row.reps,
      weight: row.weight,
      duration: row.duration,
    })
  }
  for (const sets of Object.values(result)) sets.sort((a, b) => a.order - b.order)
  return result
}

// Upsert a single set result (reps/weight/duration) for a block item
export async function logSetResult(
  userId: number,
  executionId: number,
  data: { blockItemId: number; reps?: number | null; weight?: number | null; duration?: number | null }
) {
  const ex = await requireOwnedExecution(userId, executionId)

  const existing = await prisma.workoutSessionBlockExecution.findFirst({
    where: { workoutExecutionId: ex.id, workoutSessionBlockItemId: data.blockItemId },
  })

  const values = {
    reps: data.reps ?? null,
    weight: data.weight ?? null,
    duration: data.duration ?? null,
  }

  if (existing) {
    return { created: false as const, result: await prisma.workoutSessionBlockExecution.update({ where: { id: existing.id }, data: values }) }
  }

  return {
    created: true as const,
    result: await prisma.workoutSessionBlockExecution.create({
      data: { workoutExecutionId: ex.id, workoutSessionBlockItemId: data.blockItemId, ...values },
    }),
  }
}
