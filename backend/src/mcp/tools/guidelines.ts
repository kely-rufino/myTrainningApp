import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as guidelinesService from '../../services/guidelinesService.js'
import { goalSchema, primaryOutcomeSchema, experienceLevelSchema } from '../../lib/trainingVocab.js'
import { run } from '../toolResult.js'

export function registerGuidelinesTools(server: McpServer, userId: number) {
  server.registerTool(
    'get_training_guidelines',
    {
      title: 'Get training guidelines',
      description:
        'Evidence-based programming numbers (weekly sets per muscle, proximity to failure, ' +
        'rest periods, frequency, loading, ordering) selected for the stored training profile. ' +
        'Every value carries an evidence tier and citations — use these numbers when building ' +
        'a plan instead of improvising, and surface missingProfileFields to the user (or pass ' +
        'primaryOutcome/experienceLevel overrides) when the profile is incomplete. Treat ' +
        'evidenceTier "consensus" entries as sound practice, not measured dose-response findings. ' +
        'If `outcomeUnsupported` is true, no rules exist for the user\'s outcome yet — tell them ' +
        'that rather than substituting numbers from a different outcome.',
      inputSchema: {
        primaryOutcome: primaryOutcomeSchema.optional().describe('Override the stored profile outcome'),
        goal: goalSchema.optional().describe('Deprecated — use primaryOutcome'),
        experienceLevel: experienceLevelSchema.optional().describe('Override the stored 1-10 experience level'),
      },
    },
    async (args) => run(() => guidelinesService.getTrainingGuidelines(userId, args))
  )
}
