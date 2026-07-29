import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as trainingProfileService from '../../services/trainingProfileService.js'
import { equipmentSchema, spaceFootprintSchema, EQUIPMENT } from '../../lib/exerciseTaxonomy.js'
import { equipmentInventoryInputSchema } from '../../lib/equipmentInventory.js'
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
  PRIMARY_OUTCOMES,
  EXCLUSION_REASONS,
  INJURY_CONDITIONS,
} from '../../lib/trainingVocab.js'
import { run } from '../toolResult.js'

export function registerTrainingProfileTools(server: McpServer, userId: number) {
  server.registerTool(
    'get_training_profile',
    {
      title: 'Get training profile',
      description:
        "The user's stored training constraints: experience level (1-10), primary and secondary " +
        'outcomes, equipment inventory with actual loads, space, days and minutes per session, ' +
        'injuries, excluded exercises, sleep and life stress — plus age/weight/height. ALWAYS ' +
        'read this before building or changing a workout plan; if fields the user has told you ' +
        'about are missing, save them with update_training_profile so every future session and ' +
        'client starts from the same facts. When `equipmentLoadsUnknown` is true the inventory ' +
        'records what the user owns but not how much it loads — ask before prescribing loads, ' +
        'and do not read a missing `loads` array as "no weight available".',
    },
    async () => run(() => trainingProfileService.getTrainingProfile(userId))
  )

  server.registerTool(
    'update_training_profile',
    {
      title: 'Update training profile',
      description:
        'Save training constraints the user has stated (only pass fields to change; arrays ' +
        `replace the stored value). Outcomes: ${PRIMARY_OUTCOMES.join(', ')} — primaryOutcome is ` +
        'what they are training for, secondaryOutcomes anything else that must also be satisfied. ' +
        `Equipment types: ${EQUIPMENT.join(', ')}; prefer equipmentInventory over the flat ` +
        'equipment array so loads are recorded ({ type: "dumbbell", pairs: 2, loads: [6,8,10], ' +
        'unit: "kg" }) — omit `loads` when you do not know them rather than guessing. ' +
        `Exclusion reasons: ${EXCLUSION_REASONS.join(', ')}. ` +
        `Injury conditions: ${INJURY_CONDITIONS.join(', ')} — map what the user described to the ` +
        'closest condition; put anything that does not fit in notes. Set adherenceTier only when ' +
        'the user explicitly tells you their training history is not fully logged; otherwise it ' +
        'is derived from execution history by get_training_signals.',
      inputSchema: {
        experienceLevel: experienceLevelSchema.nullable().optional(),
        goal: goalSchema.nullable().optional().describe('Deprecated — use primaryOutcome'),
        primaryOutcome: primaryOutcomeSchema.nullable().optional(),
        secondaryOutcomes: z.array(primaryOutcomeSchema).optional(),
        equipment: z.array(equipmentSchema).optional().describe('Deprecated — use equipmentInventory'),
        equipmentInventory: equipmentInventoryInputSchema.optional(),
        spaceConstraint: spaceFootprintSchema.nullable().optional(),
        daysPerWeek: daysPerWeekSchema.nullable().optional(),
        minutesPerSession: minutesPerSessionSchema.nullable().optional(),
        injuries: z.array(injuryConditionSchema).optional(),
        excludedExercises: z
          .array(z.object({ exerciseId: z.number().int(), reason: exclusionReasonSchema }))
          .optional(),
        adherenceTier: adherenceTierSchema.nullable().optional().describe('Manual override only'),
        typicalSleepHours: typicalSleepHoursSchema.nullable().optional(),
        lifeStressLevel: lifeStressLevelSchema.nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
      },
    },
    async (args) => run(() => trainingProfileService.updateTrainingProfile(userId, args))
  )
}
