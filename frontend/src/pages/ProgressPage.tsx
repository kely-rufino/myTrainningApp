import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { apiFetch } from '../lib/api'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

// ── Types ─────────────────────────────────────────────────────────────────────

type HistoryEntry = {
  id: number
  date: string
  startedAt: string | null
  finishedAt: string | null
  durationMinutes: number | null
  workout: { id: number; name: string }
  session: { id: number; name: string | null; order: number } | null
}

type TrackedExercise = {
  id: number
  name: string
  sessions: number
  bestWeight: number | null
}

type ProgressPoint = {
  date: string
  maxWeight: number | null
  maxReps: number | null
  totalVolume: number | null
  sets: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

function formatFullDate(iso: string) {
  const d = new Date(iso)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return `${days[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
}

// ── History tab ───────────────────────────────────────────────────────────────

function HistoryTab() {
  const { data: history = [], isLoading } = useQuery<HistoryEntry[]>({
    queryKey: ['history'],
    queryFn: () => apiFetch('/history'),
  })

  const thisWeek = useMemo(() => {
    const now = new Date()
    const sunday = new Date(now)
    sunday.setDate(now.getDate() - now.getDay())
    sunday.setHours(0, 0, 0, 0)
    return history.filter(e => new Date(e.date) >= sunday).length
  }, [history])

  const thisMonth = useMemo(() => {
    const now = new Date()
    return history.filter(e => {
      const d = new Date(e.date)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }).length
  }, [history])

  if (isLoading) return <p className="text-center text-gray-400 text-sm py-16">Loading…</p>

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <p className="text-4xl">📋</p>
        <p className="font-semibold text-gray-900">No workouts completed yet</p>
        <p className="text-gray-400 text-sm">Finish a session on the Calendar to see your history here.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: history.length },
          { label: 'This month', value: thisMonth },
          { label: 'This week', value: thisWeek },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl px-3 py-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Session list */}
      <div className="flex flex-col gap-3">
        {history.map(entry => {
          const sessionLabel = entry.session
            ? entry.session.name ?? `Day ${entry.session.order}`
            : null

          return (
            <div key={entry.id} className="bg-white rounded-2xl px-4 py-4 shadow-sm flex items-center gap-3">
              {/* Date badge */}
              <div className="w-12 shrink-0 flex flex-col items-center">
                <p className="text-xs text-gray-400">{MONTHS[new Date(entry.date).getMonth()]}</p>
                <p className="text-xl font-bold text-gray-900 leading-tight">{new Date(entry.date).getDate()}</p>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{entry.workout.name}</p>
                {sessionLabel && (
                  <p className="text-xs text-gray-400 mt-0.5">{sessionLabel}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">{formatFullDate(entry.date)}</p>
              </div>

              {/* Duration + checkmark */}
              <div className="shrink-0 flex flex-col items-end gap-1">
                <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                {entry.durationMinutes !== null && (
                  <p className="text-xs text-gray-400">{entry.durationMinutes}m</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Progress tab ──────────────────────────────────────────────────────────────

type ChartMetric = 'maxWeight' | 'totalVolume'

function ProgressTab() {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [metric, setMetric] = useState<ChartMetric>('maxWeight')
  const [query, setQuery] = useState('')

  const { data: exercises = [], isLoading: loadingExercises } = useQuery<TrackedExercise[]>({
    queryKey: ['progress-exercises'],
    queryFn: () => apiFetch('/progress/exercises'),
  })

  const { data: points = [], isLoading: loadingPoints } = useQuery<ProgressPoint[]>({
    queryKey: ['progress-exercise', selectedId],
    queryFn: () => apiFetch(`/progress/exercise/${selectedId}`),
    enabled: selectedId !== null,
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? exercises.filter(e => e.name.toLowerCase().includes(q)) : exercises
  }, [exercises, query])

  const selected = exercises.find(e => e.id === selectedId) ?? null

  const chartData = useMemo(() =>
    points
      .filter(p => p[metric] !== null)
      .map(p => ({ date: formatDate(p.date), value: p[metric] })),
    [points, metric]
  )

  if (loadingExercises) return <p className="text-center text-gray-400 text-sm py-16">Loading…</p>

  if (exercises.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <p className="text-4xl">📈</p>
        <p className="font-semibold text-gray-900">No exercise data yet</p>
        <p className="text-gray-400 text-sm">Complete a session with logged sets to see progress charts.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Exercise picker */}
      {!selected ? (
        <>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search exercises…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full bg-white rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none shadow-sm placeholder-gray-400"
            />
          </div>

          <div className="flex flex-col gap-0 bg-white rounded-2xl shadow-sm overflow-hidden">
            {filtered.map((ex, i) => (
              <button
                key={ex.id}
                onClick={() => { setSelectedId(ex.id); setQuery('') }}
                className={`flex items-center justify-between px-4 py-3.5 text-left active:bg-gray-50 ${
                  i < filtered.length - 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">{ex.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {ex.sessions} {ex.sessions === 1 ? 'session' : 'sessions'}
                    {ex.bestWeight ? ` · Best: ${ex.bestWeight} kg` : ''}
                  </p>
                </div>
                <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </>
      ) : (
        /* Chart view */
        <div className="flex flex-col gap-4">
          {/* Back + title */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedId(null)}
              className="text-blue-500 flex items-center gap-1 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              All exercises
            </button>
          </div>

          <p className="font-bold text-gray-900 text-lg">{selected.name}</p>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl px-4 py-4 shadow-sm">
              <p className="text-xs text-gray-400 mb-1">Best weight</p>
              <p className="text-2xl font-bold text-gray-900">
                {selected.bestWeight ? `${selected.bestWeight} kg` : '—'}
              </p>
            </div>
            <div className="bg-white rounded-2xl px-4 py-4 shadow-sm">
              <p className="text-xs text-gray-400 mb-1">Sessions logged</p>
              <p className="text-2xl font-bold text-gray-900">{selected.sessions}</p>
            </div>
          </div>

          {/* Metric toggle */}
          <div className="flex gap-2 bg-white rounded-xl p-1 shadow-sm">
            {([
              { key: 'maxWeight' as ChartMetric, label: 'Max weight (kg)' },
              { key: 'totalVolume' as ChartMetric, label: 'Volume (kg)' },
            ]).map(m => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                  metric === m.key ? 'bg-blue-500 text-white' : 'text-gray-500'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Chart */}
          {loadingPoints ? (
            <p className="text-center text-gray-400 text-sm py-10">Loading…</p>
          ) : chartData.length < 2 ? (
            <div className="bg-white rounded-2xl px-4 py-10 shadow-sm text-center">
              <p className="text-gray-400 text-sm">Not enough data yet — complete more sessions to see a chart.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl px-2 pt-5 pb-3 shadow-sm">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ left: -10, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      fontSize: '12px',
                    }}
                    formatter={(val) =>
                      metric === 'maxWeight' ? [`${val ?? 0} kg`, 'Max weight'] : [`${val ?? 0} kg`, 'Volume']
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'history' | 'progress'

export default function ProgressPage() {
  const [tab, setTab] = useState<Tab>('history')

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Tab bar */}
      <div className="bg-white shadow-sm px-4 pt-4 pb-0">
        <div className="flex gap-0 border-b border-gray-200">
          {([
            { key: 'history' as Tab, label: 'History' },
            { key: 'progress' as Tab, label: 'Progress' },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-500 text-blue-500'
                  : 'border-transparent text-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 pb-24">
        {tab === 'history' ? <HistoryTab /> : <ProgressTab />}
      </div>
    </div>
  )
}
