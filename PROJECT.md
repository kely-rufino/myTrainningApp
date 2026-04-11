# myTrainingApp

## What this is
A workout plan and execution web app. Users create workout plans organized by days/sessions, execute them, log their actual reps/weight/duration per set, and track progress over time. Mobile-first UI — desktop is out of scope for now.

---

## Stack

### Frontend (`/frontend`)
- Vite + React + TypeScript
- TailwindCSS v4 (via `@tailwindcss/vite` plugin — no `tailwind.config.js` needed)
- TanStack Router (code-based routing, not file-based)
- TanStack Query (data fetching / server state)
- Dev server: `npm run dev` → `http://localhost:5173`
- Vite proxies `/api/*` to `http://localhost:3000` (no CORS issues in dev)

### Backend (`/backend`)
- Fastify 5 + TypeScript
- `fastify-type-provider-zod` + Zod 4 for request/response validation and typing
- Prisma 7 (ORM) with SQLite (`prisma/dev.db`)
- `tsx watch` for dev (ESM-compatible)
- Dev server: `npm run dev` → `http://localhost:3000`

---

## Running locally
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

---

## Database schema (Prisma — `backend/prisma/schema.prisma`)

The schema follows this domain model:

```
Workout
  └── WorkoutSession (Day 1, Day 2, etc.)
        └── WorkoutSessionBlock (one exercise + instructions)
              └── WorkoutSessionBlockItem (one set: reps/weight/duration)

WorkoutExecution (a user starts a workout on a given day)
  └── WorkoutSessionBlockExecution (what the user actually did per set)
```

### Entities

**User** — app user with soft delete support
- id, email (unique), name, lastName, password, createdAt, updatedAt, deletedAt

**Exercise** — global library of exercises
- id, name, description (optional), image (optional), videoUrl (optional)

**Workout** — a named workout plan (e.g. "Push Pull Legs")
- id, name
- belongs to a user (userId)

**WorkoutSession** — a day/session within a workout (e.g. "Day 1 - Push")
- id, workoutId, name (optional), order
- has many WorkoutSessionBlocks

**WorkoutSessionBlock** — one exercise within a session, with instructions
- id, sessionId, exerciseId, instructions (optional), order
- has many WorkoutSessionBlockItems (the sets)

**WorkoutSessionBlockItem** — one set within a block
- id, blockId, reps (optional), weight (optional), duration in seconds (optional), order

**WorkoutExecution** — a user executing a workout on a specific date
- id, workoutId, userId, date, startedAt, finishedAt, createdAt

**WorkoutSessionBlockExecution** — actual logged output per set during execution
- id, workoutExecutionId, workoutSessionBlockItemId, reps (optional), weight (optional), duration (optional), createdAt, updatedAt

---

## Key conventions

- **Mobile-first**: all UI built for mobile screen sizes. No responsive desktop breakpoints needed.
- **API**: REST + Zod validation. Routes under `/api/*`.
- **Auth**: not yet implemented — password field exists on User, wire up later.
- **Soft deletes**: User has `deletedAt`. Other entities use hard delete for now.
- **Prisma client**: singleton at `backend/src/lib/prisma.ts`. Uses `PrismaLibSql` adapter directly with `{ url }` — no separate `@libsql/client` needed. Do NOT add `datasource.url` to `prisma.config.ts` (it conflicts with the adapter at query time).
- **Migrations**: run `./node_modules/.bin/prisma migrate dev --name <name>` from `backend/`.
- **Generated client**: output to `backend/src/generated/prisma` (set in schema.prisma).

---

## Current status
- [x] Project scaffold (frontend + backend folders)
- [x] Fastify + Zod running, GET /api/ping endpoint
- [x] Frontend pings backend via TanStack Query, displays response
- [x] Prisma + SQLite wired up
- [x] DB migration with full schema applied
- [x] Auth — register, login, logout, /api/auth/me (JWT via httpOnly cookie)
- [x] Frontend auth flow — login, sign up (with confirm password), forgot password (placeholder), protected home route
- [ ] Workout CRUD
- [ ] Workout execution flow
- [ ] Progress tracking / history
