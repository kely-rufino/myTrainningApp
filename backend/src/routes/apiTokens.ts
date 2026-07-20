import type { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { httpError } from '../lib/httpError.js'
import { createApiToken } from '../lib/apiTokens.js'

const tokenSchema = z.object({
  id: z.number(),
  name: z.string(),
  tokenPrefix: z.string(),
  lastUsedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
})

function serialize(t: {
  id: number
  name: string
  tokenPrefix: string
  lastUsedAt: Date | null
  expiresAt: Date | null
  createdAt: Date
}) {
  return {
    id: t.id,
    name: t.name,
    tokenPrefix: t.tokenPrefix,
    lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
    expiresAt: t.expiresAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  }
}

export async function apiTokenRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  app.addHook('onRequest', fastify.authenticate)

  // Tokens let an MCP client (or any Bearer-authenticated caller) act as this
  // user against the /mcp endpoint. Never return the hash or the raw token
  // except once, at creation time.

  app.get(
    '/api/tokens',
    { schema: { response: { 200: z.array(tokenSchema) } } },
    async (req) => {
      const tokens = await prisma.apiToken.findMany({
        where: { userId: req.user.sub },
        orderBy: { createdAt: 'desc' },
      })
      return tokens.map(serialize)
    }
  )

  app.post(
    '/api/tokens',
    {
      schema: {
        body: z.object({
          name: z.string().min(1).max(100),
          expiresInDays: z.number().int().positive().optional(),
        }),
        response: { 201: tokenSchema.extend({ token: z.string() }) },
      },
    },
    async (req, reply) => {
      const expiresAt = req.body.expiresInDays
        ? new Date(Date.now() + req.body.expiresInDays * 24 * 60 * 60 * 1000)
        : null
      const created = await createApiToken(req.user.sub, req.body.name, expiresAt)
      return reply.status(201).send({ ...serialize(created), token: created.token })
    }
  )

  app.delete(
    '/api/tokens/:id',
    { schema: { params: z.object({ id: z.coerce.number() }) } },
    async (req, reply) => {
      const token = await prisma.apiToken.findFirst({
        where: { id: req.params.id, userId: req.user.sub },
      })
      if (!token) throw httpError(404, 'Not found')
      await prisma.apiToken.delete({ where: { id: token.id } })
      return reply.status(204).send()
    }
  )
}
