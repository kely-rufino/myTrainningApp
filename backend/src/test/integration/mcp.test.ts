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
      expect.arrayContaining(['list_workouts', 'create_workout', 'delete_workout', 'search_exercises', 'get_exercise', 'get_history', 'get_training_profile', 'update_training_profile', 'get_training_signals'])
    )
    await client.close()
  })
})

describe('exercise tools — taxonomy and curation', () => {
  it('create_exercise requires full taxonomy', async () => {
    const { client, transport } = connectedClient(tokenA)
    await client.connect(transport)
    const res = await client.callTool({
      name: 'create_exercise',
      arguments: { name: 'MCP Incomplete Exercise' },
    })
    expect(res.isError).toBe(true)
    await client.close()
  })

  it('create → search (uncurated) → get round-trips with taxonomy', async () => {
    const { client, transport } = connectedClient(tokenA)
    await client.connect(transport)

    const created = await client.callTool({
      name: 'create_exercise',
      arguments: {
        name: 'MCP Banded Row',
        equipment: ['bands'],
        primaryMuscle: 'middle_back',
        movementPattern: 'horizontal_pull',
        difficulty: 'beginner',
      },
    })
    expect(created.isError).toBeFalsy()
    const exercise = JSON.parse((created.content as Array<{ text: string }>)[0].text)
    expect(exercise.isCurated).toBe(false)
    expect(exercise.source).toBe('agent')
    expect(exercise.equipment).toEqual(['bands'])

    // Found by the default search, which spans the whole library …
    const byName = await client.callTool({
      name: 'search_exercises',
      arguments: { query: 'MCP Banded Row' },
    })
    const byNameResult = JSON.parse((byName.content as Array<{ text: string }>)[0].text)
    expect(byNameResult.items.some((e: { id: number }) => e.id === exercise.id)).toBe(true)

    // … and hidden only when the caller explicitly asks for curated rows.
    const curatedOnly = await client.callTool({
      name: 'search_exercises',
      arguments: { query: 'MCP Banded Row', includeUncurated: false },
    })
    const curatedResult = JSON.parse((curatedOnly.content as Array<{ text: string }>)[0].text)
    expect(curatedResult.total).toBe(0)

    // Filters still apply on the default search.
    const withUncurated = await client.callTool({
      name: 'search_exercises',
      arguments: { equipment: ['bands'], movementPattern: 'horizontal_pull' },
    })
    const searchResult = JSON.parse((withUncurated.content as Array<{ text: string }>)[0].text)
    expect(searchResult.items.some((e: { id: number }) => e.id === exercise.id)).toBe(true)
    // Compact projection — no description in search results.
    expect(searchResult.items[0].description).toBeUndefined()

    const got = await client.callTool({ name: 'get_exercise', arguments: { exerciseId: exercise.id } })
    const full = JSON.parse((got.content as Array<{ text: string }>)[0].text)
    expect(full.name).toBe('MCP Banded Row')
    expect(full.aliases).toEqual([])

    await client.close()
  })

  it('training profile is scoped per token owner', async () => {
    const a = connectedClient(tokenA)
    await a.client.connect(a.transport)
    const updated = await a.client.callTool({
      name: 'update_training_profile',
      arguments: { experienceLevel: 6, goal: 'hypertrophy', equipment: ['dumbbell'], injuries: ['low_back_pain'] },
    })
    expect(updated.isError).toBeFalsy()
    const profileA = JSON.parse((updated.content as Array<{ text: string }>)[0].text)
    expect(profileA.goal).toBe('hypertrophy')
    expect(profileA.injuries).toEqual(['low_back_pain'])
    await a.client.close()

    const b = connectedClient(tokenB)
    await b.client.connect(b.transport)
    const got = await b.client.callTool({ name: 'get_training_profile', arguments: {} })
    const profileB = JSON.parse((got.content as Array<{ text: string }>)[0].text)
    expect(profileB.goal).toBeNull()
    expect(profileB.equipment).toEqual([])
    await b.client.close()
  })

  it('get_training_guidelines filters by profile and resolves citations', async () => {
    const { client, transport } = connectedClient(tokenA)
    await client.connect(transport)

    // tokenA's profile was set above: experienceLevel 6, goal hypertrophy.
    const res = await client.callTool({ name: 'get_training_guidelines', arguments: {} })
    expect(res.isError).toBeFalsy()
    const guide = JSON.parse((res.content as Array<{ text: string }>)[0].text)

    expect(guide.rulesVersion).toMatch(/^\d+\.\d+\.\d+$/)
    expect(guide.profileUsed.experienceCategory).toBe('intermediate')
    const keys = guide.guidelines.map((g: { key: string }) => g.key)
    expect(keys).toContain('weekly_sets_per_muscle')
    expect(keys).toContain('exercise_order')
    // Strength-only rules must not leak into a hypertrophy profile.
    expect(
      guide.guidelines.every((g: { goals: string[] | null }) => g.goals === null || g.goals.includes('hypertrophy'))
    ).toBe(true)
    // Every served guideline's citations resolve to full metadata with a URL.
    for (const g of guide.guidelines) {
      for (const key of g.citations) {
        expect(guide.citations[key].url).toMatch(/^https?:\/\//)
      }
    }

    // Overrides swap the rule selection without touching the stored profile.
    const strength = await client.callTool({
      name: 'get_training_guidelines',
      arguments: { goal: 'strength', experienceLevel: 2 },
    })
    const strengthGuide = JSON.parse((strength.content as Array<{ text: string }>)[0].text)
    expect(strengthGuide.profileUsed.experienceCategory).toBe('novice')
    const rest = strengthGuide.guidelines.find((g: { key: string }) => g.key === 'rest_between_sets')
    expect(rest.value).toEqual({ min: 60, max: 120, unit: 'seconds' })

    await client.close()
  })

  it('says an outcome has no rules rather than serving a neighbouring goal\'s numbers', async () => {
    const { client, transport } = connectedClient(tokenA)
    await client.connect(transport)

    const res = await client.callTool({
      name: 'get_training_guidelines',
      arguments: { primaryOutcome: 'mental_health_cognition' },
    })
    const guide = JSON.parse((res.content as Array<{ text: string }>)[0].text)

    expect(guide.profileUsed.primaryOutcome).toBe('mental_health_cognition')
    expect(guide.outcomeUnsupported).toBe(true)
    expect(guide.outcomeNote).toContain('mental_health_cognition')
    // Only universally-applicable rules survive — no hypertrophy numbers leak in.
    expect(guide.guidelines.every((g: { goals: string[] | null }) => g.goals === null)).toBe(true)

    await client.close()
  })

  it('routes a supported outcome onto the rules its legacy goal selected', async () => {
    const { client, transport } = connectedClient(tokenA)
    await client.connect(transport)

    const res = await client.callTool({
      name: 'get_training_guidelines',
      arguments: { primaryOutcome: 'hypertrophy' },
    })
    const guide = JSON.parse((res.content as Array<{ text: string }>)[0].text)

    expect(guide.outcomeUnsupported).toBe(false)
    expect(guide.guidelines.map((g: { key: string }) => g.key)).toContain('weekly_sets_per_muscle')

    await client.close()
  })

  it('rejects vocabulary values outside the closed lists', async () => {
    const { client, transport } = connectedClient(tokenA)
    await client.connect(transport)
    const res = await client.callTool({
      name: 'create_exercise',
      arguments: {
        name: 'MCP Bad Vocab',
        equipment: ['pecs-machine-3000'],
        primaryMuscle: 'pecs',
        movementPattern: 'pushing',
        difficulty: 'легко',
      },
    })
    expect(res.isError).toBe(true)
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
