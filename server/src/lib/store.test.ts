import { describe, it, expect, beforeEach } from 'vitest'
import { createDb, type Db } from './db.ts'
import { createSecret, peekSecret, revealSecret, sweepExpired } from './store.ts'
import { hashId } from './ids.ts'
import { NotFoundError, GoneError } from './errors.ts'

const NOW = 1_700_000_000_000
const CIPHERTEXT = 'Y2lwaGVy' // "cipher"
const IV = 'A'.repeat(16)

const params = (overrides: Partial<Parameters<typeof createSecret>[1]> = {}) => ({
  ciphertext: CIPHERTEXT,
  iv: IV,
  maxViews: 1,
  ttlSeconds: 3600,
  now: NOW,
  ...overrides,
})

let db: Db
beforeEach(() => {
  db = createDb(':memory:')
})

describe('createSecret', () => {
  it('stores under the hashed id (never the raw id) and returns id + expiry', () => {
    const { id, expiresAt } = createSecret(db, params())
    expect(id).toBeTruthy()
    expect(expiresAt).toBe(NOW + 3600 * 1000)

    const byHash = db.prepare('SELECT 1 FROM secrets WHERE id_hash = ?').get(hashId(id))
    const byRaw = db.prepare('SELECT 1 FROM secrets WHERE id_hash = ?').get(id)
    expect(byHash).toBeTruthy()
    expect(byRaw).toBeUndefined()
  })
})

describe('peekSecret', () => {
  it('reports views remaining without consuming', () => {
    const { id } = createSecret(db, params({ maxViews: 3 }))
    expect(peekSecret(db, id, NOW).viewsRemaining).toBe(3)
    expect(peekSecret(db, id, NOW).viewsRemaining).toBe(3) // peek did not consume
  })

  it('throws NotFound for an unknown id', () => {
    expect(() => peekSecret(db, 'nope', NOW)).toThrow(NotFoundError)
  })

  it('throws Gone for an expired secret', () => {
    const { id } = createSecret(db, params({ ttlSeconds: 3600 }))
    expect(() => peekSecret(db, id, NOW + 3600 * 1000 + 1)).toThrow(GoneError)
  })
})

describe('revealSecret', () => {
  it('returns the ciphertext and iv', () => {
    const { id } = createSecret(db, params())
    const out = revealSecret(db, id, NOW)
    expect(out.ciphertext).toBe(CIPHERTEXT)
    expect(out.iv).toBe(IV)
  })

  it('burns a one-time secret after the first reveal', () => {
    const { id } = createSecret(db, params({ maxViews: 1 }))
    revealSecret(db, id, NOW)
    expect(() => revealSecret(db, id, NOW)).toThrow(GoneError)
    expect(() => peekSecret(db, id, NOW)).toThrow(GoneError)
  })

  it('allows exactly maxViews reveals then blocks (atomic guard)', () => {
    const { id } = createSecret(db, params({ maxViews: 2 }))
    expect(revealSecret(db, id, NOW).ciphertext).toBe(CIPHERTEXT)
    expect(peekSecret(db, id, NOW).viewsRemaining).toBe(1)
    expect(revealSecret(db, id, NOW).ciphertext).toBe(CIPHERTEXT)
    expect(() => revealSecret(db, id, NOW)).toThrow(GoneError)
  })

  it('destroys the ciphertext on the final view', () => {
    const { id } = createSecret(db, params({ maxViews: 1 }))
    revealSecret(db, id, NOW)
    const row = db
      .prepare('SELECT ciphertext, iv, consumed_at FROM secrets WHERE id_hash = ?')
      .get(hashId(id)) as { ciphertext: string | null; iv: string | null; consumed_at: number | null }
    expect(row.ciphertext).toBeNull()
    expect(row.iv).toBeNull()
    expect(row.consumed_at).toBe(NOW)
  })

  it('throws NotFound for an unknown id', () => {
    expect(() => revealSecret(db, 'nope', NOW)).toThrow(NotFoundError)
  })

  it('throws Gone for an expired secret', () => {
    const { id } = createSecret(db, params({ ttlSeconds: 3600 }))
    expect(() => revealSecret(db, id, NOW + 3600 * 1000 + 1)).toThrow(GoneError)
  })
})

describe('sweepExpired', () => {
  it('deletes expired rows and returns the count', () => {
    const a = createSecret(db, params({ ttlSeconds: 3600 }))
    createSecret(db, params({ ttlSeconds: 7200 }))
    const removed = sweepExpired(db, NOW + 3600 * 1000 + 1)
    expect(removed).toBe(1)
    expect(() => peekSecret(db, a.id, NOW + 3600 * 1000 + 1)).toThrow(NotFoundError)
  })
})
