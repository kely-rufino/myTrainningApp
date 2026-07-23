import type { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import * as exerciseService from '../services/exerciseService.js'
import {
  equipmentSchema,
  muscleSchema,
  movementPatternSchema,
  spaceFootprintSchema,
  difficultySchema,
} from '../lib/exerciseTaxonomy.js'

const exerciseResponse = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  videoUrl: z.string().nullable(),
  equipment: z.array(z.string()),
  primaryMuscle: z.string().nullable(),
  secondaryMuscles: z.array(z.string()),
  movementPattern: z.string().nullable(),
  spaceFootprint: z.string().nullable(),
  difficulty: z.string().nullable(),
  source: z.string(),
  isCurated: z.boolean(),
})

// Taxonomy is optional over REST (the UI form doesn't collect it yet) but
// validated against the closed vocabularies when present. The MCP tool
// surface requires it — see src/mcp/tools/exercises.ts.
const taxonomyBody = {
  equipment: z.array(equipmentSchema).optional(),
  primaryMuscle: muscleSchema.nullish(),
  secondaryMuscles: z.array(muscleSchema).optional(),
  movementPattern: movementPatternSchema.nullish(),
  spaceFootprint: spaceFootprintSchema.nullish(),
  difficulty: difficultySchema.nullish(),
}

export async function exerciseRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  app.addHook('onRequest', fastify.authenticate)

  app.get(
    '/api/exercises',
    { schema: { response: { 200: z.array(exerciseResponse) } } },
    async () => exerciseService.listExercises()
  )

  app.post(
    '/api/exercises',
    {
      schema: {
        body: z.object({
          name: z.string().min(1).max(100),
          description: z.string().max(2000).optional(),
          videoUrl: z.string().url().nullable().optional(),
          ...taxonomyBody,
        }),
      },
    },
    async (req, reply) => {
      const exercise = await exerciseService.createExercise({ ...req.body, source: 'user' })
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
          description: z.string().max(2000).nullable().optional(),
          videoUrl: z.string().url().nullable().optional(),
          ...taxonomyBody,
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
