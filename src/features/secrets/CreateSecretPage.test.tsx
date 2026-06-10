import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateSecretPage } from './CreateSecretPage.tsx'
import { useCreateSecret } from './use-secrets.ts'

vi.mock('./use-secrets.ts', () => ({ useCreateSecret: vi.fn() }))

const mockedUseCreate = vi.mocked(useCreateSecret)

function stubCreate(value: Record<string, unknown> = {}) {
  mockedUseCreate.mockReturnValue({
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    isError: false,
    data: undefined,
    ...value,
  } as unknown as ReturnType<typeof useCreateSecret>)
}

describe('CreateSecretPage', () => {
  it('renders a labeled secret field and a create button', () => {
    stubCreate()
    render(<CreateSecretPage />)
    expect(screen.getByLabelText(/secret/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create link/i })).toBeInTheDocument()
  })

  it('submits the entered secret to the mutation', async () => {
    const mutate = vi.fn()
    stubCreate({ mutate })
    render(<CreateSecretPage />)
    await userEvent.type(screen.getByLabelText(/secret/i), 'my secret')
    await userEvent.click(screen.getByRole('button', { name: /create link/i }))
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ plaintext: 'my secret' }))
  })

  it('does not submit an empty secret', async () => {
    const mutate = vi.fn()
    stubCreate({ mutate })
    render(<CreateSecretPage />)
    await userEvent.click(screen.getByRole('button', { name: /create link/i }))
    expect(mutate).not.toHaveBeenCalled()
  })

  it('shows the share link once created', () => {
    stubCreate({ data: { link: 'https://x/s/ID#KEY', expiresAt: 1_700_000_100_000 } })
    render(<CreateSecretPage />)
    expect(screen.getByDisplayValue('https://x/s/ID#KEY')).toBeInTheDocument()
  })

  it('shows an error alert on failure', () => {
    stubCreate({ isError: true })
    render(<CreateSecretPage />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
