import { describe, it, expect, beforeAll } from 'vitest'
import { appPromise } from '../testApp.js'

const TEST_USER = {
  email: 'profile-test@example.com',
  name: 'Profile',
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

describe('GET /api/training-profile', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/training-profile' })
    expect(res.statusCode).toBe(401)
  })

  it('returns an empty profile before anything is saved', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/training-profile',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.experienceLevel).toBeNull()
    expect(body.equipment).toEqual([])
    expect(body.injuries).toEqual([])
    expect(body.age).toBeNull()
  })
})

describe('PATCH /api/training-profile', () => {
  it('saves fields and returns the merged profile', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/training-profile',
      headers: { cookie: authCookie },
      body: {
        experienceLevel: 6,
        goal: 'hypertrophy',
        equipment: ['dumbbell', 'bench'],
        spaceConstraint: 'small_area',
        daysPerWeek: 4,
        injuries: ['shoulder_impingement'],
      },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.experienceLevel).toBe(6)
    expect(body.goal).toBe('hypertrophy')
    expect(body.equipment).toEqual(['bench', 'dumbbell'])
    expect(body.injuries).toEqual(['shoulder_impingement'])
  })

  it('partial updates leave other fields untouched', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/training-profile',
      headers: { cookie: authCookie },
      body: { daysPerWeek: 3 },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.daysPerWeek).toBe(3)
    expect(body.goal).toBe('hypertrophy')
    expect(body.equipment).toEqual(['bench', 'dumbbell'])
  })

  it('rejects goals outside the vocabulary', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/training-profile',
      headers: { cookie: authCookie },
      body: { goal: 'get_swole' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects injuries outside the condition list', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/training-profile',
      headers: { cookie: authCookie },
      body: { injuries: ['sore_everything'] },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects out-of-range experience level', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/training-profile',
      headers: { cookie: authCookie },
      body: { experienceLevel: 11 },
    })
    expect(res.statusCode).toBe(400)
  })
})
