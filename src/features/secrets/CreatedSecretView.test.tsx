import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreatedSecretView } from './CreatedSecretView.tsx'

const EXPIRES = 1_700_000_100_000

describe('CreatedSecretView', () => {
  it('shows the link and copies it to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(
      <CreatedSecretView link="https://x/s/ID#KEY" expiresAt={EXPIRES} maxViews={1} onReset={vi.fn()} />,
    )

    expect(screen.getByDisplayValue('https://x/s/ID#KEY')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /copy link/i }))
    expect(writeText).toHaveBeenCalledWith('https://x/s/ID#KEY')
    expect(screen.getByRole('button', { name: /copy link/i })).toHaveTextContent(/copied/i)
  })

  it('calls onReset from "Create another"', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn() } })
    const onReset = vi.fn()
    render(<CreatedSecretView link="l" expiresAt={EXPIRES} maxViews={2} onReset={onReset} />)
    await userEvent.click(screen.getByRole('button', { name: /create another/i }))
    expect(onReset).toHaveBeenCalledOnce()
  })
})
