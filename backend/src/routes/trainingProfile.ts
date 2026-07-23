import type { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import * as trainingProfileService from '../services/trainingProfileService.js'
import { equipmentSchema, spaceFootprintSchema } from '../lib/exerciseTaxonomy.js'
import {
  goalSchema,
  injuryConditionSchema,
  experienceLevelSchema,
  daysPerWeekSchema,
} from '../lib/trainingVocab.js'

const profileResponse = z.object({
  experienceLevel: z.number().nullable(),
  goal: z.string().nullable(),
  equipment: z.array(z.string()),
  spaceConstraint: z.string().nullable(),
  daysPerWeek: z.number().nullable(),
  injuries: z.array(z.string()),
  notes: z.string().nullable(),
  updatedAt: z.string().nullable(),
  age: z.number().nullable(),
  weight: z.number().nullable(),
  height: z.number().nullable(),
  unitPreference: z.string().nullable(),
})

export async function trainingProfileRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  app.addHook('onRequest', fastify.authenticate)

  app.get(
    '/api/training-profile',
    { schema: { response: { 200: profileResponse } } },
    async (req) => trainingProfileService.getTrainingProfile(req.user.sub)
  )

  app.patch(
    '/api/training-profile',
    {
      schema: {
        body: z.object({
          experienceLevel: experienceLevelSchema.nullable().optional(),
          goal: goalSchema.nullable().optional(),
          equipment: z.array(equipmentSchema).optional(),
          spaceConstraint: spaceFootprintSchema.nullable().optional(),
          daysPerWeek: daysPerWeekSchema.nullable().optional(),
          injuries: z.array(injuryConditionSchema).optional(),
          notes: z.string().max(2000).nullable().optional(),
        }),
        response: { 200: profileResponse },
      },
    },
    async (req) => trainingProfileService.updateTrainingProfile(req.user.sub, req.body)
  )
}
