import { describe, it, expect, beforeAll } from 'vitest'
import { appPromise } from '../testApp.js'

// Adversarial probes against the Rev 3 profile migration. Each test encodes a
// claim made in PROJECT.md or knowledge-base-r3-amendment.md §2 and tries to
// break it.

const TEST_USER = {
  email: 'profile-stress@example.com',
  name: 'Profile',
  lastName: 'Stress',
  password: 'Secure@57!',
}

const app = await appPromise
let cookie: string

beforeAll(async () => {
  await app.inject({ method: 'POST', url: '/api/auth/register', body: TEST_USER })
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    body: { email: TEST_USER.email, password: TEST_USER.password },
  })
  cookie = login.headers['set-cookie'] as string
})

async function patch(body: Record<string, unknown>) {
  return app.inject({ method: 'PATCH', url: '/api/training-profile', headers: { cookie }, body })
}

async function get() {
  return app.inject({ method: 'GET', url: '/api/training-profile', headers: { cookie } })
}

// ── Claim: "a write to goal is translated rather than ignored, so the two
//    cannot drift" ────────────────────────────────────────────────────────

describe('goal/primaryOutcome alias coherence', () => {
  it('keeps the deprecated alias correct when only primaryOutcome is written', async () => {
    await patch({ goal: 'hypertrophy' })
    expect((await get()).json().goal).toBe('hypertrophy')

    // A Rev 3 client writes only the new field. A legacy client still reading
    // `goal` must not be handed a stale, contradictory answer.
    await patch({ primaryOutcome: 'endurance' })
    const body = (await get()).json()

    expect(body.primaryOutcome).toBe('endurance')
    expect(body.goal).toBe('endurance')
  })

  it('blanks the alias when the outcome has no legacy equivalent', async () => {
    await patch({ primaryOutcome: 'mental_health_cognition' })
    const body = (await get()).json()

    expect(body.primaryOutcome).toBe('mental_health_cognition')
    // There is no goal that means this. Reporting the previous goal would be
    // worse than reporting nothing.
    expect(body.goal).toBeNull()
  })

  it('clears both when the outcome is cleared', async () => {
    await patch({ primaryOutcome: 'strength' })
    await patch({ primaryOutcome: null })
    const body = (await get()).json()

    expect(body.primaryOutcome).toBeNull()
    expect(body.goal).toBeNull()
  })
})

// ── Claim: exclusions carry when they were added ──────────────────────────

describe('excludedExercises timestamps', () => {
  it('preserves addedAt for entries that were already stored', async () => {
    await patch({ excludedExercises: [{ exerciseId: 10, reason: 'dislike' }] })
    const first = (await get()).json().excludedExercises[0].addedAt

    await new Promise(resolve => setTimeout(resolve, 10))

    // Adding a second exclusion rewrites the array. The first entry's date is
    // a fact about the past and must survive the rewrite.
    await patch({
      excludedExercises: [
        { exerciseId: 10, reason: 'dislike' },
        { exerciseId: 11, reason: 'pain' },
      ],
    })
    const stored = (await get()).json().excludedExercises

    expect(stored).toHaveLength(2)
    expect(stored.find((e: { exerciseId: number }) => e.exerciseId === 10).addedAt).toBe(first)
  })

  it('does not resurrect a removed exclusion', async () => {
    await patch({ excludedExercises: [{ exerciseId: 11, reason: 'pain' }] })
    const stored = (await get()).json().excludedExercises
    expect(stored.map((e: { exerciseId: number }) => e.exerciseId)).toEqual([11])
  })

  it('accepts an empty list as "nothing is excluded"', async () => {
    await patch({ excludedExercises: [] })
    expect((await get()).json().excludedExercises).toEqual([])
  })
})

// ── Claim: "a missing loads means unknown, not zero" ──────────────────────

describe('equipment inventory round-trips', () => {
  it('is idempotent — reading and writing back changes nothing', async () => {
    await patch({
      equipmentInventory: [
        { type: 'dumbbell', pairs: 2, loads: [6, 8, 10], unit: 'kg' },
        { type: 'bench', adjustable: true },
      ],
    })
    const first = (await get()).json().equipmentInventory

    await patch({ equipmentInventory: first })
    expect((await get()).json().equipmentInventory).toEqual(first)
  })

  it('does not lose recorded loads when an unrelated field is patched', async () => {
    await patch({ equipmentInventory: [{ type: 'dumbbell', loads: [8, 10], unit: 'kg' }] })
    await patch({ daysPerWeek: 3 })

    const body = (await get()).json()
    expect(body.equipmentInventory[0].loads).toEqual([8, 10])
    expect(body.equipmentLoadsUnknown).toBe(false)
  })

  it('does not silently downgrade a load inventory when a legacy client writes tags', async () => {
    await patch({ equipmentInventory: [{ type: 'dumbbell', loads: [8, 10], unit: 'kg' }] })

    // An old client that only knows the flat array writes the same equipment.
    // Dropping the loads on the floor would quietly destroy the answer to
    // "can this user load this exercise".
    await patch({ equipment: ['dumbbell'] })

    const body = (await get()).json()
    expect(body.equipmentInventory[0].loads).toEqual([8, 10])
  })

  it('distinguishes owning nothing from never having been asked', async () => {
    await patch({ equipmentInventory: [{ type: 'dumbbell', loads: [] }] })
    // Explicitly recorded as "no loads for this" — a known answer, not a gap.
    expect((await get()).json().equipmentLoadsUnknown).toBe(false)
  })

  it('deduplicates a legacy tag array that repeats a type', async () => {
    await patch({ equipment: ['dumbbell', 'dumbbell', 'bench'] })
    const inventory = (await get()).json().equipmentInventory
    expect(inventory.filter((i: { type: string }) => i.type === 'dumbbell')).toHaveLength(1)
  })
})

// ── Claim: adherenceTier is an override, never confused with derived ──────

describe('adherence override', () => {
  it('rejects a tier outside the vocabulary', async () => {
    expect((await patch({ adherenceTier: 'expert' })).statusCode).toBe(400)
  })

  it('can be cleared back to the derived value', async () => {
    await patch({ adherenceTier: 'established' })
    expect((await get()).json().adherenceTierOverride).toBe('established')

    await patch({ adherenceTier: null })
    expect((await get()).json().adherenceTierOverride).toBeNull()
  })
})

// ── Vocabulary edges ──────────────────────────────────────────────────────

describe('outcome vocabulary edges', () => {
  it('rejects a secondary outcome outside the vocabulary', async () => {
    expect((await patch({ secondaryOutcomes: ['powerlifting'] })).statusCode).toBe(400)
  })

  it('accepts the founder-persona shape: cognition primary, health secondary', async () => {
    const res = await patch({
      primaryOutcome: 'mental_health_cognition',
      secondaryOutcomes: ['general_health'],
      minutesPerSession: 20,
      lifeStressLevel: 'high',
      typicalSleepHours: 5.5,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.primaryOutcome).toBe('mental_health_cognition')
    expect(body.secondaryOutcomes).toEqual(['general_health'])
  })
})
