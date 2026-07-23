import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as trainingProfileService from '../../services/trainingProfileService.js'
import { equipmentSchema, spaceFootprintSchema, EQUIPMENT } from '../../lib/exerciseTaxonomy.js'
import {
  goalSchema,
  injuryConditionSchema,
  experienceLevelSchema,
  daysPerWeekSchema,
  GOALS,
  INJURY_CONDITIONS,
} from '../../lib/trainingVocab.js'
import { run } from '../toolResult.js'

export function registerTrainingProfileTools(server: McpServer, userId: number) {
  server.registerTool(
    'get_training_profile',
    {
      title: 'Get training profile',
      description:
        "The user's stored training constraints: experience level (1-10), goal, available " +
        'equipment, space, days/week, injuries — plus age/weight/height. ALWAYS read this ' +
        'before building or changing a workout plan; if fields the user has told you about ' +
        'are missing, save them with update_training_profile so every future session and ' +
        'client starts from the same facts.',
    },
    async () => run(() => trainingProfileService.getTrainingProfile(userId))
  )

  server.registerTool(
    'update_training_profile',
    {
      title: 'Update training profile',
      description:
        'Save training constraints the user has stated (only pass fields to change; arrays ' +
        `replace the stored value). Goals: ${GOALS.join(', ')}. Equipment tags: ${EQUIPMENT.join(', ')}. ` +
        `Injury conditions: ${INJURY_CONDITIONS.join(', ')} — map what the user described to the ` +
        'closest condition; put anything that does not fit in notes.',
      inputSchema: {
        experienceLevel: experienceLevelSchema.nullable().optional(),
        goal: goalSchema.nullable().optional(),
        equipment: z.array(equipmentSchema).optional(),
        spaceConstraint: spaceFootprintSchema.nullable().optional(),
        daysPerWeek: daysPerWeekSchema.nullable().optional(),
        injuries: z.array(injuryConditionSchema).optional(),
        notes: z.string().max(2000).nullable().optional(),
      },
    },
    async (args) => run(() => trainingProfileService.updateTrainingProfile(userId, args))
  )
}
