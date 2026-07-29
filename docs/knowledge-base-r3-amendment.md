# Knowledge Base — Revision 3 amendment

> **Amendment to `docs/exercise-knowledge-base.md` (Revision 2, 2026-07-23).**
> Rev 2's §1 four mechanisms, §5 import pipeline, and §6 scale principles stand
> unchanged and still govern. This amendment revises §4.3 (training profile),
> §4.4 (guidelines), §4.5 (constraints), and adds §4.10–§4.14.
>
> Driven by four user scenarios that Rev 2 answers badly or not at all:
>
> 1. "I want more training days but I'm sore from yesterday."
> 2. "I don't like exercise X, I'm at home — give me an alternative."
> 3. "You prescribed Y but I don't own enough weight for it to be effective."
> 4. "Busy founder, untrained, bodyweight at home, training for stress relief
>    and cognitive function."
>
> Scenarios 1–2 are mostly served by Rev 2 plus small additions. Scenarios 3–4
> are not served at all, and 4 exposes a structural assumption in the rule set.
>
> **Status:** §8.1 (the `TrainingProfile` migration) is built. §8.2 onward are
> not started. The guidelines file is still `1.0.0` and keyed on the deprecated
> `goal` vocabulary, so outcomes with no legacy equivalent
> (`body_composition`, `mental_health_cognition`) currently return only
> universal rules plus an explicit `outcomeUnsupported` flag — see §8.3.

---

## 0. What Rev 2 already got right (do not re-litigate)

- `getTrainingGuidelines` already returns `missingProfileFields`. That is the
  right mechanism for steering clients to ask good questions; §4.14 extends it
  rather than replacing it.
- Guidelines as a small, versioned, cited JSON file with `evidenceTier` is the
  correct shape. Every addition below reuses it.
- Generation stays client-side; the server constrains, informs, verifies.

---

## 1. The structural problem scenario 4 exposes

`GOALS = ['hypertrophy', 'strength', 'general_fitness', 'endurance']`, and the
rule set is indexed on `goal`. Two defects follow:

**(a) `general_fitness` is an empty bucket.** Every one of the 30 entries in
`training-guidelines.v1.json` carries `goals` of hypertrophy, strength,
endurance, or `null`. A profile with `goal: 'general_fitness'` matches only
the three `null`-goal entries (`exercise_order`, `older_adults_*`). The tool
returns near-nothing and the client falls back to model priors — the precise
failure mode the project exists to close.

**(b) `goal` conflates three independent axes.** The founder persona has:

| Axis | Value | What it should determine |
|---|---|---|
| Primary outcome | stress relief / cognition | **modality and dose** (aerobic-led) |
| Modality constraint | bodyweight, home, no equipment | exercise pool, progression method |
| Adherence state | untrained, time-poor, high stress | a **cap** on everything above |

Rev 2 collapses all three into one enum. Splitting them is the core change in
this amendment.

**(c) Every variable silently assumes resistance training.** `variableSchema`
has no `modality` field because in v1 it did not need one. The evidence base
for mental-health and cognitive outcomes is predominantly aerobic. Adding
aerobic variables to the current schema would produce entries indistinguishable
from resistance entries — e.g. two `weekly_training_days` rows that mean
different things.

---

## 2. `TrainingProfile` — revised (supersedes Rev 2 §4.3)

Current model (`prisma/schema.prisma:37`) keeps `goal`, `equipment`,
`spaceConstraint`, `injuries`, `daysPerWeek`, `experienceLevel`, `notes`.
Changes:

### 2.1 Split `goal` into outcome + modality preference

```prisma
primaryOutcome    String?  // PRIMARY_OUTCOMES vocabulary
secondaryOutcomes String?  // JSON array, same vocabulary
```

```ts
export const PRIMARY_OUTCOMES = [
  'hypertrophy',
  'strength',
  'endurance',
  'body_composition',
  'mental_health_cognition',   // new — scenario 4
  'general_health',            // WHO-floor: "be healthy", no specific target
] as const
```

Migrate existing `goal` values 1:1 (`general_fitness` → `general_health`).
Keep `goal` as a deprecated read-only alias for one release so MCP clients
and the frontend do not break; `guidelinesService` reads `primaryOutcome`
falling back to `goal`.

`secondaryOutcomes` matters more than it looks: the founder persona is
`mental_health_cognition` primary, `general_health` secondary, and the plan
must satisfy both (aerobic dose *and* the 2×/wk strengthening floor).

### 2.2 Quantitative equipment inventory (scenario 3)

`equipment` as a tag array cannot answer "can this user actually load this
exercise." Replace with an inventory. Keep the column name; change the encoded
shape and version it so the migration is detectable.

```jsonc
{
  "schema": 2,
  "items": [
    { "type": "dumbbell", "pairs": 2, "loads": [4, 6, 8, 10, 12], "unit": "kg" },
    { "type": "barbell", "barWeight": 20, "plates": [1.25, 2.5, 5, 10], "unit": "kg" },
    { "type": "bench", "adjustable": true },
    { "type": "bands", "resistances": ["light", "medium"] },
    { "type": "pullup_bar" },
    { "type": "bodyweight" }
  ]
}
```

- `type` stays in the existing closed equipment vocabulary — filters keep working.
- Backfill: schema-1 tag arrays become `{ type }` entries with no load data.
  Loads are **unknown, not zero** — §4.12 must distinguish the two and ask
  rather than assume.
- Derived helper `maxLoadFor(exercise, inventory)` accounts for the exercise's
  loading mode (per-hand vs total, bar-loaded vs fixed, bodyweight+external).

### 2.3 Persisted preferences (scenario 2)

```prisma
excludedExercises String?  // JSON array of { exerciseId, reason, addedAt }
```

`reason` from a closed list: `dislike | pain | equipment | space | boredom |
time`. Without this the user re-states "I hate lunges" in every session, in
every client — the same reliability hole §4.3 exists to close, at exercise
granularity. `search_exercises` and `validate_workout` both honor it;
`pain`-reason exclusions additionally surface to §4.11.

### 2.4 Adherence state (scenario 4)

```prisma
adherenceTier      String?   // onboarding | building | established
consecutiveWeeksOk Int?      // derived from execution history, cached
```

Derived, not self-reported: `onboarding` until N planned sessions are completed
as scheduled, then `building`, then `established`. Drives §4.13's cap.

### 2.5 Recovery/stress context

```prisma
typicalSleepHours Float?
lifeStressLevel   String?   // low | moderate | high
```

Optional and self-reported, but they are the input the founder persona's
correct answer hinges on (§4.11). Absent → treated as unknown, and §4.14 asks.

---

## 3. §4.4 revised — modality on every variable

Add to `variableSchema`:

```ts
modality: z.enum(['resistance', 'aerobic', 'mixed', 'any']),
outcomes: z.array(z.enum(PRIMARY_OUTCOMES)).nullable(),  // replaces `goals`
```

- `goals` → `outcomes`, values migrated 1:1. Bump the file to `2.0.0`; every
  existing entry gets `modality: 'resistance'` explicitly. No entry may omit it.
- `guidelinesService` filters on `outcomes` and, when the client asks for a
  specific modality, on `modality`. Response groups by modality so a client
  cannot conflate an aerobic `weekly_training_days` with a resistance one.

### 3.1 New variable block: `mental_health_cognition`

Candidate sources — **none of these are verified yet; each must pass the same
gate v1 entries passed (DOI/PMID resolved, finding checked against full text or
abstract, `accessLevel` recorded) before it lands in the file:**

- WHO 2020 Guidelines on Physical Activity and Sedentary Behaviour — governmental /
  `position_stand` tier; covers the 150–300 min moderate aerobic + 2×/wk
  strengthening floor and explicitly addresses mental-health outcomes.
- Chekroud et al. 2018, *Lancet Psychiatry* — large cross-sectional
  exercise/mental-health association.
- Northey et al. 2018, *BJSM* — exercise and cognitive function meta-analysis.
- Schuch et al. — exercise and depression meta-analyses.
- Chang et al. 2012 — acute effects of a single bout on executive function.

Honest tiering, to be reflected in `evidenceTier` and `caveats`:
the *aerobic dose → mental health* link is the best-supported claim; *cognitive
function* effect sizes are modest and contested; resistance training has
supporting but weaker evidence than aerobic for these outcomes. The rule
entries must say so rather than laundering all of it as equivalent.

### 3.2 Conditioning movement patterns

Rev 2 §4.1's `movementPattern` list is entirely resistance patterns, so
"30 minutes brisk walking" — half the correct plan for scenario 4 — is
inexpressible. Add a parallel `locomotion` / `conditioning` category
(walk, incline walk, run, cycle, row, swim, circuit) with `intensityZone`
rather than `primaryMuscle` as its organizing field.

---

## 4. §4.5 revised — constraints, not just injuries

Rename the layer from injury accommodations to **constraints**.
`INJURY_CONDITIONS` stays as-is and remains the musculoskeletal subset; add a
non-musculoskeletal set that can veto intensity:

```ts
export const LOAD_CONSTRAINTS = [
  'high_life_stress',
  'chronic_sleep_deficit',
  'detrained',           // returning after a long gap
  'unaccustomed',        // never trained
] as const
```

These behave like injuries structurally — hard constraints that override the
§4.4 dials — but they cap **intensity and progression rate** instead of
excluding movement patterns. For the founder persona this is what produces the
genuinely coach-level output: *deliberately withhold high intensity* from
someone cortisol-loaded and sleep-short, because hard interval work adds
allostatic load to an already-taxed system. No current rule can express that,
and a naive client will happily prescribe HIIT "for efficiency."

Keep the red-flag/escalation clause and extend it: untrained adult, high stress,
mid-life → PAR-Q-style screening flag in the response. Not medical advice; a
boundary marker.

---

## 5. New tools

### 4.10 `get_recovery_state()` (scenario 1)

Deterministic, from existing execution history. Per muscle group: days since
last trained, volume in that session, and performance trend (did logged
loads/reps regress vs the prior session for the same exercise).

The playbook that consumes it must carry this reframe, because it is the part a
naive system gets wrong:

> Soreness is a weak readiness signal — DOMS tracks novelty and eccentric load,
> not recovery status, and training a sore muscle is not inherently harmful. The
> signal that matters is **performance**: if loads/reps regressed, that is
> under-recovery. If they held, distribute volume across muscle groups and
> proceed.

Practical output: alternate muscle groups across consecutive days
(upper/lower, push/pull/legs); persistent novel soreness usually indicates a
volume jump or unfamiliar movement, not a need to train less often.

### 4.11 `find_substitute(exerciseId, { reason, ... })` (scenarios 2 + 3)

A **query over the taxonomy**, not a curated `substitutes[]` list — curated
lists do not survive Rev 2 §6's scale-to-thousands requirement. Match on same
`movementPattern` + same `primaryMuscle`, filtered by the profile's inventory,
space, exclusions, and injuries; ranked. Curated overrides exist only for
non-obvious cases the taxonomy cannot express.

`reason` shapes ranking: `equipment`/`load` prefers lower absolute-load demand;
`pain` routes through the §4.5 constraint layer; `dislike` prefers a different
exercise family rather than a near-identical variant.

### 4.12 Load feasibility (scenario 3) — the highest-value new check

```
maxAvailable  = maxLoadFor(exercise, inventory)
estimated1RM  = from logged history for this exercise or its pattern
predictedReps = f(maxAvailable / estimated1RM)
if predictedReps > ~30 → LOAD_LIMITED
```

The rule is **not** "you need heavy weight." Loads well below the conventional
hypertrophy range produce comparable growth when sets are taken near failure;
the real failure mode is a set that becomes impractically long or where failure
cannot be approached. Encode that reframe explicitly — it kills a large class of
bad advice on its own. *(Threshold and the supporting low-load literature need
the §3.1 verification gate before shipping.)*

Resolution order when `LOAD_LIMITED` — raise relative demand at the same
absolute load before swapping the exercise:

1. Unilateral (single-leg RDL roughly halves required external load)
2. Tempo / paused reps / 1.5-reps
3. Extended ROM (deficit, elevated front foot)
4. Reduced leverage (feet elevated, longer moment arm)
5. Mechanical drop sets, myo-reps
6. Only then: substitute the movement (§4.11)

This is also exactly the progression ladder for a bodyweight-only user
(scenario 4), where external load is fixed at zero by definition — the same
machinery serves both.

Requires a relative-demand factor on exercises so §4.11 can rank "same muscle,
needs less absolute load." Add during the §4.1 taxonomy pass, not after.

**`validate_workout` gains a load-feasibility check**: every prescribed set must
be achievable with the inventory at the target RIR. Catches the problem before
the user meets it mid-session, which is the entire point.

### 4.13 Adherence cap in `validate_workout`

While `adherenceTier = onboarding`, a plan **fails** validation for exceeding
the tier ceiling even when it sits inside the goal-optimal guideline range.
Rationale: over-prescribing the beginner is the single most common failure mode
of LLM-generated plans, and no model self-checks for it. Weeks 1–4 are indexed
on session count completed, not volume accumulated. Exit criteria live in the
playbook, not in code.

### 4.14 `missingProfileFields` → `clarifyingQuestions`

`guidelinesService` already computes `missingProfileFields`. Extend it to emit
ordered, human-phrased questions:

```jsonc
{
  "missing": ["equipment.loads", "typicalSleepHours", "primaryOutcome"],
  "clarifyingQuestions": [
    "What dumbbell weights do you have, and in what increments?",
    "Roughly how many hours are you sleeping on a typical night?"
  ]
}
```

Every MCP client reads tool responses. This steers Claude Desktop, Claude Code,
and clients you do not control into asking the right question in the right
order. Same channel as Rev 2 §4.9's tool descriptions, but data-driven and
free — the computation already exists.

Ordering rule: ask only for fields that would change the current answer. Do not
dump the whole gap list.

---

## 6. Playbooks (`training-playbooks.v1.json`)

Composition tier above the per-variable dials. Small on purpose — 15–25 entries.
`evidenceTier: 'consensus'` where honest; cite the underlying primary study
where one exists.

```jsonc
{
  "id": "untrained_onboarding_minimum_dose",
  "applies": {
    "adherenceTier": "onboarding",
    "primaryOutcome": ["mental_health_cognition", "general_health"]
  },
  "durationWeeks": [2, 4],
  "strategy": "Index on consistency, not dose. Four completed 20-minute sessions beat five planned 45-minute ones. Hold intensity deliberately sub-maximal while the habit forms.",
  "exitCriteria": "N consecutive weeks at planned session count → adherenceTier: building, then ramp volume toward the cited range.",
  "evidenceTier": "consensus",
  "citationKeys": ["who2020"],
  "caveats": ["Not a volume prescription — it is a ceiling on one."]
}
```

Initial set: untrained onboarding; arm/weak-point specialization; minimum
effective dose (2–3 days); high-frequency short-session; split selection by days
available (upper-lower vs PPL vs full-body); deload triggers; maintenance phase;
time-capped session structure (antagonist pairing, supersets); load-limited home
training; bodyweight progression ladder; aerobic-led plan for
`mental_health_cognition`; return-from-layoff ramp.

**Authoring method:** read the practitioner material — coaching channels,
Stronger by Science, RP — and distill the *practice*, then cite the primary
study it rests on, or mark it `consensus` and say so. Research input, not
ingested corpus: no licensing exposure, no un-citable rows, and it stays inside
Rev 2 §6's provenance rule.

---

## 7. Volume budget solver

`plan_volume_budget({ daysPerWeek, minutesPerSession, primaryOutcome, emphasis[] })`

```
timeBudget = days × minutes
setBudget  = timeBudget / (avgSetTime + restSeconds)   ← rest from the cited dial
allocation = distribute across muscle groups; floor = minimum effective,
             target = cited range, emphasis groups take the surplus
```

Returns the allocation **and the trade-off**: "5 × 45 min ≈ 75 working sets/wk.
Eight muscle groups at 10+ sets means six sit at minimum. Either cover six
groups, or accept maintenance on legs this block." Depends entirely on this
user's constraints, so no corpus competes with it. Rev 2 mechanism 4.

For `mental_health_cognition` the budget is split across modalities first
(aerobic minutes vs resistance sets) before the per-muscle allocation runs.

---

## 8. Migration ordering

Both schema decisions must land **before** the Rev 2 §4.1/§4.3 migrations reach
the Railway volume — retrofitting a tag array into a load inventory afterwards
means a second production migration on a live SQLite volume.

1. ~~`TrainingProfile`: `primaryOutcome`/`secondaryOutcomes`, equipment schema 2,
   `excludedExercises`, `adherenceTier`, sleep/stress. Backfill + `goal` alias.~~
   **Done** — migration `20260729061223_training_profile_outcomes_and_inventory`.
   Additive `ADD COLUMN`s only, so SQLite never rebuilds the table. Three
   decisions worth recording:
   - **`minutesPerSession` was added too.** Not in the original list, but §7's
     volume budget solver needs it and `get_training_signals` cannot score
     duration without it — and it is cheaper here than in a second migration.
   - **Equipment is upgraded lazily, not backfilled in SQL.** Schema-1 tag
     arrays are converted to `{ type }` entries on read and written back in the
     new shape on the next update. Same end state, no data migration that can
     half-apply on a live volume — which is the risk §8 exists to manage. The
     `schema` discriminant is what makes this safe.
   - **`adherenceTier` is a manual override, not a cache.** The derived value
     comes from `get_training_signals`; the column holds only an explicit
     override, and the effective tier is `override ?? derived`. This closes §9's
     open question directly: since §4.13 makes a wrong tier a *validation
     failure*, the override is not optional.

   Three defects in the first cut, all found by stress-testing the compat
   claims rather than by review:

   - **The `goal` alias drifted.** Writing only `primaryOutcome` left the
     `goal` column stale, so a legacy client read a contradictory answer — the
     exact breakage the alias exists to prevent. `goal` is now *projected* from
     `primaryOutcome` on read and written in lockstep, and is `null` for
     outcomes with no legacy equivalent rather than reporting the previous one.
   - **A legacy tag write destroyed load data.** An old client sending
     `equipment: ["dumbbell"]` overwrote a recorded `loads: [8,10]` with a bare
     entry, silently discarding the answer to "can this user load this
     exercise". Tag writes now merge over the stored inventory.
   - **`addedAt` was restamped on every write.** Adding a second exclusion
     reset the first one's date, destroying the only signal that says whether
     an exclusion is still current. Entries now keep their date unless the
     reason changes.
2. Exercise taxonomy (Rev 2 §4.1) **plus** relative-demand factor, coaching
   notes (`cues[]`, `commonErrors[]`, `stimulusToFatigue`), conditioning
   patterns. One pass, not two.
3. Guidelines file → `2.0.0`: `modality` on every entry, `goals` → `outcomes`.
4. Mental-health/cognition variable block — gated on the §3.1 verification pass.
5. `get_recovery_state`, `find_substitute`, load feasibility.
6. `validate_workout` checks: load feasibility, adherence cap, emphasis honored.
7. Playbooks file + volume budget solver.
8. `clarifyingQuestions` — independent of all the above, ship whenever.

## 9. Open questions

- `predictedReps > 30` in §4.12 is a placeholder. Needs a defensible threshold
  from the low-load literature, or demotion to `consensus` tier with the
  arbitrariness stated in `caveats`.
- ~~Is `adherenceTier` derivable purely from execution history, or does a user
  training elsewhere (unlogged) get mis-tiered? Probably needs a manual
  override.~~ **Resolved:** it needs one, and has one. See §8.1.
- Does the aerobic tier need its own intensity-zone vocabulary, or is
  RPE/conversational-pace sufficient at this scale? Prefer the latter until
  something forces otherwise.
