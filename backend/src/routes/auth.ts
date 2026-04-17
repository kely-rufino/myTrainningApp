import type { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'

function hasSequentialDigits(pw: string): boolean {
  for (let i = 0; i < pw.length - 3; i++) {
    const a = pw.charCodeAt(i)
    if (a < 48 || a > 57) continue
    if (
      pw.charCodeAt(i + 1) === a + 1 &&
      pw.charCodeAt(i + 2) === a + 2 &&
      pw.charCodeAt(i + 3) === a + 3
    ) return true
  }
  return false
}

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .refine(pw => /[A-Z]/.test(pw), 'Password must contain at least 1 capital letter')
  .refine(pw => /[^a-zA-Z0-9]/.test(pw), 'Password must contain at least 1 special character')
  .refine(pw => !hasSequentialDigits(pw), 'Password must not contain sequential numbers (e.g. 1234)')

const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
  lastName: z.string(),
  weight: z.number().nullable(),
  height: z.number().nullable(),
  dateOfBirth: z.string().nullable(),
  unitPreference: z.string().nullable(),
  weekStartDay: z.number().nullable(),
  avatar: z.string().nullable(),
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
          password: passwordSchema,
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

      return reply.status(201).send({ id: user.id, email: user.email, name: user.name, lastName: user.lastName, weight: null, height: null, dateOfBirth: null, unitPreference: 'metric', weekStartDay: 1, avatar: null })
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

      return { id: user.id, email: user.email, name: user.name, lastName: user.lastName, weight: user.weight, height: user.height, dateOfBirth: user.dateOfBirth?.toISOString().slice(0, 10) ?? null, unitPreference: user.unitPreference, weekStartDay: user.weekStartDay, avatar: user.avatar }
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
      return { id: user.id, email: user.email, name: user.name, lastName: user.lastName, weight: user.weight, height: user.height, dateOfBirth: user.dateOfBirth?.toISOString().slice(0, 10) ?? null, unitPreference: user.unitPreference, weekStartDay: user.weekStartDay, avatar: user.avatar }
    }
  )

  // ── Profile ───────────────────────────────────────────────────────────────

  app.patch(
    '/api/profile',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: z.object({
          name: z.string().min(1).optional(),
          lastName: z.string().min(1).optional(),
          email: z.email().optional(),
          weight: z.number().positive().nullable().optional(),
          height: z.number().positive().nullable().optional(),
          dateOfBirth: z.string().nullable().optional(),
          unitPreference: z.enum(['metric', 'imperial']).optional(),
          weekStartDay: z.number().int().min(0).max(1).optional(),
          avatar: z.string().nullable().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { email, dateOfBirth, ...rest } = request.body
      if (email) {
        const existing = await prisma.user.findUnique({ where: { email } })
        if (existing && existing.id !== request.user.sub) {
          return reply.status(409).send({ error: 'Email already in use' } as any)
        }
      }
      const user = await prisma.user.update({
        where: { id: request.user.sub },
        data: {
          ...rest,
          ...(email !== undefined && { email }),
          ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }),
        },
      })
      return { id: user.id, email: user.email, name: user.name, lastName: user.lastName, weight: user.weight, height: user.height, dateOfBirth: user.dateOfBirth?.toISOString().slice(0, 10) ?? null, unitPreference: user.unitPreference, weekStartDay: user.weekStartDay, avatar: user.avatar }
    }
  )

  app.delete(
    '/api/profile',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      await prisma.user.update({
        where: { id: request.user.sub },
        data: { deletedAt: new Date() },
      })
      reply.clearCookie('token', { path: '/' })
      return reply.status(204).send()
    }
  )
}
