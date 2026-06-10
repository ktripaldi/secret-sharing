import { describe, it, expect } from 'vitest'
import { generateId, hashId } from './ids.ts'

describe('ids', () => {
  it('generateId returns a unique, URL-safe, high-entropy token', () => {
    const a = generateId()
    const b = generateId()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/) // base64url, no padding
    expect(a.length).toBeGreaterThanOrEqual(43) // 32 bytes -> 43 base64url chars
  })

  it('hashId is a deterministic 64-char hex SHA-256', () => {
    const id = 'example-token'
    expect(hashId(id)).toBe(hashId(id))
    expect(hashId(id)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashId('a')).not.toBe(hashId('b'))
  })
})
