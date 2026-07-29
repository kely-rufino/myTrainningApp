// Derivations over logged execution history — the raw material for plan
// evolution (docs/workout-evolution.md §4). Everything here is computable from
// data the app already collects; nothing asks the user for new input.
//
// Two rules govern this file:
//
//  1. **Absence is not evidence.** A missing log may mean the user trained and
//     didn't log, or trained elsewhere. Nothing here asserts non-compliance
//     from silence — it reports `null` plus a note and lets the caller ask.
//  2. **Say what is shaky.** Every derivation that rests on an assumption
//     carries its own caveat in the output rather than presenting a number as
//     if it were measured.

// ── Tunable constants ─────────────────────────────────────────────────────
// These are `consensus`-tier judgement calls, not values read off a study
// (workout-evolution.md §10). They are named and grouped so they can be tuned
// in one place and cited honestly as arbitrary until something better exists.

export const SIGNAL_CONSTANTS = {
  /** Consecutive non-improving sessions before an exercise counts as stalled. */
  stallSessions: 2,
  /** How far back the per-exercise trend walk looks. */
  observationWindowDays: 56,
  /** Times an exercise must be skipped-while-others-completed to flag abandonment. */
  abandonmentSkips: 2,
  /** Above this rep count, e1RM extrapolation degrades badly (r3-amendment §4.12). */
  e1rmMaxReliableReps: 10,
  /** Whole-execution log span below this means sets were entered in bulk, so
   *  inter-set timestamps say nothing about actual rest. */
  bulkLogSpanSeconds: 60,
  /** Set timestamps must span at least this fraction of the session's real
   *  duration to be describing training rather than data entry. Someone who
   *  logs ten sets in four minutes after a seventy-minute session clears the
   *  absolute floor above while still telling us only their typing speed. */
  minLogSpanFraction: 0.5,
  /** Inter-set gaps longer than this are interruptions, not rest. */
  maxPlausibleRestSeconds: 900,
  /** Floor for the weekly-rate denominator. Dividing two weeks of logs by a
   *  fixed four halves the user's real training rate. */
  minRateWindowDays: 7,
  /** Weeks meeting the planned session count to leave each adherence tier. */
  adherenceBuildingWeeks: 4,
  adherenceEstablishedWeeks: 12,
} as const

// ── Input shapes ──────────────────────────────────────────────────────────
// Flat, plain-data views of the Prisma rows, so every derivation below is a
// pure function and unit-testable without a database.

export type SetLog = {
  executionId: number
  date: Date
  /** Per-set timestamp — the free signal that makes rest intervals recoverable. */
  loggedAt: Date
  exerciseId: number
  exerciseName: string
  primaryMuscle: string | null
  blockId: number
  reps: number | null
  weight: number | null
  duration: number | null
  plannedReps: number | null
  plannedWeight: number | null
  plannedDuration: number | null
}

export type ExecutionLog = {
  id: number
  date: Date
  startedAt: Date | null
  finishedAt: Date | null
  workoutId: number
  workoutName: string
  sessionId: number | null
  sessionName: string | null
  /** One planned set per item, from the session the execution ran. */
  plannedSets: number
  /** Carries identity, not just ids: an exercise that is planned every session
   *  and never once logged has no set logs to take a name from, and it is
   *  exactly the case abandonment needs to report. */
  plannedExercises: { id: number; name: string; primaryMuscle: string | null }[]
}

// ── Estimated 1RM ─────────────────────────────────────────────────────────

/**
 * Epley. Returns null for bodyweight or unloaded work — an unweighted set has
 * no external max to estimate, and reporting 0 would read as a real number.
 */
export function estimate1RM(weight: number | null, reps: number | null): number | null {
  if (!weight || weight <= 0 || !reps || reps <= 0) return null
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}

/**
 * e1RM formulas are fitted near the low-rep end and drift badly past it, so a
 * 20-rep set produces a confident-looking number that means very little.
 */
export function e1rmConfidence(reps: number | null): 'ok' | 'low' {
  return reps != null && reps > SIGNAL_CONSTANTS.e1rmMaxReliableReps ? 'low' : 'ok'
}

// ── Per-exercise session rollup ───────────────────────────────────────────

export type ExerciseSession = {
  /** Usually one, but a two-a-day — or a duplicated execution row — puts
   *  several here. They are one training day either way. */
  executionIds: number[]
  date: Date
  sets: number
  topWeight: number | null
  topReps: number | null
  totalVolume: number | null
  totalDuration: number | null
  best1RM: number | null
  /** Confidence of `best1RM`, driven by the rep count it was derived from. */
  e1rmConfidence: 'ok' | 'low' | null
  /** Heaviest load the plan called for that session — used to tell a prescribed
   *  deload apart from an unplanned regression. */
  plannedTopWeight: number | null
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Collapses set logs into one row per exercise per **training day**,
 * date-ascending.
 *
 * Keyed on the date rather than the execution on purpose. Two executions on
 * one day — a duplicated row, a session restarted, or a genuine two-a-day —
 * would otherwise appear as two consecutive points in the trend, and two
 * points at the same load is the definition of a stall. Grouping by day makes
 * a phantom stall impossible to manufacture that way.
 */
export function rollupExerciseSessions(logs: SetLog[]): ExerciseSession[] {
  const byDay = new Map<string, SetLog[]>()
  for (const log of logs) {
    const key = dayKey(log.date)
    const bucket = byDay.get(key)
    if (bucket) bucket.push(log)
    else byDay.set(key, [log])
  }

  const sessions: ExerciseSession[] = []
  for (const setLogs of byDay.values()) {
    let topWeight: number | null = null
    let topReps: number | null = null
    let plannedTopWeight: number | null = null
    let volume = 0
    let durationTotal = 0
    let best1RM: number | null = null
    let bestReps: number | null = null

    for (const log of setLogs) {
      if (log.weight != null && (topWeight == null || log.weight > topWeight)) topWeight = log.weight
      if (log.reps != null && (topReps == null || log.reps > topReps)) topReps = log.reps
      if (log.plannedWeight != null && (plannedTopWeight == null || log.plannedWeight > plannedTopWeight)) {
        plannedTopWeight = log.plannedWeight
      }
      if (log.reps != null && log.weight != null) volume += log.reps * log.weight
      if (log.duration != null) durationTotal += log.duration

      const e1rm = estimate1RM(log.weight, log.reps)
      if (e1rm != null && (best1RM == null || e1rm > best1RM)) {
        best1RM = e1rm
        bestReps = log.reps
      }
    }

    sessions.push({
      executionIds: [...new Set(setLogs.map(l => l.executionId))],
      date: setLogs[0].date,
      sets: setLogs.length,
      topWeight,
      topReps,
      totalVolume: volume || null,
      totalDuration: durationTotal || null,
      best1RM,
      e1rmConfidence: best1RM == null ? null : e1rmConfidence(bestReps),
      plannedTopWeight,
    })
  }

  return sessions.sort((a, b) => a.date.getTime() - b.date.getTime())
}

// ── Trend reading ─────────────────────────────────────────────────────────

export type Comparison = 'improved' | 'not_improved' | 'incomparable'

/**
 * Did `current` beat `previous`? Load first, then reps at equal load, then
 * total volume as a tiebreak for bodyweight and duration work where neither
 * of the first two moves.
 *
 * The third answer is the important one. Two sessions can be genuinely
 * **incomparable**, and calling that a stall invents a plateau out of a
 * programming decision or a change in how the lift is loaded:
 *
 *  - The plan itself prescribed less load (§7: a deliberate deload looks
 *    identical to a regression, and must not read as one).
 *  - The lift gained or lost external load entirely — bodyweight pull-ups to
 *    belted pull-ups. Fewer reps with added weight is not a decline, and the
 *    rep count alone cannot say which way it went.
 *
 * Caveat the caller must carry either way: with no logged RIR this cannot tell
 * "same numbers, much easier" from a true stall. §3's one-tap RIR field is
 * what closes that gap.
 */
export function compareSessions(current: ExerciseSession, previous: ExerciseSession): Comparison {
  if (
    current.plannedTopWeight != null &&
    previous.plannedTopWeight != null &&
    current.plannedTopWeight < previous.plannedTopWeight
  ) {
    return 'incomparable'
  }

  // Loading mode changed between the two sessions.
  if ((current.topWeight == null) !== (previous.topWeight == null)) return 'incomparable'

  return improvedOver(current, previous) ? 'improved' : 'not_improved'
}

/** Raw performance comparison, with no programming context. */
export function improvedOver(current: ExerciseSession, previous: ExerciseSession): boolean {
  if (current.topWeight != null && previous.topWeight != null) {
    if (current.topWeight > previous.topWeight) return true
    if (current.topWeight < previous.topWeight) return false
    // Equal load — reps are the next lever.
    if (current.topReps != null && previous.topReps != null && current.topReps !== previous.topReps) {
      return current.topReps > previous.topReps
    }
  } else if (current.topReps != null && previous.topReps != null && current.topReps !== previous.topReps) {
    return current.topReps > previous.topReps
  }

  if (current.totalDuration != null && previous.totalDuration != null && current.totalDuration !== previous.totalDuration) {
    return current.totalDuration > previous.totalDuration
  }
  if (current.totalVolume != null && previous.totalVolume != null) {
    return current.totalVolume > previous.totalVolume
  }
  return false
}

/**
 * Trailing run of sessions that failed to beat the one before them. An
 * incomparable pair ends the run rather than extending it: past that point the
 * comparison is not measuring the same thing, so a longer run would be counting
 * noise as evidence.
 */
export function trailingStallLength(sessions: ExerciseSession[]): number {
  let stalled = 0
  for (let i = sessions.length - 1; i > 0; i--) {
    const comparison = compareSessions(sessions[i], sessions[i - 1])
    if (comparison !== 'not_improved') break
    stalled++
  }
  return stalled
}

export type RegressionRead = {
  regressed: boolean
  /** The plan itself called for less load — a prescribed deload, not a decline. */
  prescribed: boolean
}

/**
 * A drop against the immediately prior session. Deliberate deloads look
 * identical to under-recovery in the raw numbers (workout-evolution.md §7), so
 * the planned load is checked first: if the plan asked for less, this is the
 * program working, not a problem.
 */
export function readRegression(sessions: ExerciseSession[]): RegressionRead {
  if (sessions.length < 2) return { regressed: false, prescribed: false }
  const current = sessions[sessions.length - 1]
  const previous = sessions[sessions.length - 2]

  const prescribed =
    current.plannedTopWeight != null &&
    previous.plannedTopWeight != null &&
    current.plannedTopWeight < previous.plannedTopWeight

  let regressed = false
  if (current.topWeight != null && previous.topWeight != null && current.topWeight < previous.topWeight) {
    regressed = true
  } else if (
    current.topWeight != null &&
    previous.topWeight != null &&
    current.topWeight === previous.topWeight &&
    current.topReps != null &&
    previous.topReps != null &&
    current.topReps < previous.topReps
  ) {
    regressed = true
  } else if (
    current.topWeight == null &&
    previous.topWeight == null &&
    current.topReps != null &&
    previous.topReps != null &&
    current.topReps < previous.topReps
  ) {
    regressed = true
  }

  return { regressed: regressed && !prescribed, prescribed }
}

// ── Per-exercise signals ──────────────────────────────────────────────────

export type ExerciseSignal = {
  exerciseId: number
  exerciseName: string
  primaryMuscle: string | null
  sessionsLogged: number
  firstLogged: string | null
  lastLogged: string | null
  latest: {
    topWeight: number | null
    topReps: number | null
    estimated1RM: number | null
    e1rmConfidence: 'ok' | 'low' | null
  }
  e1rmTrend: { date: string; estimated1RM: number; confidence: 'ok' | 'low' }[]
  stalledSessions: number
  stalled: boolean
  regressed: boolean
  prescribedDeload: boolean
  /** Times the exercise was skipped while the rest of its session was logged. */
  skippedWhileSessionCompleted: number
  abandoned: boolean
  caveats: string[]
}

export function deriveExerciseSignals(
  logs: SetLog[],
  skipCounts: Map<number, SkipRecord>
): ExerciseSignal[] {
  const byExercise = new Map<number, SetLog[]>()
  for (const log of logs) {
    const bucket = byExercise.get(log.exerciseId)
    if (bucket) bucket.push(log)
    else byExercise.set(log.exerciseId, [log])
  }

  const signals: ExerciseSignal[] = []
  for (const [exerciseId, exerciseLogs] of byExercise) {
    const sessions = rollupExerciseSessions(exerciseLogs)
    const latest = sessions[sessions.length - 1]
    const stalledSessions = trailingStallLength(sessions)
    const regression = readRegression(sessions)
    const skips = skipCounts.get(exerciseId)?.skips ?? 0

    const caveats: string[] = []
    if (sessions.length < 2) {
      caveats.push('Only one logged session — no trend is readable yet.')
    }
    if (latest.e1rmConfidence === 'low') {
      caveats.push(
        `Estimated 1RM came from a set above ${SIGNAL_CONSTANTS.e1rmMaxReliableReps} reps, where the formula degrades. Prefer the rep and load trend over the estimate.`
      )
    }
    if (latest.topWeight == null) {
      caveats.push('No external load logged — progression reads from reps and duration, not estimated max.')
    }
    if (stalledSessions > 0) {
      caveats.push(
        'Stall is read from load and reps only. Without logged RIR, sets that got easier at the same numbers look identical to a true stall.'
      )
    }
    if (stalledSessions > 0 && stalledSessions >= sessions.length - 1) {
      caveats.push(
        'Every logged session for this exercise is part of the flat run — no improving session was ever observed inside the window. The exercise may have been progressing before the window opened, or may never have progressed. Widen `sinceDays` before treating this as a plateau.'
      )
    }
    if (regression.prescribed) {
      caveats.push('Load dropped, but the plan prescribed the lighter session — read as a deload, not a decline.')
    }

    signals.push({
      exerciseId,
      exerciseName: exerciseLogs[0].exerciseName,
      primaryMuscle: exerciseLogs[0].primaryMuscle,
      sessionsLogged: sessions.length,
      firstLogged: dayKey(sessions[0].date),
      lastLogged: dayKey(latest.date),
      latest: {
        topWeight: latest.topWeight,
        topReps: latest.topReps,
        estimated1RM: latest.best1RM,
        e1rmConfidence: latest.e1rmConfidence,
      },
      e1rmTrend: sessions
        .filter(s => s.best1RM != null)
        .map(s => ({ date: dayKey(s.date), estimated1RM: s.best1RM!, confidence: s.e1rmConfidence! })),
      stalledSessions,
      stalled: stalledSessions >= SIGNAL_CONSTANTS.stallSessions,
      regressed: regression.regressed,
      prescribedDeload: regression.prescribed,
      skippedWhileSessionCompleted: skips,
      abandoned: skips >= SIGNAL_CONSTANTS.abandonmentSkips,
      caveats,
    })
  }

  // An exercise planned every session and never once logged has no set logs to
  // be found in, so the loop above cannot see it — yet it is the clearest
  // abandonment case there is. Emit it with empty performance fields rather
  // than letting it fall out of the report entirely.
  for (const record of skipCounts.values()) {
    if (byExercise.has(record.exerciseId)) continue
    signals.push({
      exerciseId: record.exerciseId,
      exerciseName: record.exerciseName,
      primaryMuscle: record.primaryMuscle,
      sessionsLogged: 0,
      firstLogged: null,
      lastLogged: null,
      latest: { topWeight: null, topReps: null, estimated1RM: null, e1rmConfidence: null },
      e1rmTrend: [],
      stalledSessions: 0,
      stalled: false,
      regressed: false,
      prescribedDeload: false,
      skippedWhileSessionCompleted: record.skips,
      abandoned: record.skips >= SIGNAL_CONSTANTS.abandonmentSkips,
      caveats: [
        'Planned but never logged in this window. That may be a skipped exercise or simply an unlogged one — confirm with the user before acting.',
      ],
    })
  }

  return signals.sort((a, b) => (b.lastLogged ?? '').localeCompare(a.lastLogged ?? ''))
}

export type SkipRecord = {
  exerciseId: number
  exerciseName: string
  primaryMuscle: string | null
  skips: number
}

/**
 * Counts, per exercise, the executions where it was planned but nothing was
 * logged for it *while at least one other exercise in the same execution was*.
 * The qualifier is what separates "skipped this movement" from "logged nothing
 * that day", which is a different signal entirely.
 */
export function countSkippedWhileSessionCompleted(
  executions: ExecutionLog[],
  logs: SetLog[]
): Map<number, SkipRecord> {
  const loggedByExecution = new Map<number, Set<number>>()
  for (const log of logs) {
    const bucket = loggedByExecution.get(log.executionId)
    if (bucket) bucket.add(log.exerciseId)
    else loggedByExecution.set(log.executionId, new Set([log.exerciseId]))
  }

  const skips = new Map<number, SkipRecord>()
  for (const execution of executions) {
    // An execution the user walked out of mid-session says nothing about the
    // exercises they never reached. Only completed sessions can evidence a
    // skip. (The service filters these too; the invariant belongs here.)
    if (execution.finishedAt == null) continue
    const logged = loggedByExecution.get(execution.id)
    if (!logged || logged.size === 0) continue // nothing logged at all — see rule 1
    for (const planned of execution.plannedExercises) {
      if (logged.has(planned.id)) continue
      const existing = skips.get(planned.id)
      if (existing) existing.skips++
      else
        skips.set(planned.id, {
          exerciseId: planned.id,
          exerciseName: planned.name,
          primaryMuscle: planned.primaryMuscle,
          skips: 1,
        })
    }
  }
  return skips
}

// ── Per-muscle-group signals ──────────────────────────────────────────────

export type MuscleSignal = {
  muscle: string
  daysSinceLastTrained: number
  setsInLastSession: number
  setsLast7Days: number
  weeklySets: number
  /** Days of history the rate was computed over — below 28, the rate is an
   *  extrapolation from a short record and should be read as provisional. */
  rateWindowDays: number
}

export function deriveMuscleSignals(logs: SetLog[], now: Date): MuscleSignal[] {
  const byMuscle = new Map<string, SetLog[]>()
  for (const log of logs) {
    if (!log.primaryMuscle) continue // unclassified exercise — counting it would silently distort the group totals
    const bucket = byMuscle.get(log.primaryMuscle)
    if (bucket) bucket.push(log)
    else byMuscle.set(log.primaryMuscle, [log])
  }

  const day = 86_400_000
  const signals: MuscleSignal[] = []
  for (const [muscle, muscleLogs] of byMuscle) {
    const sorted = [...muscleLogs].sort((a, b) => a.date.getTime() - b.date.getTime())
    const lastDate = sorted[sorted.length - 1].date
    const lastExecutionId = sorted[sorted.length - 1].executionId

    // Rate over the history that actually exists, not a fixed four weeks. A
    // user two weeks into logging trains at their real rate; dividing by four
    // would report half of it and invite a spurious "add volume" proposal.
    const recent = sorted.filter(l => now.getTime() - l.date.getTime() <= 28 * day)
    const oldest = recent[0]?.date ?? lastDate
    const observedDays = Math.min(
      28,
      Math.max(SIGNAL_CONSTANTS.minRateWindowDays, Math.ceil((now.getTime() - oldest.getTime()) / day))
    )

    signals.push({
      muscle,
      daysSinceLastTrained: Math.floor((now.getTime() - lastDate.getTime()) / day),
      setsInLastSession: sorted.filter(l => l.executionId === lastExecutionId).length,
      setsLast7Days: sorted.filter(l => now.getTime() - l.date.getTime() <= 7 * day).length,
      weeklySets: Math.round((recent.length / (observedDays / 7)) * 10) / 10,
      rateWindowDays: observedDays,
    })
  }

  return signals.sort((a, b) => a.daysSinceLastTrained - b.daysSinceLastTrained)
}

// ── Rest intervals ────────────────────────────────────────────────────────

export type RestReading = {
  medianRestSeconds: number | null
  samples: number
  usable: boolean
  note: string
}

/**
 * Recovered from per-set `createdAt`. Two honest limits, both reported rather
 * than smoothed over:
 *
 *  - The gap between two set timestamps spans the rest *and* the next set's
 *    execution and logging, so it is an upper bound on rest, not rest itself.
 *  - A user who logs the whole session at the end produces clustered timestamps
 *    that describe typing speed. Detected two ways — an absolute floor, and
 *    (when the session's real duration is known) the log span as a fraction of
 *    it, since ten sets entered over four minutes clears any sane absolute
 *    floor while still describing nothing but data entry.
 */
export function deriveRestIntervals(
  logs: SetLog[],
  sessionSecondsByExecution: Map<number, number> = new Map()
): RestReading {
  const byExecution = new Map<number, SetLog[]>()
  for (const log of logs) {
    const bucket = byExecution.get(log.executionId)
    if (bucket) bucket.push(log)
    else byExecution.set(log.executionId, [log])
  }

  const gaps: number[] = []
  let bulkLogged = 0
  for (const [executionId, setLogs] of byExecution) {
    if (setLogs.length < 2) continue
    const sorted = [...setLogs].sort((a, b) => a.loggedAt.getTime() - b.loggedAt.getTime())
    const span = (sorted[sorted.length - 1].loggedAt.getTime() - sorted[0].loggedAt.getTime()) / 1000
    const sessionSeconds = sessionSecondsByExecution.get(executionId)
    const tooFastForTheSession =
      sessionSeconds != null &&
      sessionSeconds > 0 &&
      span < sessionSeconds * SIGNAL_CONSTANTS.minLogSpanFraction
    if (span < SIGNAL_CONSTANTS.bulkLogSpanSeconds || tooFastForTheSession) {
      bulkLogged++
      continue
    }
    for (let i = 1; i < sorted.length; i++) {
      // Only within one block: the gap across an exercise change includes
      // setup and travel, which is not a rest interval.
      if (sorted[i].blockId !== sorted[i - 1].blockId) continue
      const gap = (sorted[i].loggedAt.getTime() - sorted[i - 1].loggedAt.getTime()) / 1000
      if (gap > 0 && gap <= SIGNAL_CONSTANTS.maxPlausibleRestSeconds) gaps.push(gap)
    }
  }

  if (gaps.length === 0) {
    return {
      medianRestSeconds: null,
      samples: 0,
      usable: false,
      note:
        bulkLogged > 0
          ? `${bulkLogged} execution(s) were logged in one burst rather than set by set, so the timestamps describe data entry, not rest. No usable reading.`
          : 'Not enough consecutive sets within a block to read rest intervals. Sets in a superset are separated by the partner exercise, so the gap between them is not a rest period and is not counted.',
    }
  }

  const sorted = [...gaps].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]

  return {
    medianRestSeconds: Math.round(median),
    samples: gaps.length,
    usable: true,
    note:
      'Upper bound: each gap covers the rest period plus the next set and the time taken to log it. Compare against the prescribed range as a ceiling, not a measurement.',
  }
}

// ── Session and plan signals ──────────────────────────────────────────────

export type SessionSignals = {
  executionsCompleted: number
  executionsStartedNotFinished: number
  duration: {
    medianMinutes: number | null
    minMinutes: number | null
    maxMinutes: number | null
    samples: number
    plannedMinutes: number | null
    /** Actual median as a multiple of the plan. >1 means sessions overrun. */
    overrunRatio: number | null
    note: string
  }
  setCompletion: {
    setsLogged: number
    setsPlanned: number
    rate: number | null
  }
  rest: RestReading
}

export function deriveSessionSignals(
  executions: ExecutionLog[],
  logs: SetLog[],
  plannedMinutes: number | null = null
): SessionSignals {
  const completed = executions.filter(e => e.finishedAt != null)
  const durations = completed
    .filter(e => e.startedAt != null && e.finishedAt != null)
    .map(e => (e.finishedAt!.getTime() - e.startedAt!.getTime()) / 60000)
    .filter(m => m > 0)
    .sort((a, b) => a - b)

  const mid = Math.floor(durations.length / 2)
  const medianMinutes =
    durations.length === 0
      ? null
      : Math.round(durations.length % 2 === 0 ? (durations[mid - 1] + durations[mid]) / 2 : durations[mid])

  const setsPlanned = completed.reduce((sum, e) => sum + e.plannedSets, 0)
  const loggedExecutionIds = new Set(completed.map(e => e.id))
  const setsLogged = logs.filter(l => loggedExecutionIds.has(l.executionId)).length

  return {
    executionsCompleted: completed.length,
    executionsStartedNotFinished: executions.filter(e => e.startedAt != null && e.finishedAt == null).length,
    duration: {
      medianMinutes,
      minMinutes: durations.length ? Math.round(durations[0]) : null,
      maxMinutes: durations.length ? Math.round(durations[durations.length - 1]) : null,
      samples: durations.length,
      plannedMinutes,
      overrunRatio:
        plannedMinutes != null && plannedMinutes > 0 && medianMinutes != null
          ? Math.round((medianMinutes / plannedMinutes) * 100) / 100
          : null,
      note:
        plannedMinutes == null
          ? 'No planned session length on the profile, so actual duration cannot be scored against a budget. Set `minutesPerSession` to turn this into the planned-vs-actual signal.'
          : 'A plan that consistently overruns has the wrong volume budget. Re-run the budget on the actual median rather than the aspirational target, and prefer reducing scope over exhorting the user to go faster.',
    },
    setCompletion: {
      setsLogged,
      setsPlanned,
      rate: setsPlanned > 0 ? Math.round((setsLogged / setsPlanned) * 100) / 100 : null,
    },
    rest: deriveRestIntervals(
      logs,
      new Map(
        completed
          .filter(e => e.startedAt != null && e.finishedAt != null)
          .map(e => [e.id, (e.finishedAt!.getTime() - e.startedAt!.getTime()) / 1000])
      )
    ),
  }
}

// ── Adherence ─────────────────────────────────────────────────────────────

export type AdherenceSignal = {
  tier: 'onboarding' | 'building' | 'established' | null
  consecutiveWeeksOk: number
  plannedSessionsPerWeek: number | null
  weeks: { weekStart: string; sessionsCompleted: number; met: boolean }[]
  confidence: 'low' | 'moderate'
  caveats: string[]
}

function weekStartKey(d: Date): string {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  // ISO weeks start Monday; getUTCDay() is 0 for Sunday.
  const offset = (copy.getUTCDay() + 6) % 7
  copy.setUTCDate(copy.getUTCDate() - offset)
  return copy.toISOString().slice(0, 10)
}

/**
 * r3-amendment §2.4 derives the tier from history rather than self-report.
 * The known hole (r3-amendment §9) is that a user training unlogged looks
 * identical to one not training — and since `validate_workout` will *fail*
 * plans on the onboarding tier, a wrong tier has teeth. Hence: never higher
 * than `moderate` confidence, and the caveat travels with the value.
 */
export function deriveAdherence(
  executions: ExecutionLog[],
  plannedSessionsPerWeek: number | null,
  now: Date
): AdherenceSignal {
  const caveats: string[] = [
    'Derived from logged executions only. Training that happened but was not logged is indistinguishable from training that did not happen, so this can under-tier a consistent user. Treat it as overridable.',
  ]

  if (plannedSessionsPerWeek == null) {
    caveats.push('No `daysPerWeek` on the training profile, so there is no target to score weeks against.')
    return {
      tier: null,
      consecutiveWeeksOk: 0,
      plannedSessionsPerWeek: null,
      weeks: [],
      confidence: 'low',
      caveats,
    }
  }

  const completed = executions.filter(e => e.finishedAt != null)
  const counts = new Map<string, number>()
  for (const execution of completed) {
    const key = weekStartKey(execution.date)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  // Walk complete weeks backwards from the one before the current, partial
  // week — scoring a week that is still in progress would flag every user
  // mid-week as having missed their target.
  const weeks: { weekStart: string; sessionsCompleted: number; met: boolean }[] = []
  const currentWeek = weekStartKey(now)
  const cursor = new Date(`${currentWeek}T00:00:00.000Z`)
  cursor.setUTCDate(cursor.getUTCDate() - 7)

  for (let i = 0; i < SIGNAL_CONSTANTS.adherenceEstablishedWeeks + 4; i++) {
    const key = cursor.toISOString().slice(0, 10)
    const sessionsCompleted = counts.get(key) ?? 0
    weeks.push({ weekStart: key, sessionsCompleted, met: sessionsCompleted >= plannedSessionsPerWeek })
    cursor.setUTCDate(cursor.getUTCDate() - 7)
  }

  let consecutiveWeeksOk = 0
  for (const week of weeks) {
    if (!week.met) break
    consecutiveWeeksOk++
  }

  const tier =
    consecutiveWeeksOk >= SIGNAL_CONSTANTS.adherenceEstablishedWeeks
      ? 'established'
      : consecutiveWeeksOk >= SIGNAL_CONSTANTS.adherenceBuildingWeeks
        ? 'building'
        : 'onboarding'

  if (completed.length === 0) {
    caveats.push('No completed executions on record — the onboarding tier here reflects absence of data, not observed non-compliance.')
  }

  return {
    tier,
    consecutiveWeeksOk,
    plannedSessionsPerWeek,
    weeks: weeks.slice(0, SIGNAL_CONSTANTS.adherenceEstablishedWeeks),
    confidence: completed.length >= 4 ? 'moderate' : 'low',
    caveats,
  }
}
