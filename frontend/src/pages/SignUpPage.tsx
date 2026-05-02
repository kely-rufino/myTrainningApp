import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { meQueryOptions } from '../lib/queries'
import type { User } from '../lib/types'

function hasSequentialDigits(pw: string): boolean {
  for (let i = 0; i < pw.length - 3; i++) {
    const a = pw.charCodeAt(i)
    if (a < 48 || a > 57) continue
    if (
      pw.charCodeAt(i + 1) === a + 1 &&
      pw.charCodeAt(i + 2) === a + 2 &&
      pw.charCodeAt(i + 3) === a + 3
    ) return true
  }
  return false
}

function passwordRules(pw: string) {
  return {
    length:    pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    special:   /[^a-zA-Z0-9]/.test(pw),
    noSeq:     !hasSequentialDigits(pw),
  }
}

export default function SignUpPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pwTouched, setPwTouched] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const rules = passwordRules(form.password)
  const allRulesPass = Object.values(rules).every(Boolean)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!allRulesPass) {
      setError('Password does not meet all requirements')
      return
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const user = await apiFetch<User>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
        }),
      })
      queryClient.setQueryData(meQueryOptions.queryKey, user)
      navigate({ to: '/' })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col px-6 pt-12 pb-10">
      <div className="mb-8">
        <p className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-2">MyTraining</p>
        <h1 className="text-3xl font-bold text-gray-900">Create account</h1>
        <p className="text-gray-500 mt-1">Start tracking your workouts</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">First name</label>
          <input
            type="text"
            value={form.name}
            onChange={set('name')}
            placeholder="John"
            required
            autoComplete="given-name"
            className="bg-gray-100 rounded-2xl px-4 py-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Last name</label>
          <input
            type="text"
            value={form.lastName}
            onChange={set('lastName')}
            placeholder="Doe"
            required
            autoComplete="family-name"
            className="bg-gray-100 rounded-2xl px-4 py-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={set('email')}
            placeholder="you@example.com"
            required
            autoComplete="email"
            className="bg-gray-100 rounded-2xl px-4 py-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={set('password')}
              onFocus={() => setPwTouched(true)}
              placeholder="Min. 8 characters"
              required
              autoComplete="new-password"
              className="w-full bg-gray-100 rounded-2xl px-4 py-4 pr-12 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 active:text-gray-600"
              tabIndex={-1}
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          {pwTouched && (
            <ul className="mt-2 flex flex-col gap-1 px-1">
              {([
                [rules.length,    'At least 8 characters'],
                [rules.uppercase, 'At least 1 capital letter'],
                [rules.special,   'At least 1 special character (!@#$…)'],
                [rules.noSeq,     'No sequential numbers (1234, 2345…)'],
              ] as [boolean, string][]).map(([ok, label]) => (
                <li key={label} className={`flex items-center gap-2 text-xs ${ok ? 'text-green-600' : 'text-gray-400'}`}>
                  <span className="text-base leading-none">{ok ? '✓' : '○'}</span>
                  {label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Confirm password</label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              placeholder="••••••••"
              required
              autoComplete="new-password"
              className="w-full bg-gray-100 rounded-2xl px-4 py-4 pr-12 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 active:text-gray-600"
              tabIndex={-1}
            >
              {showConfirm ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {error && (
          <p className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white font-semibold py-4 rounded-2xl mt-2 disabled:opacity-50 active:scale-95 transition-transform"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="text-center text-gray-500 text-sm mt-auto pt-8">
        Already have an account?{' '}
        <Link to="/login" className="text-blue-600 font-semibold">
          Sign in
        </Link>
      </p>
    </div>
  )
}
