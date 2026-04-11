import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { workoutBuilderRoute } from '../routeTree'
import { useState } from 'react'
import { apiFetch } from '../lib/api'
import type { Workout, Session, Block, SetItem, Exercise } from '../lib/workoutTypes'
import { groupBlocks } from '../lib/workoutTypes'
import ExercisePicker from '../components/ExercisePicker'

function workoutQueryOptions(id: number) {
  return {
    queryKey: ['workout', id],
    queryFn: (): Promise<Workout> => apiFetch(`/workouts/${id}`),
  }
}

// ── Set row ───────────────────────────────────────────────────────────────────

function SetRow({
  set,
  mode,
  onUpdate,
  onDelete,
}: {
  set: SetItem
  mode: 'reps' | 'duration'
  onUpdate: (data: Partial<Pick<SetItem, 'reps' | 'weight' | 'duration'>>) => void
  onDelete: () => void
}) {
  const isDuration = mode === 'duration'
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs text-gray-400 w-5 text-center">{set.order}</span>
      {isDuration ? (
        <input
          type="number"
          placeholder="sec"
          defaultValue={set.duration ?? ''}
          onBlur={e => onUpdate({ duration: e.target.value ? Number(e.target.value) : null })}
          className="flex-1 min-w-0 bg-gray-100 rounded-lg px-2 py-1.5 text-sm text-center outline-none"
        />
      ) : (
        <>
          <input
            type="number"
            placeholder="reps"
            defaultValue={set.reps ?? ''}
            onBlur={e => onUpdate({ reps: e.target.value ? Number(e.target.value) : null })}
            className="flex-1 min-w-0 bg-gray-100 rounded-lg px-2 py-1.5 text-sm text-center outline-none"
          />
          <span className="text-xs text-gray-400">×</span>
          <input
            type="number"
            placeholder="kg"
            defaultValue={set.weight ?? ''}
            onBlur={e => onUpdate({ weight: e.target.value ? Number(e.target.value) : null })}
            className="flex-1 min-w-0 bg-gray-100 rounded-lg px-2 py-1.5 text-sm text-center outline-none"
          />
        </>
      )}
      <button onClick={onDelete} className="text-gray-300 active:text-red-400 p-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ── Block card ────────────────────────────────────────────────────────────────

function BlockCard({
  block,
  workoutId,
  onAddSuperset,
}: {
  block: Block
  workoutId: number
  onAddSuperset: (blockId: number) => void
}) {
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['workout', workoutId] })

  const addSet = useMutation({
    mutationFn: (data: { reps?: number | null; weight?: number | null; duration?: number | null }) =>
      apiFetch(`/blocks/${block.id}/items`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: inv,
  })

  const updateSet = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) =>
      apiFetch(`/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: inv,
  })

  const deleteSet = useMutation({
    mutationFn: (id: number) => apiFetch(`/items/${id}`, { method: 'DELETE' }),
    onSuccess: inv,
  })

  const deleteBlock = useMutation({
    mutationFn: () => apiFetch(`/blocks/${block.id}`, { method: 'DELETE' }),
    onSuccess: inv,
  })

  const [mode, setMode] = useState<'reps' | 'duration'>(
    block.items.some(i => i.duration !== null) ? 'duration' : 'reps'
  )

  function addNewSet() {
    if (mode === 'duration') addSet.mutate({ duration: null })
    else addSet.mutate({ reps: null, weight: null })
  }

  return (
    <div className="bg-white rounded-xl px-4 py-3 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <p className="font-semibold text-gray-900 text-sm leading-tight flex-1 pr-2">{block.exercise.name}</p>
        <button onClick={() => deleteBlock.mutate()} className="text-gray-300 active:text-red-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 mb-3">
        {(['reps', 'duration'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              mode === m ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {m === 'reps' ? 'Reps & Weight' : 'Duration'}
          </button>
        ))}
      </div>

      {/* Column headers */}
      {block.items.length > 0 && (
        <div className="flex items-center gap-2 mb-1">
          <span className="w-5" />
          {mode === 'duration' ? (
            <span className="flex-1 text-center text-xs text-gray-400">Seconds</span>
          ) : (
            <>
              <span className="flex-1 text-center text-xs text-gray-400">Reps</span>
              <span className="text-xs text-gray-400 opacity-0">×</span>
              <span className="flex-1 text-center text-xs text-gray-400">kg</span>
            </>
          )}
          <span className="w-6" />
        </div>
      )}

      {/* Sets */}
      <div className="flex flex-col">
        {block.items.map(set => (
          <SetRow
            key={set.id}
            set={set}
            mode={mode}
            onUpdate={data => updateSet.mutate({ id: set.id, data })}
            onDelete={() => deleteSet.mutate(set.id)}
          />
        ))}
      </div>

      {/* Add set + superset */}
      <div className="flex gap-2 mt-2">
        <button
          onClick={addNewSet}
          className="flex-1 py-2 border border-dashed border-gray-300 rounded-lg text-xs text-gray-400 active:bg-gray-50"
        >
          + Add set
        </button>
        <button
          onClick={() => onAddSuperset(block.id)}
          className="px-3 py-2 border border-dashed border-blue-200 rounded-lg text-xs text-blue-400 active:bg-blue-50"
        >
          + Superset
        </button>
      </div>
    </div>
  )
}

// ── Superset group ────────────────────────────────────────────────────────────

function BlockGroupCard({
  blocks,
  workoutId,
  onAddSuperset,
}: {
  blocks: Block[]
  workoutId: number
  onAddSuperset: (blockId: number) => void
}) {
  if (blocks.length === 1)
    return <BlockCard block={blocks[0]} workoutId={workoutId} onAddSuperset={onAddSuperset} />

  return (
    <div className="border-l-4 border-blue-400 pl-3 flex flex-col gap-2">
      <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Superset</p>
      {blocks.map(b => (
        <BlockCard key={b.id} block={b} workoutId={workoutId} onAddSuperset={onAddSuperset} />
      ))}
    </div>
  )
}

// ── Session panel ─────────────────────────────────────────────────────────────

function SessionPanel({ session, workoutId }: { session: Session; workoutId: number }) {
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['workout', workoutId] })
  const [pickerFor, setPickerFor] = useState<'block' | number | null>(null)

  const addBlock = useMutation({
    mutationFn: (exerciseId: number) =>
      apiFetch(`/sessions/${session.id}/blocks`, { method: 'POST', body: JSON.stringify({ exerciseId }) }),
    onSuccess: inv,
  })

  const addSuperset = useMutation({
    mutationFn: ({ blockId, exerciseId }: { blockId: number; exerciseId: number }) =>
      apiFetch(`/blocks/${blockId}/superset`, { method: 'POST', body: JSON.stringify({ exerciseId }) }),
    onSuccess: inv,
  })

  function handleExercisePick(ex: Exercise) {
    if (pickerFor === 'block') addBlock.mutate(ex.id)
    else if (typeof pickerFor === 'number') addSuperset.mutate({ blockId: pickerFor, exerciseId: ex.id })
    setPickerFor(null)
  }

  const groups = groupBlocks(session.blocks)

  return (
    <div className="flex flex-col gap-3">
      {groups.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-4">No exercises yet</p>
      )}

      {groups.map((g, i) => (
        <BlockGroupCard
          key={g.supersetGroupId ?? g.blocks[0]?.id ?? i}
          blocks={g.blocks}
          workoutId={workoutId}
          onAddSuperset={blockId => setPickerFor(blockId)}
        />
      ))}

      <button
        onClick={() => setPickerFor('block')}
        className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 active:bg-gray-50"
      >
        + Add Exercise
      </button>

      {pickerFor !== null && (
        <ExercisePicker onSelect={handleExercisePick} onClose={() => setPickerFor(null)} />
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WorkoutBuilderPage() {
  const { id } = workoutBuilderRoute.useParams()
  const workoutId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['workout', workoutId] })

  const { data: workout, isLoading } = useQuery(workoutQueryOptions(workoutId))
  const [activeSessionIdx, setActiveSessionIdx] = useState(0)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')

  const addSession = useMutation({
    mutationFn: () =>
      apiFetch(`/workouts/${workoutId}/sessions`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => {
      inv()
      setActiveSessionIdx(workout?.sessions.length ?? 0)
    },
  })

  const updateName = useMutation({
    mutationFn: (name: string) =>
      apiFetch(`/workouts/${workoutId}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    onSuccess: () => { inv(); setEditingName(false) },
  })

  if (isLoading) {
    return <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading...</div>
  }

  if (!workout) {
    return <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Workout not found</div>
  }

  const activeSession = workout.sessions[activeSessionIdx] ?? null

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Title bar */}
      <div className="px-4 pt-4 pb-3 bg-white shadow-sm">
        <button
          onClick={() => navigate({ to: '/workouts' })}
          className="text-blue-500 text-sm mb-2 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Workouts
        </button>
        {editingName ? (
          <form
            onSubmit={e => { e.preventDefault(); if (nameValue.trim()) updateName.mutate(nameValue.trim()) }}
            className="flex gap-2 items-center"
          >
            <input
              autoFocus
              value={nameValue}
              onChange={e => setNameValue(e.target.value)}
              className="flex-1 text-xl font-bold text-gray-900 outline-none border-b-2 border-blue-400 pb-0.5"
            />
            <button type="submit" className="text-blue-500 font-semibold text-sm">Save</button>
            <button type="button" onClick={() => setEditingName(false)} className="text-gray-400 text-sm">Cancel</button>
          </form>
        ) : (
          <button
            className="text-xl font-bold text-gray-900 text-left w-full"
            onClick={() => { setNameValue(workout.name); setEditingName(true) }}
          >
            {workout.name}
          </button>
        )}
      </div>

      {/* Session tabs */}
      <div className="flex gap-2 px-4 pt-3 pb-2 overflow-x-auto">
        {workout.sessions.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setActiveSessionIdx(i)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              i === activeSessionIdx ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 shadow-sm'
            }`}
          >
            {s.name ?? `Day ${i + 1}`}
          </button>
        ))}
        <button
          onClick={() => addSession.mutate()}
          disabled={addSession.isPending}
          className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium bg-white text-gray-400 shadow-sm border border-dashed border-gray-300 active:opacity-70"
        >
          + Day
        </button>
      </div>

      {/* Session content */}
      <div className="flex-1 px-4 pb-10 pt-2">
        {activeSession ? (
          <SessionPanel session={activeSession} workoutId={workoutId} />
        ) : (
          <div className="text-center text-gray-400 text-sm py-10">Add a day to get started</div>
        )}
      </div>
    </div>
  )
}
