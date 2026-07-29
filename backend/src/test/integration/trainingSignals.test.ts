import { describe, it, expect, beforeAll } from 'vitest'
import { appPromise } from '../testApp.js'
import { prisma } from '../../lib/prisma.js'
import * as trainingSignalsService from '../../services/trainingSignalsService.js'

// Drives the derivation layer end-to-end over data written through the real
// API, so the Prisma shape the service reads is the one the app actually
// produces — the part unit tests over plain objects cannot check.

const TEST_USER = {
  email: 'signals-test@example.com',
  name: 'Signals',
  lastName: 'Tester',
  password: 'Secure@57!',
}

// Fixed clock: the fixture dates below must sit inside the observation window
// regardless of when the suite runs.
const NOW = new Date('2026-07-20T12:00:00.000Z')

const app = await appPromise

let authCookie: string
let userId: number
let benchId: number
let lungeId: number

async function logSession(workoutId: number, sessionId: number, date: string, itemIds: number[], weight: number) {
  const exec = await app.inject({
    method: 'POST',
    url: '/api/executions',
    headers: { cookie: authCookie },
    body: { workoutId, sessionId, date },
  })
  const execId = exec.json().id

  await app.inject({ method: 'PATCH', url: `/api/executions/${execId}/start`, headers: { cookie: authCookie } })
  for (const blockItemId of itemIds) {
    await app.inject({
      method: 'POST',
      url: `/api/executions/${execId}/log`,
      headers: { cookie: authCookie },
      body: { blockItemId, reps: 8, weight },
    })
  }
  await app.inject({ method: 'PATCH', url: `/api/executions/${execId}/finish`, headers: { cookie: authCookie } })
  return execId
}

beforeAll(async () => {
  await app.inject({ method: 'POST', url: '/api/auth/register', body: TEST_USER })
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    body: { email: TEST_USER.email, password: TEST_USER.password },
  })
  authCookie = login.headers['set-cookie'] as string
  userId = (await prisma.user.findUniqueOrThrow({ where: { email: TEST_USER.email }, select: { id: true } })).id

  await app.inject({
    method: 'PATCH',
    url: '/api/training-profile',
    headers: { cookie: authCookie },
    body: { daysPerWeek: 2 },
  })

  const bench = await app.inject({
    method: 'POST',
    url: '/api/exercises',
    headers: { cookie: authCookie },
    body: { name: 'Signals Bench Press', primaryMuscle: 'chest' },
  })
  benchId = bench.json().id

  const lunge = await app.inject({
    method: 'POST',
    url: '/api/exercises',
    headers: { cookie: authCookie },
    body: { name: 'Signals Walking Lunge', primaryMuscle: 'quadriceps' },
  })
  lungeId = lunge.json().id

  const w = await app.inject({
    method: 'POST',
    url: '/api/workouts',
    headers: { cookie: authCookie },
    body: { name: 'Signals Workout' },
  })
  const workoutId = w.json().id

  const s = await app.inject({
    method: 'POST',
    url: `/api/workouts/${workoutId}/sessions`,
    headers: { cookie: authCookie },
    body: {},
  })
  const sessionId = s.json().id

  const benchBlock = await app.inject({
    method: 'POST',
    url: `/api/sessions/${sessionId}/blocks`,
    headers: { cookie: authCookie },
    body: { exerciseId: benchId },
  })
  const benchItems: number[] = []
  for (let i = 0; i < 2; i++) {
    const item = await app.inject({
      method: 'POST',
      url: `/api/blocks/${benchBlock.json().id}/items`,
      headers: { cookie: authCookie },
      body: { reps: 8, weight: 60 },
    })
    benchItems.push(item.json().id)
  }

  // Planned every session, never logged — the abandonment fixture.
  const lungeBlock = await app.inject({
    method: 'POST',
    url: `/api/sessions/${sessionId}/blocks`,
    headers: { cookie: authCookie },
    body: { exerciseId: lungeId },
  })
  await app.inject({
    method: 'POST',
    url: `/api/blocks/${lungeBlock.json().id}/items`,
    headers: { cookie: authCookie },
    body: { reps: 12 },
  })

  // Three sessions at identical load and reps → a two-session trailing stall.
  await logSession(workoutId, sessionId, '2026-07-01', benchItems, 60)
  await logSession(workoutId, sessionId, '2026-07-08', benchItems, 60)
  await logSession(workoutId, sessionId, '2026-07-15', benchItems, 60)
})

describe('getTrainingSignals', () => {
  it('reads a stall out of three identical sessions', async () => {
    const signals = await trainingSignalsService.getTrainingSignals(userId, { now: NOW })

    const bench = signals.exercises.find(e => e.exerciseId === benchId)!
    expect(bench.sessionsLogged).toBe(3)
    expect(bench.stalledSessions).toBe(2)
    expect(bench.stalled).toBe(true)
    expect(bench.regressed).toBe(false)
    expect(bench.latest.topWeight).toBe(60)
    expect(bench.latest.estimated1RM).toBe(76) // 60 * (1 + 8/30)
    expect(bench.latest.e1rmConfidence).toBe('ok')
  })

  it('flags the never-logged exercise as abandoned and proposes confirming it', async () => {
    const signals = await trainingSignalsService.getTrainingSignals(userId, { now: NOW })

    const lunge = signals.exercises.find(e => e.exerciseId === lungeId)!
    expect(lunge.sessionsLogged).toBe(0)
    expect(lunge.skippedWhileSessionCompleted).toBe(3)
    expect(lunge.abandoned).toBe(true)

    const proposal = signals.proposals.find(p => p.exerciseId === lungeId)!
    expect(proposal.type).toBe('confirm_exclusion')
    // The whole point: it is surfaced as a question, not written to the profile.
    expect(proposal.action).toContain('Ask the user')
  })

  it('counts planned sets against logged sets', async () => {
    const signals = await trainingSignalsService.getTrainingSignals(userId, { now: NOW })

    // 3 executions × 3 planned items (2 bench + 1 lunge) = 9 planned, 6 logged.
    expect(signals.sessions.setCompletion.setsPlanned).toBe(9)
    expect(signals.sessions.setCompletion.setsLogged).toBe(6)
    expect(signals.sessions.setCompletion.rate).toBeCloseTo(0.67, 2)
  })

  it('reports muscle recency from the executed dates', async () => {
    const signals = await trainingSignalsService.getTrainingSignals(userId, { now: NOW })

    const chest = signals.muscles.find(m => m.muscle === 'chest')!
    expect(chest.daysSinceLastTrained).toBe(5) // 2026-07-15 → 2026-07-20
    expect(chest.setsInLastSession).toBe(2)
  })

  it('ships the confounders and the missing-input questions with the payload', async () => {
    const signals = await trainingSignalsService.getTrainingSignals(userId, { now: NOW })

    expect(signals.interpretation.some(n => n.includes('missing log is not a skipped session'))).toBe(true)
    // No minutesPerSession on this profile yet, so duration has nothing to score against.
    expect(signals.sessions.duration.plannedMinutes).toBeNull()
    expect(signals.sessions.duration.overrunRatio).toBeNull()
    expect(signals.missingInputs.some(m => m.field === 'minutesPerSession')).toBe(true)
  })

  it('scores duration against the planned length once the profile has one', async () => {
    await app.inject({
      method: 'PATCH',
      url: '/api/training-profile',
      headers: { cookie: authCookie },
      body: { minutesPerSession: 45 },
    })

    const signals = await trainingSignalsService.getTrainingSignals(userId, { now: NOW })
    expect(signals.sessions.duration.plannedMinutes).toBe(45)
    expect(signals.sessions.duration.overrunRatio).not.toBeNull()
    expect(signals.missingInputs.some(m => m.field === 'minutesPerSession')).toBe(false)
  })

  it('excludes history outside the requested window', async () => {
    const signals = await trainingSignalsService.getTrainingSignals(userId, { now: NOW, sinceDays: 7 })
    expect(signals.window.days).toBe(7)
    const bench = signals.exercises.find(e => e.exerciseId === benchId)!
    expect(bench.sessionsLogged).toBe(1) // only 2026-07-15 falls inside
  })
})
