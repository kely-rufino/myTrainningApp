import { buildApp } from '../app.js'

// Store the app on globalThis so it survives module re-imports when vitest
// runs with isolate:true (each file gets a fresh module registry, but globalThis
// persists across them in the single singleFork process). This guarantees one
// Fastify instance and one Prisma client for the entire test run, preventing
// concurrent SQLite write-lock contention during parallel beforeAll setup.
const GLOBAL_KEY = Symbol.for('__testAppPromise')
if (!(globalThis as Record<symbol, unknown>)[GLOBAL_KEY]) {
  (globalThis as Record<symbol, unknown>)[GLOBAL_KEY] = buildApp()
}

export const appPromise: ReturnType<typeof buildApp> =
  (globalThis as Record<symbol, unknown>)[GLOBAL_KEY] as ReturnType<typeof buildApp>
