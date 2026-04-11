import Fastify from 'fastify'
import cors from '@fastify/cors'
import { ZodTypeProvider, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { z } from 'zod'

const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>()

app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

await app.register(cors, {
  origin: 'http://localhost:5173',
})

app.get(
  '/api/ping',
  {
    schema: {
      response: {
        200: z.object({
          message: z.string(),
          timestamp: z.string(),
        }),
      },
    },
  },
  async () => {
    return { message: 'pong', timestamp: new Date().toISOString() }
  }
)

try {
  await app.listen({ port: 3000 })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
