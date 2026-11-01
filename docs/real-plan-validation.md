# Validation against real coached training plans

What happened when `lib/trainingSignals.ts` was run, unmodified, over two
complete exports of coach-programmed training. The question was not whether the
code executes — it was whether a coach reading its output would act on it.

**Verdict: the plumbing holds, the judgement does not.** Nothing crashed and no
number was arithmetically wrong. But across both datasets the tool would have
proposed removing warm-up work, classified two consistent trainees as beginners
for 90–99% of two years, and missed every deload their coach programmed.

Nothing in this document is implemented. It is the input to a fixing session.

---

## The datasets

Two TrainHeroic exports, same coach, same exercise library, same 24-month
window (2024-07 → 2026-07). They differ enough in style to separate "our model
is wrong" from "that one user's data was unusual" — which is the whole reason
the second one matters.

| | **D1** | **D2** |
|---|---|---|
| Sessions planned | 336 | 342 |
| Sessions with logged data | 210 (62%) | 244 (71%) |
| Exercise rows | 3403 planned / 1256 logged | 2242 planned / 1515 logged |
| Distinct exercises | 243 | 223 |
| Median planned | 3/wk, 10 exercises/session | 3/wk, 6 exercises/session |
| Median logged | 2/wk, 6 exercises/session | 3/wk, 6 exercises/session |
| Warm-up/mobility in plan | heavy | none |
| Partial logging | 70% of sessions | 16% of sessions |

D1's plans include the full warm-up and mobility sequence as exercise rows; D2's
do not. D2 is the more consistent logger. The two share 112 exercises out of a
354-name union, and 84–89% of names carry the coach's `- TSR` library suffix.

**Evidence limits.** Two users, one coach, one training style. Neither export
carries per-set timestamps, session start/finish times, or numeric planned
loads — so rest intervals, duration signals and part of the deload guard could
not be exercised at all. Muscle grouping below uses a keyword heuristic in the
test harness, not our taxonomy.

---

## Findings

Ordered by how wrong we are, not by how hard the fix is. Each is marked
**structural** (confirmed in both datasets — our model is wrong) or
**style-dependent** (severity varies, but the mechanism is still wrong).

### 1. The adherence tier is unreachable — *structural*

Evaluating `deriveAdherence` every week across the full two years:

| Target | Dataset | onboarding | building | established | best run |
|---|---|---|---|---|---|
| 3/wk | D1 | **99%** | 1% | **0%** | 4 |
| 3/wk | D2 | **90%** | 10% | **0%** | 7 |
| 2/wk | D1 | 83% | 17% | 0% | 10 |
| 2/wk | D2 | 59% | 35% | 6% | 16 |

`established` requires 12 consecutive weeks. At each user's own median planned
frequency, neither reached it once in two years. D2 is the *more* diligent
trainee — 71% of sessions logged, median 3 logged per week — and still reads
`onboarding` for 90% of her history.

The behaviour underneath is not beginner behaviour: D1 had a session in 84% of
weeks and two in 71%, sustained for two years under a coach.

The rule is at fault. Requiring N *consecutive* weeks at the full planned count
means one missed week — illness, travel, a deload, a bad month — resets to zero,
and nobody's real training survives that. This is the risk flagged when the
manual override was added, now measured: r3-amendment §4.13 makes `onboarding`
**fail** plan validation for exceeding the tier ceiling, so as specified we
would have throttled both users for almost their entire training history.

**Change:** define the tier on sustained participation, not perfect weeks — a
rolling 8-week ratio of logged to planned sessions, with thresholds on that
ratio. Keep the manual override. Any replacement must promote both of these
users; that is now a concrete acceptance test.

### 2. Deloads are invisible to us — *structural*

The coach ran deload weeks — weeks where most comparable lifts drop together —
and `prescribedDeload` detected **none** of them, in either dataset.

| | D1 | D2 |
|---|---|---|
| Deload-shaped weeks (≥50% of lifts down >5%) | 8 | 7 |
| Share of lifts dropping in a *normal* week (median) | 17% | 22% |
| Share on the deload weeks | 50–73% | 50–91% |
| Detected by `prescribedDeload` | 0 | 0 |

Our guard compares `plannedWeight` between sessions. Neither export has numeric
planned loads, because this coach prescribes in prose:

> `Midline:\n\n3 Sets of 12-15 Reps  choose 3 of the below\nHollow rocks\n…\n- 90 Sec Rest`

That is what competent programming looks like in the wild — schemes and ranges
as text, not per-set numeric targets. The one mechanism separating "programmed
deload" from "under-recovery" therefore depends on data real programs do not
produce, and all 15 deload weeks would have read as regression.

The encouraging half: the signal separates cleanly **without** planned loads.
17–22% median versus 50–91% is not a marginal call.

**Change:** add a cross-lift deload detector — a simultaneous drop across many
unrelated lifts in one week is a programming decision; scattered independent
drops are noise. This is strictly better than the planned-load guard because it
works on data that exists. Keep the planned-load check for plans authored inside
our app, where the numbers *are* present.

### 3. Abandonment fires on the wrong things — *structural, two different ways*

| | D1 | D2 |
|---|---|---|
| Flagged abandoned | 44 of 203 | 18 of 200 |
| Of those, warm-up/mobility | 23+ (top 12 all prep) | 2 (11%) |
| Highest skip count | 119 | 3 |

**D1 — absence misread as refusal.** The strongest signals are the entire
warm-up: Banded Shoulder Dislocations (119 skips), Deep Lunge T-Spine Rotation
(119), Band Pull Apart (92), Rack Lat Stretch (84), Rack Chest Stretch (70),
Alternating Lizard Lunges (67). The coach programmed these in nearly every
session for two years. Our proposal would be *"the user seems to dislike these,
consider excluding them."*

workout-evolution.md §4 asserts that an exercise "skipped repeatedly while the
rest of the session is completed is an implicit dislike". That assumes every
exercise produces numbers. Mobility work does not — there is nothing to log, so
**absence is its normal state**.

**D2 — exposure ignored.** With no mobility rows, the flags land on staples
instead: Bench Press (2 skips), Romanian Deadlift (2), DB Lateral Raise (2).
DB Lateral Raise was performed 65 times. A threshold of 2 *absolute* skips
flags an exercise she does twice a week and missed twice in a year.

Both failures are the same underlying error in different clothes: the signal
counts events without reference to exposure or to whether the exercise was ever
expected to produce a log.

**Change:**
- Gate on whether the exercise is expected to produce a log. `MOVEMENT_PATTERNS`
  already has `mobility`; the §8.2 taxonomy pass should also carry warm-up/prep
  intent explicitly.
- Score on skip **rate** with a minimum exposure, not an absolute count.
- Raise the threshold substantially above 2.

### 4. Stall detection is 20–40% noise — *structural*

| | D1 | D2 |
|---|---|---|
| Flagged stalled | 63 of 165 (38%) | 31 of 155 (20%) |
| Mobility or never-loaded | 44% | 42% |
| On genuinely loaded lifts | 35 | 18 |

D1's top stalls are stretches: `Rack Pec Minor Stretch` (run of 7),
`Massage Ball Pec Smash`, `Spiderman Rotations`, `Hip Airplane`. A stretch held
for the same duration every session is not plateauing.

D2 surfaces a distinction worth keeping: its never-loaded flags include
`Push-Up` and `Inverted Row` — real bodyweight strength work where a flat rep
count genuinely *is* a stall. So the gate is not "does it carry external load"
but **"is progression intended for this exercise"**. Those are different
questions and only the second one is correct.

**Change:** restrict progression derivations to exercises with progression
intent; carry that intent in the taxonomy rather than inferring it from load.

### 5. `regressed` has no observation window — *structural*

38 exercises flagged in D1, 43 in D2. But session-to-session direction on the
main lifts is close to a coin flip:

| Lift | Dataset | n | up | flat | down | net (lb) |
|---|---|---|---|---|---|---|
| Bench Press | D1 | 47 | 21 | 8 | 17 | 33 → 33 |
| Back Squat | D1 | 29 | 14 | 7 | 7 | 50 → 50 |
| Trap Bar Deadlift | D1 | 29 | 16 | 6 | 6 | 44 → 77 |
| Bench Press | D2 | 48 | 29 | 6 | 12 | 66 → 99 |
| Leg Press | D2 | 47 | 29 | 2 | 15 | 88 → 198 |
| Romanian Deadlift | D2 | 42 | 18 | 10 | 13 | 99 → 66 |

D2's Leg Press nearly doubled while dropping on 15 of 47 sessions. Any flag that
fires on a single drop would have interrupted that progression fifteen times.

`stalled` has a multi-session window; `regressed` compares the last session to
the previous one and stops. §7 already says a single regressed session is
usually life rather than programming — this quantifies it at 17–22% of lifts in
a typical week.

**Change:** give `regressed` the same observation window as `stalled`, and rank
by magnitude instead of treating every drop as an event.

### 6. Unit labels lie — *structural*

Every load in both exports is labelled `kilogram`. Read as kilograms, 8.4% (D1)
and 12.4% (D2) land on a clean 0.25 increment. Read as **pounds**: 98.6% and
98.5%.

The exports are wrong about their own units and nothing downstream would notice.
This generalises beyond these files: r3-amendment §2.2 stores an equipment
inventory with a `unit` field and §4.12 compares prescribed load against it. A
silent factor-of-2.2 error there produces confident, dangerous load advice.

**Change:** treat a declared unit as a claim to verify, not a fact. The
increment-cleanliness test is three lines and decisive.

### 7. No concept of a training phase — *structural*

Quarter-over-quarter, the coach replaced **60–82%** of the exercise set in both
datasets:

| | D1 | D2 |
|---|---|---|
| Turnover per quarter (Jaccard distance) | 63–82% | 60–75% |

D1's workout titles encode this explicitly (16 named phases: `BN`, `FAF`,
`FBM2`, `FBM+B`, `FBM3`, `TMNT2`, `MD`…, blocks of roughly 8–12 weeks). D2's
titles do not (`Day 3 upper`), so phases are invisible in the text — yet the
turnover is identical. The practice is structural even where the naming is not.

Our data model is a flat `Workout → Sessions` with no mesocycle, duration or
intent. `propose_workout_evolution` is designed to nibble at a plan — progress a
load, swap an exercise — while the practice it models replaces the plan wholesale
every ~3 months. The §6 anti-thrash rules govern within-block tweaks and say
nothing about when a block should *end*, which is the decision the coach was
actually making.

**Change:** decide whether plans get a phase concept (start, intent, intended
duration) before building more §5 change types. This is a design question, not a
bug.

### 8. Set-completion rate assumes per-set planning — *minor*

`setCompletion.rate` came out 2.07 (D1) and 3.27 (D2) — above 1 because planned
granularity is the exercise row while logged granularity is the set. In our own
app `plannedSets` counts `WorkoutSessionBlockItem` rows, so the comparison is
sound; but any plan authored the way these are — "3 sets of 10" as text — breaks
the assumption silently.

**Change:** flag rather than emit a completion rate when planned granularity is
not per-set. Relevant to any future plan import.

---

## What held up

- **"A missing log is not a skipped session."** The single most valuable rule in
  the file. 63% (D1) and 33% (D2) of planned rows are unlogged; any derivation
  reading absence as non-compliance would be wrong about most of D1.
- **e1RM confidence gating** fired appropriately and often — 42 of 124 (D1) and
  54 of 134 (D2) exercises marked low-confidence, matching heavy 10–15 rep
  programming (`(10,10,10)` appears 201 and 227 times respectively).
- **Day-grouped rollup** and the `incomparable` comparison result did their jobs:
  no phantom stalls from same-day rows, none across loading-mode changes. Both
  were added during the stress-testing pass, and real data did not find a way
  around either.
- **Caveats** attached to every flagged stall. The mechanism for saying "this
  number is shaky" works. The problem is that several of these numbers should
  not have been produced at all.

---

## Ranked change list for the next session

1. **Adherence tier** — redefine on sustained participation. Acceptance test:
   must promote both D1 and D2 out of `onboarding`. (§1)
2. **Progression intent in the taxonomy** — one change that fixes abandonment
   and stall noise together; folds into the §8.2 taxonomy pass. (§3, §4)
3. **Cross-lift deload detection** — replaces a guard that cannot fire on real
   programs with one that separates cleanly at 17–22% vs 50–91%. (§2)
4. **Observation window on `regressed`.** (§5)
5. **Unit sanity check at every load ingest point.** (§6)
6. **Phase/mesocycle concept** — design decision, blocks further §5 work. (§7)
7. **Completion-rate guard** for non-per-set plans. (§8)

Items 1–3 are the ones that make the difference between output a coach would act
on and output they would dismiss.
