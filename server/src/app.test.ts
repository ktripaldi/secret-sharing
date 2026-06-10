import { describe, it, expect } from 'vitest'
import { createDb } from './lib/db.ts'
import { createApp, type AppDeps } from './app.ts'
import { TTL_OPTIONS } from '../../shared/constants.ts'
import type {
  CreateSecretResponse,
  ErrorResponse,
  PeekResponse,
  RevealResponse,
} from '../../shared/contract.ts'

const IV = 'A'.repeat(16)
const CT = 'AQIDBA=='
const NOW = 1_700_000_000_000

function makeApp(overrides: Partial<AppDeps> = {}) {
  const db = createDb(':memory:')
  return createApp({ db, now: () => NOW, ...overrides })
}

type App = ReturnType<typeof makeApp>

async function body<T>(res: Response): Promise<T> {
  return (await res.json()) as T
}

function create(app: App, fields: Record<string, unknown> = {}) {
  return app.request('/api/secrets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ciphertext: CT,
      iv: IV,
      ttlSeconds: TTL_OPTIONS['1h'],
      maxViews: 1,
      ...fields,
    }),
  })
}

describe('POST /api/secrets', () => {
  it('creates a secret and returns 201 with id + expiresAt', async () => {
    const res = await create(makeApp())
    expect(res.status).toBe(201)
    const json = await body<CreateSecretResponse>(res)
    expect(typeof json.id).toBe('string')
    expect(json.expiresAt).toBe(NOW + 3600 * 1000)
  })

  it('rejects an invalid iv with 400 and a structured error envelope', async () => {
    const res = await create(makeApp(), { iv: 'short' })
    expect(res.status).toBe(400)
    expect((await body<ErrorResponse>(res)).error.code).toBe('validation_error')
  })

  it('rejects a ttl outside the allow-list with 400', async () => {
    const res = await create(makeApp(), { ttlSeconds: 999 })
    expect(res.status).toBe(400)
  })

  it('rejects malformed JSON with 400', async () => {
    const res = await makeApp().request('/api/secrets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/secrets/:id (peek)', () => {
  it('returns viewsRemaining without consuming', async () => {
    const app = makeApp()
    const created = await body<CreateSecretResponse>(await create(app, { maxViews: 2 }))
    const first = await body<PeekResponse>(await app.request(`/api/secrets/${created.id}`))
    const second = await body<PeekResponse>(await app.request(`/api/secrets/${created.id}`))
    expect(first.viewsRemaining).toBe(2)
    expect(second.viewsRemaining).toBe(2) // peek never consumes
  })

  it('returns 404 for an unknown id', async () => {
    const res = await makeApp().request('/api/secrets/nope')
    expect(res.status).toBe(404)
  })
})

describe('POST /api/secrets/:id/reveal', () => {
  it('returns the ciphertext, then 410 on the burned second reveal', async () => {
    const app = makeApp()
    const created = await body<CreateSecretResponse>(await create(app))
    const first = await app.request(`/api/secrets/${created.id}/reveal`, { method: 'POST' })
    expect(first.status).toBe(200)
    expect((await body<RevealResponse>(first)).ciphertext).toBe(CT)
    const second = await app.request(`/api/secrets/${created.id}/reveal`, { method: 'POST' })
    expect(second.status).toBe(410)
  })

  it('returns 404 for an unknown id', async () => {
    const res = await makeApp().request('/api/secrets/nope/reveal', { method: 'POST' })
    expect(res.status).toBe(404)
  })
})

describe('rate limiting', () => {
  it('returns 429 with Retry-After once the bucket is empty', async () => {
    const app = makeApp({ rate: { create: { capacity: 1, refillPerSecond: 0.001 } } })
    expect((await create(app)).status).toBe(201)
    const limited = await create(app)
    expect(limited.status).toBe(429)
    expect(limited.headers.get('Retry-After')).toBeTruthy()
  })
})

describe('security headers', () => {
  it('sets a strict CSP and hardening headers on responses', async () => {
    const res = await makeApp().request('/api/health')
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'self'")
    expect(res.headers.get('Content-Security-Policy')).toContain("script-src 'self'")
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer')
    expect(res.headers.get('X-Frame-Options')).toBe('DENY')
  })
})

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await makeApp().request('/api/health')
    expect(res.status).toBe(200)
    expect((await body<{ status: string }>(res)).status).toBe('ok')
  })
})
