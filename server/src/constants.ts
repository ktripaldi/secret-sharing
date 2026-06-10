import type { RateLimiterOptions } from './lib/rate-limit.ts'

/** Per-IP create budget: ~30 burst, one refilled every 2s. */
export const CREATE_RATE: RateLimiterOptions = { capacity: 30, refillPerSecond: 0.5 }
/** Per-IP read (peek + reveal) budget: ~60 burst, one refilled per second. */
export const READ_RATE: RateLimiterOptions = { capacity: 60, refillPerSecond: 1 }

/** How often the background sweep deletes expired rows. */
export const SWEEP_INTERVAL_MS = 60_000

export const PORT = Number(process.env.PORT ?? 8787)
export const DB_PATH = process.env.SECRETS_DB_PATH ?? 'secrets.db'
