import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/api'
import type { Block, Workout, WorkoutListItem } from '../lib/workoutTypes'
import { useToast } from '../lib/toast'

// ── Types ─────────────────────────────────────────────────────────────────────

type BlockExecution = {
  id: number
  workoutSessionBlockItemId: number
  reps: number | null
  weight: number | null
  duration: number | null
}

type CalendarExecution = {
  id: number
  date: string
  startedAt: string | null
  finishedAt: string | null
  workout: { id: number; name: string }
  session: {
    id: number
    name: string | null
    order: number
    blocks: Block[]
  } | null
  blockExecutions: BlockExecution[]
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function getWeekDates(referenceDate: Date): Date[] {
  const sunday = new Date(referenceDate)
  sunday.setDate(referenceDate.getDate() - referenceDate.getDay())
  sunday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday)
    d.setDate(sunday.getDate() + i)
    return d
  })
}

function toDateString(d: Date) {
  return d.toISOString().slice(0, 10)
}

function isSameDay(a: Date, b: Date) {
  return toDateString(a) === toDateString(b)
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function useElapsed(startedAt: string | null) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!startedAt) { setElapsed(0); return }
    const tick = () => setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])
  if (!startedAt) return null
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}m ${String(s).padStart(2, '0')}s`
}

// ── Exercise log components ───────────────────────────────────────────────────

function SetLogRow({
  item,
  logged,
  executionId,
  isDuration,
  sessionStarted,
}: {
  item: Block['items'][number]
  logged: BlockExecution | undefined
  executionId: number
  isDuration: boolean
  sessionStarted: boolean
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const [saved, setSaved] = useState(!!logged)

  const save = useMutation({
    mutationFn: (data: { reps?: number | null; weight?: number | null; duration?: number | null }) =>
      apiFetch(`/executions/${executionId}/log`, {
        method: 'POST',
        body: JSON.stringify({ blockItemId: item.id, ...data }),
      }),
    onSuccess: () => {
      setSaved(true)
      qc.invalidateQueries({ queryKey: ['calendar'] })
    },
    onError: () => toast.show('Failed to save set'),
  })

  function blurReps(e: React.FocusEvent<HTMLInputElement>) {
    const val = e.target.value ? Number(e.target.value) : null
    save.mutate({ reps: val, weight: logged?.weight ?? null })
  }
  function blurWeight(e: React.FocusEvent<HTMLInputElement>) {
    const val = e.target.value ? Number(e.target.value) : null
    save.mutate({ reps: logged?.reps ?? null, weight: val })
  }
  function blurDuration(e: React.FocusEvent<HTMLInputElement>) {
    const val = e.target.value ? Number(e.target.value) : null
    save.mutate({ duration: val })
  }

  const isLogged = saved || !!logged
  const disabled = !sessionStarted

  return (
    <div className={`flex items-center gap-2 py-1.5 rounded-lg transition-colors ${isLogged ? 'bg-green-50' : ''}`}>
      <span className={`text-xs w-5 text-center shrink-0 font-medium ${isLogged ? 'text-green-500' : 'text-gray-400'}`}>
        {isLogged ? '✓' : item.order}
      </span>

      {isDuration ? (
        <input
          type="number"
          placeholder={item.duration ? `${item.duration}s` : 'sec'}
          defaultValue={logged?.duration ?? ''}
          onBlur={blurDuration}
          disabled={disabled}
          className={`flex-1 min-w-0 rounded-lg px-2 py-1.5 text-sm text-center outline-none ${isLogged ? 'bg-green-100' : 'bg-gray-100'} disabled:opacity-40 disabled:cursor-not-allowed`}
        />
      ) : (
        <>
          <input
            type="number"
            placeholder={item.reps ? String(item.reps) : 'reps'}
            defaultValue={logged?.reps ?? ''}
            onBlur={blurReps}
            disabled={disabled}
            className={`flex-1 min-w-0 rounded-lg px-2 py-1.5 text-sm text-center outline-none ${isLogged ? 'bg-green-100' : 'bg-gray-100'} disabled:opacity-40 disabled:cursor-not-allowed`}
          />
          <span className="text-xs text-gray-300 shrink-0">×</span>
          <input
            type="number"
            placeholder={item.weight ? `${item.weight}` : 'kg'}
            defaultValue={logged?.weight ?? ''}
            onBlur={blurWeight}
            disabled={disabled}
            className={`flex-1 min-w-0 rounded-lg px-2 py-1.5 text-sm text-center outline-none ${isLogged ? 'bg-green-100' : 'bg-gray-100'} disabled:opacity-40 disabled:cursor-not-allowed`}
          />
        </>
      )}
    </div>
  )
}

function BlockLog({
  block,
  loggedMap,
  executionId,
  sessionStarted,
}: {
  block: Block
  loggedMap: Map<number, BlockExecution>
  executionId: number
  sessionStarted: boolean
}) {
  const qc = useQueryClient()
  const isDuration = block.mode === 'duration'

  const toast = useToast()

  const saveNote = useMutation({
    mutationFn: (notes: string | null) =>
      apiFetch(`/blocks/${block.id}`, { method: 'PATCH', body: JSON.stringify({ notes }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar'] }); toast.show('Note saved', 'success') },
    onError: () => toast.show('Failed to save note'),
  })

  const autoHeight = useCallback((el: HTMLTextAreaElement | null) => {
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
  }, [])

  return (
    <div>
      {/* Planned instructions — read-only */}
      {block.instructions && (
        <p className="text-sm text-gray-500 mb-3 whitespace-pre-line leading-snug">
          {block.instructions}
        </p>
      )}

      {block.items.length === 0 ? (
        <p className="text-xs text-gray-400 py-1">No sets planned</p>
      ) : (
        <>
          {/* Column headers */}
          <div className="flex items-center gap-2 mb-1">
            <span className="w-5 shrink-0" />
            {isDuration ? (
              <span className="flex-1 text-center text-xs text-gray-400">Seconds</span>
            ) : (
              <>
                <span className="flex-1 text-center text-xs text-gray-400">Reps</span>
                <span className="text-xs text-gray-300 shrink-0 opacity-0">×</span>
                <span className="flex-1 text-center text-xs text-gray-400">kg</span>
              </>
            )}
          </div>
          {block.items.map(item => (
            <SetLogRow
              key={item.id}
              item={item}
              logged={loggedMap.get(item.id)}
              executionId={executionId}
              isDuration={isDuration}
              sessionStarted={sessionStarted}
            />
          ))}
        </>
      )}

      {/* Free-form note — editable during session */}
      <textarea
        ref={autoHeight}
        placeholder="Add exercise note"
        defaultValue={block.notes ?? ''}
        rows={1}
        onChange={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
        onBlur={e => saveNote.mutate(e.target.value || null)}
        className="w-full mt-3 text-sm text-gray-500 placeholder-gray-300 bg-gray-50 rounded-xl px-4 py-3 resize-none outline-none focus:bg-gray-100 leading-snug overflow-hidden"
        style={{ minHeight: '2.75rem' }}
      />
    </div>
  )
}

function ExerciseGroupRow({
  blocks,
  loggedMap,
  executionId,
  initiallyOpen,
  sessionStarted,
}: {
  blocks: Block[]
  loggedMap: Map<number, BlockExecution>
  executionId: number
  initiallyOpen?: boolean
  sessionStarted: boolean
}) {
  const [open, setOpen] = useState(initiallyOpen ?? false)
  const isSuperset = blocks.length > 1
  const names = blocks.map(b => b.exercise.name)

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        className="w-full flex items-center justify-between py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0">
          {isSuperset && (
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide block mb-0.5">
              Superset
            </span>
          )}
          <p className="text-sm font-medium text-gray-800 truncate">
            {names.join(' + ')}
          </p>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className={`pb-3 ${isSuperset ? 'flex flex-col gap-3' : ''}`}>
          {isSuperset
            ? blocks.map(b => (
                <div key={b.id} className="border-l-4 border-blue-300 pl-3">
                  <p className="text-xs font-semibold text-gray-500 mb-1">{b.exercise.name}</p>
                  <BlockLog block={b} loggedMap={loggedMap} executionId={executionId} sessionStarted={sessionStarted} />
                </div>
              ))
            : <BlockLog block={blocks[0]} loggedMap={loggedMap} executionId={executionId} sessionStarted={sessionStarted} />
          }
        </div>
      )}
    </div>
  )
}

// ── Session picker sheet ──────────────────────────────────────────────────────

function SessionPickerSheet({
  date,
  onClose,
  onScheduled,
}: {
  date: Date
  onClose: () => void
  onScheduled: () => void
}) {
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null)

  const { data: workouts = [], isLoading: loadingWorkouts } = useQuery<WorkoutListItem[]>({
    queryKey: ['workouts'],
    queryFn: () => apiFetch('/workouts'),
  })

  const { data: fullWorkout, isLoading: loadingFull } = useQuery<Workout>({
    queryKey: ['workout', selectedWorkout?.id],
    queryFn: () => apiFetch(`/workouts/${selectedWorkout!.id}`),
    enabled: selectedWorkout !== null,
  })

  const scheduleMutation = useMutation({
    mutationFn: ({ workoutId, sessionId }: { workoutId: number; sessionId: number }) =>
      apiFetch('/executions', {
        method: 'POST',
        body: JSON.stringify({ workoutId, sessionId, date: toDateString(date) }),
      }),
    onSuccess: () => { onScheduled(); onClose() },
  })

  const dateLabel = `${MONTH_LABELS[date.getMonth()]} ${date.getDate()}`

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full bg-white rounded-t-2xl max-h-[75vh] flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="px-5 pb-3 border-b border-gray-100 shrink-0">
          <p className="font-semibold text-gray-900">Plan a session</p>
          <p className="text-sm text-gray-400 mt-0.5">{dateLabel}</p>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4">
          {!selectedWorkout ? (
            /* Workout list */
            loadingWorkouts ? (
              <p className="text-center text-gray-400 text-sm py-6">Loading…</p>
            ) : workouts.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-6">No workouts yet. Create one first.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {workouts.map(w => (
                  <button
                    key={w.id}
                    onClick={() => setSelectedWorkout(w as unknown as Workout)}
                    className="flex items-center justify-between px-4 py-3.5 bg-gray-50 rounded-2xl text-left active:bg-gray-100"
                  >
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{w.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {w._count.sessions} {w._count.sessions === 1 ? 'day' : 'days'}
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            )
          ) : (
            /* Session list */
            <>
              <button
                onClick={() => setSelectedWorkout(null)}
                className="flex items-center gap-1 text-blue-500 text-sm mb-4"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {selectedWorkout.name}
              </button>

              {loadingFull ? (
                <p className="text-center text-gray-400 text-sm py-6">Loading…</p>
              ) : !fullWorkout || fullWorkout.sessions.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-6">This workout has no sessions yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {fullWorkout.sessions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => scheduleMutation.mutate({ workoutId: fullWorkout.id, sessionId: s.id })}
                      disabled={scheduleMutation.isPending}
                      className="flex items-center justify-between px-4 py-3.5 bg-gray-50 rounded-2xl text-left active:bg-gray-100 disabled:opacity-50"
                    >
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">
                          {s.name ?? `Day ${s.order}`}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {s.blocks.length} {s.blocks.length === 1 ? 'exercise' : 'exercises'}
                        </p>
                      </div>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const toast = useToast()
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState<Date>(today)
  const [pickerOpen, setPickerOpen] = useState(false)

  const weekDates = useMemo(() => {
    const ref = new Date(today)
    ref.setDate(today.getDate() + weekOffset * 7)
    return getWeekDates(ref)
  }, [weekOffset, today])

  function goToWeek(dir: 1 | -1) {
    const newOffset = weekOffset + dir
    setWeekOffset(newOffset)
    // Keep the same weekday in the new week
    const ref = new Date(today)
    ref.setDate(today.getDate() + newOffset * 7)
    const newWeek = getWeekDates(ref)
    setSelectedDate(newWeek[selectedDate.getDay()])
  }

  // Swipe detection
  const touchStartX = useRef<number | null>(null)
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(delta) > 50) goToWeek(delta < 0 ? 1 : -1)
    touchStartX.current = null
  }

  const from = toDateString(weekDates[0])
  const to = toDateString(weekDates[6])

  const qc = useQueryClient()

  const { data: executions = [] } = useQuery<CalendarExecution[]>({
    queryKey: ['calendar', from, to],
    queryFn: () => apiFetch(`/calendar?from=${from}&to=${to}`),
  })

  const startMutation = useMutation({
    mutationFn: (id: number) => apiFetch<CalendarExecution>(`/executions/${id}/start`, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }),
    onError: () => toast.show('Failed to start session'),
  })

  const finishMutation = useMutation({
    mutationFn: (id: number) => apiFetch<CalendarExecution>(`/executions/${id}/finish`, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }),
    onError: () => toast.show('Failed to end session'),
  })

  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/executions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar'] })
      setConfirmDelete(null)
    },
    onError: () => toast.show('Failed to remove session'),
  })

  // Map date string → execution
  const byDate = new Map<string, CalendarExecution>()
  for (const ex of executions) {
    byDate.set(toDateString(new Date(ex.date)), ex)
  }

  const selectedKey = toDateString(selectedDate)
  const selectedExecution = byDate.get(selectedKey) ?? null

  // Month/year label — show the month of the majority of the week
  const midWeek = weekDates[3]
  const monthLabel = `${MONTH_LABELS[midWeek.getMonth()]}'${String(midWeek.getFullYear()).slice(2)}`

  const sessionLabel = selectedExecution?.session
    ? selectedExecution.session.name ?? `Day ${selectedExecution.session.order}`
    : null

  const elapsed = useElapsed(selectedExecution?.startedAt ?? null)

  // Group blocks by supersetGroupId for display
  const blockGroups = useMemo(() => {
    const blocks = selectedExecution?.session?.blocks ?? []
    const groups: Block[][] = []
    for (const block of blocks) {
      if (block.supersetGroupId) {
        const existing = groups.find(g => g[0].supersetGroupId === block.supersetGroupId)
        if (existing) { existing.push(block); continue }
      }
      groups.push([block])
    }
    return groups
  }, [selectedExecution])

  // Map blockItemId → logged execution for quick lookup
  const loggedMap = useMemo(() => {
    const map = new Map<number, BlockExecution>()
    for (const be of selectedExecution?.blockExecutions ?? []) {
      map.set(be.workoutSessionBlockItemId, be)
    }
    return map
  }, [selectedExecution])

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* ── Week strip ──────────────────────────────────────────────────── */}
      <div
        className="bg-white shadow-sm px-4 pt-4 pb-3 select-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Month / year + nav arrows */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => goToWeek(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100 text-gray-400"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <p className="text-sm font-semibold text-gray-500 tracking-wide">{monthLabel}</p>
          <button
            onClick={() => goToWeek(1)}
            className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100 text-gray-400"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Day columns */}
        <div className="grid grid-cols-7 gap-1">
          {weekDates.map((d, i) => {
            const key = toDateString(d)
            const isToday = isSameDay(d, today)
            const isSelected = isSameDay(d, selectedDate)
            const hasExecution = byDate.has(key)

            return (
              <button
                key={key}
                onClick={() => setSelectedDate(d)}
                className="flex flex-col items-center gap-0.5 py-1"
              >
                {/* Day letter */}
                <span className="text-xs text-gray-400 font-medium">{DAY_LABELS[i]}</span>

                {/* Day number */}
                <span
                  className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-semibold transition-colors
                    ${isSelected
                      ? 'bg-blue-500 text-white'
                      : isToday
                        ? 'text-blue-500'
                        : 'text-gray-700'
                    }`}
                >
                  {d.getDate()}
                </span>

                {/* Dot indicator */}
                <span
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    hasExecution
                      ? isSelected ? 'bg-white' : 'bg-blue-400'
                      : 'bg-transparent'
                  }`}
                />
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Day content ─────────────────────────────────────────────────── */}
      <div className="flex-1 px-4 pt-5 pb-10">
        {selectedExecution ? (
          <div className="flex flex-col gap-4">
            {/* Workout + session name + delete */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xl font-bold text-gray-900">
                  {selectedExecution.workout.name}
                </p>
                {sessionLabel && (
                  <p className="text-sm text-gray-400 mt-0.5">{sessionLabel}</p>
                )}
              </div>
              {!selectedExecution.finishedAt && (
                <button
                  onClick={() => setConfirmDelete(selectedExecution.id)}
                  className="p-2 text-gray-300 active:text-red-400"
                  aria-label="Remove session"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>

            {/* Start / End button */}
            {!selectedExecution.startedAt ? (
              <button
                onClick={() => startMutation.mutate(selectedExecution.id)}
                disabled={startMutation.isPending}
                className="w-full py-3.5 bg-blue-500 text-white rounded-2xl font-semibold text-sm active:opacity-80 disabled:opacity-40 transition-opacity"
              >
                {startMutation.isPending ? 'Starting…' : 'Start Session'}
              </button>
            ) : !selectedExecution.finishedAt ? (
              <button
                onClick={() => finishMutation.mutate(selectedExecution.id)}
                disabled={finishMutation.isPending}
                className="w-full py-3.5 bg-red-500 text-white rounded-2xl font-semibold text-sm active:opacity-80 disabled:opacity-40 transition-opacity"
              >
                {finishMutation.isPending ? 'Finishing…' : elapsed ? `End Session (${elapsed})` : 'End Session'}
              </button>
            ) : (
              <div className="w-full py-3.5 bg-green-50 border border-green-200 rounded-2xl text-center">
                <span className="text-green-600 font-semibold text-sm">Session completed ✓</span>
              </div>
            )}

            {/* Exercise list */}
            {blockGroups.length > 0 && (
              <div className="bg-white rounded-2xl px-4 shadow-sm">
                {blockGroups.map((group) => (
                  <ExerciseGroupRow
                    key={group[0].id}
                    blocks={group}
                    loggedMap={loggedMap}
                    executionId={selectedExecution!.id}
                    initiallyOpen={!!selectedExecution.startedAt}
                    sessionStarted={!!selectedExecution.startedAt}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <p className="text-4xl">📅</p>
            <div>
              <p className="font-semibold text-gray-900">No session planned</p>
              <p className="text-gray-400 text-sm mt-1">
                {isSameDay(selectedDate, today)
                  ? 'Nothing scheduled for today'
                  : `Nothing on ${MONTH_LABELS[selectedDate.getMonth()]} ${selectedDate.getDate()}`}
              </p>
            </div>
            <button
              onClick={() => setPickerOpen(true)}
              className="px-6 py-3 bg-blue-500 text-white rounded-2xl font-semibold text-sm active:opacity-80 transition-opacity"
            >
              + Plan a Session
            </button>
          </div>
        )}
      </div>

      {pickerOpen && (
        <SessionPickerSheet
          date={selectedDate}
          onClose={() => setPickerOpen(false)}
          onScheduled={() => qc.invalidateQueries({ queryKey: ['calendar'] })}
        />
      )}

      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDelete(null)} />
          <div className="relative w-full bg-white rounded-t-2xl px-5 py-6 flex flex-col gap-3">
            <p className="font-semibold text-gray-900 text-center">Remove this session?</p>
            <p className="text-sm text-gray-400 text-center">Any logged sets will be lost.</p>
            <button
              onClick={() => deleteMutation.mutate(confirmDelete)}
              disabled={deleteMutation.isPending}
              className="w-full py-3 bg-red-500 text-white rounded-xl font-semibold active:opacity-80 disabled:opacity-40"
            >
              {deleteMutation.isPending ? 'Removing…' : 'Remove'}
            </button>
            <button
              onClick={() => setConfirmDelete(null)}
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
