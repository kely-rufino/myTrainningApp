import type { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

export async function exerciseRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  app.addHook('onRequest', fastify.authenticate)

  app.get(
    '/api/exercises',
    {
      schema: {
        response: {
          200: z.array(z.object({ id: z.number(), name: z.string(), description: z.string().nullable() })),
        },
      },
    },
    async () =>
      prisma.exercise.findMany({
        select: { id: true, name: true, description: true },
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
        }),
      },
    },
    async (req, reply) => {
      const exists = await prisma.exercise.findUnique({ where: { name: req.body.name } })
      if (exists) return reply.status(409).send({ error: 'An exercise with that name already exists' } as any)
      const exercise = await prisma.exercise.create({
        data: { name: req.body.name, description: req.body.description ?? null },
        select: { id: true, name: true, description: true },
      })
      return reply.status(201).send(exercise)
    }
  )
}
