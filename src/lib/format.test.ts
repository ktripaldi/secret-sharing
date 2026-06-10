import { describe, it, expect } from 'vitest'
import { formatDateTime } from './format.ts'

describe('formatDateTime', () => {
  it('formats an epoch into a localized date-time string', () => {
    const out = formatDateTime(Date.UTC(2031, 0, 2, 3, 4))
    expect(typeof out).toBe('string')
    expect(out).toMatch(/2031/)
  })
})
