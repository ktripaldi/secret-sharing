import { describe, it, expect } from 'vitest'
import { createSecretSchema } from './contract.ts'
import {
  DEFAULT_MAX_VIEWS,
  MAX_VIEWS,
  TTL_OPTIONS,
  MAX_CIPHERTEXT_B64_LENGTH,
} from './constants.ts'

const validIv = 'A'.repeat(16) // 12 bytes -> 16 base64 chars, no padding
const validBody = {
  ciphertext: 'AQIDBA==',
  iv: validIv,
  ttlSeconds: TTL_OPTIONS['1d'],
  maxViews: 2,
}

describe('createSecretSchema', () => {
  it('accepts a valid body', () => {
    const parsed = createSecretSchema.parse(validBody)
    expect(parsed.maxViews).toBe(2)
    expect(parsed.ttlSeconds).toBe(TTL_OPTIONS['1d'])
    expect(parsed.ciphertext).toBe('AQIDBA==')
  })

  it('applies defaults when ttlSeconds and maxViews are omitted', () => {
    const parsed = createSecretSchema.parse({ ciphertext: 'AQIDBA==', iv: validIv })
    expect(parsed.maxViews).toBe(DEFAULT_MAX_VIEWS)
    expect(parsed.ttlSeconds).toBe(TTL_OPTIONS['1d'])
  })

  it('rejects a ttl outside the allow-list', () => {
    expect(() => createSecretSchema.parse({ ...validBody, ttlSeconds: 999 })).toThrow()
  })

  it('rejects maxViews above the max', () => {
    expect(() => createSecretSchema.parse({ ...validBody, maxViews: MAX_VIEWS + 1 })).toThrow()
  })

  it('rejects maxViews below 1', () => {
    expect(() => createSecretSchema.parse({ ...validBody, maxViews: 0 })).toThrow()
  })

  it('rejects an iv of the wrong length', () => {
    expect(() => createSecretSchema.parse({ ...validBody, iv: 'AAAA' })).toThrow()
  })

  it('rejects a non-base64 ciphertext', () => {
    expect(() => createSecretSchema.parse({ ...validBody, ciphertext: 'not base64!!' })).toThrow()
  })

  it('rejects ciphertext over the size cap', () => {
    const tooBig = 'A'.repeat(MAX_CIPHERTEXT_B64_LENGTH + 4)
    expect(() => createSecretSchema.parse({ ...validBody, ciphertext: tooBig })).toThrow()
  })

  it('strips unknown keys', () => {
    const parsed = createSecretSchema.parse({ ...validBody, evil: 'x' }) as Record<string, unknown>
    expect(parsed.evil).toBeUndefined()
  })
})
