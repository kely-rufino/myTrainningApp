import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { meQueryOptions } from '../lib/queries'
import { apiFetch } from '../lib/api'
import type { User } from '../lib/types'

// ── Field row ─────────────────────────────────────────────────────────────────

function FieldRow({
  label,
  value,
  onEdit,
}: {
  label: string
  value: string
  onEdit: () => void
}) {
  return (
    <button
      onClick={onEdit}
      className="w-full flex items-center justify-between px-4 py-3.5 active:bg-gray-50 transition-colors"
    >
      <span className="text-sm text-gray-500 w-28 shrink-0 text-left">{label}</span>
      <span className="flex-1 text-sm text-gray-900 text-right truncate pr-2">
        {value || <span className="text-gray-300">—</span>}
      </span>
      <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

// ── Edit sheet ────────────────────────────────────────────────────────────────

type EditField = {
  key: keyof User
  label: string
  type?: 'text' | 'email' | 'number' | 'date' | 'url'
  placeholder?: string
}

function EditSheet({
  field,
  currentValue,
  onSave,
  onClose,
}: {
  field: EditField
  currentValue: string
  onSave: (value: string) => void
  onClose: () => void
}) {
  const [value, setValue] = useState(currentValue)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave(value)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-2xl px-5 py-6 flex flex-col gap-4">
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto" />
        <p className="font-semibold text-gray-900">{field.label}</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            autoFocus
            type={field.type ?? 'text'}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={field.placeholder}
            className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm outline-none placeholder-gray-400"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-500 font-semibold text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-2xl bg-blue-500 text-white font-semibold text-sm"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Delete confirm ────────────────────────────────────────────────────────────

function DeleteAccountSheet({ onConfirm, onClose, isPending }: { onConfirm: () => void; onClose: () => void; isPending: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-2xl px-5 py-6 flex flex-col gap-3">
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto" />
        <p className="font-semibold text-gray-900 text-center">Delete account?</p>
        <p className="text-sm text-gray-400 text-center">This will permanently delete your account and all your data. This cannot be undone.</p>
        <button
          onClick={onConfirm}
          disabled={isPending}
          className="w-full py-3 bg-red-500 text-white rounded-xl font-semibold active:opacity-80 disabled:opacity-40 mt-2"
        >
          {isPending ? 'Deleting…' : 'Yes, delete my account'}
        </button>
        <button onClick={onClose} className="w-full py-3 text-gray-500 font-semibold">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const WEEK_DAYS = ['Sunday', 'Monday']
const UNITS = ['metric', 'imperial']

export default function ProfilePage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data: user } = useSuspenseQuery(meQueryOptions)

  const [editingField, setEditingField] = useState<EditField | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const updateMutation = useMutation({
    mutationFn: (data: Partial<User>) =>
      apiFetch<User>('/profile', { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: (updated) => {
      qc.setQueryData(['me'], updated)
      setEditingField(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch('/profile', { method: 'DELETE' }),
    onSuccess: () => {
      qc.clear()
      navigate({ to: '/login' })
    },
  })

  function saveField(key: keyof User, raw: string) {
    let value: string | number | null = raw.trim() || null
    if ((key === 'weight' || key === 'height') && raw.trim()) value = Number(raw)
    if (key === 'weekStartDay' && raw.trim()) value = Number(raw)
    updateMutation.mutate({ [key]: value } as Partial<User>)
  }

  const isMetric = (user.unitPreference ?? 'metric') === 'metric'
  const weightUnit = isMetric ? 'kg' : 'lbs'
  const heightUnit = isMetric ? 'cm' : 'in'

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-24">

      {/* Personal info */}
      <div className="px-4 pt-5 flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1">Personal</p>
        <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100 overflow-hidden">
          <FieldRow
            label="First name"
            value={user.name}
            onEdit={() => setEditingField({ key: 'name', label: 'First name', placeholder: 'First name' })}
          />
          <FieldRow
            label="Last name"
            value={user.lastName}
            onEdit={() => setEditingField({ key: 'lastName', label: 'Last name', placeholder: 'Last name' })}
          />
          <FieldRow
            label="Email"
            value={user.email}
            onEdit={() => setEditingField({ key: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' })}
          />
          <FieldRow
            label="Date of birth"
            value={user.dateOfBirth ?? ''}
            onEdit={() => setEditingField({ key: 'dateOfBirth', label: 'Date of birth', type: 'date' })}
          />
        </div>

        {/* Body metrics */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1">Body</p>
        <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100 overflow-hidden">
          <FieldRow
            label={`Weight (${weightUnit})`}
            value={user.weight != null ? String(user.weight) : ''}
            onEdit={() => setEditingField({ key: 'weight', label: `Weight (${weightUnit})`, type: 'number', placeholder: isMetric ? '70' : '154' })}
          />
          <FieldRow
            label={`Height (${heightUnit})`}
            value={user.height != null ? String(user.height) : ''}
            onEdit={() => setEditingField({ key: 'height', label: `Height (${heightUnit})`, type: 'number', placeholder: isMetric ? '175' : '69' })}
          />
        </div>

        {/* Preferences */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1">Preferences</p>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
          {/* Unit preference */}
          <div className="px-4 py-3.5 flex items-center justify-between">
            <span className="text-sm text-gray-500">Units</span>
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {UNITS.map(u => (
                <button
                  key={u}
                  onClick={() => updateMutation.mutate({ unitPreference: u })}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    (user.unitPreference ?? 'metric') === u
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-400'
                  }`}
                >
                  {u.charAt(0).toUpperCase() + u.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Week starts on */}
          <div className="px-4 py-3.5 flex items-center justify-between">
            <span className="text-sm text-gray-500">Week starts on</span>
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {WEEK_DAYS.map((day, idx) => (
                <button
                  key={day}
                  onClick={() => updateMutation.mutate({ weekStartDay: idx })}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    (user.weekStartDay ?? 1) === idx
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-400'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Danger zone */}
        <div className="mt-2">
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-full py-4 bg-white rounded-2xl shadow-sm text-red-500 font-semibold text-sm active:opacity-70 transition-opacity"
          >
            Delete Account
          </button>
        </div>
      </div>

      {/* Edit sheet */}
      {editingField && (
        <EditSheet
          field={editingField}
          currentValue={
            editingField.key === 'weight' || editingField.key === 'height'
              ? user[editingField.key] != null ? String(user[editingField.key]) : ''
              : (user[editingField.key] as string | null) ?? ''
          }
          onSave={val => saveField(editingField.key, val)}
          onClose={() => setEditingField(null)}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <DeleteAccountSheet
          onConfirm={() => deleteMutation.mutate()}
          onClose={() => setConfirmDelete(false)}
          isPending={deleteMutation.isPending}
        />
      )}
    </div>
  )
}
