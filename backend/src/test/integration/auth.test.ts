import { describe, it, expect, beforeAll } from 'vitest'
import { appPromise } from '../testApp.js'

const TEST_USER = {
  email: 'auth-test@example.com',
  name: 'Test',
  lastName: 'User',
  password: 'Secure@57!',
}

const app = await appPromise

describe('POST /api/auth/register', () => {
  it('creates a new user and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      body: TEST_USER,
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.email).toBe(TEST_USER.email)
    expect(body.password).toBeUndefined()
  })

  it('returns 409 when the email is already registered', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/register', body: TEST_USER })
    expect(res.statusCode).toBe(409)
  })

  it('returns 400 when the password is too weak', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      body: { ...TEST_USER, email: 'weak-pw@example.com', password: 'weak' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when email is missing', async () => {
    const { email: _, ...withoutEmail } = TEST_USER
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      body: withoutEmail,
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/auth/login', () => {
  it('returns 200 and sets a cookie on valid credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      body: { email: TEST_USER.email, password: TEST_USER.password },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().email).toBe(TEST_USER.email)
    expect(res.headers['set-cookie']).toBeDefined()
  })

  it('returns 401 on wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      body: { email: TEST_USER.email, password: 'WrongPass@99' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 401 on unknown email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      body: { email: 'nobody@example.com', password: TEST_USER.password },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/auth/forgot-password', () => {
  it('returns 200 for an unknown email without revealing whether it exists', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      body: { email: 'nobody@example.com' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
  })
})

describe('POST /api/auth/reset-password', () => {
  it('returns 400 for an invalid or expired token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      body: { token: 'invalid-token-that-does-not-exist', password: 'NewSecure@57!' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /api/auth/me', () => {
  let authCookie: string

  beforeAll(async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      body: { email: TEST_USER.email, password: TEST_USER.password },
    })
    authCookie = login.headers['set-cookie'] as string
  })

  it('returns 401 with no token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' })
    expect(res.statusCode).toBe(401)
  })

  it('returns the current user when authenticated', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().email).toBe(TEST_USER.email)
  })
})
