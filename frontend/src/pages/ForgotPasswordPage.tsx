import { useState } from 'react'
import { Link } from '@tanstack/react-router'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: wire up email delivery
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col px-6 pt-16 pb-10">
      <div className="mb-10">
        <p className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-2">MyTraining</p>
        <h1 className="text-3xl font-bold text-gray-900">Reset password</h1>
        <p className="text-gray-500 mt-1">
          We'll send you a link to reset your password.
        </p>
      </div>

      {submitted ? (
        <div className="bg-green-50 rounded-2xl px-5 py-6 text-center">
          <p className="text-2xl mb-2">📬</p>
          <p className="font-semibold text-gray-900">Check your inbox</p>
          <p className="text-gray-500 text-sm mt-1">
            If <span className="font-medium text-gray-700">{email}</span> is registered, you'll receive a reset link shortly.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="bg-gray-100 rounded-2xl px-4 py-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-semibold py-4 rounded-2xl mt-2 active:scale-95 transition-transform"
          >
            Send reset link
          </button>
        </form>
      )}

      <p className="text-center text-gray-500 text-sm mt-auto pt-8">
        <Link to="/login" className="text-blue-600 font-semibold">
          ← Back to sign in
        </Link>
      </p>
    </div>
  )
}
