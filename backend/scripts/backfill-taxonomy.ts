/**
 * One-time backfill: recover the structured metadata that fetch-exercises.ts
 * flattened into `description` ("… — Muscle: X — Equipment: Y — Difficulty: Z"),
 * normalize it to the closed vocabularies, classify movement pattern +
 * space footprint heuristically, and mark recovered rows curated.
 *
 * Rows whose description carries no metadata are left uncurated (source stays
 * as-is) and listed in the report for manual triage.
 *
 * Idempotent: parsed rows have the metadata suffix stripped from description,
 * so a re-run finds nothing left to parse and changes nothing.
 *
 * Usage: npx tsx scripts/backfill-taxonomy.ts [--dry-run]
 * Report: prisma/taxonomy-backfill-report.json
 */

import 'dotenv/config'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from '../src/generated/prisma/client.js'
import {
  EQUIPMENT,
  MUSCLES,
  DIFFICULTIES,
  encodeTags,
  type MovementPattern,
  type SpaceFootprint,
} from '../src/lib/exerciseTaxonomy.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN = process.argv.includes('--dry-run')

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// ── Normalization ────────────────────────────────────────────────────────────

// API-Ninjas equipment values → our vocabulary. `null` = unusable value
// (row still curated, equipment left empty and flagged in the report).
const EQUIPMENT_MAP: Record<string, string | null> = {
  barbell: 'barbell',
  dumbbell: 'dumbbell',
  kettlebells: 'kettlebell',
  kettlebell: 'kettlebell',
  body_only: 'bodyweight',
  'body only': 'bodyweight',
  none: 'bodyweight',
  machine: 'machine',
  cable: 'cable',
  bands: 'bands',
  'e-z_curl_bar': 'ez_curl_bar',
  'e-z curl bar': 'ez_curl_bar',
  exercise_ball: 'exercise_ball',
  medicine_ball: 'medicine_ball',
  foam_roll: 'foam_roll',
  other: 'other',
  undefined: null,
}

// The fetched data carries `Equipment: undefined` on every row (the field
// was never returned by the API), so equipment is inferred from the exercise
// name — names almost always carry the implement. Rows where nothing can be
// inferred stay curated=false and go to the report for manual triage.
const EQUIPMENT_NAME_RULES: Array<{ tags: string[]; re: RegExp }> = [
  { tags: ['barbell'], re: /barbell|landmine|trap bar|deadlift|\bclean\b|snatch|good morning|zercher|t-bar|long bar|push[- ]?press|olympic squat|with chains/ },
  { tags: ['dumbbell'], re: /dumbbell|\bdb\b|arnold|farmer|concentration curl|goblet|hammer curl|zottman/ },
  { tags: ['kettlebell'], re: /kettlebell|\bkb\b|turkish get/ },
  { tags: ['cable'], re: /cable|pushdown|pull-?down|pull-through|face pull|crossover|pallof|pulley|rope (?:crunch|extension|pushdown)/ },
  { tags: ['machine'], re: /machine|smith|leg press|hack squat|leg extension|leg curl|pec deck|sled|elliptical|treadmill|stationary bike|rowing machine|\brower\b|stair|glute ham raise|thigh adductor|calf press|leverage/ },
  { tags: ['bands'], re: /\bband\b|bands\b|resistance band/ },
  { tags: ['ez_curl_bar'], re: /e-?z[- ]?(?:curl )?bar|preacher curl|spider curl/ },
  { tags: ['other'], re: /atlas stone|agility ladder|bicycling|\bsledgehammer|tire|rope climb|battling rope|jump(?:ing)? rope|keg|log lift|sandbag|rickshaw|suspended|suspension|wrist roller/ },
  { tags: ['medicine_ball'], re: /medicine ball|med ball|wall ball|slam/ },
  { tags: ['exercise_ball'], re: /exercise ball|stability ball|swiss ball|physio ?ball/ },
  { tags: ['foam_roll'], re: /foam roll/ },
  { tags: ['bench'], re: /bench|incline|decline|step-?up|box jump|hip thrust/ },
  { tags: ['bodyweight', 'pullup_bar'], re: /pull[- ]?up|chin[- ]?up|hanging|muscle[- ]?up|toes.to.bar/ },
  {
    tags: ['bodyweight'],
    re: /push-?up|\bdip\b|dips\b|plank|crunch|sit-?up|leg raise|knee raise|superman|bird ?dog|dead ?bug|burpee|mountain climber|jumping jack|bear crawl|wall sit|pistol|inverted row|handstand|l-sit|hollow|flutter|scissor|v-?up|bridge|lunge|squat jump|jump squat|calf raise|bodyweight|air |stretch|pose|walking|running|sprint|jog|swim|crawl|hyperextension|back extension|donkey|bicycle|windshield|side bend|neck\b|no weight|leg swing|\bjacks?\b|\bskip\b|slide|\bkicks?\b|up-?down|groiner|arm circle|shuffle|scissors|high knees|butt kick|inchworm|toe touch|\bhops?\b|star jump|pop squat|shadow box|hip circle|balance/,
  },
]

function inferEquipment(name: string): string[] {
  const n = name.toLowerCase()
  const tags = new Set<string>()
  for (const rule of EQUIPMENT_NAME_RULES) {
    if (rule.re.test(n)) rule.tags.forEach(t => tags.add(t))
  }
  // A bench alone isn't a complete answer ("Incline Dumbbell Press" gets
  // dumbbell+bench; a bare "Incline Press" would get bench only — keep it,
  // it's still a real constraint), but bodyweight+anything-loaded is noise.
  if (tags.size > 1 && tags.has('bodyweight') && !tags.has('pullup_bar')) tags.delete('bodyweight')
  return [...tags]
}

function normalizeMuscle(raw: string): string | null {
  const m = raw.trim().toLowerCase().replace(/\s+/g, '_')
  return (MUSCLES as readonly string[]).includes(m) ? m : null
}

function normalizeDifficulty(raw: string): string | null {
  const d = raw.trim().toLowerCase()
  return (DIFFICULTIES as readonly string[]).includes(d) ? d : null
}

// ── Movement pattern heuristics ──────────────────────────────────────────────
// First match wins; `fallback: true` marks rows classified only by muscle
// group so the report surfaces them for review.

type Rule = { pattern: MovementPattern; test: (name: string, muscle: string | null) => boolean }

const RULES: Rule[] = [
  { pattern: 'carry', test: n => /farmer|carry|suitcase|yoke/.test(n) },
  {
    pattern: 'locomotion',
    test: n =>
      /\b(walk|run|running|sprint|jog|bike|biking|cycling|rowing machine|elliptical|stair|sled|shuttle|swim|jump rope|skipping|skating|ski)\b/.test(n) ||
      /burpee|mountain climber|jumping jack|bear crawl|agility/.test(n),
  },
  { pattern: 'mobility', test: n => /stretch|pose|foam roll|rolling|mobility|circles|rotation drill/.test(n) },
  {
    pattern: 'core',
    test: (n, m) =>
      m === 'abdominals' ||
      /crunch|sit-?up|plank|leg raise|knee raise|twist|rollout|dead ?bug|bird ?dog|hollow|l-sit|windshield|wood ?chop|pallof|side bend|v-?up|flutter kick|scissor/.test(n),
  },
  { pattern: 'lunge', test: n => /lunge|split squat|step-?up|pistol|single-?leg squat|skater/.test(n) },
  {
    pattern: 'isolation',
    test: n =>
      /\bcurl\b|extension|pushdown|kick-?back|\bfly\b|flye|pec deck|shrug|calf raise|lateral raise|front raise|rear delt|reverse fly|pullover|wrist|forearm|neck\b|concentration/.test(n),
  },
  { pattern: 'hinge', test: n => /deadlift|\brdl\b|romanian|good morning|hip thrust|glute bridge|\bbridge\b|swing|pull-?through|back extension|hyperextension|clean\b|snatch|high pull/.test(n) },
  { pattern: 'vertical_pull', test: n => /pull-?up|chin-?up|pull ?down|lat pull|muscle-?up/.test(n) },
  { pattern: 'horizontal_pull', test: n => /\brow\b|rows\b|face pull|inverted/.test(n) },
  {
    pattern: 'vertical_push',
    test: (n, m) =>
      /overhead press|shoulder press|military|push press|handstand|arnold|z press|pike push|landmine press/.test(n) ||
      (/press/.test(n) && m === 'shoulders'),
  },
  {
    pattern: 'horizontal_push',
    test: (n, m) =>
      /bench press|push-?up|chest press|floor press|\bdip\b|dips\b|svend/.test(n) ||
      (/press/.test(n) && m === 'chest'),
  },
  { pattern: 'squat', test: n => /squat|leg press|wall sit/.test(n) },
]

const MUSCLE_FALLBACK: Record<string, MovementPattern> = {
  abdominals: 'core',
  abductors: 'isolation',
  adductors: 'isolation',
  biceps: 'isolation',
  calves: 'isolation',
  chest: 'horizontal_push',
  forearms: 'isolation',
  glutes: 'hinge',
  hamstrings: 'hinge',
  lats: 'horizontal_pull',
  lower_back: 'hinge',
  middle_back: 'horizontal_pull',
  neck: 'isolation',
  quadriceps: 'squat',
  shoulders: 'vertical_push',
  traps: 'isolation',
  triceps: 'isolation',
}

function classifyPattern(name: string, muscle: string | null): { pattern: MovementPattern | null; fallback: boolean } {
  const n = name.toLowerCase()
  for (const rule of RULES) {
    if (rule.test(n, muscle)) return { pattern: rule.pattern, fallback: false }
  }
  if (muscle && MUSCLE_FALLBACK[muscle]) return { pattern: MUSCLE_FALLBACK[muscle], fallback: true }
  return { pattern: null, fallback: false }
}

function classifyFootprint(name: string, pattern: MovementPattern | null): SpaceFootprint {
  const n = name.toLowerCase()
  if (pattern === 'locomotion' || /walking|farmer|carry|sled|sprint|crawl|shuttle/.test(n)) return 'large_area'
  if (/lunge|swing|jump|burpee|turkish|skater|step-?up/.test(n)) return 'small_area'
  return 'stationary'
}

// ── Main ─────────────────────────────────────────────────────────────────────

const METADATA_RE = /^(?:(.*?)\s+— )?Muscle: (.+?) — Equipment: (.+?) — Difficulty: (.+)$/s

async function main() {
  const exercises = await prisma.exercise.findMany({ orderBy: { name: 'asc' } })

  const report = {
    dryRun: DRY_RUN,
    totals: { rows: exercises.length, curated: 0, skippedAlreadyDone: 0, noMetadata: 0 },
    equipmentUnresolved: [] as Array<{ id: number; name: string }>,
    unknownMuscle: [] as Array<{ id: number; name: string; raw: string }>,
    patternFromMuscleFallback: [] as Array<{ id: number; name: string; pattern: string }>,
    patternUnresolved: [] as Array<{ id: number; name: string }>,
    noMetadataRows: [] as Array<{ id: number; name: string; source: string }>,
  }

  for (const ex of exercises) {
    const match = ex.description?.match(METADATA_RE)

    if (!match) {
      if (ex.source === 'api-ninjas') {
        report.totals.skippedAlreadyDone++
      } else {
        report.totals.noMetadata++
        report.noMetadataRows.push({ id: ex.id, name: ex.name, source: ex.source })
      }
      continue
    }

    const [, instructions, rawMuscle, rawEquipment, rawDifficulty] = match

    const muscle = normalizeMuscle(rawMuscle)
    if (!muscle) report.unknownMuscle.push({ id: ex.id, name: ex.name, raw: rawMuscle })

    // Prefer the source field when it's usable, else infer from the name.
    const equipKey = rawEquipment.trim().toLowerCase().replace(/\s+/g, '_')
    let equipment: string[] = []
    const mapped = equipKey in EQUIPMENT_MAP ? EQUIPMENT_MAP[equipKey] : null
    if (mapped) {
      equipment = [mapped]
    } else if ((EQUIPMENT as readonly string[]).includes(equipKey)) {
      equipment = [equipKey]
    } else {
      equipment = inferEquipment(ex.name)
    }

    const difficulty = normalizeDifficulty(rawDifficulty)

    const { pattern, fallback } = classifyPattern(ex.name, muscle)
    if (fallback) report.patternFromMuscleFallback.push({ id: ex.id, name: ex.name, pattern: pattern! })
    if (!pattern) report.patternUnresolved.push({ id: ex.id, name: ex.name })

    const footprint = classifyFootprint(ex.name, pattern)

    // Curated requires the full filterable contract: a curated exercise with
    // no equipment tag would silently never match an equipment filter.
    const curated = Boolean(muscle && difficulty && pattern && equipment.length > 0)
    if (curated) report.totals.curated++
    else report.equipmentUnresolved.push({ id: ex.id, name: ex.name })

    if (DRY_RUN) continue

    await prisma.exercise.update({
      where: { id: ex.id },
      data: {
        description: instructions?.trim() || null,
        equipment: encodeTags(equipment),
        primaryMuscle: muscle,
        movementPattern: pattern,
        spaceFootprint: footprint,
        difficulty,
        source: 'api-ninjas',
        license: 'API-Ninjas Exercises API',
        isCurated: curated,
        ...(curated && { verifiedAt: new Date() }),
      },
    })
  }

  const reportPath = resolve(__dirname, '../prisma/taxonomy-backfill-report.json')
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n')

  console.log(`${DRY_RUN ? '[dry run] ' : ''}Backfill complete:`)
  console.log(`  rows examined:        ${report.totals.rows}`)
  console.log(`  curated:              ${report.totals.curated}`)
  console.log(`  already done:         ${report.totals.skippedAlreadyDone}`)
  console.log(`  no metadata (triage): ${report.totals.noMetadata}`)
  console.log(`  equipment unresolved: ${report.equipmentUnresolved.length}`)
  console.log(`  unknown muscle:       ${report.unknownMuscle.length}`)
  console.log(`  pattern via fallback: ${report.patternFromMuscleFallback.length}`)
  console.log(`  pattern unresolved:   ${report.patternUnresolved.length}`)
  console.log(`\nFull report: ${reportPath}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
