/**
 * Fetches all exercises from api-ninjas.com and writes the result to
 * prisma/exercises-data.json, which seed.ts reads from.
 *
 * Usage:
 *   1. Add API_NINJAS_KEY=<your_key> to backend/.env
 *   2. npm run exercises:fetch
 */

import 'dotenv/config'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const API_KEY = process.env.API_NINJAS_KEY
const BASE_URL = 'https://api.api-ninjas.com/v1/exercises'

// Every muscle group the API supports
const MUSCLE_GROUPS = [
  'abdominals',
  'abductors',
  'adductors',
  'biceps',
  'calves',
  'chest',
  'forearms',
  'glutes',
  'hamstrings',
  'lats',
  'lower_back',
  'middle_back',
  'neck',
  'quadriceps',
  'traps',
  'triceps',
] as const

type ApiExercise = {
  name: string
  type: string
  muscle: string
  equipment: string
  difficulty: string
  instructions: string
}

export type ExerciseSeedEntry = {
  name: string
  description: string | null
}

async function fetchPage(params: Record<string, string | number>): Promise<ApiExercise[] | null> {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
  ).toString()
  const url = `${BASE_URL}?${qs}`
  const res = await fetch(url, { headers: { 'X-Api-Key': API_KEY! } })

  if (res.status === 429) {
    console.warn('  Rate limited, waiting 3s…')
    await sleep(3000)
    return fetchPage(params)
  }

  // 400 means offset is beyond available results — treat as end of list
  if (res.status === 400) return []

  if (!res.ok) {
    console.warn(`  Warning: ${res.status} for ${qs} — skipping`)
    return null
  }

  return res.json() as Promise<ApiExercise[]>
}

async function fetchAll(filterKey: string, filterValue: string): Promise<ApiExercise[]> {
  const results: ApiExercise[] = []
  let offset = 0

  while (true) {
    const page = await fetchPage({ [filterKey]: filterValue, offset })
    if (page === null || page.length === 0) break
    results.push(...page)
    if (page.length < 10) break   // last partial page — no point requesting more
    offset += page.length
    await sleep(200)
  }

  return results
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

const EXERCISE_TYPES = [
  'cardio',
  'olympic_weightlifting',
  'plyometrics',
  'powerlifting',
  'strength',
  'stretching',
  'strongman',
] as const

async function main() {
  if (!API_KEY) {
    console.error('❌  Missing API_NINJAS_KEY in .env')
    process.exit(1)
  }

  const seen = new Map<string, ApiExercise>() // keyed by lowercase name for dedup

  function ingest(exercises: ApiExercise[]) {
    let added = 0
    for (const ex of exercises) {
      const key = ex.name.toLowerCase().trim()
      if (!seen.has(key)) { seen.set(key, ex); added++ }
    }
    return added
  }

  console.log('── Pass 1: by muscle group ──')
  for (const muscle of MUSCLE_GROUPS) {
    process.stdout.write(`  ${muscle}… `)
    const exercises = await fetchAll('muscle', muscle)
    console.log(`${exercises.length} fetched, ${ingest(exercises)} new (total: ${seen.size})`)
  }

  console.log('\n── Pass 2: by exercise type ──')
  for (const type of EXERCISE_TYPES) {
    process.stdout.write(`  ${type}… `)
    const exercises = await fetchAll('type', type)
    console.log(`${exercises.length} fetched, ${ingest(exercises)} new (total: ${seen.size})`)
  }

  const seedEntries: ExerciseSeedEntry[] = Array.from(seen.values()).map(ex => ({
    name: ex.name.trim(),
    // Combine instructions with metadata so it reads nicely in the app
    description: [
      ex.instructions || null,
      `Muscle: ${ex.muscle.replace(/_/g, ' ')}`,
      `Equipment: ${ex.equipment}`,
      `Difficulty: ${ex.difficulty}`,
    ]
      .filter(Boolean)
      .join(' — ') || null,
  }))

  // Sort alphabetically so git diffs are stable
  seedEntries.sort((a, b) => a.name.localeCompare(b.name))

  const outPath = resolve(__dirname, '../prisma/exercises-data.json')
  writeFileSync(outPath, JSON.stringify(seedEntries, null, 2) + '\n')

  console.log(`\n✅  Wrote ${seedEntries.length} exercises to prisma/exercises-data.json`)
}

main().catch(e => { console.error(e); process.exit(1) })
