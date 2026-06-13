import { describe, it, expect, beforeAll } from 'vitest'
import { appPromise } from '../testApp.js'

const TEST_USER = {
  email: 'exercises-test@example.com',
  name: 'Exercise',
  lastName: 'Tester',
  password: 'Secure@57!',
}

const app = await appPromise
let authCookie: string

beforeAll(async () => {
  await app.inject({ method: 'POST', url: '/api/auth/register', body: TEST_USER })
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    body: { email: TEST_USER.email, password: TEST_USER.password },
  })
  authCookie = login.headers['set-cookie'] as string
})

describe('GET /api/exercises', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/exercises' })
    expect(res.statusCode).toBe(401)
  })

  it('returns an array when authenticated', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/exercises',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json())).toBe(true)
  })
})

describe('POST /api/exercises', () => {
  it('creates an exercise and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/exercises',
      headers: { cookie: authCookie },
      body: { name: 'Bench Press' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().name).toBe('Bench Press')
    expect(res.json().id).toBeDefined()
  })

  it('returns 409 when the exercise name already exists', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/exercises',
      headers: { cookie: authCookie },
      body: { name: 'Bench Press' },
    })
    expect(res.statusCode).toBe(409)
  })

  it('returns 400 when name is empty', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/exercises',
      headers: { cookie: authCookie },
      body: { name: '' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when videoUrl is not a valid URL', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/exercises',
      headers: { cookie: authCookie },
      body: { name: 'Squat', videoUrl: 'not-a-url' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/exercises',
      body: { name: 'Deadlift' },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('PATCH /api/exercises/:id', () => {
  let exerciseId: number

  beforeAll(async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/exercises',
      headers: { cookie: authCookie },
      body: { name: 'Overhead Press' },
    })
    exerciseId = res.json().id
  })

  it('updates the exercise name', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/exercises/${exerciseId}`,
      headers: { cookie: authCookie },
      body: { name: 'Overhead Press (barbell)' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().name).toBe('Overhead Press (barbell)')
  })

  it('updates description and videoUrl', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/exercises/${exerciseId}`,
      headers: { cookie: authCookie },
      body: { description: 'A classic push exercise', videoUrl: 'https://youtube.com/watch?v=abc' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().description).toBe('A classic push exercise')
    expect(res.json().videoUrl).toBe('https://youtube.com/watch?v=abc')
  })

  it('returns 200 when the name is unchanged (no uniqueness check needed)', async () => {
    const current = await app.inject({
      method: 'GET',
      url: '/api/exercises',
      headers: { cookie: authCookie },
    })
    const name = current.json().find((e: { id: number }) => e.id === exerciseId)?.name
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/exercises/${exerciseId}`,
      headers: { cookie: authCookie },
      body: { name },
    })
    expect(res.statusCode).toBe(200)
  })

  it('returns 404 for a non-existent exercise', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/exercises/999999',
      headers: { cookie: authCookie },
      body: { name: 'New Name' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 409 when renaming to an already-taken name', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/exercises/${exerciseId}`,
      headers: { cookie: authCookie },
      body: { name: 'Bench Press' },
    })
    expect(res.statusCode).toBe(409)
  })
})

describe('DELETE /api/exercises/:id', () => {
  it('deletes an exercise and returns 204', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/exercises',
      headers: { cookie: authCookie },
      body: { name: 'Exercise To Delete' },
    })
    const { id } = created.json()

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/exercises/${id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(204)
  })

  it('returns 404 when deleting a non-existent exercise', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/exercises/999999',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 409 when the exercise is used in a workout', async () => {
    const ex = await app.inject({
      method: 'POST',
      url: '/api/exercises',
      headers: { cookie: authCookie },
      body: { name: 'In-Use Exercise' },
    })
    const exId = ex.json().id

    const w = await app.inject({
      method: 'POST',
      url: '/api/workouts',
      headers: { cookie: authCookie },
      body: { name: 'Temp Workout' },
    })
    const s = await app.inject({
      method: 'POST',
      url: `/api/workouts/${w.json().id}/sessions`,
      headers: { cookie: authCookie },
      body: {},
    })
    await app.inject({
      method: 'POST',
      url: `/api/sessions/${s.json().id}/blocks`,
      headers: { cookie: authCookie },
      body: { exerciseId: exId },
    })

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/exercises/${exId}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(409)
  })

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/exercises/1',
    })
    expect(res.statusCode).toBe(401)
  })
})
