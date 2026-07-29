import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as trainingSignalsService from '../../services/trainingSignalsService.js'
import { run } from '../toolResult.js'

export function registerSignalsTools(server: McpServer, userId: number) {
  server.registerTool(
    'get_training_signals',
    {
      title: 'Get training signals',
      description:
        "Derived state from the user's own logged training: per-exercise stalls, regressions, " +
        'estimated 1RM trend and abandonment; per-muscle recency and weekly set counts; session ' +
        'duration, set completion and observed rest intervals; and a derived adherence tier. ' +
        'Call this before adjusting an existing plan — it is the difference between a generic ' +
        'plan and one fitted to this person. Read `interpretation` and each signal\'s `caveats` ' +
        'before acting: several signals have known confounders (a missing log is not a skipped ' +
        'session, a prescribed deload is not a regression) and proposing changes without them ' +
        'produces confident, wrong advice. `missingInputs` lists what to ask the user to sharpen ' +
        'the read. Nothing here mutates the plan.',
      inputSchema: {
        sinceDays: z
          .number()
          .int()
          .min(7)
          .max(365)
          .optional()
          .describe('Observation window in days (default 56)'),
      },
    },
    async ({ sinceDays }) => run(() => trainingSignalsService.getTrainingSignals(userId, { sinceDays }))
  )
}
