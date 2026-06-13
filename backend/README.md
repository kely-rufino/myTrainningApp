# Backend

Fastify 5 API with Prisma + SQLite, deployed on Railway.

---

## Stack

| Layer | Choice |
|---|---|
| HTTP framework | Fastify 5 |
| Validation | Zod 4 via `fastify-type-provider-zod` |
| ORM | Prisma 7 with `@prisma/adapter-libsql` (SQLite) |
| Auth | JWT via `@fastify/jwt` + httpOnly cookie (`@fastify/cookie`) |
| Logging | Pino (built into Fastify) |
| Error tracking | Sentry (`@sentry/node`) |
| Build | tsup (bundles ESM output for production) |
| Tests | Vitest 4 |

---

## Local development

```bash
npm install
npm run dev        # tsx watch — restarts on file change
```

API runs at `http://localhost:3000`. Requires the env vars below.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | `file:./dev.db` locally; set by Railway in production |
| `JWT_SECRET` | Yes | Long random string used to sign JWT tokens |
| `SENTRY_DSN` | Production only | DSN from your Sentry project (see below) |
| `RESEND_API_KEY` | Optional | For transactional email (password reset) |
| `PORT` | Optional | Defaults to `3000` |
| `LOG_LEVEL` | Optional | Pino log level (`info`, `debug`, `warn`). Defaults to `info` |
| `NODE_ENV` | Set by Railway | `production` enables Sentry and static file serving |

Create a `.env` file at `backend/.env` for local dev (not committed):

```
DATABASE_URL=file:./dev.db
JWT_SECRET=replace-me-with-a-long-random-string
```

---

## Sentry setup

Error tracking is split into two parts:

**`src/instrument.ts`** — initialises Sentry before any routes load. This file is imported at the very top of `src/app.ts` using a side-effect import (`import './instrument.js'`) so the SDK is active before Fastify registers any plugins.

```ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  enabled: process.env.NODE_ENV === 'production',   // silent in dev/test
})
```

**`src/app.ts`** — `Sentry.setupFastifyErrorHandler(app)` is called immediately after Fastify is created. This wires Sentry into Fastify's request lifecycle so unhandled route errors are automatically captured with request context.

**`src/plugins/errorHandler.ts`** — the global error handler calls `Sentry.captureException(error)` explicitly for any 500-class error. This guarantees capture even for errors that Fastify's error handler swallows before Sentry's integration sees them.

To use Sentry in production, set the `SENTRY_DSN` environment variable in your Railway service settings. The DSN is safe to commit (it's public-facing), but keeping it in an env var makes it easy to rotate.

---

## Logging

Pino structured logging is enabled in all non-test environments:

- Each request gets a UUID (`genReqId: () => randomUUID()`)
- Log level is controlled by `LOG_LEVEL` env var (defaults to `info`)
- Sensitive fields are redacted in all log output:
  - `req.headers.cookie` → `[REDACTED]`
  - `req.body.password` → `[REDACTED]`
  - `req.body.token` → `[REDACTED]`

---

## Error handling

`src/plugins/errorHandler.ts` maps known errors to HTTP status codes before responding:

| Error | Status |
|---|---|
| Prisma P2002 (unique constraint) | 409 Conflict |
| Prisma P2025 (record not found) | 404 Not Found |
| Fastify validation error (Zod) | 400 Bad Request |
| Everything else | 500 Internal Server Error |

500s are logged with full stack trace via Pino and captured in Sentry.

---

## Database

```bash
npm run db:migrate      # create + apply a new migration (dev)
npm run db:generate     # regenerate Prisma client after schema changes
npm run db:studio       # open Prisma Studio (visual DB browser)
npm run db:seed         # seed the exercise library (~750 exercises)
```

Migrations live in `prisma/migrations/`. The generated Prisma client is output to `src/generated/prisma/` (configured in `schema.prisma`).

In production, `railway.json` runs `prisma migrate deploy` before starting the server so the production database is always up to date.

---

## Tests

```bash
npm test                # run all tests once
npm run test:watch      # watch mode
npm run test:coverage   # with line/branch coverage report
```

### Coverage (as of last run)

```
File              | % Stmts | % Branch | % Funcs | % Lines
------------------|---------|----------|---------|--------
lib/prisma.ts     |     100 |       50 |     100 |    100
plugins/auth.ts   |     100 |       50 |     100 |    100
errorHandler.ts   |   56.25 |    47.36 |     100 |  56.25
routes/auth.ts    |      50 |    32.35 |      50 |  50.81
routes/exercises  |   96.55 |    83.33 |     100 |    100
routes/progress   |   40.54 |        0 |      50 |  51.72
routes/workouts   |    89.3 |    80.76 |   83.87 |  91.17
------------------|---------|----------|---------|--------
All files         |    76.2 |    56.93 |   78.12 |  78.35
```

### Structure

```
src/test/
├── globalSetup.ts              # wipes test.db and runs prisma migrate deploy before each run
├── testApp.ts                  # shared Fastify app instance (globalThis singleton)
├── unit/
│   └── password.test.ts        # password validator rules (5 tests)
└── integration/
    ├── auth.test.ts            # register, login, /me — 400/401/409 cases (5 tests)
    ├── exercises.test.ts       # exercise CRUD + conflict + validation (11 tests)
    ├── progress.test.ts        # history + progress endpoints (6 tests)
    ├── workouts.test.ts        # workout CRUD (12 tests)
    └── workouts-builder.test.ts  # sessions, blocks, items, executions, calendar (34 tests)
```

Total: **83 tests** across 6 files.

### How integration tests work

Fastify's built-in `inject()` sends fake HTTP requests through the full middleware stack (Zod validation → auth plugin → route handler → Prisma → SQLite) without opening a real port. Tests run against a separate `test.db` that is wiped and remigrated before each run.

### Infrastructure notes

Two things keep the SQLite-backed test suite stable:

1. **`lib/prisma.ts` uses a `globalThis` singleton.** Vitest runs all files in one process (`singleFork: true`) but gives each file its own module registry (`isolate: true`). Without the singleton, every file's import chain would create a separate `PrismaClient` — multiple concurrent connections on the same SQLite file cause write-lock failures at startup.

2. **`vitest.config.ts` sets `fileParallelism: false`.** This makes test files run one at a time so their `beforeAll` setup hooks never interleave. Without this, concurrent `beforeAll` hooks from different files race on SQLite writes.

---

## Production build

```bash
npm run build    # tsup bundles src/ → dist/
npm start        # node dist/index.js
```

tsup is used instead of tsc because Prisma's generated client uses extensionless ESM imports that Node's module resolver requires to be bundled to resolve correctly.

---

## Railway deployment

The app deploys automatically on every push to `main`.

**Build**: `Dockerfile` at the repo root builds the frontend and backend into a single image. The backend serves `frontend/dist/` as static files in production.

**Start**: `railway.json` overrides the start command to run `prisma migrate deploy` before starting the server. This keeps the production database schema in sync with the code on every deploy.

**Healthcheck**: Railway probes `/health` (returns `{ status: "ok" }`) to confirm the server is up before routing traffic.

### Required Railway variables

Set these in the service's **Variables** tab before deploying:

| Variable | Notes |
|---|---|
| `JWT_SECRET` | Long random string — generate with `openssl rand -hex 32` |
| `SENTRY_DSN` | Backend DSN from your Sentry project settings |
| `VITE_FRONTEND_SENTRY_DSN` | Browser DSN from your Sentry project settings — **build-time only**, see note below |

`DATABASE_URL`, `PORT`, and `NODE_ENV` are provided automatically by Railway.

> **`VITE_FRONTEND_SENTRY_DSN` is baked into the frontend bundle at build time.** The Dockerfile declares it as a Docker `ARG`, and Railway automatically passes matching service variables as build args. This means: (1) the value must be present in Railway before the build starts, and (2) changing the variable requires a new deploy to take effect.
