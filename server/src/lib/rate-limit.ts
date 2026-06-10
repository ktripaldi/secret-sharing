export interface RateLimiterOptions {
  /** Maximum burst — tokens available when full. */
  capacity: number
  /** Tokens replenished per second. */
  refillPerSecond: number
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

interface Bucket {
  tokens: number
  updatedAt: number
}

/**
 * In-memory token-bucket limiter keyed by client (e.g. IP). Single-node only;
 * a shared store would be the multi-node upgrade (STANDARDS §5.6). `now` is
 * passed in so behavior is deterministic and testable.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const { capacity, refillPerSecond } = options
  const buckets = new Map<string, Bucket>()

  return {
    check(key: string, now: number): RateLimitResult {
      const bucket = buckets.get(key) ?? { tokens: capacity, updatedAt: now }
      const elapsedSeconds = Math.max(0, now - bucket.updatedAt) / 1000
      bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSeconds * refillPerSecond)
      bucket.updatedAt = now

      if (bucket.tokens >= 1) {
        bucket.tokens -= 1
        buckets.set(key, bucket)
        return { allowed: true, retryAfterSeconds: 0 }
      }

      buckets.set(key, bucket)
      const retryAfterSeconds = Math.ceil((1 - bucket.tokens) / refillPerSecond)
      return { allowed: false, retryAfterSeconds }
    },
  }
}

export type RateLimiter = ReturnType<typeof createRateLimiter>
