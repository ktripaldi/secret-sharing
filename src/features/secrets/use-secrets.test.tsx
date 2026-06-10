import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useCreateSecret, usePeekSecret, useRevealSecret } from './use-secrets.ts'
import * as api from '@/lib/api-client.ts'
import * as cryptoLib from '@/lib/crypto.ts'

vi.mock('@/lib/api-client.ts')
vi.mock('@/lib/crypto.ts')

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  vi.mocked(cryptoLib.encryptSecret).mockResolvedValue({ ciphertext: 'CT', iv: 'IV', key: 'KEY' })
  vi.mocked(cryptoLib.decryptSecret).mockResolvedValue('PLAINTEXT')
  vi.mocked(api.createSecret).mockResolvedValue({ id: 'ID', expiresAt: 999 })
  vi.mocked(api.peekSecret).mockResolvedValue({ viewsRemaining: 2, expiresAt: 999 })
  vi.mocked(api.revealSecret).mockResolvedValue({ ciphertext: 'CT', iv: 'IV' })
})

describe('useCreateSecret', () => {
  it('encrypts, posts, and returns a link with the key in the fragment', async () => {
    const { result } = renderHook(() => useCreateSecret(), { wrapper: makeWrapper() })
    const created = await result.current.mutateAsync({ plaintext: 'hi', ttl: '1d', maxViews: 1 })
    expect(cryptoLib.encryptSecret).toHaveBeenCalledWith('hi')
    expect(api.createSecret).toHaveBeenCalledWith(
      expect.objectContaining({ ciphertext: 'CT', iv: 'IV', maxViews: 1 }),
    )
    expect(created.link).toContain('/s/ID#KEY')
    expect(created.expiresAt).toBe(999)
  })
})

describe('usePeekSecret', () => {
  it('fetches peek metadata for a real id', async () => {
    const { result } = renderHook(() => usePeekSecret('ID'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.viewsRemaining).toBe(2)
  })

  it('is disabled for an empty id', () => {
    const { result } = renderHook(() => usePeekSecret(''), { wrapper: makeWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
    expect(api.peekSecret).not.toHaveBeenCalled()
  })
})

describe('useRevealSecret', () => {
  it('reveals then decrypts with the provided key', async () => {
    const { result } = renderHook(() => useRevealSecret(), { wrapper: makeWrapper() })
    const plaintext = await result.current.mutateAsync({ id: 'ID', key: 'KEY' })
    expect(api.revealSecret).toHaveBeenCalledWith('ID')
    expect(cryptoLib.decryptSecret).toHaveBeenCalledWith({ ciphertext: 'CT', iv: 'IV', key: 'KEY' })
    expect(plaintext).toBe('PLAINTEXT')
  })
})
