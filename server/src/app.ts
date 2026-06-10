import { Hono } from 'hono'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { ZodError } from 'zod'
import { createSecretSchema } from '../../shared/contract.ts'
import type { Db } from './lib/db.ts'
import { createSecret, peekSecret, revealSecret } from './lib/store.ts'
import { isAppError, RateLimitedError } from './lib/errors.ts'
import { createRateLimiter, type RateLimiter, type RateLimiterOptions } from './lib/rate-limit.ts'
import { CREATE_RATE, READ_RATE } from './constants.ts'

export interface AppDeps {
  db: Db
  /** Injectable clock (unix ms). Defaults to Date.now. */
  now?: () => number
  /** Override rate-limit budgets (used in tests). */
  rate?: { create?: RateLimiterOptions; read?: RateLimiterOptions }
}

export function createApp(deps: AppDeps) {
  const { db } = deps
  const now = deps.now ?? (() => Date.now())
  const createLimiter = createRateLimiter(deps.rate?.create ?? CREATE_RATE)
  const readLimiter = createRateLimiter(deps.rate?.read ?? READ_RATE)

  const app = new Hono()

  // Security headers on every response (the real teeth behind the zero-knowledge
  // model — script-src 'self' blocks injected-script key exfiltration).
  app.use('*', async (c, next) => {
    applySecurityHeaders(c)
    await next()
  })

  app.get('/api/health', (c) => c.json({ status: 'ok' }))

  app.post('/api/secrets', async (c) => {
    enforce(createLimiter, c, now())
    const body = await c.req.json().catch(() => null)
    const parsed = createSecretSchema.parse(body)
    const { id, expiresAt } = createSecret(db, { ...parsed, now: now() })
    return c.json({ id, expiresAt }, 201)
  })

  app.get('/api/secrets/:id', (c) => {
    enforce(readLimiter, c, now())
    return c.json(peekSecret(db, c.req.param('id'), now()))
  })

  app.post('/api/secrets/:id/reveal', (c) => {
    enforce(readLimiter, c, now())
    return c.json(revealSecret(db, c.req.param('id'), now()))
  })

  app.onError(handleError)

  return app
}

function applySecurityHeaders(c: Context): void {
  c.header(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  )
  c.header('Referrer-Policy', 'no-referrer')
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
}

/** Client IP for rate limiting, trusting standard proxy headers. */
function clientIp(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || c.req.header('x-real-ip') || 'unknown'
}

function enforce(limiter: RateLimiter, c: Context, now: number): void {
  const result = limiter.check(clientIp(c), now)
  if (!result.allowed) throw new RateLimitedError(result.retryAfterSeconds)
}

/** Central error -> response mapping. Internals are never forwarded (STANDARDS §1.5). */
function handleError(err: unknown, c: Context): Response {
  if (err instanceof ZodError) {
    return errorJson(c, 400, 'validation_error', 'Invalid request')
  }
  if (err instanceof RateLimitedError) {
    c.header('Retry-After', String(err.retryAfterSeconds))
    return errorJson(c, err.status as ContentfulStatusCode, err.code, err.message)
  }
  if (isAppError(err)) {
    return errorJson(c, err.status as ContentfulStatusCode, err.code, err.message)
  }
  console.error('[api] unhandled error', err)
  return errorJson(c, 500, 'internal_error', 'Something went wrong')
}

function errorJson(
  c: Context,
  status: ContentfulStatusCode,
  code: string,
  message: string,
): Response {
  return c.json({ error: { code, message } }, status)
}
