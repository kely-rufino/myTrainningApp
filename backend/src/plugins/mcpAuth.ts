import type { FastifyRequest } from 'fastify'
import { httpError } from '../lib/httpError.js'
import { resolveApiToken } from '../lib/apiTokens.js'

// Bearer-token auth for the /mcp endpoint. Deliberately not a Fastify
// onRequest hook: it needs to resolve to a userId *before* handing the raw
// req/res off to the MCP SDK transport, and it uses a different credential
// (a PAT, not the browser's JWT cookie) than the rest of the API.
export async function authenticateMcpRequest(request: FastifyRequest): Promise<number> {
  const header = request.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    throw httpError(401, 'Missing or malformed Authorization header (expected "Bearer <token>")')
  }

  const raw = header.slice('Bearer '.length).trim()
  const userId = await resolveApiToken(raw)
  if (!userId) throw httpError(401, 'Invalid, expired, or revoked token')

  return userId
}
