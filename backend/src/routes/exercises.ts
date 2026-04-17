import type { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

export async function exerciseRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  app.addHook('onRequest', fastify.authenticate)

  const exerciseSelect = { id: true, name: true, description: true, videoUrl: true }

  app.get(
    '/api/exercises',
    {
      schema: {
        response: {
          200: z.array(z.object({
            id: z.number(),
            name: z.string(),
            description: z.string().nullable(),
            videoUrl: z.string().nullable(),
          })),
        },
      },
    },
    async () =>
      prisma.exercise.findMany({
        select: exerciseSelect,
        orderBy: { name: 'asc' },
      })
  )

  app.post(
    '/api/exercises',
    {
      schema: {
        body: z.object({
          name: z.string().min(1).max(100),
          description: z.string().max(500).optional(),
          videoUrl: z.string().url().nullable().optional(),
        }),
      },
    },
    async (req, reply) => {
      const exists = await prisma.exercise.findUnique({ where: { name: req.body.name } })
      if (exists) return reply.status(409).send({ error: 'An exercise with that name already exists' } as any)
      const exercise = await prisma.exercise.create({
        data: {
          name: req.body.name,
          description: req.body.description ?? null,
          videoUrl: req.body.videoUrl ?? null,
        },
        select: exerciseSelect,
      })
      return reply.status(201).send(exercise)
    }
  )

  app.patch(
    '/api/exercises/:id',
    {
      schema: {
        params: z.object({ id: z.coerce.number() }),
        body: z.object({
          name: z.string().min(1).max(100).optional(),
          description: z.string().max(500).nullable().optional(),
          videoUrl: z.string().url().nullable().optional(),
        }),
      },
    },
    async (req, reply) => {
      const ex = await prisma.exercise.findUnique({ where: { id: req.params.id } })
      if (!ex) return reply.status(404).send({ error: 'Not found' } as any)
      if (req.body.name && req.body.name !== ex.name) {
        const exists = await prisma.exercise.findUnique({ where: { name: req.body.name } })
        if (exists) return reply.status(409).send({ error: 'An exercise with that name already exists' } as any)
      }
      return prisma.exercise.update({
        where: { id: ex.id },
        data: {
          ...(req.body.name !== undefined && { name: req.body.name }),
          ...(req.body.description !== undefined && { description: req.body.description }),
          ...(req.body.videoUrl !== undefined && { videoUrl: req.body.videoUrl }),
        },
        select: exerciseSelect,
      })
    }
  )

  app.delete(
    '/api/exercises/:id',
    { schema: { params: z.object({ id: z.coerce.number() }) } },
    async (req, reply) => {
      const ex = await prisma.exercise.findUnique({ where: { id: req.params.id } })
      if (!ex) return reply.status(404).send({ error: 'Not found' } as any)
      const inUse = await prisma.workoutSessionBlock.count({ where: { exerciseId: ex.id } })
      if (inUse > 0) return reply.status(409).send({ error: 'Exercise is used in a workout and cannot be deleted' } as any)
      await prisma.exercise.delete({ where: { id: ex.id } })
      return reply.status(204).send()
    }
  )
}
