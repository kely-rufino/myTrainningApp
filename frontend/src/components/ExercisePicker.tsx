import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { apiFetch } from '../lib/api'
import type { Exercise } from '../lib/workoutTypes'

interface Props {
  onSelect: (exercise: Exercise) => void
  onClose: () => void
}

export default function ExercisePicker({ onSelect, onClose }: Props) {
  const [search, setSearch] = useState('')
  const { data: exercises = [] } = useQuery({
    queryKey: ['exercises'],
    queryFn: (): Promise<Exercise[]> => apiFetch('/exercises'),
    staleTime: Infinity,
  })

  const filtered = search.trim()
    ? exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    : exercises

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
              {ex.description && (
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{ex.description}</p>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-10">No exercises found</p>
          )}
        </div>
      </div>
    </div>
  )
}
