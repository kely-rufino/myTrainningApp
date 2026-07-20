import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as workoutService from '../../services/workoutService.js'
import { run } from '../toolResult.js'

export function registerWorkoutTools(server: McpServer, userId: number) {
  // ── Workouts ──────────────────────────────────────────────────────────────

  server.registerTool(
    'list_workouts',
    { title: 'List workouts', description: "List the current user's workout plans." },
    async () => run(() => workoutService.listWorkouts(userId))
  )

  server.registerTool(
    'get_workout',
    {
      title: 'Get workout',
      description: 'Get a workout plan with its full sessions/blocks/sets tree.',
      inputSchema: { workoutId: z.number().int() },
    },
    async ({ workoutId }) => run(() => workoutService.getWorkout(userId, workoutId))
  )

  server.registerTool(
    'create_workout',
    {
      title: 'Create workout',
      description: 'Create a new, empty workout plan.',
      inputSchema: { name: z.string().min(1), instructions: z.string().optional() },
    },
    async (args) => run(() => workoutService.createWorkout(userId, args))
  )

  server.registerTool(
    'update_workout',
    {
      title: 'Update workout',
      description: "Rename a workout or change its instructions.",
      inputSchema: {
        workoutId: z.number().int(),
        name: z.string().min(1).optional(),
        instructions: z.string().nullable().optional(),
      },
    },
    async ({ workoutId, ...data }) => run(() => workoutService.updateWorkout(userId, workoutId, data))
  )

  server.registerTool(
    'delete_workout',
    {
      title: 'Delete workout',
      description: 'Permanently delete a workout plan and everything under it (sessions, blocks, sets, executions).',
      inputSchema: { workoutId: z.number().int() },
    },
    async ({ workoutId }) => run(() => workoutService.deleteWorkout(userId, workoutId))
  )

  // ── Sessions ──────────────────────────────────────────────────────────────

  server.registerTool(
    'create_session',
    {
      title: 'Create session',
      description: 'Add a day/session (e.g. "Day 1 - Push") to a workout plan.',
      inputSchema: { workoutId: z.number().int(), name: z.string().optional() },
    },
    async ({ workoutId, name }) => run(() => workoutService.createSession(userId, workoutId, name))
  )

  server.registerTool(
    'update_session',
    {
      title: 'Update session',
      description: 'Rename a session.',
      inputSchema: { sessionId: z.number().int(), name: z.string().min(1) },
    },
    async ({ sessionId, name }) => run(() => workoutService.updateSession(userId, sessionId, name))
  )

  server.registerTool(
    'delete_session',
    {
      title: 'Delete session',
      description: 'Delete a session and its blocks/sets/executions.',
      inputSchema: { sessionId: z.number().int() },
    },
    async ({ sessionId }) => run(() => workoutService.deleteSession(userId, sessionId))
  )

  // ── Blocks ────────────────────────────────────────────────────────────────

  server.registerTool(
    'create_block',
    {
      title: 'Create block',
      description: 'Add an exercise block to a session.',
      inputSchema: {
        sessionId: z.number().int(),
        exerciseId: z.number().int(),
        instructions: z.string().optional(),
        supersetGroupId: z.string().optional(),
        mode: z.enum(['reps', 'duration']).optional(),
      },
    },
    async ({ sessionId, ...data }) => run(() => workoutService.createBlock(userId, sessionId, data))
  )

  server.registerTool(
    'add_superset_block',
    {
      title: 'Add superset block',
      description: 'Add another exercise to an existing block as a superset (same supersetGroupId).',
      inputSchema: { blockId: z.number().int(), exerciseId: z.number().int() },
    },
    async ({ blockId, exerciseId }) => run(() => workoutService.addSupersetBlock(userId, blockId, exerciseId))
  )

  server.registerTool(
    'update_block',
    {
      title: 'Update block',
      description: "Change a block's exercise, instructions, notes, or reps/duration mode.",
      inputSchema: {
        blockId: z.number().int(),
        exerciseId: z.number().int().optional(),
        instructions: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        mode: z.enum(['reps', 'duration']).optional(),
      },
    },
    async ({ blockId, ...data }) => run(() => workoutService.updateBlock(userId, blockId, data))
  )

  server.registerTool(
    'delete_block',
    {
      title: 'Delete block',
      description: 'Delete a block and its sets/executions.',
      inputSchema: { blockId: z.number().int() },
    },
    async ({ blockId }) => run(() => workoutService.deleteBlock(userId, blockId))
  )

  // ── Items (sets) ──────────────────────────────────────────────────────────

  server.registerTool(
    'create_item',
    {
      title: 'Create set',
      description: 'Add a planned set (reps/weight/duration) to a block.',
      inputSchema: {
        blockId: z.number().int(),
        reps: z.number().int().positive().nullable().optional(),
        weight: z.number().nonnegative().nullable().optional(),
        duration: z.number().int().positive().nullable().optional(),
        instructions: z.string().optional(),
      },
    },
    async ({ blockId, ...data }) => run(() => workoutService.createItem(userId, blockId, data))
  )

  server.registerTool(
    'update_item',
    {
      title: 'Update set',
      description: 'Change a planned set.',
      inputSchema: {
        itemId: z.number().int(),
        reps: z.number().int().positive().nullable().optional(),
        weight: z.number().nonnegative().nullable().optional(),
        duration: z.number().int().positive().nullable().optional(),
        instructions: z.string().nullable().optional(),
      },
    },
    async ({ itemId, ...data }) => run(() => workoutService.updateItem(userId, itemId, data))
  )

  server.registerTool(
    'delete_item',
    {
      title: 'Delete set',
      description: 'Delete a planned set.',
      inputSchema: { itemId: z.number().int() },
    },
    async ({ itemId }) => run(() => workoutService.deleteItem(userId, itemId))
  )

  // ── Calendar / Executions ─────────────────────────────────────────────────

  server.registerTool(
    'get_calendar',
    {
      title: 'Get calendar',
      description: 'List scheduled/logged workout executions between two dates (ISO yyyy-mm-dd).',
      inputSchema: { from: z.string(), to: z.string() },
    },
    async ({ from, to }) => run(() => workoutService.getCalendar(userId, new Date(from), new Date(to)))
  )

  server.registerTool(
    'create_execution',
    {
      title: 'Schedule/start a workout execution',
      description: 'Create a workout execution entry for a given date (optionally tied to a specific session).',
      inputSchema: { workoutId: z.number().int(), sessionId: z.number().int().optional(), date: z.string() },
    },
    async (args) => run(() => workoutService.createExecution(userId, args))
  )

  server.registerTool(
    'start_execution',
    {
      title: 'Start execution',
      description: 'Mark a workout execution as started (sets startedAt to now).',
      inputSchema: { executionId: z.number().int() },
    },
    async ({ executionId }) => run(() => workoutService.startExecution(userId, executionId))
  )

  server.registerTool(
    'finish_execution',
    {
      title: 'Finish execution',
      description: 'Mark a workout execution as finished (sets finishedAt to now).',
      inputSchema: { executionId: z.number().int() },
    },
    async ({ executionId }) => run(() => workoutService.finishExecution(userId, executionId))
  )

  server.registerTool(
    'delete_execution',
    {
      title: 'Delete execution',
      description: 'Delete a workout execution and its logged sets.',
      inputSchema: { executionId: z.number().int() },
    },
    async ({ executionId }) => run(() => workoutService.deleteExecution(userId, executionId))
  )

  server.registerTool(
    'log_set_result',
    {
      title: 'Log set result',
      description: 'Record what was actually done (reps/weight/duration) for one set during an execution.',
      inputSchema: {
        executionId: z.number().int(),
        blockItemId: z.number().int(),
        reps: z.number().int().nullable().optional(),
        weight: z.number().nullable().optional(),
        duration: z.number().int().nullable().optional(),
      },
    },
    async ({ executionId, ...data }) =>
      run(async () => (await workoutService.logSetResult(userId, executionId, data)).result)
  )
}
