import type { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import * as workoutService from '../services/workoutService.js'

export async function workoutRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  app.addHook('onRequest', fastify.authenticate)

  // ── Workouts ──────────────────────────────────────────────────────────────

  app.get('/api/workouts', async (req) => workoutService.listWorkouts(req.user.sub))

  app.post(
    '/api/workouts',
    { schema: { body: z.object({ name: z.string().min(1), instructions: z.string().optional() }) } },
    async (req, reply) => {
      const w = await workoutService.createWorkout(req.user.sub, req.body)
      return reply.status(201).send(w)
    }
  )

  app.get(
    '/api/workouts/:id',
    { schema: { params: z.object({ id: z.coerce.number() }) } },
    async (req) => workoutService.getWorkout(req.user.sub, req.params.id)
  )

  app.patch(
    '/api/workouts/:id',
    {
      schema: {
        params: z.object({ id: z.coerce.number() }),
        body: z.object({ name: z.string().min(1).optional(), instructions: z.string().nullable().optional() }),
      },
    },
    async (req) => workoutService.updateWorkout(req.user.sub, req.params.id, req.body)
  )

  app.delete(
    '/api/workouts/:id',
    { schema: { params: z.object({ id: z.coerce.number() }) } },
    async (req, reply) => {
      await workoutService.deleteWorkout(req.user.sub, req.params.id)
      return reply.status(204).send()
    }
  )

  // ── Sessions ──────────────────────────────────────────────────────────────

  app.post(
    '/api/workouts/:id/sessions',
    { schema: { params: z.object({ id: z.coerce.number() }), body: z.object({ name: z.string().optional() }) } },
    async (req, reply) => {
      const s = await workoutService.createSession(req.user.sub, req.params.id, req.body.name)
      return reply.status(201).send(s)
    }
  )

  app.patch(
    '/api/sessions/:id',
    { schema: { params: z.object({ id: z.coerce.number() }), body: z.object({ name: z.string().min(1) }) } },
    async (req) => workoutService.updateSession(req.user.sub, req.params.id, req.body.name)
  )

  app.delete(
    '/api/sessions/:id',
    { schema: { params: z.object({ id: z.coerce.number() }) } },
    async (req, reply) => {
      await workoutService.deleteSession(req.user.sub, req.params.id)
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
          mode: z.enum(['reps', 'duration']).optional(),
        }),
      },
    },
    async (req, reply) => {
      const block = await workoutService.createBlock(req.user.sub, req.params.id, req.body)
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
      const block = await workoutService.addSupersetBlock(req.user.sub, req.params.id, req.body.exerciseId)
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
          notes: z.string().nullable().optional(),
          mode: z.enum(['reps', 'duration']).optional(),
        }),
      },
    },
    async (req) => workoutService.updateBlock(req.user.sub, req.params.id, req.body)
  )

  app.delete(
    '/api/blocks/:id',
    { schema: { params: z.object({ id: z.coerce.number() }) } },
    async (req, reply) => {
      await workoutService.deleteBlock(req.user.sub, req.params.id)
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
          instructions: z.string().optional(),
        }),
      },
    },
    async (req, reply) => {
      const item = await workoutService.createItem(req.user.sub, req.params.id, req.body)
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
          instructions: z.string().nullable().optional(),
        }),
      },
    },
    async (req) => workoutService.updateItem(req.user.sub, req.params.id, req.body)
  )

  app.delete(
    '/api/items/:id',
    { schema: { params: z.object({ id: z.coerce.number() }) } },
    async (req, reply) => {
      await workoutService.deleteItem(req.user.sub, req.params.id)
      return reply.status(204).send()
    }
  )

  // ── Calendar / Executions ─────────────────────────────────────────────────

  app.get(
    '/api/calendar',
    { schema: { querystring: z.object({ from: z.string(), to: z.string() }) } },
    async (req) => workoutService.getCalendar(req.user.sub, new Date(req.query.from), new Date(req.query.to))
  )

  app.post(
    '/api/executions',
    {
      schema: {
        body: z.object({
          workoutId: z.number(),
          sessionId: z.number().optional(),
          date: z.string(),
        }),
      },
    },
    async (req, reply) => {
      const ex = await workoutService.createExecution(req.user.sub, req.body)
      return reply.status(201).send(ex)
    }
  )

  app.patch(
    '/api/executions/:id/start',
    { schema: { params: z.object({ id: z.coerce.number() }) } },
    async (req) => workoutService.startExecution(req.user.sub, req.params.id)
  )

  app.patch(
    '/api/executions/:id/finish',
    { schema: { params: z.object({ id: z.coerce.number() }) } },
    async (req) => workoutService.finishExecution(req.user.sub, req.params.id)
  )

  app.delete(
    '/api/executions/:id',
    { schema: { params: z.object({ id: z.coerce.number() }) } },
    async (req, reply) => {
      await workoutService.deleteExecution(req.user.sub, req.params.id)
      return reply.status(204).send()
    }
  )

  // Upsert a single set result (reps/weight/duration) for a block item
  app.post(
    '/api/executions/:id/log',
    {
      schema: {
        params: z.object({ id: z.coerce.number() }),
        body: z.object({
          blockItemId: z.number(),
          reps: z.number().int().nullable().optional(),
          weight: z.number().nullable().optional(),
          duration: z.number().int().nullable().optional(),
        }),
      },
    },
    async (req, reply) => {
      const { created, result } = await workoutService.logSetResult(req.user.sub, req.params.id, req.body)
      return reply.status(created ? 201 : 200).send(result)
    }
  )
}
