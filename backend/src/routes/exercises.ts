import type { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import * as exerciseService from '../services/exerciseService.js'

export async function exerciseRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  app.addHook('onRequest', fastify.authenticate)

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
    async () => exerciseService.listExercises()
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
      const exercise = await exerciseService.createExercise(req.body)
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
    async (req) => exerciseService.updateExercise(req.params.id, req.body)
  )

  app.delete(
    '/api/exercises/:id',
    { schema: { params: z.object({ id: z.coerce.number() }) } },
    async (req, reply) => {
      await exerciseService.deleteExercise(req.params.id)
      return reply.status(204).send()
    }
  )
}
