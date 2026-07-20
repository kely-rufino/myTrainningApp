import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { apiTokensQueryOptions } from '../lib/queries'
import { apiFetch } from '../lib/api'
import { useToast } from '../lib/toast'
import type { ApiToken, CreatedApiToken } from '../lib/types'

const EXPIRY_OPTIONS: { label: string; days: number | undefined }[] = [
  { label: 'No expiry', days: undefined },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── Generate token sheet ─────────────────────────────────────────────────────

function GenerateTokenSheet({
  onCreate,
  onClose,
  isPending,
}: {
  onCreate: (name: string, expiresInDays: number | undefined) => void
  onClose: () => void
  isPending: boolean
}) {
  const [name, setName] = useState('')
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(undefined)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onCreate(name.trim(), expiresInDays)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-2xl px-5 py-6 flex flex-col gap-4">
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto" />
        <p className="font-semibold text-gray-900">New agent token</p>
        <p className="text-sm text-gray-400 -mt-2">
          Lets an MCP-compatible agent (Claude Code, Claude Desktop, etc.) manage your workouts on your behalf.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            autoFocus
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Claude Desktop"
            className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm outline-none placeholder-gray-400"
          />
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {EXPIRY_OPTIONS.map(opt => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setExpiresInDays(opt.days)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  expiresInDays === opt.days ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
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
              disabled={!name.trim() || isPending}
              className="flex-1 py-3 rounded-2xl bg-blue-500 text-white font-semibold text-sm disabled:opacity-40"
            >
              {isPending ? 'Generating…' : 'Generate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Reveal-once sheet ─────────────────────────────────────────────────────────

function TokenRevealSheet({ token, onClose }: { token: CreatedApiToken; onClose: () => void }) {
  const toast = useToast()

  async function copy() {
    await navigator.clipboard.writeText(token.token)
    toast.show('Copied to clipboard', 'success')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full bg-white rounded-t-2xl px-5 py-6 flex flex-col gap-4">
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto" />
        <p className="font-semibold text-gray-900">{token.name}</p>
        <p className="text-sm text-red-500">
          Copy this token now — you won't be able to see it again.
        </p>
        <button
          onClick={copy}
          className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm font-mono text-gray-900 text-left break-all active:opacity-70"
        >
          {token.token}
        </button>
        <button onClick={copy} className="w-full py-3 rounded-2xl bg-blue-500 text-white font-semibold text-sm">
          Copy token
        </button>
        <button onClick={onClose} className="w-full py-3 text-gray-500 font-semibold text-sm">
          Done
        </button>
      </div>
    </div>
  )
}

// ── Revoke confirm ────────────────────────────────────────────────────────────

function RevokeConfirmSheet({
  tokenName,
  onConfirm,
  onClose,
  isPending,
}: {
  tokenName: string
  onConfirm: () => void
  onClose: () => void
  isPending: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-2xl px-5 py-6 flex flex-col gap-3">
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto" />
        <p className="font-semibold text-gray-900 text-center">Revoke "{tokenName}"?</p>
        <p className="text-sm text-gray-400 text-center">
          Any agent using this token will immediately lose access to your account.
        </p>
        <button
          onClick={onConfirm}
          disabled={isPending}
          className="w-full py-3 bg-red-500 text-white rounded-xl font-semibold active:opacity-80 disabled:opacity-40 mt-2"
        >
          {isPending ? 'Revoking…' : 'Yes, revoke'}
        </button>
        <button onClick={onClose} className="w-full py-3 text-gray-500 font-semibold">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main section ──────────────────────────────────────────────────────────────

export function ApiTokensSection() {
  const qc = useQueryClient()
  const toast = useToast()
  const { data: tokens } = useQuery(apiTokensQueryOptions)

  const [generating, setGenerating] = useState(false)
  const [revealedToken, setRevealedToken] = useState<CreatedApiToken | null>(null)
  const [revoking, setRevoking] = useState<ApiToken | null>(null)

  const createMutation = useMutation({
    mutationFn: (data: { name: string; expiresInDays?: number }) =>
      apiFetch<CreatedApiToken>('/tokens', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: created => {
      qc.invalidateQueries({ queryKey: ['apiTokens'] })
      setGenerating(false)
      setRevealedToken(created)
    },
    onError: () => toast.show('Could not generate token'),
  })

  const revokeMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/tokens/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apiTokens'] })
      setRevoking(null)
    },
    onError: () => toast.show('Could not revoke token'),
  })

  return (
    <>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1">Connected agents</p>
      <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100 overflow-hidden">
        {tokens?.length === 0 && (
          <p className="px-4 py-3.5 text-sm text-gray-400">No agent tokens yet.</p>
        )}
        {tokens?.map(t => (
          <div key={t.id} className="px-4 py-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-gray-900 truncate">{t.name}</p>
              <p className="text-xs text-gray-400 font-mono truncate">
                {t.tokenPrefix}… · {t.lastUsedAt ? `used ${formatDate(t.lastUsedAt)}` : 'never used'}
                {t.expiresAt ? ` · expires ${formatDate(t.expiresAt)}` : ''}
              </p>
            </div>
            <button
              onClick={() => setRevoking(t)}
              className="shrink-0 text-xs font-semibold text-red-500 px-3 py-1.5 rounded-lg active:bg-red-50"
            >
              Revoke
            </button>
          </div>
        ))}
        <button
          onClick={() => setGenerating(true)}
          className="w-full px-4 py-3.5 text-sm font-semibold text-blue-500 text-left active:bg-gray-50"
        >
          + Generate new token
        </button>
      </div>

      {generating && (
        <GenerateTokenSheet
          isPending={createMutation.isPending}
          onClose={() => setGenerating(false)}
          onCreate={(name, expiresInDays) => createMutation.mutate({ name, expiresInDays })}
        />
      )}

      {revealedToken && <TokenRevealSheet token={revealedToken} onClose={() => setRevealedToken(null)} />}

      {revoking && (
        <RevokeConfirmSheet
          tokenName={revoking.name}
          isPending={revokeMutation.isPending}
          onClose={() => setRevoking(null)}
          onConfirm={() => revokeMutation.mutate(revoking.id)}
        />
      )}
    </>
  )
}
