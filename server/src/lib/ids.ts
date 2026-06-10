import { createHash, randomBytes } from 'node:crypto'

/** A 256-bit, URL-safe token. Sent to the user in the link; never stored raw. */
export function generateId(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * SHA-256 hex of an id. Only the hash is persisted, so a database leak yields
 * no usable lookup keys (STANDARDS §5.4).
 */
export function hashId(id: string): string {
  return createHash('sha256').update(id).digest('hex')
}
