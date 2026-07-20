import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as exerciseService from '../../services/exerciseService.js'
import { run } from '../toolResult.js'

// Exercises are a global library shared by all users (not scoped to the
// caller) — same as the REST API. userId is accepted for a consistent
// register*Tools(server, userId) shape even though it isn't used here.
export function registerExerciseTools(server: McpServer, _userId: number) {
  server.registerTool(
    'list_exercises',
    { title: 'List exercises', description: 'List the global exercise library.' },
    async () => run(() => exerciseService.listExercises())
  )

  server.registerTool(
    'create_exercise',
    {
      title: 'Create exercise',
      description: 'Add a new exercise to the global library.',
      inputSchema: {
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        videoUrl: z.string().url().nullable().optional(),
      },
    },
    async (args) => run(() => exerciseService.createExercise(args))
  )

  server.registerTool(
    'update_exercise',
    {
      title: 'Update exercise',
      description: 'Edit an exercise in the global library.',
      inputSchema: {
        exerciseId: z.number().int(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).nullable().optional(),
        videoUrl: z.string().url().nullable().optional(),
      },
    },
    async ({ exerciseId, ...data }) => run(() => exerciseService.updateExercise(exerciseId, data))
  )

  server.registerTool(
    'delete_exercise',
    {
      title: 'Delete exercise',
      description: 'Delete an exercise from the global library (fails if it is used in any workout).',
      inputSchema: { exerciseId: z.number().int() },
    },
    async ({ exerciseId }) => run(() => exerciseService.deleteExercise(exerciseId))
  )
}
