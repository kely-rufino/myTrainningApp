import { randomUUID } from 'node:crypto'
import path from 'node:path'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { ZodTypeProvider, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import authPlugin from './plugins/auth.js'
import errorHandler from './plugins/errorHandler.js'
import { authRoutes } from './routes/auth.js'
import { workoutRoutes } from './routes/workouts.js'
import { exerciseRoutes } from './routes/exercises.js'
import { progressRoutes } from './routes/progress.js'

import './instrument.js'
import * as Sentry from '@sentry/node'

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
  }).withTypeProvider<ZodTypeProvider>()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  await app.register(cors, { origin: true, credentials: true })
  Sentry.setupFastifyErrorHandler(app)
  await app.register(errorHandler)
  await app.register(authPlugin)
  await app.register(authRoutes)
  await app.register(workoutRoutes)
  await app.register(exerciseRoutes)
  await app.register(progressRoutes)

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
