import { describe, it, expect, vi, afterEach } from 'vitest'
import { createSecret, peekSecret, revealSecret, ApiError } from './api-client.ts'

function mockFetch(status: number, json: unknown) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(json), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('api-client', () => {
  it('createSecret POSTs the input and returns the parsed response', async () => {
    const fetchMock = mockFetch(201, { id: 'abc', expiresAt: 123 })
    vi.stubGlobal('fetch', fetchMock)
    const res = await createSecret({ ciphertext: 'c', iv: 'i' })
    expect(res.id).toBe('abc')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/secrets',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('peekSecret GETs by id', async () => {
    const fetchMock = mockFetch(200, { viewsRemaining: 2, expiresAt: 1 })
    vi.stubGlobal('fetch', fetchMock)
    const res = await peekSecret('abc')
    expect(res.viewsRemaining).toBe(2)
    expect(fetchMock).toHaveBeenCalledWith('/api/secrets/abc', undefined)
  })

  it('revealSecret POSTs to the reveal endpoint', async () => {
    const fetchMock = mockFetch(200, { ciphertext: 'ct', iv: 'iv' })
    vi.stubGlobal('fetch', fetchMock)
    const res = await revealSecret('abc')
    expect(res.ciphertext).toBe('ct')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/secrets/abc/reveal',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('throws ApiError carrying the server error code on failure', async () => {
    vi.stubGlobal('fetch', mockFetch(410, { error: { code: 'gone', message: 'no' } }))
    await expect(revealSecret('abc')).rejects.toBeInstanceOf(ApiError)
    await expect(revealSecret('abc')).rejects.toMatchObject({ code: 'gone', status: 410 })
  })
})
