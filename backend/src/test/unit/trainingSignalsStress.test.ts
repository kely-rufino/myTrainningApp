import { describe, it, expect } from 'vitest'
import {
  SIGNAL_CONSTANTS,
  countSkippedWhileSessionCompleted,
  deriveAdherence,
  deriveExerciseSignals,
  deriveMuscleSignals,
  deriveRestIntervals,
  rollupExerciseSessions,
  trailingStallLength,
  type ExecutionLog,
  type SetLog,
} from '../../lib/trainingSignals.js'

// Adversarial probes against the derivations. Each test encodes what
// docs/workout-evolution.md says *should* happen in a hostile case, not what
// the implementation currently does — the point is to find the gap.

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
    workoutName: 'W',
    sessionId: 1,
    sessionName: 'S',
    plannedSets: 0,
    plannedExercises: [],
    ...overrides,
  }
}

// ── §7: "Deliberate deloads look identical to regression" ─────────────────
// The doc says a prescribed lighter week "must not be read as a stall". The
// regression path checks planned load; the stall path is the other half.

describe('prescribed deload vs stall', () => {
  it('does not count a prescribed deload week toward a stall', () => {
    const logs = [
      // Progressing normally …
      setLog({ executionId: 1, date: new Date('2026-07-01'), reps: 8, weight: 60, plannedWeight: 60 }),
      setLog({ executionId: 2, date: new Date('2026-07-08'), reps: 8, weight: 65, plannedWeight: 65 }),
      // … then the plan prescribes a deload week.
      setLog({ executionId: 3, date: new Date('2026-07-15'), reps: 8, weight: 45, plannedWeight: 45 }),
      // … and the user returns to the previous load, as programmed.
      setLog({ executionId: 4, date: new Date('2026-07-22'), reps: 8, weight: 65, plannedWeight: 65 }),
    ]
    const [signal] = deriveExerciseSignals(logs, new Map())

    // Session 3 is down (prescribed) and session 4 merely returns to 65 —
    // neither is evidence the user has plateaued.
    expect(signal.stalled).toBe(false)
  })

  it('does not let the deload week itself read as a two-session stall', () => {
    const logs = [
      setLog({ executionId: 1, date: new Date('2026-07-01'), reps: 8, weight: 60, plannedWeight: 60 }),
      setLog({ executionId: 2, date: new Date('2026-07-08'), reps: 8, weight: 40, plannedWeight: 40 }),
      setLog({ executionId: 3, date: new Date('2026-07-15'), reps: 8, weight: 40, plannedWeight: 40 }),
    ]
    const [signal] = deriveExerciseSignals(logs, new Map())
    expect(signal.stalled).toBe(false)
  })
})

// ── Two executions on the same calendar day ───────────────────────────────
// Rollup keys on executionId, so a duplicate or a genuine two-a-day produces
// two "sessions" a day apart in the trend — cheap phantom stall material.

describe('same-day executions', () => {
  it('does not manufacture a stall from two executions logged on one day', () => {
    const logs = [
      setLog({ executionId: 1, date: new Date('2026-07-01'), reps: 8, weight: 60 }),
      setLog({ executionId: 2, date: new Date('2026-07-01'), reps: 8, weight: 60 }),
      setLog({ executionId: 3, date: new Date('2026-07-01'), reps: 8, weight: 60 }),
    ]
    const [signal] = deriveExerciseSignals(logs, new Map())
    expect(signal.stalled).toBe(false)
  })
})

// ── Rest intervals inside a superset ──────────────────────────────────────
// Superset blocks alternate exercises, so consecutive same-block sets are
// separated by the partner exercise. That gap is not a rest interval.

describe('rest intervals under supersets', () => {
  const base = new Date('2026-07-01T10:00:00.000Z')

  it('does not report the partner exercise as rest', () => {
    // A1 set, B1 set, A2 set, B2 set — alternating, 60s apart.
    const logs = [
      setLog({ executionId: 1, date: base, loggedAt: new Date(base.getTime() + 0), blockId: 1 }),
      setLog({ executionId: 1, date: base, loggedAt: new Date(base.getTime() + 60_000), blockId: 2 }),
      setLog({ executionId: 1, date: base, loggedAt: new Date(base.getTime() + 120_000), blockId: 1 }),
      setLog({ executionId: 1, date: base, loggedAt: new Date(base.getTime() + 180_000), blockId: 2 }),
    ]
    const reading = deriveRestIntervals(logs)
    // Consecutive same-block sets are 120s apart, but the user rested ~60s and
    // spent the rest on the partner lift. Reporting 120s as rest is wrong.
    expect(reading.usable).toBe(false)
  })
})

// ── Bulk logging that is slower than the 60s window ───────────────────────

describe('bulk logging detection', () => {
  it('does not publish typing speed as rest when a whole session is entered afterwards', () => {
    // 10 sets entered over 4 minutes, after a 70-minute session.
    const base = new Date('2026-07-01T11:00:00.000Z')
    const logs = Array.from({ length: 10 }, (_, i) =>
      setLog({
        executionId: 1,
        date: base,
        loggedAt: new Date(base.getTime() + i * 24_000),
        reps: 8,
        weight: 60,
      })
    )
    const reading = deriveRestIntervals(logs, new Map([[1, 70 * 60]]))
    // Sets ~24s apart across a session that actually took 70 minutes: the
    // timestamps describe data entry, not training.
    expect(reading.usable).toBe(false)
  })
})

// ── Weekly set extrapolation on short history ─────────────────────────────

describe('weekly set rate on short history', () => {
  it('does not divide 10 days of training by four weeks', () => {
    // Two weeks of history, 10 sets/week.
    const logs = Array.from({ length: 20 }, (_, i) =>
      setLog({
        executionId: Math.floor(i / 10) + 1,
        date: new Date(NOW.getTime() - (i < 10 ? 3 : 10) * day),
        reps: 8,
        weight: 60,
      })
    )
    const [chest] = deriveMuscleSignals(logs, NOW)
    // True rate is ~10/wk. Dividing 20 sets by a fixed 4 weeks gives 5.
    expect(chest.weeklySets).toBeGreaterThan(8)
    // And the short history is declared, not hidden behind the number.
    expect(chest.rateWindowDays).toBeLessThan(28)
  })
})

// ── Abandonment when the whole session is skipped ─────────────────────────

describe('abandonment guards', () => {
  it('does not count a wholly-unlogged execution against any exercise', () => {
    const executions = [
      execution({
        id: 1,
        date: new Date('2026-07-01'),
        plannedExercises: [{ id: 1, name: 'A', primaryMuscle: null }, { id: 2, name: 'B', primaryMuscle: null }],
      }),
    ]
    expect(countSkippedWhileSessionCompleted(executions, []).size).toBe(0)
  })

  it('does not count executions that were never finished', () => {
    // An abandoned mid-session execution: the user logged the first exercise
    // and walked out. That is not evidence they dislike the second.
    const executions = [
      execution({
        id: 1,
        date: new Date('2026-07-01'),
        finishedAt: null,
        plannedExercises: [{ id: 1, name: 'A', primaryMuscle: null }, { id: 2, name: 'B', primaryMuscle: null }],
      }),
    ]
    const logs = [setLog({ executionId: 1, date: new Date('2026-07-01'), exerciseId: 1, reps: 8 })]
    expect(countSkippedWhileSessionCompleted(executions, logs).size).toBe(0)
  })
})

// ── Adherence week bucketing ──────────────────────────────────────────────

describe('adherence bucketing', () => {
  it('does not credit a week twice for one long gap', () => {
    // 6 sessions all in a single week, target 2/wk. Only that one week is met.
    const executions = Array.from({ length: 6 }, (_, i) => {
      const date = new Date(NOW.getTime() - 7 * day - i * (day / 6))
      return execution({ id: i + 1, date, finishedAt: date })
    })
    const signal = deriveAdherence(executions, 2, NOW)
    expect(signal.consecutiveWeeksOk).toBe(1)
  })

  it('treats a late-evening local session as belonging to its own week', () => {
    // Executions stored at UTC midnight for a Monday — the ISO week start.
    const monday = new Date('2026-07-20T00:00:00.000Z')
    const signal = deriveAdherence(
      [execution({ id: 1, date: monday, finishedAt: monday })],
      1,
      new Date('2026-07-29T12:00:00.000Z')
    )
    expect(signal.weeks[0].weekStart).toBe('2026-07-20')
    expect(signal.weeks[0].sessionsCompleted).toBe(1)
  })
})

// ── Trend ladder with mixed loaded/unloaded sessions ──────────────────────

describe('improvement ladder with ragged data', () => {
  it('does not read added assistance weight as improvement on a bodyweight lift', () => {
    // Pull-ups: bodyweight only, then bodyweight + belt. Load appears where
    // there was none — the comparison has to survive that.
    const sessions = rollupExerciseSessions([
      setLog({ executionId: 1, date: new Date('2026-07-01'), reps: 10 }),
      setLog({ executionId: 2, date: new Date('2026-07-08'), reps: 6, weight: 10 }),
    ])
    // Fewer reps with added load is not obviously worse, but it is certainly
    // not a clean stall either. The run should not silently count it.
    expect(trailingStallLength(sessions)).toBe(0)
  })

  it('counts a session with more sets but lower top-end as non-improving', () => {
    const sessions = rollupExerciseSessions([
      setLog({ executionId: 1, date: new Date('2026-07-01'), reps: 10, weight: 60 }),
      setLog({ executionId: 2, date: new Date('2026-07-08'), reps: 8, weight: 55 }),
      setLog({ executionId: 2, date: new Date('2026-07-08'), reps: 8, weight: 55 }),
      setLog({ executionId: 2, date: new Date('2026-07-08'), reps: 8, weight: 55 }),
    ])
    // Volume is up (1320 vs 600) but the top set is down. Volume must not
    // override a clear drop in load.
    expect(trailingStallLength(sessions)).toBe(1)
  })
})

// ── Window truncation ─────────────────────────────────────────────────────

describe('observation window edges', () => {
  it('caveats a stall when no improving session was ever observed', () => {
    // Only the flat tail is inside the window; any rise happened before it.
    const logs = [
      setLog({ executionId: 2, date: new Date('2026-07-08'), reps: 8, weight: 60 }),
      setLog({ executionId: 3, date: new Date('2026-07-15'), reps: 8, weight: 60 }),
      setLog({ executionId: 4, date: new Date('2026-07-22'), reps: 8, weight: 60 }),
    ]
    const [signal] = deriveExerciseSignals(logs, new Map())

    expect(signal.stalled).toBe(true)
    // The whole record is the flat run — there is no observed progression to
    // have stalled *from*, and the payload has to say so.
    expect(signal.caveats.some(c => c.includes('window'))).toBe(true)
  })

  it('does not caveat when a real improving session precedes the flat run', () => {
    const logs = [
      setLog({ executionId: 1, date: new Date('2026-07-01'), reps: 8, weight: 55 }),
      setLog({ executionId: 2, date: new Date('2026-07-08'), reps: 8, weight: 60 }),
      setLog({ executionId: 3, date: new Date('2026-07-15'), reps: 8, weight: 60 }),
      setLog({ executionId: 4, date: new Date('2026-07-22'), reps: 8, weight: 60 }),
    ]
    const [signal] = deriveExerciseSignals(logs, new Map())
    expect(signal.stalled).toBe(true)
    expect(signal.caveats.some(c => c.includes('window'))).toBe(false)
  })
})

// ── Constants sanity ──────────────────────────────────────────────────────

describe('constants', () => {
  it('keeps the stall threshold above one session', () => {
    // §6: "No change fires on a single session."
    expect(SIGNAL_CONSTANTS.stallSessions).toBeGreaterThanOrEqual(2)
  })
})
