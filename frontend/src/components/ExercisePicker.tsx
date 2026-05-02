import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { apiFetch } from '../lib/api'
import type { Exercise } from '../lib/workoutTypes'

interface Props {
  onSelect: (exercise: Exercise) => void
  onClose: () => void
}

export default function ExercisePicker({ onSelect, onClose }: Props) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState('')

  const { data: exercises = [] } = useQuery({
    queryKey: ['exercises'],
    queryFn: (): Promise<Exercise[]> => apiFetch('/exercises'),
    staleTime: Infinity,
  })

  const filtered = search.trim()
    ? exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    : exercises

  function openCreate() {
    setNewName(search.trim())
    setNewDesc('')
    setCreateError('')
    setCreating(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    setCreateError('')
    try {
      const created = await apiFetch<Exercise>('/exercises', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined }),
      })
      // add to cache so ExercisesPage also sees it
      qc.setQueryData<Exercise[]>(['exercises'], prev =>
        prev ? [...prev, created].sort((a, b) => a.name.localeCompare(b.name)) : [created]
      )
      onSelect(created)
    } catch (err) {
      setCreateError((err as Error).message)
      setSaving(false)
    }
  }

  if (creating) {
    return (
      <div className="fixed inset-0 z-50 flex items-end">
        <div className="absolute inset-0 bg-black/40" onClick={() => setCreating(false)} />
        <div className="relative w-full bg-white rounded-t-2xl px-5 py-6 flex flex-col gap-4">
          <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto" />
          <p className="font-semibold text-gray-900">New exercise</p>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Exercise name"
              required
              className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm outline-none placeholder-gray-400"
            />
            <input
              type="text"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm outline-none placeholder-gray-400"
            />
            {createError && (
              <p className="text-xs text-red-500 px-1">{createError}</p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-500 font-semibold text-sm"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={saving || !newName.trim()}
                className="flex-1 py-3 rounded-2xl bg-blue-500 text-white font-semibold text-sm disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Create & add'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-2xl flex flex-col max-h-[80vh]">
        <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex items-center gap-3">
          <div className="flex-1 bg-gray-100 rounded-xl px-3 py-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              autoFocus
              type="text"
              placeholder="Search exercises…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <button onClick={onClose} className="text-blue-500 font-semibold text-sm">Cancel</button>
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered.map(ex => (
            <button
              key={ex.id}
              onClick={() => onSelect(ex)}
              className="w-full px-4 py-3.5 text-left border-b border-gray-50 active:bg-gray-50 last:border-0"
            >
              <p className="font-medium text-gray-900 text-sm">{ex.name}</p>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-10 px-6">
              <p className="text-gray-400 text-sm">No exercises found</p>
              <button
                onClick={openCreate}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white text-sm font-semibold rounded-2xl active:opacity-80"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {search.trim() ? `Create "${search.trim()}"` : 'Create new exercise'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
