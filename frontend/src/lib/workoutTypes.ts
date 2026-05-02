export type SetItem = {
  id: number
  blockId: number
  reps: number | null
  weight: number | null
  duration: number | null
  instructions: string | null
  order: number
}

export type Block = {
  id: number
  sessionId: number
  exerciseId: number
  exercise: { id: number; name: string; videoUrl: string | null }
  instructions: string | null
  notes: string | null
  order: number
  supersetGroupId: string | null
  items: SetItem[]
}

export type Session = {
  id: number
  workoutId: number
  name: string | null
  order: number
  blocks: Block[]
}

export type Workout = {
  id: number
  name: string
  instructions: string | null
  userId: number
  sessions: Session[]
}

export type WorkoutListItem = {
  id: number
  name: string
  _count: { sessions: number }
}

export type Exercise = {
  id: number
  name: string
  description: string | null
  videoUrl: string | null
}

// Blocks grouped for display — adjacent blocks sharing a supersetGroupId are merged
export type BlockGroup = {
  supersetGroupId: string | null
  blocks: Block[]
}

export function groupBlocks(blocks: Block[]): BlockGroup[] {
  const groups: BlockGroup[] = []
  for (const block of blocks) {
    if (block.supersetGroupId) {
      const existing = groups.find(g => g.supersetGroupId === block.supersetGroupId)
      if (existing) { existing.blocks.push(block); continue }
    }
    groups.push({ supersetGroupId: block.supersetGroupId, blocks: [block] })
  }
  return groups
}
