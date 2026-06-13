import { buildApp } from '../app.js'

// Single app instance shared across all test files (singleFork mode).
// Sharing prevents the Prisma/libsql write lock from being disrupted by
// closing and reopening a Fastify instance between test files.
export const appPromise = buildApp()
