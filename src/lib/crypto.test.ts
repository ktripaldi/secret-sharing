// @vitest-environment node
// Web Crypto (crypto.subtle) is guaranteed in Node; the API is identical to the
// browser's, so this exercises the real encryption path.
import { describe, it, expect } from 'vitest'
import { encryptSecret, decryptSecret } from './crypto.ts'

describe('crypto', () => {
  it('round-trips plaintext through encrypt then decrypt', async () => {
    const enc = await encryptSecret('hunter2 🔐')
    expect(enc.ciphertext).not.toContain('hunter2')
    expect(await decryptSecret(enc)).toBe('hunter2 🔐')
  })

  it('produces base64 ciphertext/iv and a base64url key', async () => {
    const enc = await encryptSecret('x')
    expect(enc.ciphertext).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(enc.iv).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(enc.iv.length).toBe(16) // 12-byte nonce
    expect(enc.key).toMatch(/^[A-Za-z0-9_-]+$/) // base64url, no padding
  })

  it('fails to decrypt with the wrong key', async () => {
    const enc = await encryptSecret('secret')
    const other = await encryptSecret('decoy')
    await expect(decryptSecret({ ...enc, key: other.key })).rejects.toThrow()
  })

  it('fails to decrypt tampered ciphertext (GCM authentication)', async () => {
    const enc = await encryptSecret('secret')
    const flipped = (enc.ciphertext[0] === 'A' ? 'B' : 'A') + enc.ciphertext.slice(1)
    await expect(decryptSecret({ ...enc, ciphertext: flipped })).rejects.toThrow()
  })
})
