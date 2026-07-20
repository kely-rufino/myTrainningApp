import type { FastifyInstance } from 'fastify'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { authenticateMcpRequest } from '../plugins/mcpAuth.js'
import { createMcpServerForUser } from '../mcp/createServer.js'

// The MCP endpoint. Auth is a bearer Personal Access Token (see
// routes/apiTokens.ts), not the cookie-based JWT the rest of the API uses —
// this route intentionally does NOT get fastify.authenticate.
//
// Run stateless: a fresh McpServer + transport per request, scoped to the
// user resolved from the token. See mcp/createServer.ts for why.
export async function mcpRoutes(fastify: FastifyInstance) {
  fastify.post('/mcp', async (request, reply) => {
    const userId = await authenticateMcpRequest(request)

    const server = createMcpServerForUser(userId)
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })

    reply.hijack()
    request.raw.on('close', () => {
      transport.close()
      server.close()
    })

    await server.connect(transport)
    await transport.handleRequest(request.raw, reply.raw, request.body)
  })

  // Stateless mode has no server-initiated SSE stream or session to delete.
  fastify.get('/mcp', async (_, reply) => {
    reply.status(405).send({ error: 'Method not allowed (stateless MCP server)' })
  })
  fastify.delete('/mcp', async (_, reply) => {
    reply.status(405).send({ error: 'Method not allowed (stateless MCP server)' })
  })
}
