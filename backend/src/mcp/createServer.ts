import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerWorkoutTools } from './tools/workouts.js'
import { registerExerciseTools } from './tools/exercises.js'
import { registerProgressTools } from './tools/progress.js'
import { registerTrainingProfileTools } from './tools/trainingProfile.js'
import { registerGuidelinesTools } from './tools/guidelines.js'
import { registerSignalsTools } from './tools/signals.js'

// Built fresh per HTTP request (stateless Streamable HTTP mode) so every
// tool call is closed over the userId resolved from that request's bearer
// token. No shared/global server instance — that's what keeps one user's
// agent from ever touching another user's data.
export function createMcpServerForUser(userId: number): McpServer {
  const server = new McpServer({ name: 'mytrainingapp', version: '1.0.0' })

  registerWorkoutTools(server, userId)
  registerExerciseTools(server, userId)
  registerProgressTools(server, userId)
  registerTrainingProfileTools(server, userId)
  registerGuidelinesTools(server, userId)
  registerSignalsTools(server, userId)

  return server
}
