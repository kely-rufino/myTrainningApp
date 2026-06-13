import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'

function isPrismaKnownError(err: unknown): err is Error & { code: string } {
  return err instanceof Error && err.constructor.name === 'PrismaClientKnownRequestError' && 'code' in err
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

    const status = error.statusCode ?? 500

    if (status >= 500) {
      request.log.error({ err: error }, 'Unhandled server error')
    }

    return reply.status(status).send({
      error: status === 500 ? 'Internal server error' : error.message,
    })
  })
})
