import { describe, it, expect, beforeAll } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { appPromise } from '../testApp.js'

const app = await appPromise

let baseUrl: string
let tokenA: string
let tokenB: string

async function registerAndGetToken(email: string): Promise<string> {
  const user = { email, name: 'MCP', lastName: 'Tester', password: 'Secure@57!' }
  await app.inject({ method: 'POST', url: '/api/auth/register', body: user })
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    body: { email: user.email, password: user.password },
  })
  const cookie = login.headers['set-cookie'] as string

  const created = await app.inject({
    method: 'POST',
    url: '/api/tokens',
    headers: { cookie },
    body: { name: 'MCP client' },
  })
  return created.json().token
}

function connectedClient(token: string) {
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  })
  const client = new Client({ name: 'mcp-test-client', version: '1.0.0' })
  return { client, transport }
}

beforeAll(async () => {
  await app.listen({ port: 0, host: '127.0.0.1' })
  const address = app.server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  baseUrl = `http://127.0.0.1:${port}`

  tokenA = await registerAndGetToken('mcp-a@example.com')
  tokenB = await registerAndGetToken('mcp-b@example.com')
})

describe('POST /mcp auth', () => {
  it('returns 401 without a token', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 with an invalid token', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer mcp_not-a-real-token' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(401)
  })
})

describe('GET /mcp and DELETE /mcp', () => {
  it('reject with 405 (stateless server, no SSE stream / session to delete)', async () => {
    const get = await fetch(`${baseUrl}/mcp`, { method: 'GET' })
    expect(get.status).toBe(405)
    const del = await fetch(`${baseUrl}/mcp`, { method: 'DELETE' })
    expect(del.status).toBe(405)
  })
})

describe('tools/list', () => {
  it('exposes the workout/exercise/progress tool set', async () => {
    const { client, transport } = connectedClient(tokenA)
    await client.connect(transport)
    const { tools } = await client.listTools()
    const names = tools.map(t => t.name)
    expect(names).toEqual(
      expect.arrayContaining(['list_workouts', 'create_workout', 'delete_workout', 'list_exercises', 'get_history'])
    )
    await client.close()
  })
})

describe('tools/call — scoping to the authenticated user', () => {
  let workoutId: number

  it('create_workout + list_workouts round-trips for the same user', async () => {
    const { client, transport } = connectedClient(tokenA)
    await client.connect(transport)

    const created = await client.callTool({ name: 'create_workout', arguments: { name: 'MCP Push Day' } })
    expect(created.isError).toBeFalsy()
    const workout = JSON.parse((created.content as Array<{ text: string }>)[0].text)
    expect(workout.name).toBe('MCP Push Day')
    workoutId = workout.id

    const listed = await client.callTool({ name: 'list_workouts', arguments: {} })
    const workouts = JSON.parse((listed.content as Array<{ text: string }>)[0].text)
    expect(workouts.some((w: { id: number }) => w.id === workoutId)).toBe(true)

    await client.close()
  })

  it("a second user's token cannot see or modify the first user's workout", async () => {
    const { client, transport } = connectedClient(tokenB)
    await client.connect(transport)

    const getResult = await client.callTool({ name: 'get_workout', arguments: { workoutId } })
    expect(getResult.isError).toBe(true)

    const deleteResult = await client.callTool({ name: 'delete_workout', arguments: { workoutId } })
    expect(deleteResult.isError).toBe(true)

    const listed = await client.callTool({ name: 'list_workouts', arguments: {} })
    const workouts = JSON.parse((listed.content as Array<{ text: string }>)[0].text)
    expect(workouts.some((w: { id: number }) => w.id === workoutId)).toBe(false)

    await client.close()
  })

  it("the owner can still see the workout untouched", async () => {
    const { client, transport } = connectedClient(tokenA)
    await client.connect(transport)
    const getResult = await client.callTool({ name: 'get_workout', arguments: { workoutId } })
    expect(getResult.isError).toBeFalsy()
    await client.close()
  })
})
