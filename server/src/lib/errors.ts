/** Base class for errors that map to a specific HTTP status (STANDARDS §1.5). */
export class AppError extends Error {
  readonly code: string
  readonly status: number
  constructor(code: string, status: number, message: string) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Secret not found') {
    super('not_found', 404, message)
    this.name = 'NotFoundError'
  }
}

export class GoneError extends AppError {
  constructor(message = 'This secret is no longer available') {
    super('gone', 410, message)
    this.name = 'GoneError'
  }
}

export class RateLimitedError extends AppError {
  readonly retryAfterSeconds: number
  constructor(retryAfterSeconds: number, message = 'Too many requests') {
    super('rate_limited', 429, message)
    this.name = 'RateLimitedError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError
}
