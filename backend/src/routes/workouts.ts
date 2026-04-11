import type { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { randomUUID } from 'crypto'

const blockInclude = {
  exercise: { select: { id: true, name: true } },
  items: { orderBy: { order: 'asc' as const } },
}

const sessionInclude = {
  blocks: {
    orderBy: { order: 'asc' as const },
    include: blockInclude,
  },
}

async function ownedWorkout(userId: number, workoutId: number) {
  return prisma.workout.findFirst({ where: { id: workoutId, userId } })
}

async function ownedSession(userId: number, sessionId: number) {
  return prisma.workoutSession.findFirst({
    where: { id: sessionId, workout: { userId } },
    include: { workout: { select: { userId: true } }, _count: { select: { blocks: true } } },
  })
}

async function ownedBlock(userId: number, blockId: number) {
  return prisma.workoutSessionBlock.findFirst({
    where: { id: blockId, session: { workout: { userId } } },
    include: { _count: { select: { items: true } } },
  })
}

async function ownedItem(userId: number, itemId: number) {
  return prisma.workoutSessionBlockItem.findFirst({
    where: { id: itemId, block: { session: { workout: { userId } } } },
  })
}

export async function workoutRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  app.addHook('onRequest', fastify.authenticate)

  // ── Workouts ──────────────────────────────────────────────────────────────

  app.get('/api/workouts', async (req) =>
    prisma.workout.findMany({
      where: { userId: req.user.sub },
      include: { _count: { select: { sessions: true } } },
      orderBy: { id: 'desc' },
    })
  )

  app.post(
    '/api/workouts',
    { schema: { body: z.object({ name: z.string().min(1) }) } },
    async (req, reply) => {
      const w = await prisma.workout.create({ data: { name: req.body.name, userId: req.user.sub } })
      return reply.status(201).send(w)
    }
  )

  app.get(
    '/api/workouts/:id',
    { schema: { params: z.object({ id: z.coerce.number() }) } },
    async (req, reply) => {
      const w = await prisma.workout.findFirst({
        where: { id: req.params.id, userId: req.user.sub },
        include: { sessions: { orderBy: { order: 'asc' }, include: sessionInclude } },
      })
      if (!w) return reply.status(404).send({ error: 'Not found' } as any)
      return w
    }
  )

  app.patch(
    '/api/workouts/:id',
    { schema: { params: z.object({ id: z.coerce.number() }), body: z.object({ name: z.string().min(1) }) } },
    async (req, reply) => {
      const w = await ownedWorkout(req.user.sub, req.params.id)
      if (!w) return reply.status(404).send({ error: 'Not found' } as any)
      return prisma.workout.update({ where: { id: w.id }, data: { name: req.body.name } })
    }
  )

  app.delete(
    '/api/workouts/:id',
    { schema: { params: z.object({ id: z.coerce.number() }) } },
    async (req, reply) => {
      const w = await ownedWorkout(req.user.sub, req.params.id)
      if (!w) return reply.status(404).send({ error: 'Not found' } as any)
      await prisma.workout.delete({ where: { id: w.id } })
      return reply.status(204).send()
    }
  )

  // ── Sessions ──────────────────────────────────────────────────────────────

  app.post(
    '/api/workouts/:id/sessions',
    { schema: { params: z.object({ id: z.coerce.number() }), body: z.object({ name: z.string().optional() }) } },
    async (req, reply) => {
      const w = await prisma.workout.findFirst({
        where: { id: req.params.id, userId: req.user.sub },
        include: { _count: { select: { sessions: true } } },
      })
      if (!w) return reply.status(404).send({ error: 'Not found' } as any)
      const count = w._count.sessions
      const s = await prisma.workoutSession.create({
        data: {
          workoutId: w.id,
          name: req.body.name ?? `Day ${count + 1}`,
          order: count + 1,
        },
        include: sessionInclude,
      })
      return reply.status(201).send(s)
    }
  )

  app.patch(
    '/api/sessions/:id',
    { schema: { params: z.object({ id: z.coerce.number() }), body: z.object({ name: z.string().min(1) }) } },
    async (req, reply) => {
      const s = await ownedSession(req.user.sub, req.params.id)
      if (!s) return reply.status(404).send({ error: 'Not found' } as any)
      return prisma.workoutSession.update({ where: { id: s.id }, data: { name: req.body.name } })
    }
  )

  app.delete(
    '/api/sessions/:id',
    { schema: { params: z.object({ id: z.coerce.number() }) } },
    async (req, reply) => {
      const s = await ownedSession(req.user.sub, req.params.id)
      if (!s) return reply.status(404).send({ error: 'Not found' } as any)
      await prisma.workoutSession.delete({ where: { id: s.id } })
      return reply.status(204).send()
    }
  )

  // ── Blocks ────────────────────────────────────────────────────────────────

  app.post(
    '/api/sessions/:id/blocks',
    {
      schema: {
        params: z.object({ id: z.coerce.number() }),
        body: z.object({
          exerciseId: z.number(),
          instructions: z.string().optional(),
          supersetGroupId: z.string().optional(),
        }),
      },
    },
    async (req, reply) => {
      const s = await ownedSession(req.user.sub, req.params.id)
      if (!s) return reply.status(404).send({ error: 'Not found' } as any)
      const block = await prisma.workoutSessionBlock.create({
        data: {
          sessionId: s.id,
          exerciseId: req.body.exerciseId,
          instructions: req.body.instructions,
          supersetGroupId: req.body.supersetGroupId,
          order: s._count.blocks + 1,
        },
        include: blockInclude,
      })
      return reply.status(201).send(block)
    }
  )

  // Add to superset — creates a new block sharing the same supersetGroupId
  app.post(
    '/api/blocks/:id/superset',
    {
      schema: {
        params: z.object({ id: z.coerce.number() }),
        body: z.object({ exerciseId: z.number() }),
      },
    },
    async (req, reply) => {
      const existing = await prisma.workoutSessionBlock.findFirst({
        where: { id: req.params.id, session: { workout: { userId: req.user.sub } } },
        include: { session: { include: { _count: { select: { blocks: true } } } } },
      })
      if (!existing) return reply.status(404).send({ error: 'Not found' } as any)

      // Assign a groupId if this block doesn't have one yet
      const groupId = existing.supersetGroupId ?? randomUUID()

      // Ensure the original block has the groupId
      if (!existing.supersetGroupId) {
        await prisma.workoutSessionBlock.update({
          where: { id: existing.id },
          data: { supersetGroupId: groupId },
        })
      }

      const block = await prisma.workoutSessionBlock.create({
        data: {
          sessionId: existing.sessionId,
          exerciseId: req.body.exerciseId,
          supersetGroupId: groupId,
          order: existing.session._count.blocks + 1,
        },
        include: blockInclude,
      })
      return reply.status(201).send(block)
    }
  )

  app.patch(
    '/api/blocks/:id',
    {
      schema: {
        params: z.object({ id: z.coerce.number() }),
        body: z.object({
          exerciseId: z.number().optional(),
          instructions: z.string().nullable().optional(),
        }),
      },
    },
    async (req, reply) => {
      const b = await ownedBlock(req.user.sub, req.params.id)
      if (!b) return reply.status(404).send({ error: 'Not found' } as any)
      return prisma.workoutSessionBlock.update({
        where: { id: b.id },
        data: {
          ...(req.body.exerciseId !== undefined && { exerciseId: req.body.exerciseId }),
          ...(req.body.instructions !== undefined && { instructions: req.body.instructions }),
        },
        include: blockInclude,
      })
    }
  )

  app.delete(
    '/api/blocks/:id',
    { schema: { params: z.object({ id: z.coerce.number() }) } },
    async (req, reply) => {
      const b = await ownedBlock(req.user.sub, req.params.id)
      if (!b) return reply.status(404).send({ error: 'Not found' } as any)
      await prisma.workoutSessionBlock.delete({ where: { id: b.id } })
      return reply.status(204).send()
    }
  )

  // ── Items (sets) ──────────────────────────────────────────────────────────

  app.post(
    '/api/blocks/:id/items',
    {
      schema: {
        params: z.object({ id: z.coerce.number() }),
        body: z.object({
          reps: z.number().int().positive().nullable().optional(),
          weight: z.number().nonnegative().nullable().optional(),
          duration: z.number().int().positive().nullable().optional(),
        }),
      },
    },
    async (req, reply) => {
      const b = await ownedBlock(req.user.sub, req.params.id)
      if (!b) return reply.status(404).send({ error: 'Not found' } as any)
      const item = await prisma.workoutSessionBlockItem.create({
        data: {
          blockId: b.id,
          reps: req.body.reps,
          weight: req.body.weight,
          duration: req.body.duration,
          order: b._count.items + 1,
        },
      })
      return reply.status(201).send(item)
    }
  )

  app.patch(
    '/api/items/:id',
    {
      schema: {
        params: z.object({ id: z.coerce.number() }),
        body: z.object({
          reps: z.number().int().positive().nullable().optional(),
          weight: z.number().nonnegative().nullable().optional(),
          duration: z.number().int().positive().nullable().optional(),
        }),
      },
    },
    async (req, reply) => {
      const item = await ownedItem(req.user.sub, req.params.id)
      if (!item) return reply.status(404).send({ error: 'Not found' } as any)
      return prisma.workoutSessionBlockItem.update({
        where: { id: item.id },
        data: { reps: req.body.reps, weight: req.body.weight, duration: req.body.duration },
      })
    }
  )

  app.delete(
    '/api/items/:id',
    { schema: { params: z.object({ id: z.coerce.number() }) } },
    async (req, reply) => {
      const item = await ownedItem(req.user.sub, req.params.id)
      if (!item) return reply.status(404).send({ error: 'Not found' } as any)
      await prisma.workoutSessionBlockItem.delete({ where: { id: item.id } })
      return reply.status(204).send()
    }
  )
}
