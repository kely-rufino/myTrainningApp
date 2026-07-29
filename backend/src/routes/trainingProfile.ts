import type { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import * as trainingProfileService from '../services/trainingProfileService.js'
import { equipmentSchema, spaceFootprintSchema } from '../lib/exerciseTaxonomy.js'
import { equipmentInventoryInputSchema } from '../lib/equipmentInventory.js'
import {
  goalSchema,
  primaryOutcomeSchema,
  injuryConditionSchema,
  exclusionReasonSchema,
  adherenceTierSchema,
  lifeStressLevelSchema,
  experienceLevelSchema,
  daysPerWeekSchema,
  minutesPerSessionSchema,
  typicalSleepHoursSchema,
} from '../lib/trainingVocab.js'

const inventoryItemResponse = z.object({
  type: z.string(),
  pairs: z.number().optional(),
  loads: z.array(z.number()).optional(),
  barWeight: z.number().optional(),
  plates: z.array(z.number()).optional(),
  adjustable: z.boolean().optional(),
  resistances: z.array(z.string()).optional(),
  unit: z.string().optional(),
})

const profileResponse = z.object({
  experienceLevel: z.number().nullable(),
  goal: z.string().nullable(),
  primaryOutcome: z.string().nullable(),
  secondaryOutcomes: z.array(z.string()),
  equipment: z.array(z.string()),
  equipmentInventory: z.array(inventoryItemResponse),
  equipmentLoadsUnknown: z.boolean(),
  spaceConstraint: z.string().nullable(),
  daysPerWeek: z.number().nullable(),
  minutesPerSession: z.number().nullable(),
  injuries: z.array(z.string()),
  excludedExercises: z.array(
    z.object({ exerciseId: z.number(), reason: z.string(), addedAt: z.string() })
  ),
  adherenceTierOverride: z.string().nullable(),
  consecutiveWeeksOk: z.number().nullable(),
  typicalSleepHours: z.number().nullable(),
  lifeStressLevel: z.string().nullable(),
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
          // Deprecated: accepted and translated to primaryOutcome so old
          // clients keep working through one release.
          goal: goalSchema.nullable().optional(),
          primaryOutcome: primaryOutcomeSchema.nullable().optional(),
          secondaryOutcomes: z.array(primaryOutcomeSchema).optional(),
          // Deprecated flat form; equipmentInventory carries the load data.
          equipment: z.array(equipmentSchema).optional(),
          equipmentInventory: equipmentInventoryInputSchema.optional(),
          spaceConstraint: spaceFootprintSchema.nullable().optional(),
          daysPerWeek: daysPerWeekSchema.nullable().optional(),
          minutesPerSession: minutesPerSessionSchema.nullable().optional(),
          injuries: z.array(injuryConditionSchema).optional(),
          excludedExercises: z
            .array(z.object({ exerciseId: z.number().int(), reason: exclusionReasonSchema }))
            .optional(),
          adherenceTier: adherenceTierSchema.nullable().optional(),
          typicalSleepHours: typicalSleepHoursSchema.nullable().optional(),
          lifeStressLevel: lifeStressLevelSchema.nullable().optional(),
          notes: z.string().max(2000).nullable().optional(),
        }),
        response: { 200: profileResponse },
      },
    },
    async (req) => trainingProfileService.updateTrainingProfile(req.user.sub, req.body)
  )
}
