import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiFetch } from '../lib/api'

function mockFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  const response = new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('apiFetch', () => {
  it('returns parsed JSON on a successful response', async () => {
    mockFetch(200, { id: 1, name: 'Push Day' })
    const result = await apiFetch('/workouts')
    expect(result).toEqual({ id: 1, name: 'Push Day' })
  })

  it('prefixes the path with /api', async () => {
    const spy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', spy)
    await apiFetch('/workouts')
    expect(spy).toHaveBeenCalledWith('/api/workouts', expect.any(Object))
  })

  it('throws with the server error message on a non-ok response', async () => {
    mockFetch(401, { error: 'Unauthorized' })
    await expect(apiFetch('/me')).rejects.toThrow('Unauthorized')
  })

  it('throws a fallback message when the error body has no error field', async () => {
    mockFetch(500, {})
    await expect(apiFetch('/me')).rejects.toThrow('Request failed')
  })

  it('returns undefined on a 204 No Content response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    const result = await apiFetch('/workouts/1')
    expect(result).toBeUndefined()
  })

  it('sets Content-Type to application/json when a body is provided', async () => {
    const spy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', spy)
    await apiFetch('/workouts', { method: 'POST', body: JSON.stringify({ name: 'Test' }) })
    expect(spy).toHaveBeenCalledWith(
      '/api/workouts',
      expect.objectContaining({ headers: expect.objectContaining({ 'Content-Type': 'application/json' }) }),
    )
  })
})
