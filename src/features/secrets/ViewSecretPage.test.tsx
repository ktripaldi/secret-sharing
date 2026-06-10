import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ViewSecretPage } from './ViewSecretPage.tsx'
import { usePeekSecret, useRevealSecret } from './use-secrets.ts'
import { ApiError } from '@/lib/api-client.ts'

vi.mock('./use-secrets.ts', () => ({ usePeekSecret: vi.fn(), useRevealSecret: vi.fn() }))

const mockedPeek = vi.mocked(usePeekSecret)
const mockedReveal = vi.mocked(useRevealSecret)

function stubPeek(value: Record<string, unknown> = {}) {
  mockedPeek.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    ...value,
  } as unknown as ReturnType<typeof usePeekSecret>)
}

function stubReveal(value: Record<string, unknown> = {}) {
  mockedReveal.mockReturnValue({
    mutate: vi.fn(),
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    ...value,
  } as unknown as ReturnType<typeof useRevealSecret>)
}

function renderView() {
  return render(
    <MemoryRouter initialEntries={['/s/ID']}>
      <Routes>
        <Route path="/s/:id" element={<ViewSecretPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  window.location.hash = '#KEY'
})

describe('ViewSecretPage', () => {
  it('offers a reveal button showing remaining views', () => {
    stubPeek({ data: { viewsRemaining: 2, expiresAt: 1 } })
    stubReveal()
    renderView()
    expect(screen.getByRole('button', { name: /reveal/i })).toBeInTheDocument()
    expect(screen.getByText(/2/)).toBeInTheDocument()
  })

  it('triggers reveal with the id and fragment key on click', async () => {
    const mutate = vi.fn()
    stubPeek({ data: { viewsRemaining: 1, expiresAt: 1 } })
    stubReveal({ mutate })
    renderView()
    await userEvent.click(screen.getByRole('button', { name: /reveal/i }))
    expect(mutate).toHaveBeenCalledWith({ id: 'ID', key: 'KEY' })
  })

  it('shows the revealed secret and a destroyed note', () => {
    stubPeek({ data: { viewsRemaining: 1, expiresAt: 1 } })
    stubReveal({ data: 'the password' })
    renderView()
    expect(screen.getByText('the password')).toBeInTheDocument()
    expect(screen.getByText(/destroyed/i)).toBeInTheDocument()
  })

  it('warns when the link is missing its key', () => {
    window.location.hash = ''
    stubPeek()
    stubReveal()
    renderView()
    expect(screen.getByRole('alert')).toHaveTextContent(/key/i)
  })

  it('shows an unavailable message when the secret is gone', () => {
    stubPeek({ isError: true, error: new ApiError(410, 'gone', 'gone') })
    stubReveal()
    renderView()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows a loading state while peeking', () => {
    stubPeek({ isLoading: true })
    stubReveal()
    renderView()
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
})
