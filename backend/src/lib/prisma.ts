import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from '../generated/prisma/client.js'

// With vitest isolate:true each test file gets its own module registry but shares
// globalThis. Store the client here so re-imports in isolated contexts reuse the
// same connection instead of opening a second one on the same SQLite file.
const PRISMA_KEY = Symbol.for('__prismaClient')

if (!(globalThis as Record<symbol, unknown>)[PRISMA_KEY]) {
  const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL! })
  const client = new PrismaClient({ adapter })
  // Assign BEFORE any await so a concurrent re-import sees the key and skips init.
  ;(globalThis as Record<symbol, unknown>)[PRISMA_KEY] = client

  if (process.env.NODE_ENV === 'test') {
    await client.$executeRawUnsafe('PRAGMA busy_timeout = 10000')
    await client.$executeRawUnsafe('PRAGMA journal_mode = DELETE')
  }
}

export const prisma = (globalThis as Record<symbol, unknown>)[PRISMA_KEY] as PrismaClient
