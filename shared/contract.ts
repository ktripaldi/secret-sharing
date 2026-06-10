import { z } from 'zod'
import {
  DEFAULT_MAX_VIEWS,
  DEFAULT_TTL_SECONDS,
  IV_B64_LENGTH,
  MAX_CIPHERTEXT_B64_LENGTH,
  MAX_VIEWS,
  MIN_VIEWS,
  TTL_SECONDS,
} from './constants.ts'

const base64 = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/, 'must be base64')

/**
 * Body for `POST /api/secrets`. The server validates this before any business
 * logic. `ciphertext` and `iv` are opaque base64; the server never sees the key.
 * Unknown keys are stripped (zod object default).
 */
export const createSecretSchema = z.object({
  ciphertext: base64.max(MAX_CIPHERTEXT_B64_LENGTH, 'secret too large'),
  iv: base64.length(IV_B64_LENGTH, 'invalid iv'),
  ttlSeconds: z
    .number()
    .int()
    .refine((v) => TTL_SECONDS.includes(v), 'ttl not allowed')
    .default(DEFAULT_TTL_SECONDS),
  maxViews: z.number().int().min(MIN_VIEWS).max(MAX_VIEWS).default(DEFAULT_MAX_VIEWS),
})

/** Parsed (output) shape — defaults applied. */
export type CreateSecretRequest = z.infer<typeof createSecretSchema>
/** Input shape — defaults optional. Used by the client to build the request. */
export type CreateSecretInput = z.input<typeof createSecretSchema>

export const createSecretResponseSchema = z.object({
  id: z.string(),
  expiresAt: z.number(),
})
export type CreateSecretResponse = z.infer<typeof createSecretResponseSchema>

export const peekResponseSchema = z.object({
  viewsRemaining: z.number(),
  expiresAt: z.number(),
})
export type PeekResponse = z.infer<typeof peekResponseSchema>

export const revealResponseSchema = z.object({
  ciphertext: z.string(),
  iv: z.string(),
})
export type RevealResponse = z.infer<typeof revealResponseSchema>

/** Structured error envelope returned for every 4xx/5xx (STANDARDS §1.5). */
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})
export type ErrorResponse = z.infer<typeof errorResponseSchema>
