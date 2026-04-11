import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { ZodTypeProvider, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import authPlugin from './plugins/auth.js'
import { authRoutes } from './routes/auth.js'
import { workoutRoutes } from './routes/workouts.js'
import { exerciseRoutes } from './routes/exercises.js'

const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>()

app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

await app.register(cors, {
  origin: true,
  credentials: true,
})

await app.register(authPlugin)
await app.register(authRoutes)
await app.register(workoutRoutes)
await app.register(exerciseRoutes)

try {
  await app.listen({ port: 3000, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
