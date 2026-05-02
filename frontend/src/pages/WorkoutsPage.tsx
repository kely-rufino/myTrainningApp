import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { apiFetch } from '../lib/api'
import type { WorkoutListItem } from '../lib/workoutTypes'
import { useToast } from '../lib/toast'

function workoutsQueryOptions() {
  return {
    queryKey: ['workouts'],
    queryFn: (): Promise<WorkoutListItem[]> => apiFetch('/workouts'),
  }
}

export default function WorkoutsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  const { data: workouts = [], isLoading } = useQuery(workoutsQueryOptions())
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      apiFetch('/workouts', { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workouts'] })
      setCreating(false)
      setNewName('')
    },
    onError: () => toast.show('Failed to create workout. Please try again.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/workouts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workouts'] })
      setDeletingId(null)
    },
    onError: () => toast.show('Failed to delete workout. Please try again.'),
  })

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (newName.trim()) createMutation.mutate(newName.trim())
  }

  return (
    <div className="px-4 pt-5 pb-24 flex flex-col gap-4">
      <h1 className="text-xl font-bold text-gray-900">My Workouts</h1>

      {isLoading && (
        <p className="text-center text-gray-400 py-10">Loading...</p>
      )}

      {!isLoading && workouts.length === 0 && !creating && (
        <div className="bg-white rounded-2xl px-5 py-10 shadow-sm text-center flex flex-col items-center gap-4">
          <p className="text-4xl">🏋️</p>
          <div>
            <p className="font-semibold text-gray-900">No workouts yet</p>
            <p className="text-gray-400 text-sm mt-1">Build your first workout plan to get started</p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="px-6 py-3 bg-blue-500 text-white rounded-2xl font-semibold text-sm active:opacity-80"
          >
            Create Workout
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {workouts.map(w => (
          <div
            key={w.id}
            className="bg-white rounded-2xl px-4 py-4 shadow-sm flex items-center justify-between"
          >
            <button
              className="flex-1 text-left"
              onClick={() => navigate({ to: '/workouts/$id', params: { id: String(w.id) } })}
            >
              <p className="font-semibold text-gray-900">{w.name}</p>
              <p className="text-sm text-gray-400 mt-0.5">
                {w._count.sessions} {w._count.sessions === 1 ? 'day' : 'days'}
              </p>
            </button>
            <button
              onClick={() => setDeletingId(w.id)}
              className="ml-3 text-gray-300 active:text-red-400 p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl px-4 py-4 shadow-sm flex gap-3">
          <input
            autoFocus
            type="text"
            placeholder="Workout name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="flex-1 text-sm outline-none placeholder-gray-300"
          />
          <button
            type="button"
            onClick={() => { setCreating(false); setNewName('') }}
            className="text-gray-400 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!newName.trim() || createMutation.isPending}
            className="text-blue-500 font-semibold text-sm disabled:opacity-40"
          >
            Save
          </button>
        </form>
      )}

      {/* FAB */}
      {!creating && (
        <button
          onClick={() => setCreating(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-500 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        >
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      {/* Delete confirm sheet */}
      {deletingId !== null && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeletingId(null)} />
          <div className="relative w-full bg-white rounded-t-2xl px-5 py-6 flex flex-col gap-3">
            <p className="font-semibold text-gray-900 text-center">Delete workout?</p>
            <p className="text-sm text-gray-400 text-center">This will remove all sessions and exercises.</p>
            <button
              onClick={() => deleteMutation.mutate(deletingId)}
              disabled={deleteMutation.isPending}
              className="w-full py-3 bg-red-500 text-white rounded-xl font-semibold active:opacity-80 disabled:opacity-40"
            >
              Delete
            </button>
            <button
              onClick={() => setDeletingId(null)}
              className="w-full py-3 text-gray-500 font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
