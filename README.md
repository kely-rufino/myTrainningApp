# myTrainingApp

A full-stack workout planning and execution web app. Users build workout plans (sessions, exercises, sets), execute them day-by-day, log their actual output, and track progress over time.

**Live:** [https://mytrainning.up.railway.app](https://mytrainning.up.railway.app)

---

## What's in this repo

```
myTrainingApp/
├── backend/          # Fastify API + SQLite via Prisma
├── frontend/         # React + Vite SPA
├── Dockerfile        # Single image: builds both, serves frontend as static files
└── railway.json      # Railway deployment config (start command + healthcheck)
```

The backend serves the frontend's built files in production — no separate static host needed.

---

## Running locally

Prerequisites: Node 20+

```bash
# Terminal 1 — API (http://localhost:3000)
cd backend && npm install && npm run dev

# Terminal 2 — UI (http://localhost:5173, proxies /api/* to :3000)
cd frontend && npm install && npm run dev
```

The frontend Vite config proxies all `/api/*` requests to the backend, so you never deal with CORS in development.

---

## Detailed docs

- **[backend/README.md](backend/README.md)** — environment variables, Sentry setup, Railway deployment, test suite, database migrations
- **[frontend/README.md](frontend/README.md)** — Sentry setup, build, environment config

---

## Architecture overview

```
Browser (React)
  │  TanStack Router + Query
  │  Sentry (browser tracing + session replay)
  ▼
Fastify API
  │  JWT auth (httpOnly cookie)
  │  Zod request/response validation
  │  Pino structured logging
  │  Sentry error capture
  ▼
Prisma ORM → SQLite (libsql)
```

### Domain model

```
Workout
  └── WorkoutSession ("Day 1", "Day 2", …)
        └── WorkoutSessionBlock (exercise + instructions)
              └── WorkoutSessionBlockItem (set: reps / weight / duration)

WorkoutExecution  (user starts a session on a given date)
  └── WorkoutSessionBlockExecution (what the user actually logged per set)
```
