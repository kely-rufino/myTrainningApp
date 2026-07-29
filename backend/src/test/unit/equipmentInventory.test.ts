import { describe, it, expect } from 'vitest'
import {
  decodeInventory,
  encodeInventory,
  hasUnknownLoads,
  inventoryTypes,
} from '../../lib/equipmentInventory.js'
import { GOAL_FOR_OUTCOME, OUTCOME_FOR_GOAL, GOALS, PRIMARY_OUTCOMES } from '../../lib/trainingVocab.js'

describe('encodeInventory', () => {
  it('stamps the schema version and sorts by type', () => {
    const encoded = encodeInventory([{ type: 'dumbbell', pairs: 2, loads: [6, 8, 10], unit: 'kg' }, { type: 'bench' }])
    expect(JSON.parse(encoded!)).toEqual({
      schema: 2,
      items: [{ type: 'bench' }, { type: 'dumbbell', pairs: 2, loads: [6, 8, 10], unit: 'kg' }],
    })
  })

  it('collapses duplicate types so load lookups stay unambiguous', () => {
    const encoded = encodeInventory([
      { type: 'dumbbell', loads: [5] },
      { type: 'dumbbell', loads: [10] },
    ])
    expect(JSON.parse(encoded!).items).toHaveLength(1)
  })

  it('stores nothing for an empty inventory', () => {
    expect(encodeInventory([])).toBeNull()
    expect(encodeInventory(null)).toBeNull()
  })
})

describe('decodeInventory', () => {
  it('round-trips a schema-2 payload', () => {
    const items = [{ type: 'barbell' as const, barWeight: 20, plates: [1.25, 2.5, 5], unit: 'kg' as const }]
    expect(decodeInventory(encodeInventory(items)).items).toEqual(items)
  })

  it('upgrades a schema-1 tag array without inventing load data', () => {
    const inventory = decodeInventory(JSON.stringify(['dumbbell', 'bench']))

    expect(inventory.schema).toBe(2)
    expect(inventory.items).toEqual([{ type: 'dumbbell' }, { type: 'bench' }])
    // The old shape never recorded loads. Unknown, not zero, and not [].
    expect(inventory.items[0].loads).toBeUndefined()
  })

  it('drops tags outside the closed equipment vocabulary', () => {
    expect(decodeInventory(JSON.stringify(['dumbbell', 'pecs-machine-3000'])).items).toEqual([{ type: 'dumbbell' }])
  })

  it('returns an empty inventory for null or unparseable values', () => {
    expect(decodeInventory(null).items).toEqual([])
    expect(decodeInventory('not json').items).toEqual([])
    expect(decodeInventory(JSON.stringify({ schema: 2, items: [{ type: 'nope' }] })).items).toEqual([])
  })
})

describe('inventoryTypes', () => {
  it('reproduces the flat tag list older filters expect', () => {
    const inventory = decodeInventory(encodeInventory([{ type: 'dumbbell', loads: [10] }, { type: 'pullup_bar' }]))
    expect(inventoryTypes(inventory).sort()).toEqual(['dumbbell', 'pullup_bar'])
  })
})

describe('hasUnknownLoads', () => {
  it('is true for a backfilled schema-1 profile', () => {
    expect(hasUnknownLoads(decodeInventory(JSON.stringify(['dumbbell'])))).toBe(true)
  })

  it('is false once loads are recorded', () => {
    expect(hasUnknownLoads(decodeInventory(encodeInventory([{ type: 'dumbbell', loads: [8, 10] }])))).toBe(false)
  })

  it('does not ask about equipment that has no load denomination', () => {
    expect(hasUnknownLoads(decodeInventory(JSON.stringify(['pullup_bar', 'bench', 'bodyweight'])))).toBe(false)
  })

  it('treats an explicitly empty load list as a known answer', () => {
    expect(hasUnknownLoads(decodeInventory(encodeInventory([{ type: 'dumbbell', loads: [] }])))).toBe(false)
  })
})

describe('goal ↔ outcome mapping', () => {
  it('maps every legacy goal onto an outcome', () => {
    for (const goal of GOALS) expect(OUTCOME_FOR_GOAL[goal]).toBeDefined()
    expect(OUTCOME_FOR_GOAL.general_fitness).toBe('general_health')
  })

  it('covers every outcome in the reverse direction', () => {
    for (const outcome of PRIMARY_OUTCOMES) expect(outcome in GOAL_FOR_OUTCOME).toBe(true)
  })

  it('leaves outcomes with no published rules unmapped rather than approximating', () => {
    expect(GOAL_FOR_OUTCOME.mental_health_cognition).toBeNull()
    expect(GOAL_FOR_OUTCOME.body_composition).toBeNull()
  })

  it('round-trips the goals that do map', () => {
    for (const goal of GOALS) {
      expect(GOAL_FOR_OUTCOME[OUTCOME_FOR_GOAL[goal]]).toBe(goal)
    }
  })
})
