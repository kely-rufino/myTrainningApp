# Exercise & Programming Knowledge Base

Design doc for making the MCP server a trustworthy, global source of workout
knowledge — so that any MCP client (Claude Code, Claude Desktop, or others)
connected to this API produces concretely better, more reliable workout plans
than it would from its own training data.

Nothing here is built yet; this is the plan for implementation sessions.

> **Revision 2 (2026-07-23).** Supersedes the original draft. Incorporates a
> code audit (which resolved the original's open question about the exercise
> seed source), drops the second-dataset import in favor of curating the
> existing library, and adds: provenance/aliases, a persisted training
> profile, prescription fields, a `validate_workout` tool, scale requirements
> for a much larger library, and an eval harness.

---

## 1. Goal — and what "better than the model" actually means

Today, `list_exercises`/`create_exercise` (`backend/src/mcp/tools/exercises.ts`)
expose a bare `name/description/image/videoUrl` record with no taxonomy, and
there is no tool that encodes programming logic (volume, sequencing, recovery,
injury accommodation) at all. An LLM client is therefore free to invent
exercise names, prescribe unbalanced volume, or ignore
equipment/space/injury constraints — it's reasoning from training data, not
from anything this app provides.

Be honest about the baseline: a frontier model's training data already
contains the volume landmarks, movement-pattern balancing, and every common
exercise. A pile of prose records served over MCP does **not** beat that —
it's a smaller, staler Wikipedia. The server wins through four mechanisms the
model cannot replicate, and every design decision below exists to maximize
one of them:

1. **Referential validity** — every exercise in a plan is a real, tagged,
   queryable row with a stable ID. No hallucinated exercises, no guessing at
   equipment/muscle/movement pattern.
2. **Consistency and provenance** — volume/intensity/rest/frequency numbers
   come from a structured, citable rule set. The same question gets the same
   cited answer in every session, every client, every model version. The
   server never freelances.
3. **The user's own data** — logged history, actual loads, injuries,
   equipment. Model priors can never know the user benched 60 kg × 8 last
   Tuesday. Progressive overload grounded in real history is the single
   biggest advantage over a bare LLM, and the execution data already exists
   in this app.
4. **Deterministic verification** — the server checks the assembled plan
   against the rules and reports violations. Verification beats model
   self-assessment even when the model "knows" the rules.

The server never generates the plan itself — it constrains, informs, and
verifies the client that does. Plan assembly is the part the LLM is actually
good at and keeps doing.

**Scale intent:** the library is expected to grow from ~250 records to
thousands. Growth must not degrade trust — see §6. The corollary of the four
mechanisms above: value comes from *curation, structure, and queryability*,
not from record count. An uncurated large library is worse than a small
curated one, because it reintroduces the noise this project exists to remove.

---

## 2. Intended usage

A user (in any MCP client connected to this server) describes their situation
in natural language, e.g.:

> "Dumbbells only, working out at home, not much space, full body, I'm a 6/10
> experienced lifter, 48-year-old male."

The client is expected to:

1. Read (and, first time, populate) the server-side **training profile**
   (§4.3) — experience level, age, goal, equipment, space, injuries. Stored
   constraints, not per-conversation re-inference.
2. Call `get_training_guidelines` (§4.4) and, if injuries are on the profile,
   `get_injury_accommodations` (§4.5) — getting back **numbers and
   exclusions**, not prose: sets/week, RIR, rest, frequency, excluded
   movement patterns, substitutes.
3. Call `search_exercises` (§4.2) filtered by equipment / movement pattern /
   space feasibility to get a **real, valid** candidate pool — compact
   projections, never a library dump.
4. Assemble the plan from that pool — the LLM's job.
5. Write it via the existing `create_workout`/`create_session`/
   `create_block`/`create_item` tools, now including rest and RIR targets
   (§4.6).
6. Call `validate_workout` (§4.7) and iterate until the plan passes.

Tool descriptions steer every client through this flow (§4.9).

---

## 3. Current state (code audit, 2026-07-23)

Findings the implementation should rely on:

- **Seed source resolved:** the library was seeded from **API-Ninjas**
  (`backend/scripts/fetch-exercises.ts`). The API returns structured `type`,
  `muscle` (one only — no secondaries), `equipment`, `difficulty` — but the
  script flattens them into the `description` string
  (`"… — Muscle: hamstrings — Equipment: dumbbell — Difficulty: beginner"`).
  All 191 seed entries parse back cleanly with a regex; the dev DB holds 253
  exercises, of which those 191 carry parseable metadata.
- **API-Ninjas has no movement pattern** and some records carry the literal
  string `"undefined"` for equipment. Movement pattern must be curated
  regardless of dataset choice; equipment needs cleanup.
- **62 DB rows have no metadata** — created later via UI or agent. Evidence
  that the unrestricted global `create_exercise` mutation surface (§4.8)
  already pollutes the library.
- **`list_exercises` has no filters** and returns full records including
  instructions — already a context dump at 253 rows.
- **`WorkoutSessionBlockItem` is reps/weight/duration only** — no rest or
  RIR fields, so guideline prescriptions currently have nowhere structured
  to land (§4.6).
- **The `User` model has `weight`/`height`/`dateOfBirth`** but no experience
  level, goal, equipment, or injuries (§4.3).
- PROJECT.md's "766 exercises" figure is stale — correct it when touching
  that doc.
- Production runs on a separate Railway SQLite volume — every migration and
  backfill below must run there too, not just locally.

---

## 4. Architectural changes

### 4.1 Exercise taxonomy, provenance, and aliases (`Exercise` model)

Extend the model (SQLite notes: Prisma enums are **not supported** on
SQLite — use `String` columns validated against closed vocabularies by zod in
the service layer; multi-valued fields are JSON-string columns, fine at this
scale and queryable via `json_each` if needed):

- `equipment` — JSON array of tags from a closed list (dumbbell, barbell,
  bodyweight, bench, bands, machine, kettlebell, …).
- `primaryMuscle` (single) / `secondaryMuscles` (JSON array) — closed list.
- `movementPattern` — closed list: horizontal push, horizontal pull,
  vertical push, vertical pull, squat/quad-dominant, hinge/posterior-chain,
  unilateral/lunge, core/carry.
- `spaceFootprint` — stationary vs. requires room to move; supports the
  "low space" constraint directly.
- `difficulty` — beginner/intermediate/expert; already present in the source
  data, pairs with the experience-level dial in §4.4.
- **Provenance:** `source` (api-ninjas | user | agent | import:<name>),
  `license`, `isCurated` (bool), `verifiedAt`. Filtered queries default to
  curated-only. At scale, "where did this row come from and has anyone
  checked it" is the difference between a knowledge base and a data swamp.

New model — **`ExerciseAlias`** (`alias` → `exerciseId`, alias unique):
many names map to one canonical exercise ("DB Press", "Dumbbell Bench
Press", "Flat Dumbbell Press"). Serves two jobs: dedup on import, and letting
an agent resolve whatever name the user said to the right ID. This replaces
the original draft's fragile "match by name" backfill idea.

**Controlled vocabulary is enforced server-side on every write path (REST
and MCP).** At 191 rows, "chest" vs "pectorals" vs "pecs" is annoying; at
5,000 it silently breaks every filter — a mis-tagged exercise is invisible,
which is worse than not existing.

**Backfill (one-time, replaces the second-dataset import):** parse the
existing API-Ninjas metadata out of `description` for the 191 tagged rows;
normalize equipment/muscle to the closed vocabularies; curate
`movementPattern` (LLM-assisted, human-reviewed — ~250 rows is one sitting);
mark the 62 metadata-less rows uncurated for later triage; strip the
metadata suffix from descriptions once it lives in columns.

### 4.2 Query surface: `search_exercises`

Replace dump-style `list_exercises` with a query-first tool:

- Filters: equipment (any-of), movementPattern, primaryMuscle, difficulty,
  spaceFootprint, curated (default true).
- Name/alias text search — SQLite FTS5 is available and free.
- Pagination (limit/offset, sane default limit).
- **Compact projection**: id, name, movementPattern, primaryMuscle,
  equipment, difficulty. Full record (instructions, video) via a separate
  `get_exercise(exerciseId)`. Never ship instructions in list responses.

### 4.3 Training profile (new model + tools)

New `TrainingProfile` model (1:1 with `User`): `experienceLevel` (1–10),
`goal` (hypertrophy | strength | general fitness | endurance), `equipment`
(JSON array, same vocabulary as exercises), `spaceConstraint`,
`daysPerWeek`, `injuries` (JSON array from the §4.5 condition list),
`notes`. Age/weight/height come from the existing `User` fields.

New MCP tools: `get_training_profile` / `update_training_profile`. The app
UI (Profile screen) exposes the same data — frontend can trail.

Rationale: without this, every client re-infers "48yo, 6/10, dumbbells,
shoulder issue" from conversation every time — the same reliability hole the
project exists to close, moved one step earlier. Stored constraints are what
make the guarantee *cross-client* and *cross-session*.

### 4.4 Programming guidelines tool (quantitative dials)

`get_training_guidelines()` — no required arguments; reads the stored
profile (explicit overrides allowed). Returns structured data, not prose:

- Sets/week per muscle group, RIR target, rest period, session frequency —
  by experience level (1–3 / 4–7 / 8–10) and goal.
- Age ≥ 45 modifiers: joint-friendly variant weighting, mandatory warm-up
  flag, RIR cap.
- `sex` as, at most, a minor annotation (see §7.2) — not a branching
  dimension with its own numbers.
- **Every number carries a source citation** (see §7.2) and the response
  carries a `rulesVersion`.

Backing data: a versioned JSON file in the backend (one entry per variable,
citation attached), checked by a CI validation script. Static file first;
promote to DB only if runtime editing turns out to be needed. The rule set
stays *small on purpose* — dozens of cited entries, not thousands. "Massively
expand" applies to the exercise library (§6), never to the rule tier: ten
well-cited rules beat a thousand scraped ones, and versioning keeps every
past plan auditable against the rules that produced it.

### 4.5 Injury/constraint layer

`get_injury_accommodations(injuries[])` (or fold into §4.4), returning per
injury:

- Excluded movement patterns / joint actions.
- Recommended corrective/rehab exercises (substitute, not just remove),
  referencing real exercise IDs in the library.
- Pain-free ROM guidance.
- A red-flag/escalation clause ("if X, this isn't a training problem, see a
  professional") — mirrors how the source clinical guidelines are
  structured.
- Source citation(s).

Scope: ~10–15 common, non-acute, training-relevant conditions (shoulder
impingement, general low back pain, patellofemoral/knee pain, elbow
tendinopathy, wrist pain, hip impingement, …). This is a hard constraint
layer, categorically different from §4.4's dials — an injury
excludes/replaces a category regardless of what the experience dial says.
Same versioned-JSON-with-citations format as §4.4.

### 4.6 Prescription fields on planned sets

Add nullable `restSeconds` and `targetRir` to `WorkoutSessionBlockItem`
(or block level if per-set granularity proves noisy). Without them, the
guideline outputs ("2–3 min rest, 2 RIR") can only be buried in free-text
`instructions` — unqueryable, unvalidatable, invisible to progress tools and
to §4.7. Add to `create_item`/`update_item` tool schemas and REST routes;
frontend display can trail.

### 4.7 `validate_workout` — the feedback loop

New MCP tool: `validate_workout(workoutId)`. Deterministic, server-side —
all data is already in the DB. Checks against the profile + rule set:

- Weekly sets per muscle group within guideline range (uses taxonomy +
  session frequency).
- Movement-pattern coverage/balance for the stated goal.
- Injury exclusions respected; substitutes present where prescribed.
- Every exercise feasible with the profile's equipment/space.
- Compound-before-isolation ordering.
- Rest/RIR targets present and within guideline range.

Returns a structured report: `pass | warn | fail` per check, with the cited
rule behind each finding. The client iterates until pass.

This answers the original draft's open question: **no** server-side
"assemble a plan" tool — that would move the LLM's job onto the server.
Generation stays client-side; correctness becomes verifiable. This is the
highest-leverage reliability feature in the plan: any client, any model
quality, gets the same check.

### 4.8 Mutation control on the global library

Today any user's agent can `create/update/delete_exercise` on the **global**
library with no taxonomy required — which undermines "no hallucinated
exercises" entirely (the 62 untagged rows are the evidence). Changes:

- `create_exercise` requires the full taxonomy fields; writes land with
  `source: agent|user`, `isCurated: false`.
- Uncurated rows are excluded from `search_exercises` results by default
  (still visible to their creator's flows and via an explicit flag).
- `update/delete` restricted to uncurated rows (curated library is
  read-only via MCP); deletes already fail when the exercise is in use.
- Promotion to curated is an admin/maintainer action, not an agent one.

### 4.9 Tool descriptions as the cross-client steering channel

Tool descriptions are the one channel every MCP client reads. Rewrite them
to encode the §2 flow — e.g. `create_workout`: *"Before building a plan,
call `get_training_profile` and `get_training_guidelines`, select exercises
via `search_exercises` filters, and finish with `validate_workout`."* Costs
nothing; it's how the intended orchestration reaches clients this project
doesn't control.

---

## 5. Import pipeline (replaces one-off fetch scripts)

`fetch-exercises.ts` grows into an idempotent importer — this pipeline *is*
the product once the library grows by thousands:

1. Fetch/read source records (API-Ninjas re-fetch keeping structured fields;
   future sources e.g. exercemus as *enrichment*, not a parallel library).
2. Normalize to the closed vocabularies (muscle/equipment/pattern mapping
   tables per source).
3. Resolve against `ExerciseAlias` — update existing canonical rows rather
   than inserting duplicates.
4. Upsert with provenance (`source`, `license`, `isCurated: false` until
   reviewed).
5. Emit a review report: unmatched names, vocabulary misses, conflicts with
   existing curated rows. A human (or a supervised agent session) triages;
   nothing skips the gate.

CI check: validate the whole library against the vocabularies + the rule
files against their JSON schema, so a bad import can't merge.

---

## 6. Scale principles (thousands of records)

The invariants that keep a large library trustworthy — every future change
should be checked against these:

- **Query-first, never dump-first.** No tool returns the whole library.
  Filters + search + pagination + compact projections (§4.2).
- **Closed vocabularies, enforced at write time.** Taxonomy rot is silent
  filter breakage (§4.1).
- **Aliases and dedup as first-class.** Growth without alias resolution =
  duplicates = split progress history and noisy candidate pools.
- **Provenance on every record; curated-by-default reads.** Uncurated data
  can exist, but never silently enters plan-building queries.
- **Everything enters through the pipeline (§5).** No manual inserts, no
  one-off scripts without the normalize/alias/provenance steps.
- **The rule tier stays small and cited.** Only the exercise library scales.
- **SQLite is fine.** Thousands of rows is small for SQLite; FTS5 covers
  search. No DB engine change is part of this plan.

---

## 7. Sourcing discussion (reliable info, not model priors)

The numbers/rules above must be traceable to a source, not "the model said
so." Recorded here so implementation sessions don't re-derive it.

### 7.1 Exercise taxonomy datasets (free)

The primary library is the existing API-Ninjas seed, curated in place
(§4.1). External datasets are enrichment sources through the §5 pipeline:

- **exercemus/exercises** (GitHub, MIT) — curated, aggregated from
  wger/open-exercise projects; maps exercises to muscle groups, equipment,
  variations, cues. Best first enrichment source — curated rather than
  exhaustive, matching the "know what to choose" framing.
- hasaneyldrm/exercises-dataset (GitHub) — 1,300+ exercises, similar fields,
  larger/less curated.
- ExerciseDB (REST API) — 11,000+ exercises; useful only queried live, too
  large/unfiltered to import wholesale.
- API-Ninjas Exercises API — the original seed source; a re-fetch keeping
  the structured fields is the cheapest metadata recovery path.

This tier is exercise metadata only — it never needs reconciling with the
rule sets below.

### 7.2 Programming logic sources (volume, frequency, rest, RIR, order)

Two evidence tiers — keep them distinct rather than citing everything at the
same confidence level:

**Primary (peer-reviewed, specific, free via PMC)** — where the actual
numbers come from:
- Schoenfeld et al. 2017 — *Dose-response relationship between weekly
  resistance training volume and increases in muscle mass* — source of the
  ~10–20 sets/muscle/week landmark.
- Schoenfeld et al. 2016 — training frequency meta-analysis.
- Grgic et al. 2017 — rest interval duration meta-analysis.
- Refalo et al. 2021 / Robinson et al. 2024 — proximity-to-failure (RIR)
  and hypertrophy outcomes.
- Simão et al. — exercise order (compound-before-isolation evidence).

**Position-stand / synthesis tier:**
- ACSM — *Progression Models in Resistance Training for Healthy Adults* —
  consolidated peer-reviewed position stand; good backbone citation, but it
  synthesizes the same primary literature above rather than being
  independent evidence.
- NSCA *Essentials of Strength Training and Conditioning* — the field's
  reference textbook, but paywalled. Cite as background, not as a "free
  source."

Honest caveat to carry into implementation: volume/frequency/rest/RIR have
real dose-response research behind them. Movement-pattern balancing,
antagonist pairing, and session-template structure are sound practitioner
consensus / biomechanical reasoning, not measured dose-response variables —
`validate_workout` findings and rule entries should carry that distinction
(e.g. an `evidenceTier` field on rules).

**Sex as a variable** — deliberately *not* a first-class rule table. The one
place it's evidence-backed is injury-risk emphasis (e.g., ACL/knee-valgus
risk during lateral/high-impact loading is documented as higher in females —
worth a cueing note on lunges/jumps), not exercise selection or volume.
Optional annotation, not a branching dimension, to avoid encoding stereotype
rather than signal.

### 7.3 Injury/rehab sources

- **JOSPT Clinical Practice Guidelines** (with APTA) — free,
  evidence-graded, per-condition clinical guidelines. Best single authority
  for the injury rule set.
- **Physiopedia** — practitioner-written wiki citing primary literature per
  condition; easier to translate into a rule than a raw CPG. Curation aid /
  pointer to sources, not final authority (wiki editorial model).
- **PubMed/PMC** — spot-check specific claims against primary literature.
- **Cochrane Reviews** — highest rigor where a review exists; sparse
  coverage.

Injury handling is exclude-and-substitute-with-a-corrective-exercise, not
just "avoid this movement" — matching how the CPGs themselves are
structured.

---

## 8. Eval harness — proving "concretely better"

Without measurement, "can I trust it" stays a feeling. Small harness:

- ~10 personas covering the constraint space ("48yo, dumbbells only,
  shoulder impingement, 6/10", "beginner, full gym, 3 days/week",
  "low space, bodyweight+bands, low back pain", …).
- For each persona: an MCP-connected client builds a plan end-to-end; score
  it with `validate_workout` (violation count by severity, plus referential
  checks — do all exercise IDs exist and match the equipment constraint).
- Baseline: the same personas prompted against a bare model with no MCP;
  score the resulting plan text with the same checks (exercises resolved by
  name/alias where possible; unresolvable names count as violations).
- Report MCP vs. baseline side by side.

This is both the proof of value and the regression test as the library
scales — re-run after imports and rule changes.

---

## 9. Build order

1. **Taxonomy + provenance migration, alias table, backfill script** (§4.1)
   and **`search_exercises` + `get_exercise`** (§4.2), including mutation
   control (§4.8).
2. **`TrainingProfile` model + profile tools** (§4.3).
3. **Guidelines + injury rule files and tools** (§4.4, §4.5) — the content
   extraction from §7 sources happens here.
4. **`restSeconds`/`targetRir` + `validate_workout`** (§4.6, §4.7).
5. **Tool-description rewrite** (§4.9), then the **eval harness** (§8) run
   end-to-end against a local backend over MCP.
6. **Import pipeline hardening** (§5) before the first large external
   import.

Each step is independently shippable; the frontend can trail every one of
them.

---

## 10. Open questions

- Cross-client parity: Claude Desktop works with the existing bearer-token
  HTTP MCP setup. ChatGPT only supports remote MCP via OAuth-based
  connectors — the current plain bearer-token auth
  (`backend/src/plugins/mcpAuth.ts`) isn't that. If ChatGPT parity is
  wanted, an OAuth-compatible auth path is separate follow-up work.
- Whether `targetRir` belongs on the item (per set) or the block (per
  exercise) — decide when implementing §4.6 based on how the UI wants to
  render it.
- Admin/maintainer story for promoting uncurated rows (§4.8): a minimal
  internal screen, a CLI script, or a supervised agent session. Cheapest
  wins; decide at implementation time.

---

## 11. What this document is not

It doesn't contain the extracted rule content itself (actual set/rep numbers
per condition, the final injury list, the final migration SQL) — that's
implementation work. This records the *goal*, the *intended usage*, the
*architecture*, the *scale invariants*, and *which sources* to pull the
actual numbers from.
