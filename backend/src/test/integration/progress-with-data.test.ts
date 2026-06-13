import { describe, it, expect, beforeAll } from 'vitest'
import { appPromise } from '../testApp.js'

// Separate user so this file's setup doesn't collide with progress.test.ts
const TEST_USER = {
  email: 'progress-data-test@example.com',
  name: 'Progress',
  lastName: 'Data',
  password: 'Secure@57!',
}

const app = await appPromise

let authCookie: string
let exerciseId: number
let itemId: number

// Build a complete execution chain with logged data so the aggregation
// branches in progress.ts (bestWeight, volume, per-date grouping) are exercised.
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
    body: { name: 'Progress Test Exercise' },
  })
  exerciseId = ex.json().id

  const w = await app.inject({
    method: 'POST',
    url: '/api/workouts',
    headers: { cookie: authCookie },
    body: { name: 'Progress Workout' },
  })
  const s = await app.inject({
    method: 'POST',
    url: `/api/workouts/${w.json().id}/sessions`,
    headers: { cookie: authCookie },
    body: {},
  })
  const b = await app.inject({
    method: 'POST',
    url: `/api/sessions/${s.json().id}/blocks`,
    headers: { cookie: authCookie },
    body: { exerciseId },
  })
  const i = await app.inject({
    method: 'POST',
    url: `/api/blocks/${b.json().id}/items`,
    headers: { cookie: authCookie },
    body: { reps: 10, weight: 80 },
  })
  itemId = i.json().id

  // Create, start, log, and finish one execution so progress routes return data
  const exec = await app.inject({
    method: 'POST',
    url: '/api/executions',
    headers: { cookie: authCookie },
    body: { workoutId: w.json().id, sessionId: s.json().id, date: '2026-06-01' },
  })
  const execId = exec.json().id

  await app.inject({ method: 'PATCH', url: `/api/executions/${execId}/start`, headers: { cookie: authCookie } })
  await app.inject({
    method: 'POST',
    url: `/api/executions/${execId}/log`,
    headers: { cookie: authCookie },
    body: { blockItemId: itemId, reps: 10, weight: 80 },
  })
  await app.inject({ method: 'PATCH', url: `/api/executions/${execId}/finish`, headers: { cookie: authCookie } })
})

describe('GET /api/history with completed executions', () => {
  it('returns the completed execution with a calculated duration', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/history',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const history = res.json()
    expect(history.length).toBeGreaterThan(0)
    expect(history[0].workout).toBeDefined()
    expect(history[0].finishedAt).toBeTruthy()
    // durationMinutes is null if start/finish timestamps are the same second; just check the field exists
    expect('durationMinutes' in history[0]).toBe(true)
  })
})

describe('GET /api/progress/exercises with logged data', () => {
  it('returns the exercise with session count and bestWeight', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/progress/exercises',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const list = res.json()
    const entry = list.find((e: { id: number }) => e.id === exerciseId)
    expect(entry).toBeDefined()
    expect(entry.sessions).toBe(1)
    expect(entry.bestWeight).toBe(80)
  })
})

describe('GET /api/progress/exercise/:id with logged data', () => {
  it('returns per-date aggregated stats including maxWeight, maxReps, and totalVolume', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/progress/exercise/${exerciseId}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const data = res.json()
    expect(data.length).toBeGreaterThan(0)
    const day = data[0]
    expect(day.date).toBe('2026-06-01')
    expect(day.maxWeight).toBe(80)
    expect(day.maxReps).toBe(10)
    expect(day.totalVolume).toBe(800) // 10 reps * 80 kg
    expect(day.sets).toBe(1)
  })
})
