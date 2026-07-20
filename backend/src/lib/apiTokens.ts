import crypto from 'node:crypto'
import { prisma } from './prisma.js'

const TOKEN_PREFIX = 'mcp_'
const PREFIX_DISPLAY_LEN = 12 // "mcp_" + 8 chars, enough to recognize a token in a list

export function generateToken(): string {
  return TOKEN_PREFIX + crypto.randomBytes(32).toString('base64url')
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

export async function createApiToken(userId: number, name: string, expiresAt: Date | null) {
  const token = generateToken()
  const record = await prisma.apiToken.create({
    data: {
      userId,
      name,
      tokenHash: hashToken(token),
      tokenPrefix: token.slice(0, PREFIX_DISPLAY_LEN),
      expiresAt,
    },
  })
  return { ...record, token }
}

// Resolves a raw bearer token to a userId, or null if missing/invalid/expired.
// Updates lastUsedAt on success (fire-and-forget — not worth failing the request over).
export async function resolveApiToken(raw: string): Promise<number | null> {
  const record = await prisma.apiToken.findUnique({ where: { tokenHash: hashToken(raw) } })
  if (!record) return null
  if (record.expiresAt && record.expiresAt.getTime() < Date.now()) return null

  prisma.apiToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {})

  return record.userId
}
