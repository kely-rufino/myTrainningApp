import { describe, it, expect, beforeAll } from 'vitest'
import { appPromise } from '../testApp.js'

const TEST_USER = {
  email: 'workouts-test@example.com',
  name: 'Workout',
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

describe('GET /api/workouts', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/workouts' })
    expect(res.statusCode).toBe(401)
  })

  it('returns an empty array for a new user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/workouts',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })
})

describe('POST /api/workouts', () => {
  it('creates a workout and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/workouts',
      headers: { cookie: authCookie },
      body: { name: 'Push Day' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().name).toBe('Push Day')
  })

  it('returns 400 when name is empty', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/workouts',
      headers: { cookie: authCookie },
      body: { name: '' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/workouts',
      body: { name: 'Push Day' },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /api/workouts/:id', () => {
  it('returns 404 for a non-existent workout', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/workouts/999999',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns the workout when found', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/workouts',
      headers: { cookie: authCookie },
      body: { name: 'Pull Day' },
    })
    const { id } = created.json()

    const res = await app.inject({
      method: 'GET',
      url: `/api/workouts/${id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().name).toBe('Pull Day')
  })
})

describe('DELETE /api/workouts/:id', () => {
  it('deletes the workout and returns 204', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/workouts',
      headers: { cookie: authCookie },
      body: { name: 'Leg Day' },
    })
    const { id } = created.json()

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/workouts/${id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(204)
  })

  it('returns 404 when deleting a workout that does not exist', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/workouts/999999',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
  })
})
