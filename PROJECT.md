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

### Done
- [x] Project scaffold (frontend + backend folders)
- [x] Fastify + Zod running, GET /api/ping endpoint
- [x] Frontend pings backend via TanStack Query, displays response
- [x] Prisma + SQLite wired up
- [x] DB migration with full schema applied
- [x] Auth — register, login, logout, /api/auth/me (JWT via httpOnly cookie)
- [x] Frontend auth flow — login, sign up (with confirm password), forgot password (placeholder), protected home route

#### Exercise CRUD
- [x] Global exercise library seeded from external API (766 exercises)
- [x] List + search exercises
- [x] Create exercise (name + description)
- [x] Edit exercise (name + description, duplicate-name check)
- [x] Delete exercise (blocked with 409 if exercise is used in a workout)

#### Workout CRUD
- [x] List workouts (with session count)
- [x] Create / rename / delete workout (full cascade delete — sessions, blocks, sets, executions)
- [x] Add / rename / delete sessions (days) within a workout
- [x] Delete empty session directly from the session content area
- [x] Add exercises (blocks) to a session, with superset support
- [x] Add / edit / delete sets per block (reps+weight or duration modes)
- [x] Granular superset editing — delete one exercise from a superset while keeping others, add new exercise to existing superset
- [x] Video URL per exercise — embedded player (YouTube + fallback) inside the workout builder

#### Workout Execution Flow
- [x] Calendar week view with swipe navigation and dot indicators
- [x] Plan a session on any day (pick workout → pick session)
- [x] Remove a planned session from the calendar
- [x] Start / End session buttons with timestamp tracking
- [x] Log actual reps/weight/duration per set (blur-to-save)
- [x] Logged sets turn green with a ✓ indicator
- [x] Exercises auto-expand when session is in progress

#### Progress & History
- [x] History tab — last 30 completed sessions with date, workout, session, duration
- [x] Summary strip — total / this month / this week counts
- [x] Progress tab — list of exercises with logged data (sessions count, best weight)
- [x] Exercise progression chart (recharts LineChart) — max weight or total volume over time
- [x] Progress page in nav drawer

---

## Next steps

- [x] Add an instructions field to workout creation — an optional text field at the workout level and at each individual set level
- [x] When no workouts are available, replace the empty state message with a create workout prompt and a button
- [x] Show error messages when requests fail — network errors or server issues should surface a visible message to the user
- [x] Add per-exercise instructions inside a workout — each exercise block has its own instruction text field
- [x] When a session is started, show a live countdown in the End Session button (e.g. "End Session (46m 32s)")
- [x] Fix mobile viewport shifting when focusing form fields — the page should stay static and not zoom or shift horizontally
- [x] Prevent users from entering set data before a session has been started
- [ ] Forgot password flow — allow users to reset their password (e.g. via email link or a reset token)
- [x] Add show/hide password toggle on the sign in and sign up forms

## Next version

- [ ] Allow reordering exercises within a session
