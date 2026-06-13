import type { FastifyInstance } from 'fastify'

function httpError(statusCode: number, message: string): Error {
  return Object.assign(new Error(message), { statusCode })
}
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { Resend } from 'resend'
import { prisma } from '../lib/prisma.js'
import { passwordSchema } from '../lib/password.js'

const resend = new Resend(process.env.RESEND_API_KEY)

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
      if (existing) throw httpError(409, 'Email already in use')

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
        throw httpError(401, 'Invalid credentials')
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
      if (!user) throw httpError(404, 'User not found')
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
          throw httpError(409, 'Email already in use')
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

  // ── Forgot / Reset password ───────────────────────────────────────────────

  app.post(
    '/api/auth/forgot-password',
    {
      schema: {
        body: z.object({ email: z.email() }),
        response: { 200: z.object({ ok: z.boolean() }) },
      },
    },
    async (request, reply) => {
      const { email } = request.body
      const user = await prisma.user.findUnique({ where: { email } })
      // Always return 200 — don't reveal whether the email exists
      if (!user) return { ok: true }

      const token = crypto.randomBytes(32).toString('hex')
      const expiry = new Date(Date.now() + 1000 * 60 * 60) // 1 hour
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: token, resetTokenExpiry: expiry },
      })

      const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
      const resetUrl = `${appUrl}/reset-password?token=${token}`

      const result = await resend.emails.send({
        from: process.env.RESEND_FROM ?? 'noreply@intiefkal.resend.app',
        to: email,
        subject: 'Reset your MyTraining password',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
            <h2 style="color:#1d4ed8;margin-bottom:8px">Reset your password</h2>
            <p style="color:#374151">Hi ${user.name},</p>
            <p style="color:#374151">Click the button below to set a new password. This link expires in 1 hour.</p>
            <a href="${resetUrl}"
               style="display:inline-block;margin:24px 0;padding:14px 28px;background:#2563eb;color:#fff;border-radius:12px;text-decoration:none;font-weight:600">
              Reset password
            </a>
            <p style="color:#9ca3af;font-size:13px">If you didn't request this, you can ignore this email.</p>
          </div>
        `,
      })
      request.log.info({ emailId: result.data?.id, to: email }, 'Password reset email sent')

      return { ok: true }
    }
  )

  app.post(
    '/api/auth/reset-password',
    {
      schema: {
        body: z.object({
          token: z.string(),
          password: passwordSchema,
        }),
        response: { 200: z.object({ ok: z.boolean() }) },
      },
    },
    async (request, reply) => {
      const { token, password } = request.body
      const user = await prisma.user.findFirst({
        where: {
          resetToken: token,
          resetTokenExpiry: { gt: new Date() },
        },
      })
      if (!user) {
        throw httpError(400, 'Invalid or expired reset token')
      }
      const hashed = await bcrypt.hash(password, 10)
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashed, resetToken: null, resetTokenExpiry: null },
      })
      return { ok: true }
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
