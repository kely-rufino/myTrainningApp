import type { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'

const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
  lastName: z.string(),
})

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
}

export async function authRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>()

  app.post(
    '/api/auth/register',
    {
      schema: {
        body: z.object({
          email: z.email(),
          name: z.string().min(1),
          lastName: z.string().min(1),
          password: z.string().min(8),
        }),
        response: { 201: userSchema },
      },
    },
    async (request, reply) => {
      const { email, name, lastName, password } = request.body

      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) {
        return reply.status(409).send({ error: 'Email already in use' } as any)
      }

      const hashed = await bcrypt.hash(password, 10)
      const user = await prisma.user.create({
        data: { email, name, lastName, password: hashed },
      })

      const token = fastify.jwt.sign({ sub: user.id, email: user.email })
      reply.setCookie('token', token, cookieOptions)

      return reply.status(201).send({ id: user.id, email: user.email, name: user.name, lastName: user.lastName })
    }
  )

  app.post(
    '/api/auth/login',
    {
      schema: {
        body: z.object({
          email: z.email(),
          password: z.string(),
        }),
        response: { 200: userSchema },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body

      const user = await prisma.user.findUnique({ where: { email } })
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return reply.status(401).send({ error: 'Invalid credentials' } as any)
      }

      const token = fastify.jwt.sign({ sub: user.id, email: user.email })
      reply.setCookie('token', token, cookieOptions)

      return { id: user.id, email: user.email, name: user.name, lastName: user.lastName }
    }
  )

  app.post('/api/auth/logout', async (_, reply) => {
    reply.clearCookie('token', { path: '/' })
    return { ok: true }
  })

  app.get(
    '/api/auth/me',
    {
      onRequest: [fastify.authenticate],
      schema: { response: { 200: userSchema } },
    },
    async (request, reply) => {
      const user = await prisma.user.findUnique({ where: { id: request.user.sub } })
      if (!user) return reply.status(404).send({ error: 'User not found' } as any)
      return { id: user.id, email: user.email, name: user.name, lastName: user.lastName }
    }
  )
}
