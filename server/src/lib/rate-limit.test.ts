import { describe, it, expect } from 'vitest'
import { createRateLimiter } from './rate-limit.ts'

describe('createRateLimiter', () => {
  it('allows up to capacity, then blocks with a positive retry hint', () => {
    const rl = createRateLimiter({ capacity: 2, refillPerSecond: 1 })
    expect(rl.check('ip', 1000).allowed).toBe(true)
    expect(rl.check('ip', 1000).allowed).toBe(true)
    const blocked = rl.check('ip', 1000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('refills over time', () => {
    const rl = createRateLimiter({ capacity: 1, refillPerSecond: 1 })
    expect(rl.check('ip', 0).allowed).toBe(true)
    expect(rl.check('ip', 0).allowed).toBe(false)
    expect(rl.check('ip', 1000).allowed).toBe(true) // 1s later -> 1 token back
  })

  it('keeps a separate bucket per key', () => {
    const rl = createRateLimiter({ capacity: 1, refillPerSecond: 1 })
    expect(rl.check('a', 0).allowed).toBe(true)
    expect(rl.check('b', 0).allowed).toBe(true)
  })
})
