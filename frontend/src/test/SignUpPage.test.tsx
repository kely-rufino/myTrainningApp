import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SignUpPage from '../pages/SignUpPage'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>{children}</a>
  ),
}))

vi.mock('../lib/api', () => ({ apiFetch: vi.fn() }))
import { apiFetch } from '../lib/api'

function renderSignUp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SignUpPage />
    </QueryClientProvider>,
  )
}

async function fillRequiredFields(overrides: { password?: string; confirm?: string } = {}) {
  await userEvent.type(screen.getByPlaceholderText('John'), 'Jane')
  await userEvent.type(screen.getByPlaceholderText('Doe'), 'Smith')
  await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'jane@test.com')
  await userEvent.type(screen.getByPlaceholderText('Min. 8 characters'), overrides.password ?? 'Secure@57!')
  await userEvent.type(screen.getByPlaceholderText('••••••••'), overrides.confirm ?? 'Secure@57!')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SignUpPage', () => {
  it('renders all form fields', () => {
    renderSignUp()
    expect(screen.getByPlaceholderText('John')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('shows password rule indicators once the password field is touched', async () => {
    renderSignUp()
    await userEvent.type(screen.getByPlaceholderText('Min. 8 characters'), 'a')

    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    expect(screen.getByText(/capital letter/i)).toBeInTheDocument()
    expect(screen.getByText(/special character/i)).toBeInTheDocument()
    expect(screen.getByText(/sequential numbers/i)).toBeInTheDocument()
  })

  it('shows an error when passwords do not match', async () => {
    renderSignUp()
    await fillRequiredFields({ password: 'Secure@57!', confirm: 'Different@57!' })
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    })
  })

  it('shows a client-side error when the password does not meet requirements', async () => {
    renderSignUp()
    await fillRequiredFields({ password: 'weak', confirm: 'weak' })
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText(/does not meet all requirements/i)).toBeInTheDocument()
    })
    expect(apiFetch).not.toHaveBeenCalled()
  })
})
