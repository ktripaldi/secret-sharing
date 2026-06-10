// Shared, framework-agnostic constants for the secret-sharing contract.
// One source of truth, imported by both the client and the server.

/** Allowed time-to-live options. Keys are UI labels; values are seconds. */
export const TTL_OPTIONS = {
  '1h': 60 * 60,
  '1d': 60 * 60 * 24,
  '7d': 60 * 60 * 24 * 7,
} as const

export type TtlOption = keyof typeof TTL_OPTIONS

/** Allow-list of accepted TTL values, in seconds. */
export const TTL_SECONDS: readonly number[] = Object.values(TTL_OPTIONS)

export const DEFAULT_TTL_OPTION: TtlOption = '1d'
export const DEFAULT_TTL_SECONDS = TTL_OPTIONS[DEFAULT_TTL_OPTION]

/** View-count bounds. The default of 1 is a classic burn-after-read secret. */
export const MIN_VIEWS = 1
export const MAX_VIEWS = 10
export const DEFAULT_MAX_VIEWS = 1

/** Largest plaintext we accept, measured before encryption. */
export const MAX_PLAINTEXT_BYTES = 64 * 1024

// AES-GCM appends a 16-byte auth tag and base64 inflates by 4/3. Cap the encoded
// ciphertext length with that headroom so oversized payloads are rejected at the
// boundary instead of after a decode.
const GCM_TAG_BYTES = 16
export const MAX_CIPHERTEXT_B64_LENGTH =
  Math.ceil(((MAX_PLAINTEXT_BYTES + GCM_TAG_BYTES) * 4) / 3) + 4

/** AES-GCM 96-bit nonce: 12 bytes -> 16 base64 characters. */
export const IV_BYTES = 12
export const IV_B64_LENGTH = 16
