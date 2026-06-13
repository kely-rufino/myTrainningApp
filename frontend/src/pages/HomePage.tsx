import { useSuspenseQuery, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { meQueryOptions } from '../lib/queries'
import { apiFetch } from '../lib/api'
import type { WorkoutListItem } from '../lib/workoutTypes'

function workoutsQueryOptions() {
  return {
    queryKey: ['workouts'],
    queryFn: (): Promise<WorkoutListItem[]> => apiFetch('/workouts'),
  }
}

export default function HomePage() {
  const { data: user } = useSuspenseQuery(meQueryOptions)
  const { data: workouts = [], isLoading } = useQuery(workoutsQueryOptions())
  const navigate = useNavigate()

  return (
    <div className="px-5 pt-6 flex flex-col gap-5">
      {/* Avatar */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-base shrink-0 shadow-sm">
          {user.name[0]}{user.lastName[0]}
        </div>
        <div>
          <p className="text-xs text-gray-400">Welcome back</p>
          <p className="font-semibold text-gray-900">{user.name}</p>
        </div>
      </div>

      {/* Workouts section */}
      {isLoading ? (
        <p className="text-center text-gray-400 py-6">Loading...</p>
      ) : workouts.length === 0 ? (
        <div className="bg-white rounded-2xl px-5 py-8 shadow-sm text-center flex flex-col items-center gap-4">
          <p className="text-4xl">🏋️</p>
          <div>
            <p className="font-semibold text-gray-900">No workouts yet</p>
            <p className="text-gray-400 text-sm mt-1">Build your first workout plan to get started</p>
          </div>
          <button
            onClick={() => navigate({ to: '/workouts' })}
            className="px-6 py-3 bg-blue-500 text-white rounded-2xl font-semibold text-sm active:opacity-80"
          >
            Create Workout
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-widest">Your Workouts</h2>
          {workouts.map(w => (
            <button
              key={w.id}
              onClick={() => navigate({ to: '/workouts/$id', params: { id: String(w.id) } })}
              className="bg-white rounded-2xl px-4 py-4 shadow-sm flex items-center justify-between text-left w-full active:opacity-80"
            >
              <div>
                <p className="font-semibold text-gray-900">{w.name}</p>
                <p className="text-sm text-gray-400 mt-0.5">
                  {w._count.sessions} {w._count.sessions === 1 ? 'day' : 'days'}
                </p>
              </div>
              <svg className="w-5 h-5 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
