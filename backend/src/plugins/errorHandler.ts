import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import * as Sentry from '@sentry/node'

function isPrismaKnownError(err: unknown): err is Error & { code: string } {
  return err instanceof Error && err.constructor.name === 'PrismaClientKnownRequestError' && 'code' in err
}

function toHttpError(err: unknown): { statusCode: number; message: string } {
  if (err instanceof Error) {
    const statusCode = 'statusCode' in err && typeof (err as Record<string, unknown>).statusCode === 'number'
      ? (err as Error & { statusCode: number }).statusCode
      : 500
    return { statusCode, message: err.message }
  }
  return { statusCode: 500, message: 'Internal server error' }
}

export default fp(async (fastify: FastifyInstance) => {
  fastify.setErrorHandler((error, request, reply) => {
    if (isPrismaKnownError(error)) {
      if (error.code === 'P2002') {
        return reply.status(409).send({ error: 'A record with that value already exists' })
      }
      if (error.code === 'P2025') {
        return reply.status(404).send({ error: 'Record not found' })
      }
    }

    const { statusCode, message } = toHttpError(error)

    if (statusCode >= 500) {
      request.log.error({ err: error }, 'Unhandled server error')
      Sentry.captureException(error)
    }

    return reply.status(statusCode).send({
      error: statusCode === 500 ? 'Internal server error' : message,
    })
  })
})
