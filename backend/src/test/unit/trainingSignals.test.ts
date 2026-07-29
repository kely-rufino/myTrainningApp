import { describe, it, expect } from 'vitest'
import {
  SIGNAL_CONSTANTS,
  countSkippedWhileSessionCompleted,
  deriveAdherence,
  deriveExerciseSignals,
  deriveMuscleSignals,
  deriveRestIntervals,
  deriveSessionSignals,
  e1rmConfidence,
  estimate1RM,
  improvedOver,
  readRegression,
  rollupExerciseSessions,
  trailingStallLength,
  type ExecutionLog,
  type SetLog,
} from '../../lib/trainingSignals.js'

const NOW = new Date('2026-07-29T12:00:00.000Z')
const day = 86_400_000

function setLog(overrides: Partial<SetLog> & Pick<SetLog, 'executionId' | 'date'>): SetLog {
  return {
    loggedAt: overrides.date,
    exerciseId: 1,
    exerciseName: 'Bench Press',
    primaryMuscle: 'chest',
    blockId: 1,
    reps: null,
    weight: null,
    duration: null,
    plannedReps: null,
    plannedWeight: null,
    plannedDuration: null,
    ...overrides,
  }
}

function execution(overrides: Partial<ExecutionLog> & Pick<ExecutionLog, 'id' | 'date'>): ExecutionLog {
  return {
    startedAt: null,
    finishedAt: overrides.date,
    workoutId: 1,
    workoutName: 'Push/Pull',
    sessionId: 1,
    sessionName: 'Push',
    plannedSets: 0,
    plannedExercises: [],
    ...overrides,
  }
}

function planned(id: number, name = `Exercise ${id}`) {
  return { id, name, primaryMuscle: null }
}

describe('estimate1RM', () => {
  it('applies Epley and rounds to one decimal', () => {
    expect(estimate1RM(100, 5)).toBe(116.7)
    expect(estimate1RM(60, 1)).toBe(62)
  })

  it('returns null for unloaded work rather than reporting zero as a max', () => {
    expect(estimate1RM(null, 12)).toBeNull()
    expect(estimate1RM(0, 12)).toBeNull()
    expect(estimate1RM(80, null)).toBeNull()
  })
})

describe('e1rmConfidence', () => {
  it('marks high-rep sets low confidence', () => {
    expect(e1rmConfidence(8)).toBe('ok')
    expect(e1rmConfidence(SIGNAL_CONSTANTS.e1rmMaxReliableReps)).toBe('ok')
    expect(e1rmConfidence(20)).toBe('low')
  })
})

describe('rollupExerciseSessions', () => {
  it('collapses sets into one dated row per execution, ascending', () => {
    const sessions = rollupExerciseSessions([
      setLog({ executionId: 2, date: new Date('2026-07-10'), reps: 8, weight: 62.5 }),
      setLog({ executionId: 1, date: new Date('2026-07-03'), reps: 10, weight: 60, plannedWeight: 60 }),
      setLog({ executionId: 1, date: new Date('2026-07-03'), reps: 8, weight: 60, plannedWeight: 60 }),
    ])

    expect(sessions).toHaveLength(2)
    expect(sessions[0].date).toEqual(new Date('2026-07-03'))
    expect(sessions[0].sets).toBe(2)
    expect(sessions[0].topWeight).toBe(60)
    expect(sessions[0].topReps).toBe(10)
    expect(sessions[0].totalVolume).toBe(1080) // 10*60 + 8*60
    expect(sessions[0].plannedTopWeight).toBe(60)
    expect(sessions[1].topWeight).toBe(62.5)
  })
})

describe('improvedOver', () => {
  const base = rollupExerciseSessions([
    setLog({ executionId: 1, date: new Date('2026-07-01'), reps: 8, weight: 60 }),
  ])[0]

  it('reads more load as improvement', () => {
    const next = rollupExerciseSessions([
      setLog({ executionId: 2, date: new Date('2026-07-08'), reps: 8, weight: 62.5 }),
    ])[0]
    expect(improvedOver(next, base)).toBe(true)
  })

  it('reads more reps at equal load as improvement', () => {
    const next = rollupExerciseSessions([
      setLog({ executionId: 2, date: new Date('2026-07-08'), reps: 10, weight: 60 }),
    ])[0]
    expect(improvedOver(next, base)).toBe(true)
  })

  it('reads identical numbers as no improvement', () => {
    const next = rollupExerciseSessions([
      setLog({ executionId: 2, date: new Date('2026-07-08'), reps: 8, weight: 60 }),
    ])[0]
    expect(improvedOver(next, base)).toBe(false)
  })

  it('falls back to reps for bodyweight work where load never moves', () => {
    const bodyweightBase = rollupExerciseSessions([
      setLog({ executionId: 1, date: new Date('2026-07-01'), reps: 10 }),
    ])[0]
    const next = rollupExerciseSessions([setLog({ executionId: 2, date: new Date('2026-07-08'), reps: 12 })])[0]
    expect(improvedOver(next, bodyweightBase)).toBe(true)
  })

  it('falls back to duration for timed work', () => {
    const timedBase = rollupExerciseSessions([
      setLog({ executionId: 1, date: new Date('2026-07-01'), duration: 45 }),
    ])[0]
    const next = rollupExerciseSessions([setLog({ executionId: 2, date: new Date('2026-07-08'), duration: 60 })])[0]
    expect(improvedOver(next, timedBase)).toBe(true)
  })
})

describe('trailingStallLength', () => {
  it('counts only the trailing run of non-improving sessions', () => {
    const sessions = rollupExerciseSessions([
      setLog({ executionId: 1, date: new Date('2026-07-01'), reps: 8, weight: 55 }),
      setLog({ executionId: 2, date: new Date('2026-07-08'), reps: 8, weight: 60 }),
      setLog({ executionId: 3, date: new Date('2026-07-15'), reps: 8, weight: 60 }),
      setLog({ executionId: 4, date: new Date('2026-07-22'), reps: 8, weight: 60 }),
    ])
    expect(trailingStallLength(sessions)).toBe(2)
  })

  it('is zero when the most recent session improved', () => {
    const sessions = rollupExerciseSessions([
      setLog({ executionId: 1, date: new Date('2026-07-01'), reps: 8, weight: 60 }),
      setLog({ executionId: 2, date: new Date('2026-07-08'), reps: 8, weight: 62.5 }),
    ])
    expect(trailingStallLength(sessions)).toBe(0)
  })
})

describe('readRegression', () => {
  it('flags a load drop the plan did not ask for', () => {
    const sessions = rollupExerciseSessions([
      setLog({ executionId: 1, date: new Date('2026-07-01'), reps: 8, weight: 60, plannedWeight: 60 }),
      setLog({ executionId: 2, date: new Date('2026-07-08'), reps: 8, weight: 55, plannedWeight: 60 }),
    ])
    expect(readRegression(sessions)).toEqual({ regressed: true, prescribed: false })
  })

  it('does not read a prescribed deload as a regression', () => {
    const sessions = rollupExerciseSessions([
      setLog({ executionId: 1, date: new Date('2026-07-01'), reps: 8, weight: 60, plannedWeight: 60 }),
      setLog({ executionId: 2, date: new Date('2026-07-08'), reps: 8, weight: 50, plannedWeight: 50 }),
    ])
    const read = readRegression(sessions)
    expect(read.prescribed).toBe(true)
    expect(read.regressed).toBe(false)
  })

  it('flags fewer reps at the same load', () => {
    const sessions = rollupExerciseSessions([
      setLog({ executionId: 1, date: new Date('2026-07-01'), reps: 10, weight: 60 }),
      setLog({ executionId: 2, date: new Date('2026-07-08'), reps: 7, weight: 60 }),
    ])
    expect(readRegression(sessions).regressed).toBe(true)
  })

  it('reports nothing from a single session', () => {
    const sessions = rollupExerciseSessions([
      setLog({ executionId: 1, date: new Date('2026-07-01'), reps: 8, weight: 60 }),
    ])
    expect(readRegression(sessions)).toEqual({ regressed: false, prescribed: false })
  })
})

describe('countSkippedWhileSessionCompleted', () => {
  it('counts a planned exercise skipped while others in the session were logged', () => {
    const executions = [
      execution({ id: 1, date: new Date('2026-07-01'), plannedExercises: [planned(1), planned(2, 'Lunge')] }),
      execution({ id: 2, date: new Date('2026-07-08'), plannedExercises: [planned(1), planned(2, 'Lunge')] }),
    ]
    const logs = [
      setLog({ executionId: 1, date: new Date('2026-07-01'), exerciseId: 1, reps: 8, weight: 60 }),
      setLog({ executionId: 2, date: new Date('2026-07-08'), exerciseId: 1, reps: 8, weight: 60 }),
    ]
    const record = countSkippedWhileSessionCompleted(executions, logs).get(2)!
    expect(record.skips).toBe(2)
    expect(record.exerciseName).toBe('Lunge')
  })

  it('ignores executions where nothing at all was logged', () => {
    const executions = [execution({ id: 1, date: new Date('2026-07-01'), plannedExercises: [planned(1), planned(2)] })]
    expect(countSkippedWhileSessionCompleted(executions, []).size).toBe(0)
  })
})

describe('deriveExerciseSignals', () => {
  it('reports a stall with the no-RIR caveat attached', () => {
    const logs = [
      setLog({ executionId: 1, date: new Date('2026-07-01'), reps: 8, weight: 60 }),
      setLog({ executionId: 2, date: new Date('2026-07-08'), reps: 8, weight: 60 }),
      setLog({ executionId: 3, date: new Date('2026-07-15'), reps: 8, weight: 60 }),
    ]
    const [signal] = deriveExerciseSignals(logs, new Map())

    expect(signal.stalledSessions).toBe(2)
    expect(signal.stalled).toBe(true)
    expect(signal.sessionsLogged).toBe(3)
    expect(signal.lastLogged).toBe('2026-07-15')
    expect(signal.caveats.some(c => c.includes('RIR'))).toBe(true)
  })

  it('caveats a high-rep estimated 1RM instead of publishing it plainly', () => {
    const logs = [setLog({ executionId: 1, date: new Date('2026-07-01'), reps: 20, weight: 40 })]
    const [signal] = deriveExerciseSignals(logs, new Map())

    expect(signal.latest.e1rmConfidence).toBe('low')
    expect(signal.caveats.some(c => c.includes('degrades'))).toBe(true)
  })

  it('flags abandonment once the skip threshold is met', () => {
    const logs = [setLog({ executionId: 1, date: new Date('2026-07-01'), reps: 8, weight: 60 })]
    const skips = new Map([
      [1, { exerciseId: 1, exerciseName: 'Bench Press', primaryMuscle: 'chest', skips: SIGNAL_CONSTANTS.abandonmentSkips }],
    ])
    const [signal] = deriveExerciseSignals(logs, skips)
    expect(signal.abandoned).toBe(true)
  })

  it('still reports an exercise that was planned every session and never logged', () => {
    const skips = new Map([
      [7, { exerciseId: 7, exerciseName: 'Walking Lunge', primaryMuscle: 'quadriceps', skips: 3 }],
    ])
    const signals = deriveExerciseSignals([], skips)

    expect(signals).toHaveLength(1)
    expect(signals[0]).toMatchObject({
      exerciseId: 7,
      exerciseName: 'Walking Lunge',
      sessionsLogged: 0,
      lastLogged: null,
      abandoned: true,
      skippedWhileSessionCompleted: 3,
    })
  })
})

describe('deriveMuscleSignals', () => {
  it('reports recency and weekly set counts per muscle', () => {
    const logs = [
      setLog({ executionId: 1, date: new Date(NOW.getTime() - 2 * day), primaryMuscle: 'chest', reps: 8, weight: 60 }),
      setLog({ executionId: 1, date: new Date(NOW.getTime() - 2 * day), primaryMuscle: 'chest', reps: 8, weight: 60 }),
      setLog({ executionId: 2, date: new Date(NOW.getTime() - 20 * day), primaryMuscle: 'quadriceps', reps: 8, weight: 80 }),
    ]
    const signals = deriveMuscleSignals(logs, NOW)

    const chest = signals.find(s => s.muscle === 'chest')!
    expect(chest.daysSinceLastTrained).toBe(2)
    expect(chest.setsInLastSession).toBe(2)
    expect(chest.setsLast7Days).toBe(2)

    const quads = signals.find(s => s.muscle === 'quadriceps')!
    expect(quads.daysSinceLastTrained).toBe(20)
    expect(quads.setsLast7Days).toBe(0)
  })

  it('skips unclassified exercises rather than distorting group totals', () => {
    const logs = [setLog({ executionId: 1, date: NOW, primaryMuscle: null, reps: 8 })]
    expect(deriveMuscleSignals(logs, NOW)).toEqual([])
  })
})

describe('deriveRestIntervals', () => {
  const base = new Date('2026-07-01T10:00:00.000Z')

  it('recovers a median interval from per-set timestamps', () => {
    const logs = [
      setLog({ executionId: 1, date: base, loggedAt: base, reps: 8, weight: 60 }),
      setLog({ executionId: 1, date: base, loggedAt: new Date(base.getTime() + 90_000), reps: 8, weight: 60 }),
      setLog({ executionId: 1, date: base, loggedAt: new Date(base.getTime() + 180_000), reps: 8, weight: 60 }),
    ]
    const reading = deriveRestIntervals(logs)

    expect(reading.usable).toBe(true)
    expect(reading.medianRestSeconds).toBe(90)
    expect(reading.samples).toBe(2)
    expect(reading.note).toContain('Upper bound')
  })

  it('refuses to report a number when the session was logged in one burst', () => {
    const logs = [
      setLog({ executionId: 1, date: base, loggedAt: base, reps: 8, weight: 60 }),
      setLog({ executionId: 1, date: base, loggedAt: new Date(base.getTime() + 3_000), reps: 8, weight: 60 }),
    ]
    const reading = deriveRestIntervals(logs)

    expect(reading.usable).toBe(false)
    expect(reading.medianRestSeconds).toBeNull()
    expect(reading.note).toContain('one burst')
  })

  it('ignores gaps that span a change of exercise', () => {
    const logs = [
      setLog({ executionId: 1, date: base, loggedAt: base, blockId: 1, reps: 8, weight: 60 }),
      setLog({ executionId: 1, date: base, loggedAt: new Date(base.getTime() + 300_000), blockId: 2, reps: 8, weight: 30 }),
    ]
    expect(deriveRestIntervals(logs).samples).toBe(0)
  })

  it('discards implausibly long gaps as interruptions', () => {
    const logs = [
      setLog({ executionId: 1, date: base, loggedAt: base, reps: 8, weight: 60 }),
      setLog({
        executionId: 1,
        date: base,
        loggedAt: new Date(base.getTime() + (SIGNAL_CONSTANTS.maxPlausibleRestSeconds + 60) * 1000),
        reps: 8,
        weight: 60,
      }),
    ]
    expect(deriveRestIntervals(logs).samples).toBe(0)
  })
})

describe('deriveSessionSignals', () => {
  it('summarises duration and set completion, and states that no planned length exists', () => {
    const executions = [
      execution({
        id: 1,
        date: new Date('2026-07-01'),
        startedAt: new Date('2026-07-01T10:00:00.000Z'),
        finishedAt: new Date('2026-07-01T11:10:00.000Z'),
        plannedSets: 10,
      }),
    ]
    const logs = Array.from({ length: 8 }, () => setLog({ executionId: 1, date: new Date('2026-07-01'), reps: 8, weight: 60 }))
    const signals = deriveSessionSignals(executions, logs)

    expect(signals.executionsCompleted).toBe(1)
    expect(signals.duration.medianMinutes).toBe(70)
    expect(signals.duration.plannedMinutes).toBeNull()
    expect(signals.duration.note).toContain('No planned session length')
    expect(signals.setCompletion).toMatchObject({ setsLogged: 8, setsPlanned: 10, rate: 0.8 })
  })

  it('counts executions that were started but never finished', () => {
    const executions = [
      execution({ id: 1, date: new Date('2026-07-01'), startedAt: new Date('2026-07-01'), finishedAt: null }),
    ]
    expect(deriveSessionSignals(executions, []).executionsStartedNotFinished).toBe(1)
  })
})

describe('deriveAdherence', () => {
  function weeklyExecutions(weeks: number, perWeek: number): ExecutionLog[] {
    const out: ExecutionLog[] = []
    let id = 1
    for (let w = 1; w <= weeks; w++) {
      for (let s = 0; s < perWeek; s++) {
        const date = new Date(NOW.getTime() - w * 7 * day + s * day)
        out.push(execution({ id: id++, date, finishedAt: date }))
      }
    }
    return out
  }

  it('returns no tier when the profile has no weekly target to score against', () => {
    const signal = deriveAdherence(weeklyExecutions(4, 3), null, NOW)
    expect(signal.tier).toBeNull()
    expect(signal.confidence).toBe('low')
    expect(signal.caveats.some(c => c.includes('daysPerWeek'))).toBe(true)
  })

  it('promotes to building after the required consecutive weeks', () => {
    const signal = deriveAdherence(weeklyExecutions(6, 3), 3, NOW)
    expect(signal.consecutiveWeeksOk).toBeGreaterThanOrEqual(SIGNAL_CONSTANTS.adherenceBuildingWeeks)
    expect(signal.tier).toBe('building')
  })

  it('stays on onboarding when weeks fall short of the target', () => {
    const signal = deriveAdherence(weeklyExecutions(6, 1), 3, NOW)
    expect(signal.consecutiveWeeksOk).toBe(0)
    expect(signal.tier).toBe('onboarding')
  })

  it('never asserts non-compliance from an empty history', () => {
    const signal = deriveAdherence([], 3, NOW)
    expect(signal.tier).toBe('onboarding')
    expect(signal.confidence).toBe('low')
    expect(signal.caveats.some(c => c.includes('absence of data'))).toBe(true)
  })

  it('always carries the unlogged-training caveat', () => {
    const signal = deriveAdherence(weeklyExecutions(6, 3), 3, NOW)
    expect(signal.caveats.some(c => c.includes('not logged'))).toBe(true)
  })
})
