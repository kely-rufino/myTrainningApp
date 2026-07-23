# Knowledge Build Report — Training Guidelines v1.0.0 (2026-07-23)

Honest accounting of the evidence-verification pass behind
`backend/src/knowledge/training-guidelines.v1.json`. Method: every source was
located and fetched online (PMC/PubMed/publisher/position-statement PDFs);
only findings extractable as quotes from fetched material were encoded. No
numbers were filled in from model memory or practitioner convention. The
injury layer was deliberately excluded from this round.

## What made it in

31 variables, 12 citations. 9 variables at meta-analysis tier, 22 at
position-stand tier. 6 citations verified at full-text level, 6 at
abstract-only (publisher paywalls).

| Domain | Verification | Outcome |
|---|---|---|
| Weekly volume (hypertrophy) | Full text | Strong. ≥10 sets/muscle/week landmark confirmed with graded categories (5.4% / 6.6% / 9.8% for <5 / 5–9 / 10+) and per-set increment (+0.37%). |
| Frequency (hypertrophy) | Full text (2016) + abstract (2019) | Strong, with a revision the original plan didn't know: the 2019 meta-analysis found frequency irrelevant when volume is equated. Both encoded; 2019 treated as operative. |
| Rest intervals | Abstracts only | Good for strength (>2 min trained; 60–120 s untrained). Weaker for hypertrophy (">60 s possible advantage", 6 studies). |
| Proximity to failure (RIR) | Full text (Refalo) + abstract (Robinson) | Direction only. Closer-to-failure → more hypertrophy; failure itself unnecessary; strength insensitive to RIR. **No numeric RIR prescription exists in the verified literature** — encoded qualitatively. |
| Exercise order | Abstracts only | Verified — and it corrected the plan: order doesn't affect hypertrophy; priority-based ordering (not compound-first) is what the evidence supports. |
| ACSM prescriptions | Full text | Complete numeric matrix: loading, sets, rest, weekly days × novice/intermediate/advanced × strength/hypertrophy/endurance, plus the 2–10% load-progression rule. Position-stand tier (2009 — synthesis, not primary evidence). |
| Older adults | Full text (NSCA 2019, Borde 2015) | Concrete doses for 60+/65+ populations, gated by `appliesFromAge: 60` so they are never served to younger users. |

## What was checked and rejected (or couldn't be sourced)

- **The "age ≥ 45 modifiers" from the original design are not evidence-backed.**
  Joint-friendly variants, mandatory warm-up, and an RIR cap at 45+ were each
  checked; nothing locatable supports the 45 threshold. The related findings
  that do exist apply to 60+/65+ (encoded as such) or ≥50 (Nunes 2022,
  single-vs-multiple sets — not encoded, marginal). Dropped from the design.
- **No numeric RIR target.** Popular "0–2 RIR" prescriptions are practitioner
  interpretation. Robinson et al. explicitly call their analysis exploratory.
- **No verified upper volume bound.** The popular "10–20 sets" upper end is
  not in the verified source ("paucity of data investigating weekly volumes
  of >12 sets"). The rule encodes min 10, max unknown.
- **`general_fitness` has no dedicated verified prescription.** ACSM's novice
  recommendations are adjacent, but mapping the app's general_fitness goal
  onto them would be inference. Gap left open; such users currently get only
  goal-agnostic rules (exercise order, older-adult rules when applicable).
- **Movement-pattern balancing / session templates**: consensus territory per
  the original doc; nothing encoded this round (the file currently contains
  zero consensus-tier entries).
- **2016 frequency paper page range** and the NSCA/Borde DOIs were not
  confirmed from fetched material and are recorded as null rather than
  guessed.

## Quality caveats carried in the file itself

- Every citation records `accessLevel` (full_text vs abstract); every
  abstract-derived rule says so in its caveats.
- Known internal inconsistencies in sources are recorded (ACSM abstract says
  4–5 d/wk advanced, its Table 2 says 4–6).
- The novice/intermediate/advanced ↔ 1–10 scale mapping and the
  trained/untrained ↔ intermediate+/novice mapping are app conventions,
  labeled as such in `experienceLevelMapping.note`.

## Verdict

Roughly 85% of what the original design wanted as "quantitative dials" was
verifiable and is now served with citations. The two headline casualties are
the numeric RIR target (doesn't exist in the literature) and the 45+ age
tier (not evidence-backed). Both absences are themselves encoded/flagged so
downstream clients can't silently reinvent them.
