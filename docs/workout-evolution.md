# Workout Evolution — using logged user data as planning context

Design doc for the feature that turns this app's execution history into the
context an MCP client uses when **iterating** on an existing plan, rather than
generating a new one from scratch.

Companion to `docs/exercise-knowledge-base.md` (Rev 2) and
`docs/knowledge-base-r3-amendment.md`.

**Status:** §9 step 1 is built — `get_training_signals` ships the derivation
layer over existing data (`backend/src/lib/trainingSignals.ts`,
`services/trainingSignalsService.ts`, `mcp/tools/signals.ts`). Steps 2–6 are
not started. Two §4 assumptions were wrong; see §4's notes on duration and
rest.

---

## 1. Why this is the highest-value piece

Rev 2 §1 lists four mechanisms by which this server beats a bare LLM. Mechanism
3 — **the user's own data** — is the only one a competitor cannot copy by
reading a paper, and it is currently the least developed.

The framing that matters: a coach's value is not the initial plan. Anyone can
write a reasonable first plan, including a frontier model with no tools. The
value is the **weekly adjustment** — noticing the bench stalled three sessions
running, that leg day keeps getting skipped, that the "45-minute" session
actually takes 70. That requires longitudinal data about one specific person,
which is exactly what this app already collects and currently does nothing with.

Consequence for scope: this feature is about **deltas to an existing plan**, not
plan generation. Generation stays client-side (Rev 2 §4.7). Evolution proposals
are structured, cited, and reviewed — the server proposes, the client and user
dispose.

---

## 2. What is already logged (code audit)

Confirmed against `prisma/schema.prisma`:

| Signal | Source | Status |
|---|---|---|
| Actual reps / weight / duration per set | `WorkoutSessionBlockExecution` | ✅ logged |
| Planned vs actual, per set | FK to `WorkoutSessionBlockItem` | ✅ derivable |
| **Per-set timestamp** | `WorkoutSessionBlockExecution.createdAt` | ✅ logged — gives actual rest intervals for free |
| **Session duration** | `WorkoutExecution.startedAt` / `finishedAt` | ✅ logged |
| Session date, workout, session | `WorkoutExecution` | ✅ logged |
| Actual RIR / RPE | — | ❌ missing |
| Pain / discomfort flag | — | ❌ missing |
| Why a set or session was skipped | — | ❌ missing |

The free signals are better than expected. Per-set `createdAt` means actual rest
intervals are already recoverable without asking the user anything — and rest
interval is a cited guideline variable, so planned-vs-actual rest is checkable
today.

---

## 3. Feedback capture — deliberately minimal

Design constraint that overrides completeness: **this is filled in on a phone,
mid-set, in a gym.** Every added field is friction, and friction kills logging.
A missing log destroys more value than a missing RPE field creates. Cap the new
inputs at three, all one-tap, all optional:

1. **Per set — actual RIR.** Tap 0/1/2/3/4+. Optional; absent is a valid state
   and must not be imputed as any particular value.
2. **Per block — discomfort flag.** none / discomfort / pain, plus location from
   the existing `INJURY_CONDITIONS` vocabulary. One tap, and it is the single
   highest-consequence signal in the system — it routes into the Rev 3 §4.5
   constraint layer and can veto an exercise outright.
3. **Per session — overall RPE.** One tap, 1–10, on the finish-execution screen
   where the user has already stopped moving.

Explicitly **not** collecting: nutrition, mood scales, HRV, per-set video, free
text beyond the existing notes. Each is defensible in isolation and collectively
they guarantee nobody logs anything.

Schema: nullable `actualRir` on `WorkoutSessionBlockExecution`, a
`discomfort`/`discomfortLocation` pair at block-execution level, `sessionRpe` on
`WorkoutExecution`. All nullable — the derivation layer must work with none of
them present, degrading to the free signals in §2.

---

## 4. Derivation layer — `get_training_signals()`

One tool, deterministic, no user input required. Turns raw logs into the state
an evolving plan needs. Everything here is computable from §2 alone; §3 fields
sharpen it where present.

**Per exercise:**
- Estimated 1RM trend across sessions (with the accuracy caveat from
  r3-amendment §4.12 — e1RM formulas degrade badly above ~10 reps).
- **Stall**: N consecutive sessions with no increase in load or reps at
  comparable RIR.
- **Regression**: load or reps down versus the immediately prior session.
- **Abandonment**: exercise present in the plan and repeatedly not logged.

**Per muscle group:**
- Days since last trained, volume in that session (feeds
  `get_recovery_state`, r3-amendment §4.10).
- Actual weekly sets vs the cited guideline range.

**Per session / plan:**
- **Planned vs actual duration** — the highest-value derived signal, but *not*
  free after all. **Correction:** no planned session length is stored anywhere
  — not on `Workout`, not on `WorkoutSession`, not on `TrainingProfile`. Actual
  duration is available; there is nothing to score it against. The tool reports
  actual duration with `plannedMinutes: null` and asks for the target via
  `missingInputs`. A `minutesPerSession` field is a prerequisite for both this
  signal and the volume budget solver (r3-amendment §7), which needs the same
  number — add it in the §8.1 profile migration.
- **Actual rest intervals** from per-set `createdAt`. **Correction:** there is
  no prescribed-rest column on `WorkoutSessionBlockItem` either, so the
  comparison is against the `rest_between_sets` *guideline* range, not a
  per-block prescription. Two further limits, both reported in the payload
  rather than smoothed over: the gap between set timestamps covers rest **plus**
  the next set and the time taken to log it, so it is an upper bound; and a user
  who logs the whole session at the end produces clustered timestamps that
  describe typing speed, which is detected and marked unusable instead of
  published as a number.
- Completion rate: sets logged / sets planned; sessions executed / scheduled.
- Adherence tier (r3-amendment §2.4), derived not self-reported.

**Abandonment → preference.** An exercise skipped repeatedly while the rest of
the session is completed is an implicit dislike. Propose it as an
`excludedExercises` entry (r3-amendment §2.3) with an inferred reason — propose,
never write silently. Silent inference of user preferences is how a tool becomes
untrustworthy.

---

## 5. `propose_workout_evolution(workoutId)`

Returns a **structured diff proposal**, never a mutation. Mirrors
`validate_workout`: the server computes, the client and user decide, the
existing `update_*` tools write.

Each proposed change carries four things — without all four it does not ship:

```jsonc
{
  "change": "progress_load",
  "target": { "blockId": 42, "exerciseId": 118 },
  "from": { "weight": 60 }, "to": { "weight": 62.5 },
  "signal": "3 sessions at 60kg × 8 with actualRir ≥ 2",
  "rule": { "key": "load_progression", "citationKeys": ["acsm2009progression"] },
  "confidence": "high"
}
```

Change types, in rough order of how often they should fire:

| Change | Trigger |
|---|---|
| `progress_load` / `progress_reps` | Target met at or above target RIR for N sessions |
| `add_set` | Sustained completion, volume below the cited range, adherence tier allows |
| `deload` | Stall or regression across the observation window |
| `substitute_exercise` | Discomfort flag, repeated abandonment, or `LOAD_LIMITED` (r3-amendment §4.12) |
| `rebalance_volume` | Emphasis not honored, or a muscle group outside the cited range |
| `reduce_scope` | Actual duration over budget, or adherence declining |

`reduce_scope` deserves emphasis: it is the change an LLM will essentially never
propose on its own, and it is frequently the correct one. A plan the user cannot
finish is worse than a smaller plan they complete.

---

## 6. Anti-thrash rules

The failure mode of a data-driven evolution tool is changing the plan every
session — which is program-hopping with extra steps, and the thing coaches
actively prevent. A good coach changes one variable at a time and lets it run
long enough to read the result.

Encode it, do not leave it to the model:

- **Minimum observation window.** No change fires on a single session. Progression needs N≥2 confirming sessions; structural changes (substitute, rebalance, reduce scope) need more.
- **Max changes per iteration.** Cap it low — roughly 1 structural change, or a handful of load progressions, per proposal.
- **Minimum interval between structural changes** to the same block, so a substitution gets time to be evaluated.
- **Exception:** the discomfort/pain flag bypasses every window above. Pain is not a trend to confirm.

---

## 7. Confounders — state these in the output, do not hide them

Every one of these will produce a wrong proposal if treated naively. The tool
should degrade confidence rather than assert:

- **A missing log is not a skipped session.** The user may have trained and not
  logged, or trained elsewhere. Never assert non-compliance from absence — say
  "no data" and let §4.14's clarifying-questions channel ask.
- **Load jumps are often equipment increments, not decisions.** 12 kg → 14 kg
  dumbbells is +17% because that is the next dumbbell on the rack, not because
  anyone chose a progression rate. Interpret against the equipment inventory
  (r3-amendment §2.2), not as a free-floating percentage.
- **Single-session regression is usually life, not programming.** Sleep, stress,
  illness, timing. This is why the observation window exists.
- **e1RM is unreliable at high reps** — the same extrapolation problem as
  r3-amendment §4.12. Bodyweight and long-set work needs rep/duration trends
  instead of estimated maxes.
- **Deliberate deloads look identical to regression** in the raw data. If the
  plan prescribed a lighter week, the tool must not read it as a stall.

### 7.1 Found by stress-testing, not by design

Every item below produced a *wrong signal* in the first implementation and was
only caught by writing adversarial tests against the claims in §4. They are
listed because each is a way the tool can confidently lie:

- **Two executions on one calendar day** — a duplicate row, a restarted
  session, or a real two-a-day — produced two consecutive trend points at the
  same load, which is the literal definition of a stall. The rollup now keys on
  the **training day**, not the execution.
- **A loading-mode change reads as a decline.** Bodyweight pull-ups → belted
  pull-ups is fewer reps at more load; comparing rep counts across that
  boundary invents a plateau. Comparison now has a third answer,
  `incomparable`, which ends the stall run instead of extending it. Prescribed
  deloads use the same channel.
- **Bulk logging can be slower than any absolute threshold.** Ten sets entered
  over four minutes after a seventy-minute session clears a 60-second floor
  while describing nothing but typing speed. Detection now also compares the
  log span against the session's real duration.
- **A fixed four-week denominator halves a new user's training rate.** Two
  weeks of logs divided by four weeks reports half the truth and invites a
  spurious "add volume" proposal. The rate now uses the history that exists and
  reports `rateWindowDays` alongside it.
- **An unfinished execution is not evidence of a skip.** Walking out mid-session
  says nothing about the exercises never reached.
- **A stall with no observed progression is not a plateau.** If every logged
  session for an exercise is part of the flat run, the window may simply have
  opened after the progress happened. That now carries an explicit caveat.

The general lesson, worth applying to the change types in §5 before they ship:
the failure mode is never a crash, it is a plausible number with no warning
attached to it.

---

## 8. Relationship to the rest of the design

- Reads `TrainingProfile` (r3-amendment §2) for outcome, inventory, exclusions,
  adherence tier.
- Every proposal cites a rule from `training-guidelines` or a playbook — same
  provenance discipline as everything else. **No un-cited proposals.**
- Feeds `validate_workout`: an applied evolution must still pass validation.
- Feeds the volume budget solver with *actual* session duration instead of
  planned.
- `get_recovery_state` (r3-amendment §4.10) is a consumer of §4's derivations,
  not a separate pipeline.

## 9. Build order

1. ~~`get_training_signals()` over the **existing** data only (§2). No schema
   change, no new user input — ships value immediately and proves the
   derivations before anyone is asked to tap anything.~~ **Done.** Confirmed the
   §2 audit, and surfaced the two gaps recorded in §4 (no planned session
   length, no prescribed rest). Stall/regression/abandonment, muscle recency,
   set completion and the derived adherence tier all work off existing logs.
2. Nullable feedback fields (§3) + one-tap UI on the execution screen.
3. `propose_workout_evolution` with `progress_load` / `progress_reps` /
   `deload` only — the well-cited changes.
4. Anti-thrash rules (§6) — before adding change types, not after.
5. Remaining change types: substitute, rebalance, reduce scope.
6. Abandonment → `excludedExercises` proposal flow.

## 10. Open questions

- Where does the evolution proposal surface in the app UI, or is it MCP-only
  at first? MCP-only is the cheaper start and matches the mobile-first
  constraint.
- Does an applied evolution version the workout (history preserved) or mutate
  in place? Versioning is more honest for progress tracking but a larger change.
- N for the observation window: pick from the progression literature, or start
  conservative and tune? Probably the latter, stated as a `consensus`-tier
  constant rather than dressed up as derived.
