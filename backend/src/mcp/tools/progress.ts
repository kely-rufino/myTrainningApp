import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as progressService from '../../services/progressService.js'
import { run } from '../toolResult.js'

export function registerProgressTools(server: McpServer, userId: number) {
  server.registerTool(
    'get_history',
    { title: 'Get workout history', description: "List the current user's last 30 completed workout executions." },
    async () => run(() => progressService.getHistory(userId))
  )

  server.registerTool(
    'list_tracked_exercises',
    {
      title: 'List tracked exercises',
      description: 'List exercises the user has logged data for, with session count and best weight.',
    },
    async () => run(() => progressService.getTrackedExercises(userId))
  )

  server.registerTool(
    'get_exercise_progress',
    {
      title: 'Get exercise progress',
      description: 'Per-date progression stats (max weight/reps, volume, sets) for one exercise.',
      inputSchema: { exerciseId: z.number().int() },
    },
    async ({ exerciseId }) => run(() => progressService.getExerciseProgress(userId, exerciseId))
  )
}
