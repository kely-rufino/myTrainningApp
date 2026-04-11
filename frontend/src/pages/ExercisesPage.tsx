import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { apiFetch } from '../lib/api'
import type { Exercise } from '../lib/workoutTypes'

// ── Create exercise sheet ─────────────────────────────────────────────────────

function CreateExerciseSheet({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: () =>
      apiFetch<Exercise>('/exercises', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exercises'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (name.trim()) create.mutate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-2xl flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="px-5 pb-2 border-b border-gray-100">
          <p className="font-semibold text-gray-900">New Exercise</p>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Name *</label>
            <input
              autoFocus
              type="text"
              placeholder="e.g. Cable Fly"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={100}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm outline-none placeholder-gray-400"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Description <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              placeholder="How to perform this exercise…"
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm outline-none placeholder-gray-400 resize-none"
            />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <div className="flex gap-3 pb-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-500 font-semibold text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || create.isPending}
              className="flex-1 py-3 rounded-2xl bg-blue-500 text-white font-semibold text-sm disabled:opacity-40"
            >
              {create.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ExercisesPage() {
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const { data: exercises = [], isLoading } = useQuery<Exercise[]>({
    queryKey: ['exercises'],
    queryFn: () => apiFetch('/exercises'),
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return exercises
    return exercises.filter(e => e.name.toLowerCase().includes(q))
  }, [exercises, query])

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* ── Search bar ────────────────────────────────────────────────── */}
      <div className="bg-white px-4 pt-4 pb-3 shadow-sm sticky top-0 z-10">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search exercises…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-gray-100 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none placeholder-gray-400"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── List ──────────────────────────────────────────────────────── */}
      <div className="flex-1 px-4 py-3 pb-24">
        {isLoading ? (
          <p className="text-center text-gray-400 text-sm py-12">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 font-medium">No exercises found</p>
            {query && (
              <p className="text-gray-400 text-sm mt-1">
                Try a different name or{' '}
                <button onClick={() => setCreating(true)} className="text-blue-500 underline">
                  create it
                </button>
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-0 bg-white rounded-2xl shadow-sm overflow-hidden">
            {filtered.map((ex, i) => (
              <div
                key={ex.id}
                className={`px-4 py-3.5 ${i < filtered.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <p className="text-sm font-semibold text-gray-900">{ex.name}</p>
                {ex.description && (
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{ex.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── FAB ───────────────────────────────────────────────────────── */}
      <button
        onClick={() => setCreating(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-500 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
      >
        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {creating && <CreateExerciseSheet onClose={() => setCreating(false)} />}
    </div>
  )
}
