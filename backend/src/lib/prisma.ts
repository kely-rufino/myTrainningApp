import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from '../generated/prisma/client.js'

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL! })

export const prisma = new PrismaClient({ adapter })
