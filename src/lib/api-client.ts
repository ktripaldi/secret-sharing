import type {
  CreateSecretInput,
  CreateSecretResponse,
  ErrorResponse,
  PeekResponse,
  RevealResponse,
} from '@shared/contract.ts'

/** Error thrown for any non-2xx API response, carrying the server's error code. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    let code = 'error'
    let message = res.statusText
    try {
      const body = (await res.json()) as ErrorResponse
      code = body.error.code
      message = body.error.message
    } catch {
      // non-JSON error body; keep the status text
    }
    throw new ApiError(res.status, code, message)
  }
  return (await res.json()) as T
}

const jsonHeaders = { 'content-type': 'application/json' }

export function createSecret(input: CreateSecretInput): Promise<CreateSecretResponse> {
  return request('/api/secrets', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(input),
  })
}

export function peekSecret(id: string): Promise<PeekResponse> {
  return request(`/api/secrets/${encodeURIComponent(id)}`)
}

export function revealSecret(id: string): Promise<RevealResponse> {
  return request(`/api/secrets/${encodeURIComponent(id)}/reveal`, { method: 'POST' })
}
