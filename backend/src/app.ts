import { randomUUID } from 'node:crypto'
import path from 'node:path'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import { ZodTypeProvider, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import authPlugin from './plugins/auth.js'
import errorHandler from './plugins/errorHandler.js'
import { authRoutes } from './routes/auth.js'
import { workoutRoutes } from './routes/workouts.js'
import { exerciseRoutes } from './routes/exercises.js'
import { progressRoutes } from './routes/progress.js'
import { apiTokenRoutes } from './routes/apiTokens.js'
import { trainingProfileRoutes } from './routes/trainingProfile.js'
import { mcpRoutes } from './routes/mcp.js'

import './instrument.js'
import * as Sentry from '@sentry/node'

// In production the frontend is served from this same origin, so no cross-origin
// browser traffic is expected; CORS_ORIGINS exists as an escape hatch. MCP
// clients authenticate with a Bearer token rather than the cookie, so they are
// unaffected by this list.
function corsOrigins(): string[] | boolean {
  const configured = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean)
  if (configured?.length) return configured
  if (process.env.NODE_ENV === 'production') {
    return process.env.APP_URL ? [process.env.APP_URL] : false
  }
  return ['http://localhost:5173', 'http://localhost:3000']
}

export async function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test'
      ? false
      : {
          level: process.env.LOG_LEVEL ?? 'info',
          redact: {
            paths: ['req.headers.cookie', 'req.body.password', 'req.body.token'],
            censor: '[REDACTED]',
          },
        },
    genReqId: () => randomUUID(),
    // Railway terminates TLS at its edge and forwards X-Forwarded-For. Without
    // this, req.ip is the proxy's address and rate limiting buckets every
    // client into one counter.
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  await app.register(helmet, {
    // CSP left off for now — the frontend needs an audit for inline styles and
    // Sentry's endpoints before a policy can be enforced without breaking it.
    contentSecurityPolicy: false,
    hsts: { maxAge: 31536000, includeSubDomains: true },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'deny' },
  })

  // Registered globally so the plugin is available, but off by default: only
  // the auth routes opt in via their per-route `config.rateLimit`.
  await app.register(rateLimit, { global: false })

  await app.register(cors, { origin: corsOrigins(), credentials: true })
  Sentry.setupFastifyErrorHandler(app)
  await app.register(errorHandler)
  await app.register(authPlugin)
  await app.register(authRoutes)
  await app.register(workoutRoutes)
  await app.register(exerciseRoutes)
  await app.register(progressRoutes)
  await app.register(apiTokenRoutes)
  await app.register(trainingProfileRoutes)
  await app.register(mcpRoutes)

  app.get('/health', async () => ({ status: 'ok' }))

  if (process.env.NODE_ENV === 'production') {
    const frontendDist = path.join(process.cwd(), 'frontend', 'dist')
    await app.register(fastifyStatic, { root: frontendDist })
    app.setNotFoundHandler((_, reply) => {
      reply.sendFile('index.html')
    })
  }

  return app
}
