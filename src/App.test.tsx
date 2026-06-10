import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'

vi.mock('@/lib/api-client.ts', () => ({
  ApiError: class ApiError extends Error {},
  createSecret: vi.fn(),
  peekSecret: vi.fn().mockResolvedValue({ viewsRemaining: 1, expiresAt: 1 }),
  revealSecret: vi.fn(),
}))

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('App routing', () => {
  it('renders the create form at /', () => {
    renderAt('/')
    expect(screen.getByLabelText(/secret/i)).toBeInTheDocument()
  })

  it('renders the view page (not the create form) at /s/:id', async () => {
    window.location.hash = '#KEY'
    renderAt('/s/ID')
    expect(screen.queryByRole('textbox', { name: /secret/i })).not.toBeInTheDocument()
    expect(await screen.findByText(/received a secret/i)).toBeInTheDocument()
  })
})
