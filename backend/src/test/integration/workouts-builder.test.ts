import { describe, it, expect, beforeAll } from 'vitest'
import { appPromise } from '../testApp.js'

const TEST_USER = {
  email: 'builder-test@example.com',
  name: 'Builder',
  lastName: 'Tester',
  password: 'Secure@57!',
}

const app = await appPromise

let authCookie: string
let workoutId: number
let exerciseId: number
let sessionId: number
let blockId: number
let itemId: number

// Build the full chain once so every describe below can use it
beforeAll(async () => {
  await app.inject({ method: 'POST', url: '/api/auth/register', body: TEST_USER })
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    body: { email: TEST_USER.email, password: TEST_USER.password },
  })
  authCookie = login.headers['set-cookie'] as string

  const ex = await app.inject({
    method: 'POST',
    url: '/api/exercises',
    headers: { cookie: authCookie },
    body: { name: 'Builder Test Exercise' },
  })
  exerciseId = ex.json().id

  const w = await app.inject({
    method: 'POST',
    url: '/api/workouts',
    headers: { cookie: authCookie },
    body: { name: 'Builder Workout' },
  })
  workoutId = w.json().id

  const s = await app.inject({
    method: 'POST',
    url: `/api/workouts/${workoutId}/sessions`,
    headers: { cookie: authCookie },
    body: {},
  })
  sessionId = s.json().id

  const b = await app.inject({
    method: 'POST',
    url: `/api/sessions/${sessionId}/blocks`,
    headers: { cookie: authCookie },
    body: { exerciseId },
  })
  blockId = b.json().id

  const i = await app.inject({
    method: 'POST',
    url: `/api/blocks/${blockId}/items`,
    headers: { cookie: authCookie },
    body: { reps: 10, weight: 60 },
  })
  itemId = i.json().id
})

// ── Sessions ─────────────────────────────────────────────────────────────────

describe('POST /api/workouts/:id/sessions', () => {
  it('creates a session with an auto-generated name and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/workouts/${workoutId}/sessions`,
      headers: { cookie: authCookie },
      body: {},
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().name).toMatch(/^Day \d+$/)
  })

  it('creates a session with a custom name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/workouts/${workoutId}/sessions`,
      headers: { cookie: authCookie },
      body: { name: 'Upper Body' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().name).toBe('Upper Body')
  })

  it('returns 404 for a non-existent workout', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/workouts/999999/sessions',
      headers: { cookie: authCookie },
      body: {},
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('PATCH /api/sessions/:id', () => {
  it('updates the session name', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/sessions/${sessionId}`,
      headers: { cookie: authCookie },
      body: { name: 'Monday Push' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().name).toBe('Monday Push')
  })

  it('returns 404 for a non-existent session', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/sessions/999999',
      headers: { cookie: authCookie },
      body: { name: 'Monday Push' },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('DELETE /api/sessions/:id', () => {
  it('deletes the session and returns 204', async () => {
    const s = await app.inject({
      method: 'POST',
      url: `/api/workouts/${workoutId}/sessions`,
      headers: { cookie: authCookie },
      body: { name: 'Temp Session' },
    })
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/sessions/${s.json().id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(204)
  })

  it('returns 404 for a non-existent session', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/sessions/999999',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
  })
})

// ── Blocks ────────────────────────────────────────────────────────────────────

describe('POST /api/sessions/:id/blocks', () => {
  it('creates a block and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionId}/blocks`,
      headers: { cookie: authCookie },
      body: { exerciseId },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().exercise.id).toBe(exerciseId)
  })

  it('returns 404 for a non-existent session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions/999999/blocks',
      headers: { cookie: authCookie },
      body: { exerciseId },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('POST /api/blocks/:id/superset', () => {
  let secondExerciseId: number

  beforeAll(async () => {
    const ex = await app.inject({
      method: 'POST',
      url: '/api/exercises',
      headers: { cookie: authCookie },
      body: { name: 'Superset Exercise' },
    })
    secondExerciseId = ex.json().id
  })

  it('creates a paired block sharing a supersetGroupId and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/blocks/${blockId}/superset`,
      headers: { cookie: authCookie },
      body: { exerciseId: secondExerciseId },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().supersetGroupId).toBeTruthy()
  })

  it('returns 404 for a non-existent block', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/blocks/999999/superset',
      headers: { cookie: authCookie },
      body: { exerciseId: secondExerciseId },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('PATCH /api/blocks/:id', () => {
  it('updates the block instructions', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/blocks/${blockId}`,
      headers: { cookie: authCookie },
      body: { instructions: '3 sets of 10' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().instructions).toBe('3 sets of 10')
  })

  it('returns 404 for a non-existent block', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/blocks/999999',
      headers: { cookie: authCookie },
      body: { instructions: '3 sets' },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('DELETE /api/blocks/:id', () => {
  it('deletes the block and returns 204', async () => {
    const b = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionId}/blocks`,
      headers: { cookie: authCookie },
      body: { exerciseId },
    })
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/blocks/${b.json().id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(204)
  })

  it('returns 404 for a non-existent block', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/blocks/999999',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
  })
})

// ── Items (sets) ──────────────────────────────────────────────────────────────

describe('POST /api/blocks/:id/items', () => {
  it('creates an item and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/blocks/${blockId}/items`,
      headers: { cookie: authCookie },
      body: { reps: 8, weight: 80 },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().reps).toBe(8)
    expect(res.json().weight).toBe(80)
  })

  it('returns 404 for a non-existent block', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/blocks/999999/items',
      headers: { cookie: authCookie },
      body: { reps: 10 },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('PATCH /api/items/:id', () => {
  it('updates the item reps and weight', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/items/${itemId}`,
      headers: { cookie: authCookie },
      body: { reps: 12, weight: 65 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().reps).toBe(12)
    expect(res.json().weight).toBe(65)
  })

  it('returns 404 for a non-existent item', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/items/999999',
      headers: { cookie: authCookie },
      body: { reps: 10 },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('DELETE /api/items/:id', () => {
  it('deletes the item and returns 204', async () => {
    const i = await app.inject({
      method: 'POST',
      url: `/api/blocks/${blockId}/items`,
      headers: { cookie: authCookie },
      body: { reps: 5 },
    })
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/items/${i.json().id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(204)
  })

  it('returns 404 for a non-existent item', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/items/999999',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
  })
})

// ── Calendar ──────────────────────────────────────────────────────────────────

describe('GET /api/calendar', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/calendar?from=2026-01-01&to=2026-12-31',
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns an array for a valid date range', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/calendar?from=2026-01-01&to=2026-12-31',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json())).toBe(true)
  })
})

// ── Executions ────────────────────────────────────────────────────────────────

describe('POST /api/executions', () => {
  it('creates an execution and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/executions',
      headers: { cookie: authCookie },
      body: { workoutId, sessionId, date: '2026-06-13' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().workout.id).toBe(workoutId)
    expect(res.json().session.id).toBe(sessionId)
  })

  it('returns 404 for a non-existent workout', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/executions',
      headers: { cookie: authCookie },
      body: { workoutId: 999999, date: '2026-06-13' },
    })
    expect(res.statusCode).toBe(404)
  })
})

// The start → log → finish → delete tests share one execution
describe('Execution lifecycle (start → log → finish → delete)', () => {
  let execId: number

  beforeAll(async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/executions',
      headers: { cookie: authCookie },
      body: { workoutId, sessionId, date: '2026-06-14' },
    })
    execId = res.json().id
  })

  it('PATCH /start — sets startedAt', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/executions/${execId}/start`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().startedAt).toBeTruthy()
  })

  it('PATCH /start — returns 404 for a non-existent execution', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/executions/999999/start',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
  })

  it('POST /log — creates a block execution and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/executions/${execId}/log`,
      headers: { cookie: authCookie },
      body: { blockItemId: itemId, reps: 10, weight: 60 },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().reps).toBe(10)
  })

  it('POST /log — upserts an existing entry and returns 200', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/executions/${execId}/log`,
      headers: { cookie: authCookie },
      body: { blockItemId: itemId, reps: 12, weight: 65 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().reps).toBe(12)
  })

  it('POST /log — returns 404 for a non-existent execution', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/executions/999999/log',
      headers: { cookie: authCookie },
      body: { blockItemId: itemId, reps: 10 },
    })
    expect(res.statusCode).toBe(404)
  })

  it('PATCH /finish — sets finishedAt', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/executions/${execId}/finish`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().finishedAt).toBeTruthy()
  })

  it('PATCH /finish — returns 404 for a non-existent execution', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/executions/999999/finish',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
  })

  it('DELETE — deletes the execution and returns 204', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/executions/${execId}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(204)
  })

  it('DELETE — returns 404 for a non-existent execution', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/executions/999999',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
  })
})
