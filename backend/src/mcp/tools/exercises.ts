import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as exerciseService from '../../services/exerciseService.js'
import {
  equipmentSchema,
  muscleSchema,
  movementPatternSchema,
  spaceFootprintSchema,
  difficultySchema,
  EQUIPMENT,
  MOVEMENT_PATTERNS,
} from '../../lib/exerciseTaxonomy.js'
import { run } from '../toolResult.js'

// Exercises are a global library shared by all users (not scoped to the
// caller). Reads are open; curated rows are read-only — agents can only
// create new (uncurated) exercises or edit/delete uncurated ones. userId is
// accepted for a consistent register*Tools(server, userId) shape.
export function registerExerciseTools(server: McpServer, _userId: number) {
  server.registerTool(
    'search_exercises',
    {
      title: 'Search exercises',
      description:
        'Search the exercise library (curated and user/agent-created) with filters. ' +
        'Always query with filters ' +
        '(equipment, movementPattern, primaryMuscle, …) instead of paging through everything — ' +
        'results are compact; call get_exercise for full instructions. ' +
        `Equipment tags: ${EQUIPMENT.join(', ')}. Movement patterns: ${MOVEMENT_PATTERNS.join(', ')}.`,
      inputSchema: {
        query: z.string().min(1).max(100).optional().describe('Text match on name or alias'),
        equipment: z.array(equipmentSchema).optional().describe('Match exercises using ANY of these'),
        movementPattern: movementPatternSchema.optional(),
        primaryMuscle: muscleSchema.optional(),
        difficulty: difficultySchema.optional(),
        spaceFootprint: spaceFootprintSchema.optional(),
        includeUncurated: z.boolean().optional().describe('Include unvetted user/agent-created exercises (default true). Pass false for vetted library rows only.'),
        limit: z.number().int().positive().max(100).optional(),
        offset: z.number().int().nonnegative().optional(),
      },
    },
    async (args) => run(() => exerciseService.searchExercises(args))
  )

  server.registerTool(
    'get_exercise',
    {
      title: 'Get exercise',
      description: 'Get one exercise with full description/instructions, taxonomy, and aliases.',
      inputSchema: { exerciseId: z.number().int() },
    },
    async ({ exerciseId }) => run(() => exerciseService.getExercise(exerciseId))
  )

  server.registerTool(
    'create_exercise',
    {
      title: 'Create exercise',
      description:
        'Add a new exercise to the library. Search first (including aliases) — creating a ' +
        'duplicate under a different name is rejected when the name is a known alias. ' +
        'Full taxonomy is required so the exercise stays filterable. New exercises are ' +
        'uncurated until reviewed.',
      inputSchema: {
        name: z.string().min(1).max(100),
        description: z.string().max(2000).optional(),
        videoUrl: z.string().url().nullable().optional(),
        equipment: z.array(equipmentSchema).min(1),
        primaryMuscle: muscleSchema,
        secondaryMuscles: z.array(muscleSchema).optional(),
        movementPattern: movementPatternSchema,
        spaceFootprint: spaceFootprintSchema.optional(),
        difficulty: difficultySchema,
      },
    },
    async (args) => run(() => exerciseService.createExercise({ ...args, source: 'agent' }))
  )

  server.registerTool(
    'update_exercise',
    {
      title: 'Update exercise',
      description: 'Edit an UNCURATED exercise (curated library rows are read-only).',
      inputSchema: {
        exerciseId: z.number().int(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(2000).nullable().optional(),
        videoUrl: z.string().url().nullable().optional(),
        equipment: z.array(equipmentSchema).optional(),
        primaryMuscle: muscleSchema.optional(),
        secondaryMuscles: z.array(muscleSchema).optional(),
        movementPattern: movementPatternSchema.optional(),
        spaceFootprint: spaceFootprintSchema.optional(),
        difficulty: difficultySchema.optional(),
      },
    },
    async ({ exerciseId, ...data }) => run(() => exerciseService.updateExercise(exerciseId, data))
  )

  server.registerTool(
    'delete_exercise',
    {
      title: 'Delete exercise',
      description:
        'Delete an UNCURATED exercise (fails if curated or used in any workout).',
      inputSchema: { exerciseId: z.number().int() },
    },
    async ({ exerciseId }) => run(() => exerciseService.deleteExercise(exerciseId))
  )
}
