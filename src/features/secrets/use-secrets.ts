import { useMutation, useQuery } from '@tanstack/react-query'
import {
  createSecret as apiCreateSecret,
  peekSecret as apiPeekSecret,
  revealSecret as apiRevealSecret,
} from '@/lib/api-client.ts'
import { encryptSecret, decryptSecret } from '@/lib/crypto.ts'
import { buildShareLink } from '@/lib/secret-link.ts'
import { queryKeys } from '@/lib/query-keys.ts'
import { TTL_OPTIONS, type TtlOption } from '@shared/constants.ts'

export interface CreateSecretVars {
  plaintext: string
  ttl: TtlOption
  maxViews: number
}

export interface CreatedSecret {
  link: string
  expiresAt: number
}

/** Encrypt in the browser, store the ciphertext, and return the share link. */
export function useCreateSecret() {
  return useMutation<CreatedSecret, Error, CreateSecretVars>({
    mutationFn: async ({ plaintext, ttl, maxViews }) => {
      const { ciphertext, iv, key } = await encryptSecret(plaintext)
      const { id, expiresAt } = await apiCreateSecret({
        ciphertext,
        iv,
        ttlSeconds: TTL_OPTIONS[ttl],
        maxViews,
      })
      const link = buildShareLink({ origin: window.location.origin, id, key })
      return { link, expiresAt }
    },
  })
}

/** Non-consuming metadata read; disabled until an id is present. */
export function usePeekSecret(id: string) {
  return useQuery({
    queryKey: queryKeys.secrets.peek(id),
    queryFn: () => apiPeekSecret(id),
    enabled: id.length > 0,
    retry: false,
  })
}

export interface RevealVars {
  id: string
  key: string
}

/** Consume one view, then decrypt with the key from the link fragment. */
export function useRevealSecret() {
  return useMutation<string, Error, RevealVars>({
    mutationFn: async ({ id, key }) => {
      const { ciphertext, iv } = await apiRevealSecret(id)
      return decryptSecret({ ciphertext, iv, key })
    },
  })
}
