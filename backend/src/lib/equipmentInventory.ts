import { z } from 'zod'
import { EQUIPMENT, equipmentSchema } from './exerciseTaxonomy.js'

// Quantitative equipment inventory (knowledge-base-r3-amendment.md §2.2).
//
// A tag array cannot answer the question that matters — "can this user
// actually load this exercise?" — so the encoded shape carries the loads.
// `type` stays in the existing closed vocabulary, which keeps every existing
// equipment filter working unchanged.
//
// **`loads` absent and `loads: []` are different facts.** Absent means nobody
// has asked what the user owns; empty means they own the equipment with no
// external load. Load feasibility (§4.12) must ask in the first case and can
// conclude in the second, so nothing in this file collapses one into the other.

const inventoryItemSchema = z.object({
  type: equipmentSchema,
  /** Number of matched pairs, for dumbbells and similar. */
  pairs: z.number().int().min(0).optional(),
  /** Discrete loads available, per implement. Absent = unknown, not zero. */
  loads: z.array(z.number().positive()).optional(),
  /** Bare bar weight, for barbell entries. */
  barWeight: z.number().positive().optional(),
  /** Plate denominations available, per side unless the user says otherwise. */
  plates: z.array(z.number().positive()).optional(),
  adjustable: z.boolean().optional(),
  /** Bands are ordinal, not numeric — kept as labels rather than faked into kg. */
  resistances: z.array(z.string().max(30)).optional(),
  unit: z.enum(['kg', 'lb']).optional(),
})

export const equipmentInventorySchema = z.object({
  schema: z.literal(2),
  items: z.array(inventoryItemSchema),
})

export type EquipmentInventoryItem = z.infer<typeof inventoryItemSchema>
export type EquipmentInventory = z.infer<typeof equipmentInventorySchema>

/** Input shape for writes — `schema` is stamped by the encoder, not the caller. */
export const equipmentInventoryInputSchema = z.array(inventoryItemSchema)

// ── Encoding ──────────────────────────────────────────────────────────────

export function encodeInventory(items: EquipmentInventoryItem[] | null | undefined): string | null {
  if (!items || items.length === 0) return null
  // One entry per type: two "dumbbell" rows would make maxLoadFor ambiguous.
  const byType = new Map<string, EquipmentInventoryItem>()
  for (const item of items) byType.set(item.type, item)
  const inventory: EquipmentInventory = {
    schema: 2,
    items: [...byType.values()].sort((a, b) => a.type.localeCompare(b.type)),
  }
  return JSON.stringify(inventory)
}

/**
 * Reads either encoding. Schema-1 rows are plain tag arrays (`["dumbbell"]`)
 * and are upgraded on read to `{ type }` entries with **no load data**, which
 * is the honest translation: the old shape never recorded loads, so they are
 * unknown rather than zero.
 *
 * Upgrading lazily rather than with a data migration is deliberate. The volume
 * this runs against is a live SQLite file on Railway, and a read-time
 * conversion plus write-through on the next profile update reaches the same
 * end state without a migration that can half-apply. The `schema` discriminant
 * is what makes the two shapes distinguishable at read time.
 */
export function decodeInventory(json: string | null): EquipmentInventory {
  if (!json) return { schema: 2, items: [] }

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { schema: 2, items: [] }
  }

  // Schema 1: bare array of equipment tags.
  if (Array.isArray(parsed)) {
    const known = new Set<string>(EQUIPMENT)
    return {
      schema: 2,
      items: parsed
        .filter((tag): tag is string => typeof tag === 'string' && known.has(tag))
        .map(tag => ({ type: tag as EquipmentInventoryItem['type'] })),
    }
  }

  const result = equipmentInventorySchema.safeParse(parsed)
  return result.success ? result.data : { schema: 2, items: [] }
}

/**
 * The equipment tag list the old `equipment` field used to hold. Every filter
 * written against schema 1 keeps working through this.
 */
export function inventoryTypes(inventory: EquipmentInventory): string[] {
  return inventory.items.map(item => item.type)
}

/**
 * True when the inventory records that equipment exists but not what it can
 * load — the state a backfilled schema-1 profile lands in, and the trigger for
 * a clarifying question rather than an assumption (§4.14).
 */
export function hasUnknownLoads(inventory: EquipmentInventory): boolean {
  return inventory.items.some(
    item =>
      LOADABLE_TYPES.has(item.type) &&
      item.loads === undefined &&
      item.plates === undefined &&
      item.resistances === undefined
  )
}

// Types whose usefulness depends on how much they load. A pull-up bar or a
// bench has no load denomination to be missing, so their absence of `loads` is
// not a gap worth asking about.
const LOADABLE_TYPES = new Set<string>([
  'barbell',
  'dumbbell',
  'kettlebell',
  'bands',
  'machine',
  'cable',
  'ez_curl_bar',
  'medicine_ball',
])
