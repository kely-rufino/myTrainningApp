import { describe, it, expect, beforeAll } from 'vitest'
import { appPromise } from '../testApp.js'

const app = await appPromise

async function registerAndLogin(email: string) {
  const user = { email, name: 'Token', lastName: 'Tester', password: 'Secure@57!' }
  await app.inject({ method: 'POST', url: '/api/auth/register', body: user })
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    body: { email: user.email, password: user.password },
  })
  return login.headers['set-cookie'] as string
}

let cookieA: string
let cookieB: string

beforeAll(async () => {
  cookieA = await registerAndLogin('tokens-a@example.com')
  cookieB = await registerAndLogin('tokens-b@example.com')
})

describe('POST /api/tokens', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/tokens', body: { name: 'x' } })
    expect(res.statusCode).toBe(401)
  })

  it('creates a token and returns the raw value once', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tokens',
      headers: { cookie: cookieA },
      body: { name: 'My Agent' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.name).toBe('My Agent')
    expect(body.token).toMatch(/^mcp_/)
    expect(body.tokenPrefix).toBe(body.token.slice(0, 12))
    expect(body.expiresAt).toBeNull()
  })

  it('supports an expiry', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tokens',
      headers: { cookie: cookieA },
      body: { name: 'Short-lived', expiresInDays: 7 },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().expiresAt).not.toBeNull()
  })
})

describe('GET /api/tokens', () => {
  it('lists only the caller\'s tokens, without the raw token or hash', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tokens', headers: { cookie: cookieA } })
    expect(res.statusCode).toBe(200)
    const tokens = res.json()
    expect(tokens.length).toBeGreaterThan(0)
    for (const t of tokens) {
      expect(t.token).toBeUndefined()
      expect(t.tokenHash).toBeUndefined()
      expect(t.tokenPrefix).toMatch(/^mcp_/)
    }

    const resB = await app.inject({ method: 'GET', url: '/api/tokens', headers: { cookie: cookieB } })
    expect(resB.json()).toEqual([])
  })
})

describe('DELETE /api/tokens/:id', () => {
  it('revokes a token owned by the caller', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/tokens',
      headers: { cookie: cookieA },
      body: { name: 'To Revoke' },
    })
    const { id } = created.json()

    const res = await app.inject({ method: 'DELETE', url: `/api/tokens/${id}`, headers: { cookie: cookieA } })
    expect(res.statusCode).toBe(204)

    const list = await app.inject({ method: 'GET', url: '/api/tokens', headers: { cookie: cookieA } })
    expect(list.json().find((t: { id: number }) => t.id === id)).toBeUndefined()
  })

  it('returns 404 when revoking a token owned by another user', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/tokens',
      headers: { cookie: cookieA },
      body: { name: 'Owned By A' },
    })
    const { id } = created.json()

    const res = await app.inject({ method: 'DELETE', url: `/api/tokens/${id}`, headers: { cookie: cookieB } })
    expect(res.statusCode).toBe(404)
  })

  it('returns 404 for a non-existent token', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/tokens/999999', headers: { cookie: cookieA } })
    expect(res.statusCode).toBe(404)
  })
})
