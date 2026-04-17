import type { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

export async function progressRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  app.addHook('onRequest', fastify.authenticate)

  // ── History ───────────────────────────────────────────────────────────────
  // Last 30 completed workout executions for the user

  app.get('/api/history', async (req) => {
    const executions = await prisma.workoutExecution.findMany({
      where: { userId: req.user.sub, finishedAt: { not: null } },
      include: {
        workout: { select: { id: true, name: true } },
        session: { select: { id: true, name: true, order: true } },
      },
      orderBy: { date: 'desc' },
      take: 30,
    })

    return executions.map(ex => ({
      id: ex.id,
      date: ex.date,
      startedAt: ex.startedAt,
      finishedAt: ex.finishedAt,
      durationMinutes:
        ex.startedAt && ex.finishedAt
          ? Math.round((ex.finishedAt.getTime() - ex.startedAt.getTime()) / 60000)
          : null,
      workout: ex.workout,
      session: ex.session,
    }))
  })

  // ── Tracked exercises ─────────────────────────────────────────────────────
  // Exercises the user has actually logged data for, with summary stats

  app.get('/api/progress/exercises', async (req) => {
    const rows = await prisma.workoutSessionBlockExecution.findMany({
      where: {
        workoutExecution: { userId: req.user.sub, finishedAt: { not: null } },
      },
      include: {
        workoutSessionBlockItem: {
          include: {
            block: { include: { exercise: { select: { id: true, name: true } } } },
          },
        },
        workoutExecution: { select: { date: true } },
      },
    })

    // Group by exercise
    const map = new Map<number, { id: number; name: string; sessions: Set<string>; bestWeight: number }>()
    for (const row of rows) {
      const ex = row.workoutSessionBlockItem.block.exercise
      if (!map.has(ex.id)) map.set(ex.id, { id: ex.id, name: ex.name, sessions: new Set(), bestWeight: 0 })
      const entry = map.get(ex.id)!
      entry.sessions.add(row.workoutExecution.date.toISOString().slice(0, 10))
      if (row.weight && row.weight > entry.bestWeight) entry.bestWeight = row.weight
    }

    return Array.from(map.values())
      .map(e => ({ id: e.id, name: e.name, sessions: e.sessions.size, bestWeight: e.bestWeight || null }))
      .sort((a, b) => b.sessions - a.sessions)
  })

  // ── Exercise progression ──────────────────────────────────────────────────
  // Per-date stats for a specific exercise

  app.get(
    '/api/progress/exercise/:id',
    { schema: { params: z.object({ id: z.coerce.number() }) } },
    async (req) => {
      const rows = await prisma.workoutSessionBlockExecution.findMany({
        where: {
          workoutExecution: { userId: req.user.sub, finishedAt: { not: null } },
          workoutSessionBlockItem: { block: { exerciseId: req.params.id } },
        },
        include: {
          workoutExecution: { select: { date: true } },
        },
        orderBy: { workoutExecution: { date: 'asc' } },
      })

      // Group by date
      const byDate = new Map<string, { maxWeight: number; maxReps: number; totalVolume: number; sets: number }>()
      for (const row of rows) {
        const date = row.workoutExecution.date.toISOString().slice(0, 10)
        if (!byDate.has(date)) byDate.set(date, { maxWeight: 0, maxReps: 0, totalVolume: 0, sets: 0 })
        const entry = byDate.get(date)!
        entry.sets++
        if (row.weight && row.weight > entry.maxWeight) entry.maxWeight = row.weight
        if (row.reps && row.reps > entry.maxReps) entry.maxReps = row.reps
        if (row.reps && row.weight) entry.totalVolume += row.reps * row.weight
      }

      return Array.from(byDate.entries()).map(([date, stats]) => ({
        date,
        maxWeight: stats.maxWeight || null,
        maxReps: stats.maxReps || null,
        totalVolume: stats.totalVolume || null,
        sets: stats.sets,
      }))
    }
  )
}
