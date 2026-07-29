import { prisma } from '../lib/prisma.js'
import * as trainingProfileService from './trainingProfileService.js'
import {
  SIGNAL_CONSTANTS,
  countSkippedWhileSessionCompleted,
  deriveAdherence,
  deriveExerciseSignals,
  deriveMuscleSignals,
  deriveSessionSignals,
  type ExecutionLog,
  type SetLog,
} from '../lib/trainingSignals.js'

// Turns logged history into the state an evolving plan needs
// (docs/workout-evolution.md §4). Deterministic, and asks the user for nothing
// — it reads only what the app already records.
//
// This is step 1 of the evolution build order on purpose: it proves the
// derivations against real logs before anyone is asked to tap a new field.

export type TrainingSignalsOptions = {
  /** How far back to read. Defaults to the standard observation window. */
  sinceDays?: number
  /** Injectable clock so the derivations are testable at a fixed date. */
  now?: Date
}

export async function getTrainingSignals(userId: number, options: TrainingSignalsOptions = {}) {
  const now = options.now ?? new Date()
  const sinceDays = options.sinceDays ?? SIGNAL_CONSTANTS.observationWindowDays
  const since = new Date(now.getTime() - sinceDays * 86_400_000)

  const profile = await trainingProfileService.getTrainingProfile(userId)

  const executions = await prisma.workoutExecution.findMany({
    where: { userId, date: { gte: since } },
    include: {
      workout: { select: { name: true } },
      session: {
        select: {
          name: true,
          blocks: {
            select: {
              id: true,
              exerciseId: true,
              exercise: { select: { name: true, primaryMuscle: true } },
              items: { select: { id: true, reps: true, weight: true, duration: true } },
            },
          },
        },
      },
      blockExecutions: {
        select: {
          reps: true,
          weight: true,
          duration: true,
          createdAt: true,
          workoutSessionBlockItem: {
            select: {
              reps: true,
              weight: true,
              duration: true,
              block: {
                select: {
                  id: true,
                  exerciseId: true,
                  exercise: { select: { name: true, primaryMuscle: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { date: 'asc' },
  })

  const executionLogs: ExecutionLog[] = executions.map(execution => {
    const blocks = execution.session?.blocks ?? []
    return {
      id: execution.id,
      date: execution.date,
      startedAt: execution.startedAt,
      finishedAt: execution.finishedAt,
      workoutId: execution.workoutId,
      workoutName: execution.workout.name,
      sessionId: execution.sessionId,
      sessionName: execution.session?.name ?? null,
      plannedSets: blocks.reduce((sum, block) => sum + block.items.length, 0),
      plannedExercises: [
        ...new Map(
          blocks.map(block => [
            block.exerciseId,
            {
              id: block.exerciseId,
              name: block.exercise.name,
              primaryMuscle: block.exercise.primaryMuscle,
            },
          ])
        ).values(),
      ],
    }
  })

  // Only completed executions feed the trend derivations. An abandoned or
  // still-running execution is a partial record, and reading a stall out of
  // one would be reading the interruption, not the training.
  const setLogs: SetLog[] = executions
    .filter(execution => execution.finishedAt != null)
    .flatMap(execution =>
      execution.blockExecutions.map(blockExecution => {
        const item = blockExecution.workoutSessionBlockItem
        return {
          executionId: execution.id,
          date: execution.date,
          loggedAt: blockExecution.createdAt,
          exerciseId: item.block.exerciseId,
          exerciseName: item.block.exercise.name,
          primaryMuscle: item.block.exercise.primaryMuscle,
          blockId: item.block.id,
          reps: blockExecution.reps,
          weight: blockExecution.weight,
          duration: blockExecution.duration,
          plannedReps: item.reps,
          plannedWeight: item.weight,
          plannedDuration: item.duration,
        }
      })
    )

  const completedExecutions = executionLogs.filter(e => e.finishedAt != null)
  const skipCounts = countSkippedWhileSessionCompleted(completedExecutions, setLogs)

  const exercises = deriveExerciseSignals(setLogs, skipCounts)
  const muscles = deriveMuscleSignals(setLogs, now)
  const sessions = deriveSessionSignals(executionLogs, setLogs, profile.minutesPerSession ?? null)
  const adherence = deriveAdherence(executionLogs, profile.daysPerWeek ?? null, now)

  // The tier is derived, but a user who trains without logging looks exactly
  // like one who does not train — and the tier gates plan validation. An
  // explicit override on the profile therefore wins over the derivation.
  const effectiveAdherence = profile.adherenceTierOverride
    ? {
        ...adherence,
        tier: profile.adherenceTierOverride as typeof adherence.tier,
        overridden: true,
        caveats: [...adherence.caveats, 'Tier was set manually on the profile and overrides the derived value.'],
      }
    : { ...adherence, overridden: false }

  return {
    window: {
      since: since.toISOString().slice(0, 10),
      until: now.toISOString().slice(0, 10),
      days: sinceDays,
      executionsInWindow: executionLogs.length,
      setsLogged: setLogs.length,
    },
    exercises,
    muscles,
    sessions,
    adherence: effectiveAdherence,
    proposals: buildProposals(exercises),
    missingInputs: buildMissingInputs(profile, setLogs, sessions),
    constants: SIGNAL_CONSTANTS,
    interpretation: INTERPRETATION_NOTES,
  }
}

// ── Implicit preferences ──────────────────────────────────────────────────

/**
 * An exercise repeatedly skipped while the rest of its session gets logged is
 * an implicit dislike (workout-evolution.md §4). It is surfaced as something
 * to *ask about* and never written to the profile: silently inferring what a
 * user wants is how a tool stops being trustworthy.
 */
function buildProposals(exercises: ReturnType<typeof deriveExerciseSignals>) {
  return exercises
    .filter(exercise => exercise.abandoned)
    .map(exercise => ({
      type: 'confirm_exclusion' as const,
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      inferredReason: 'dislike',
      signal: `Planned but not logged in ${exercise.skippedWhileSessionCompleted} execution(s) where other exercises in the same session were logged.`,
      action: 'Ask the user before excluding. Do not write this to the profile automatically.',
    }))
}

// ── Missing inputs ────────────────────────────────────────────────────────

/**
 * Mirrors the `clarifyingQuestions` channel (r3-amendment §4.14): name only the
 * gaps that would change an answer above, not every empty column.
 */
function buildMissingInputs(
  profile: { daysPerWeek: number | null; minutesPerSession: number | null; equipmentLoadsUnknown: boolean },
  setLogs: SetLog[],
  sessions: ReturnType<typeof deriveSessionSignals>
) {
  const missing: { field: string; unlocks: string; question: string }[] = []

  if (profile.daysPerWeek == null) {
    missing.push({
      field: 'daysPerWeek',
      unlocks: 'adherence tier',
      question: 'How many days per week are you planning to train?',
    })
  }
  if (profile.minutesPerSession == null && sessions.duration.samples > 0) {
    missing.push({
      field: 'minutesPerSession',
      unlocks: 'planned-vs-actual duration, and a volume budget built on the real session length',
      question: `Your sessions are running about ${sessions.duration.medianMinutes} minutes. How long do you actually want them to be?`,
    })
  }
  if (profile.equipmentLoadsUnknown) {
    missing.push({
      field: 'equipment.loads',
      unlocks: 'load feasibility — whether a prescribed set is achievable with what the user owns',
      question: 'What weights do you actually have, and in what increments?',
    })
  }
  if (setLogs.some(log => log.weight == null)) {
    missing.push({
      field: 'actualRir',
      unlocks: 'stall detection that can tell "same numbers, easier" from a real plateau',
      question: 'On your last set, roughly how many reps did you have left in the tank?',
    })
  }

  return missing
}

// ── Interpretation notes ──────────────────────────────────────────────────
// The confounders from workout-evolution.md §7, shipped in the payload rather
// than left to the client to remember. Any consumer proposing a plan change
// off these signals needs them in front of it.

const INTERPRETATION_NOTES = [
  'A missing log is not a skipped session. The user may have trained without logging, or trained elsewhere. Never assert non-compliance from absence — ask.',
  'Load jumps are usually equipment increments, not decisions. 12 kg to 14 kg dumbbells is the next pair on the rack, not a chosen 17% progression. Read jumps against the available inventory.',
  'A single regressed session is usually life — sleep, stress, illness — not programming. That is why stall detection needs consecutive sessions.',
  'Estimated 1RM is unreliable above ~10 reps. For bodyweight and long-set work, read the rep and duration trend instead.',
  'A prescribed deload looks identical to a regression in raw numbers. Sessions where the plan itself lowered the load are flagged `prescribedDeload` and must not be read as decline.',
  'No RIR is logged yet, so "stalled" means the load and reps stopped moving — not that the sets were maximal.',
]
