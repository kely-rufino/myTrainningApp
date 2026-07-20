import type { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import * as progressService from '../services/progressService.js'

export async function progressRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  app.addHook('onRequest', fastify.authenticate)

  app.get('/api/history', async (req) => progressService.getHistory(req.user.sub))

  app.get('/api/progress/exercises', async (req) => progressService.getTrackedExercises(req.user.sub))

  app.get(
    '/api/progress/exercise/:id',
    { schema: { params: z.object({ id: z.coerce.number() }) } },
    async (req) => progressService.getExerciseProgress(req.user.sub, req.params.id)
  )
}
