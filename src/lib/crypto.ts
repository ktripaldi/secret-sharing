// Zero-knowledge client-side crypto. AES-256-GCM via the Web Crypto API.
// The key is generated, used, and exported here in the browser; it is placed in
// the URL fragment and never sent to the server.

const KEY_ALGORITHM = { name: 'AES-GCM', length: 256 } as const
const IV_BYTES = 12

export interface EncryptedSecret {
  /** AES-GCM ciphertext (incl. auth tag), base64. */
  ciphertext: string
  /** 96-bit nonce, base64. */
  iv: string
  /** Raw AES key, base64url — belongs in the URL fragment. */
  key: string
}

export async function encryptSecret(plaintext: string): Promise<EncryptedSecret> {
  const key = await crypto.subtle.generateKey(KEY_ALGORITHM, true, ['encrypt', 'decrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const data = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', key))
  return {
    ciphertext: toBase64(new Uint8Array(ciphertext)),
    iv: toBase64(iv),
    key: toBase64Url(rawKey),
  }
}

export async function decryptSecret(input: EncryptedSecret): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    fromBase64Url(input.key),
    KEY_ALGORITHM,
    false,
    ['decrypt'],
  )
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(input.iv) },
    key,
    fromBase64(input.ciphertext),
  )
  return new TextDecoder().decode(plaintext)
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  return fromBase64(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
}
