import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import WorkoutsPage from '../pages/WorkoutsPage'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>{children}</a>
  ),
}))

vi.mock('../lib/api', () => ({ apiFetch: vi.fn() }))
import { apiFetch } from '../lib/api'

vi.mock('../lib/toast', () => ({
  useToast: () => ({ show: vi.fn() }),
}))

function renderWorkouts() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <WorkoutsPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('WorkoutsPage', () => {
  it('shows a loading indicator while the query is in flight', () => {
    vi.mocked(apiFetch).mockReturnValue(new Promise(() => {})) // never resolves
    renderWorkouts()
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows the empty state when the user has no workouts', async () => {
    vi.mocked(apiFetch).mockResolvedValue([])
    renderWorkouts()
    expect(await screen.findByText(/no workouts yet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create workout/i })).toBeInTheDocument()
  })

  it('renders the workout names returned by the API', async () => {
    vi.mocked(apiFetch).mockResolvedValue([
      { id: 1, name: 'Push Day', _count: { sessions: 3 } },
      { id: 2, name: 'Pull Day', _count: { sessions: 2 } },
    ])
    renderWorkouts()
    expect(await screen.findByText('Push Day')).toBeInTheDocument()
    expect(screen.getByText('Pull Day')).toBeInTheDocument()
  })
})
