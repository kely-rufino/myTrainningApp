import { useSuspenseQuery } from '@tanstack/react-query'
import { meQueryOptions } from '../lib/queries'

export default function HomePage() {
  const { data: user } = useSuspenseQuery(meQueryOptions)

  return (
    <div className="px-5 pt-6 flex flex-col gap-5">
      {/* Auth indicator */}
      <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
        <p className="text-green-800 text-sm font-medium">Authenticated</p>
      </div>

      {/* User card */}
      <div className="bg-white rounded-2xl px-5 py-6 shadow-sm">
        <p className="text-xs text-gray-400 uppercase tracking-widest font-medium mb-3">Signed in as</p>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold shrink-0">
            {user.name[0]}{user.lastName[0]}
          </div>
          <div>
            <p className="text-gray-900 font-semibold text-lg leading-tight">
              {user.name} {user.lastName}
            </p>
            <p className="text-gray-500 text-sm mt-0.5">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Placeholder */}
      <div className="bg-white rounded-2xl px-5 py-8 shadow-sm text-center">
        <p className="text-4xl mb-3">🏋️</p>
        <p className="font-semibold text-gray-900">Your workouts will appear here</p>
        <p className="text-gray-400 text-sm mt-1">Coming soon</p>
      </div>
    </div>
  )
}
