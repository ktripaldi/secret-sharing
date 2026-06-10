import type { Db } from './db.ts'
import { generateId, hashId } from './ids.ts'
import { GoneError, NotFoundError } from './errors.ts'

export interface CreateSecretParams {
  ciphertext: string
  iv: string
  maxViews: number
  ttlSeconds: number
  now: number
}

export interface CreateSecretResult {
  id: string
  expiresAt: number
}

/** Persist a secret under the hash of a fresh id and return the raw id + expiry. */
export function createSecret(db: Db, params: CreateSecretParams): CreateSecretResult {
  const { ciphertext, iv, maxViews, ttlSeconds, now } = params
  const id = generateId()
  const expiresAt = now + ttlSeconds * 1000
  db.prepare(
    `INSERT INTO secrets (id_hash, ciphertext, iv, max_views, views, expires_at, created_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
  ).run(hashId(id), ciphertext, iv, maxViews, expiresAt, now)
  return { id, expiresAt }
}

interface MetaRow {
  views: number
  max_views: number
  expires_at: number
  consumed_at: number | null
}

export interface PeekResult {
  viewsRemaining: number
  expiresAt: number
}

/** Non-consuming metadata read. Safe for link-preview prefetch. */
export function peekSecret(db: Db, id: string, now: number): PeekResult {
  const row = db
    .prepare('SELECT views, max_views, expires_at, consumed_at FROM secrets WHERE id_hash = ?')
    .get(hashId(id)) as MetaRow | undefined
  if (!row) throw new NotFoundError()
  if (row.consumed_at !== null || row.expires_at <= now || row.views >= row.max_views) {
    throw new GoneError()
  }
  return { viewsRemaining: row.max_views - row.views, expiresAt: row.expires_at }
}

interface RevealRow {
  ciphertext: string
  iv: string
  views: number
  max_views: number
}

export interface RevealResult {
  ciphertext: string
  iv: string
}

/**
 * Atomically consume one view and return the ciphertext. The conditional
 * `UPDATE ... RETURNING` is the burn: only requests that cross the
 * `views < max_views` threshold succeed, so a race can never over-deliver.
 * On the final allowed view the ciphertext is destroyed and a tombstone remains.
 */
export function revealSecret(db: Db, id: string, now: number): RevealResult {
  const idHash = hashId(id)
  const consume = db.transaction((): RevealResult => {
    const row = db
      .prepare(
        `UPDATE secrets SET views = views + 1
         WHERE id_hash = ? AND consumed_at IS NULL AND expires_at > ? AND views < max_views
         RETURNING ciphertext, iv, views, max_views`,
      )
      .get(idHash, now) as RevealRow | undefined

    if (!row) {
      const exists = db.prepare('SELECT 1 FROM secrets WHERE id_hash = ?').get(idHash)
      throw exists ? new GoneError() : new NotFoundError()
    }

    if (row.views >= row.max_views) {
      db.prepare(
        'UPDATE secrets SET ciphertext = NULL, iv = NULL, consumed_at = ? WHERE id_hash = ?',
      ).run(now, idHash)
    }
    return { ciphertext: row.ciphertext, iv: row.iv }
  })
  return consume()
}

/** Delete expired rows and consumed tombstones past their TTL. Returns the count removed. */
export function sweepExpired(db: Db, now: number): number {
  return db.prepare('DELETE FROM secrets WHERE expires_at <= ?').run(now).changes
}
