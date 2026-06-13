import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from '../generated/prisma/client.js'

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL! })

export const prisma = new PrismaClient({ adapter })

// In test mode, configure the SQLite connection to avoid transient write-lock failures.
// busy_timeout tells SQLite to retry for up to 10 s instead of failing immediately.
// journal_mode=DELETE avoids WAL coordination issues between connections in the same process.
if (process.env.NODE_ENV === 'test') {
  await prisma.$executeRawUnsafe('PRAGMA busy_timeout = 10000')
  await prisma.$executeRawUnsafe('PRAGMA journal_mode = DELETE')
}
