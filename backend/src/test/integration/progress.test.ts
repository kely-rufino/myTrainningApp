import { describe, it, expect, beforeAll } from 'vitest'
import { appPromise } from '../testApp.js'

const TEST_USER = {
  email: 'progress-test@example.com',
  name: 'Progress',
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

describe('GET /api/history', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/history' })
    expect(res.statusCode).toBe(401)
  })

  it('returns an empty array for a new user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/history',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })
})

describe('GET /api/progress/exercises', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/progress/exercises' })
    expect(res.statusCode).toBe(401)
  })

  it('returns an empty array for a new user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/progress/exercises',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })
})

describe('GET /api/progress/exercise/:id', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/progress/exercise/1' })
    expect(res.statusCode).toBe(401)
  })

  it('returns an empty array for an exercise with no logged data', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/progress/exercise/999999',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })
})
