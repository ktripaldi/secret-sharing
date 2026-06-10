import { describe, it, expect } from 'vitest'
import { buildShareLink, readKeyFromHash } from './secret-link.ts'

describe('secret-link', () => {
  it('builds a share link with the key in the URL fragment', () => {
    const link = buildShareLink({ origin: 'https://x.app', id: 'abc-_123', key: 'KEY' })
    expect(link).toBe('https://x.app/s/abc-_123#KEY')
  })

  it('reads the key from a location hash', () => {
    expect(readKeyFromHash('#KEY')).toBe('KEY')
  })

  it('returns null when there is no key', () => {
    expect(readKeyFromHash('')).toBeNull()
    expect(readKeyFromHash('#')).toBeNull()
  })
})
