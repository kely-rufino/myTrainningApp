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

// ── Rev 3: outcome split, load inventory, exclusions ──────────────────────

async function patch(cookie: string, body: Record<string, unknown>) {
  return app.inject({ method: 'PATCH', url: '/api/training-profile', headers: { cookie }, body })
}

describe('primaryOutcome supersedes goal', () => {
  it('translates a write to the deprecated goal so the two cannot drift', async () => {
    // The suite above left goal: 'hypertrophy' on this profile.
    const res = await app.inject({
      method: 'GET',
      url: '/api/training-profile',
      headers: { cookie: authCookie },
    })
    expect(res.json().primaryOutcome).toBe('hypertrophy')
  })

  it('maps the legacy general_fitness goal onto general_health', async () => {
    const res = await patch(authCookie, { goal: 'general_fitness' })
    expect(res.json().goal).toBe('general_fitness')
    expect(res.json().primaryOutcome).toBe('general_health')
  })

  it('lets an explicit primaryOutcome win over the deprecated field', async () => {
    const res = await patch(authCookie, { goal: 'strength', primaryOutcome: 'mental_health_cognition' })
    expect(res.json().primaryOutcome).toBe('mental_health_cognition')
  })

  it('accepts outcomes the legacy goal enum could not express', async () => {
    const res = await patch(authCookie, {
      primaryOutcome: 'mental_health_cognition',
      secondaryOutcomes: ['general_health'],
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().secondaryOutcomes).toEqual(['general_health'])
  })

  it('rejects outcomes outside the vocabulary', async () => {
    expect((await patch(authCookie, { primaryOutcome: 'vibes' })).statusCode).toBe(400)
  })
})

describe('equipment inventory', () => {
  it('stores loads and still serves the flat tag list older clients read', async () => {
    const res = await patch(authCookie, {
      equipmentInventory: [
        { type: 'dumbbell', pairs: 2, loads: [6, 8, 10, 12], unit: 'kg' },
        { type: 'barbell', barWeight: 20, plates: [1.25, 2.5, 5, 10], unit: 'kg' },
        { type: 'pullup_bar' },
      ],
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    expect(body.equipment).toEqual(['barbell', 'dumbbell', 'pullup_bar'])
    const dumbbell = body.equipmentInventory.find((i: { type: string }) => i.type === 'dumbbell')
    expect(dumbbell.loads).toEqual([6, 8, 10, 12])
    expect(body.equipmentLoadsUnknown).toBe(false)
  })

  it('flags loads as unknown for a type nobody has been asked about', async () => {
    // Kettlebells are new to this profile, so the tag write records the type
    // with no load data. The dumbbell loads recorded above survive the write.
    const res = await patch(authCookie, { equipment: ['dumbbell', 'kettlebell'] })
    const body = res.json()

    const kettlebell = body.equipmentInventory.find((i: { type: string }) => i.type === 'kettlebell')
    // Unknown, not zero — the distinction load feasibility depends on.
    expect(kettlebell.loads).toBeUndefined()
    expect(body.equipmentLoadsUnknown).toBe(true)

    expect(body.equipmentInventory.find((i: { type: string }) => i.type === 'dumbbell').loads).toEqual([6, 8, 10, 12])
    // Types dropped from the tag list are removed.
    expect(body.equipment).toEqual(['dumbbell', 'kettlebell'])
  })

  it('rejects negative loads', async () => {
    const res = await patch(authCookie, { equipmentInventory: [{ type: 'dumbbell', loads: [-5] }] })
    expect(res.statusCode).toBe(400)
  })

  it('rejects equipment types outside the closed vocabulary', async () => {
    const res = await patch(authCookie, { equipmentInventory: [{ type: 'pecs-machine-3000' }] })
    expect(res.statusCode).toBe(400)
  })
})

describe('excluded exercises', () => {
  it('stores exclusions with a reason and a timestamp', async () => {
    const res = await patch(authCookie, {
      excludedExercises: [{ exerciseId: 1, reason: 'dislike' }, { exerciseId: 2, reason: 'pain' }],
    })
    expect(res.statusCode).toBe(200)
    const stored = res.json().excludedExercises
    expect(stored).toHaveLength(2)
    expect(stored[0]).toMatchObject({ exerciseId: 1, reason: 'dislike' })
    expect(stored[0].addedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('rejects reasons outside the closed list', async () => {
    const res = await patch(authCookie, { excludedExercises: [{ exerciseId: 1, reason: 'meh' }] })
    expect(res.statusCode).toBe(400)
  })
})

describe('adherence, session length and recovery context', () => {
  it('stores the new planning inputs', async () => {
    const res = await patch(authCookie, {
      minutesPerSession: 45,
      typicalSleepHours: 6.5,
      lifeStressLevel: 'high',
      adherenceTier: 'building',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.minutesPerSession).toBe(45)
    expect(body.typicalSleepHours).toBe(6.5)
    expect(body.lifeStressLevel).toBe('high')
    // Exposed as an override so it is never confused with the derived tier.
    expect(body.adherenceTierOverride).toBe('building')
  })

  it('rejects an implausible session length', async () => {
    expect((await patch(authCookie, { minutesPerSession: 600 })).statusCode).toBe(400)
  })

  it('rejects stress levels outside the vocabulary', async () => {
    expect((await patch(authCookie, { lifeStressLevel: 'cosmic' })).statusCode).toBe(400)
  })
})
