// The share link is `${origin}/s/${id}#${key}`. The key lives in the fragment,
// which browsers never transmit, so the server never receives it.

export interface ShareLinkParts {
  origin: string
  id: string
  key: string
}

export function buildShareLink({ origin, id, key }: ShareLinkParts): string {
  return `${origin}/s/${encodeURIComponent(id)}#${key}`
}

/** Extract the key from a `location.hash` (`#<key>`), or null if absent. */
export function readKeyFromHash(hash: string): string | null {
  const key = hash.startsWith('#') ? hash.slice(1) : hash
  return key.length > 0 ? key : null
}
