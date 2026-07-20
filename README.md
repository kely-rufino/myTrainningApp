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

## Connecting an AI agent (MCP)

The backend exposes a [Model Context Protocol](https://modelcontextprotocol.io) server so a user's own AI agent (Claude Code, Claude Desktop, or any MCP-compatible client) can manage their workouts on their behalf — no LLM calls happen inside this app, it's pure tool plumbing over the existing REST logic. Every tool call is scoped to the token's owner; one user's agent can never see or touch another user's data.

**1. Generate a token** — log in to the app → **Profile** → **Connected agents** → **"+ Generate new token"**. Copy it immediately; it's only shown once.

**2. Point an MCP client at it** — endpoint is `POST /mcp`, auth is `Authorization: Bearer <token>`. For Claude Code:

```bash
claude mcp add --transport http mytraining https://mytrainning.up.railway.app/mcp --header "Authorization: Bearer <token>"
# or, for a local dev backend:
claude mcp add --transport http mytraining http://localhost:3000/mcp --header "Authorization: Bearer <token>"
```

Any other MCP client that supports Streamable HTTP + custom headers works the same way.

**3. Use it** — the agent gets tools like `list_workouts`, `create_workout`, `create_session`, `create_block`, `log_set_result`, `get_calendar`, `get_history`, etc. — full CRUD parity with the app's own UI. Revoke a token from the same Profile screen at any time to cut off access immediately.

Full tool list, auth internals, and the token data model are documented in [`PROJECT.md`](PROJECT.md#mcp-server).

---

## Deploying to Railway

The app is configured to deploy automatically on every push to `main`. Before the first deploy (or when setting up a new environment), add these variables in your Railway service's **Variables** tab:

| Variable | Where it's used | Notes |
|---|---|---|
| `JWT_SECRET` | Backend (runtime) | Any long random string |
| `SENTRY_DSN` | Backend (runtime) | From your Sentry project's backend DSN |
| `VITE_FRONTEND_SENTRY_DSN` | Frontend (build time) | From your Sentry project's browser DSN — injected into the bundle during `docker build`, so Railway must have this set before the build runs |

`DATABASE_URL`, `PORT`, and `NODE_ENV` are set automatically by Railway.

> **Important:** `VITE_FRONTEND_SENTRY_DSN` is a build-time variable. Railway passes it to Docker as a build arg. If you add or change it, you need to trigger a new deploy for it to take effect.

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
