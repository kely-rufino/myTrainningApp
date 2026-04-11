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
}
