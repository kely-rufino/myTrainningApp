# Exercise & Programming Knowledge Base

Design doc for making the MCP server produce reliable, evidence-based workout
plans instead of relying on whatever the connected LLM happens to remember.
Written up for implementation in a future session — nothing here is built yet.

---

## 1. Goal

Today, `list_exercises`/`create_exercise` (`backend/src/mcp/tools/exercises.ts`)
expose a bare `name/description/image/videoUrl` record with no taxonomy, and
there is no tool that encodes programming logic (volume, sequencing, recovery,
injury accommodation) at all. An LLM client (Claude Code, Claude Desktop, or
any other MCP client) is therefore free to invent exercise names, prescribe
unbalanced volume, or ignore equipment/space/injury constraints — it's
reasoning from training data, not from anything this app provides.

The goal is to move the parts of "how to build a good workout" that have an
actual right answer out of the LLM's head and into the MCP server, as
queryable tools/data, so that:

- Exercise selection is constrained to a real, tagged taxonomy (no
  hallucinated exercises, no guessing at equipment/muscle/movement pattern).
- Volume, intensity, rest, and frequency prescriptions come from a
  structured, citable rule set — not the model's improvisation.
- Injury accommodation offers a substitute + corrective/rehab exercise, not
  just "avoid X" — sourced from PT clinical guidelines, not the model's
  general knowledge.
- Any MCP client that connects (not just this session) gets the same
  guarantees, because the constraints live server-side.

Explicit non-goal: cataloguing every exercise in existence. The design
optimizes for "know what to choose" (a small, well-tagged, well-justified set
of choices) over "know everything" (a 10k+ exercise dump the model has to
sift through).

---

## 2. Intended usage

A user (in Claude Code, Claude Desktop, or another MCP client connected to
this server) describes their situation in natural language, e.g.:

> "Dumbbells only, working out at home, not much space, full body, I'm a 6/10
> experienced lifter, 48-year-old male."

The client is expected to:

1. Call a constraints/guidelines tool with the structured inputs it can infer
   from that sentence (experience level, age, sex, equipment, space, goal,
   any injuries mentioned) and get back **numbers and exclusions**, not
   prose — sets/week, RIR, rest, frequency, excluded movement
   patterns/joint actions, recommended substitutes.
2. Call the (now taxonomy-tagged) `list_exercises` tool filtered by
   equipment/space-feasibility/movement pattern to get a **real, valid**
   candidate pool.
3. Assemble a plan from that pool that satisfies the movement-pattern
   checklist and the numbers from step 1 — this is the part the LLM is
   actually good at and should keep doing.
4. Write the result into the app via the existing
   `create_workout`/`create_block`/`create_item` tools.

The server never generates the plan itself — it constrains and informs the
client that does. Same shape as today's tools, just with a richer,
harder-to-get-wrong contract.

---

## 3. Architectural changes

### 3.1 Exercise taxonomy (`Exercise` model)

Current schema (`backend/prisma/schema.prisma`):
```
model Exercise {
  id          Int    @id @default(autoincrement())
  name        String @unique
  description String?
  image       String?
  videoUrl    String?
  blocks      WorkoutSessionBlock[]
}
```

Add columns:
- `equipment` — tag(s): dumbbell, bodyweight, bench, bands, etc.
- `primaryMuscle` / `secondaryMuscles`
- `movementPattern` — enum: horizontal push, horizontal pull, vertical push,
  vertical pull, squat/quad-dominant, hinge/posterior-chain,
  unilateral/lunge, core/carry.
- Possibly a `spaceFootprint` or similar tag (stationary vs. requires
  lateral/long-range movement) to support the "low space" constraint
  directly, rather than inferring it from movement pattern alone.

Before importing a new dataset: the existing 766-exercise library
(`PROJECT.md` → "Exercise CRUD") was seeded from an external API already —
confirm what that source was and whether it already carries usable
equipment/muscle metadata before bringing in a second dataset. Avoid ending
up with two half-overlapping libraries.

Migration + a one-time backfill/import script mapping the chosen external
dataset (see §4) onto existing rows (match by name, flag unmatched) is
needed. `create_exercise`/`update_exercise` tool schemas
(`backend/src/mcp/tools/exercises.ts`) and the REST routes/frontend forms
need the new fields added — frontend UI work can trail the backend/MCP
change, it's not blocking.

`list_exercises` needs filter parameters (equipment, movementPattern,
muscle) so a client queries instead of dumping the whole library into
context.

### 3.2 Programming guidelines tool (quantitative dials)

New MCP tool, e.g. `get_training_guidelines(experienceLevel, age, sex?,
goal)` returning structured data (not prose):

- Sets/week per muscle group, RIR, rest period, session frequency — by
  experience level (1–3 / 4–7 / 8–10).
- Age ≥ 45 modifiers: preference weighting toward joint-friendly variants,
  mandatory warm-up flag, RIR cap.
- `sex` as, at most, a minor annotation (see §4.2) — not a branching
  dimension with its own numbers.

Backing data: a structured file (JSON, versioned, one entry per variable)
with a source citation attached to each number — same idea as the injury
rule set below. Start as a static data file in the backend, not a DB table;
promote to DB only if it turns out to need runtime editing.

### 3.3 Injury/constraint layer

New tool (or an argument on the guidelines tool above), e.g.
`get_injury_accommodations(injuries[])`, returning per injury:

- Excluded movement patterns / joint actions.
- Recommended corrective/rehab exercises (substitute, not just remove).
- Pain-free ROM guidance.
- A red-flag/escalation clause ("if X, this isn't a training problem, see a
  professional") — mirrors how the source clinical guidelines themselves are
  structured.
- Source citation(s).

Scope: ~10–15 common, non-acute, training-relevant conditions (shoulder
impingement, general low back pain, patellofemoral/knee pain, elbow
tendinopathy, wrist pain, hip impingement, …), not general pathology
coverage or diagnosis. This is a hard constraint layer, categorically
different from the quantitative dials in §3.2 — an injury excludes/replaces
a whole category regardless of what the age/experience dial says.

### 3.4 Open questions (not decided — flag for the implementation session)

- Whether tool-schema changes are enough, or whether a higher-level
  "assemble a plan" tool is worth adding vs. relying on the client to
  orchestrate `get_training_guidelines` → `list_exercises` →
  `create_workout`/`create_block`/`create_item` itself.
- Cross-client parity: Claude Desktop works with the existing bearer-token
  HTTP MCP setup (same config pattern validated in this session). ChatGPT
  only supports **remote** MCP via OAuth-based connectors — the current
  server's plain bearer-token auth (`backend/src/plugins/mcpAuth.ts`) isn't
  that. If ChatGPT parity is actually wanted, an OAuth-compatible auth path
  is separate follow-up work, not assumed here.

---

## 4. Sourcing discussion (reliable info, not model priors)

The point of this whole effort is that the numbers/rules above should be
traceable to a source, not "the model said so." Recorded here so the
implementation session doesn't have to re-derive it.

### 4.1 Exercise taxonomy datasets (free)

- **exercemus/exercises** (GitHub, MIT) — curated, aggregated from
  wger/open-exercise projects, maps exercises to muscle groups, equipment,
  variations, cues. Preferred over the alternatives below because it's
  curated rather than exhaustive — matches the "know what to choose"
  framing.
- hasaneyldrm/exercises-dataset (GitHub) — 1,300+ exercises, similar fields,
  larger/less curated.
- ExerciseDB (REST API) — 11,000+ exercises, useful only if querying live
  rather than importing; too large/unfiltered for this project's goal.
- API-Ninjas Exercises API — lightweight, 3,000+ exercises, alternative if
  exercemus turns out to have gaps.

None of these need to be reconciled with the injury/programming rule sets
below — this tier is exercise metadata only.

### 4.2 Programming logic sources (volume, frequency, rest, RIR, order)

Two evidence tiers — worth keeping distinct rather than citing everything at
the same confidence level:

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
  consolidated peer-reviewed position stand, good backbone citation, but
  synthesizes the same primary literature above rather than being
  independent evidence.
- NSCA *Essentials of Strength Training and Conditioning* — the field's
  reference textbook, but paywalled. Cite as background, not as a "free
  source."

Honest caveat to carry into the implementation: volume/frequency/rest/RIR
have real dose-response research behind them. Movement-pattern balancing,
antagonist pairing, and session-template structure are sound practitioner
consensus / biomechanical reasoning, not a measured dose-response variable —
don't cite them with the same evidentiary weight.

**Sex as a variable** — deliberately *not* built as a first-class rule
table. The one place it's actually evidence-backed is injury-risk emphasis
(e.g., ACL/knee-valgus risk during lateral/high-impact loading is
documented as higher in females — worth a cueing note on lunges/jumps), not
exercise selection or volume. Treat as an optional annotation, not a
branching dimension, to avoid encoding stereotype rather than signal.

### 4.3 Injury/rehab sources

- **JOSPT Clinical Practice Guidelines** (Journal of Orthopaedic & Sports
  Physical Therapy, with APTA) — free, evidence-graded, per-condition
  clinical guidelines. Best single authority for the injury rule set.
- **Physiopedia** — practitioner-written wiki, cites primary literature per
  condition, easier to translate into a rule than a raw CPG. Use as a
  curation aid / pointer to sources, not the final authority (wiki editorial
  model).
- **PubMed/PMC** — spot-check specific claims against primary literature.
- **Cochrane Reviews** — highest rigor when a review exists for the exact
  condition; coverage is sparse, won't have an entry for everything.

Reframe adopted from discussion: injury handling should be
exclude-and-substitute-with-a-corrective-exercise, not just "avoid this
movement" — matches how the CPGs themselves are structured.

---

## 5. What this document is not

It doesn't contain the extracted rule content itself (actual set/rep numbers
per condition, the final injury list, the final schema migration) — that's
implementation work for the future session. This records the *goal*, the
*intended usage*, the *architecture*, and *which sources* to pull the actual
numbers from.
