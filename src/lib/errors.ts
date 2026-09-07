// Typed errors thrown by server actions and routes. The client shows `message` in a toast; `code`
// lets the UI branch (e.g. SESSION_IN_PROGRESS → offer Resume). Anything else that escapes is
// logged with context and shown as "Something went wrong".
export type AppErrorCode =
  | 'UNAUTHENTICATED'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'SESSION_IN_PROGRESS'
  | 'SESSION_FINISHED'
  | 'QUEUE_NOT_EMPTY'
  | 'RATE_LIMITED'
  | 'CONFLICT'

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly status: number

  constructor(code: AppErrorCode, message: string, status = 400) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError
}
