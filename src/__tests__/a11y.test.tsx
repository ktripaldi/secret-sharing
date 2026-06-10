import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import axe from 'axe-core'
import { CreateSecretPage } from '@/features/secrets/CreateSecretPage.tsx'
import { ViewSecretPage } from '@/features/secrets/ViewSecretPage.tsx'
import {
  useCreateSecret,
  usePeekSecret,
  useRevealSecret,
} from '@/features/secrets/use-secrets.ts'

vi.mock('@/features/secrets/use-secrets.ts', () => ({
  useCreateSecret: vi.fn(),
  usePeekSecret: vi.fn(),
  useRevealSecret: vi.fn(),
}))

// Restrict to WCAG A/AA (best-practice "region" landmark rule would false-positive
// on a page rendered without the app shell); color-contrast needs real layout.
async function violations(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: ['wcag2a', 'wcag2aa'],
    rules: { 'color-contrast': { enabled: false } },
  })
  return results.violations
}

beforeEach(() => {
  vi.mocked(useCreateSecret).mockReturnValue({
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    isError: false,
    data: undefined,
  } as unknown as ReturnType<typeof useCreateSecret>)
  vi.mocked(usePeekSecret).mockReturnValue({
    data: { viewsRemaining: 1, expiresAt: 1_700_000_100_000 },
    isLoading: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof usePeekSecret>)
  vi.mocked(useRevealSecret).mockReturnValue({
    mutate: vi.fn(),
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useRevealSecret>)
  window.location.hash = '#KEY'
})

describe('accessibility (axe, WCAG A/AA)', () => {
  it('CreateSecretPage has no violations', async () => {
    const { container } = render(<CreateSecretPage />)
    expect(await violations(container)).toEqual([])
  })

  it('ViewSecretPage has no violations', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/s/ID']}>
        <Routes>
          <Route path="/s/:id" element={<ViewSecretPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await violations(container)).toEqual([])
  })
})
