import axios, { AxiosError } from 'axios'

export type ApiErrorKind = 'timeout' | 'network' | 'http'

/**
 * Every failed request ends up as one of three kinds, so the rest of the
 * app (retry rules, error messages) never looks at Axios internals.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | undefined

  constructor(kind: ApiErrorKind, status?: number, message?: string) {
    super(message ?? describe(kind, status))
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
}

function describe(kind: ApiErrorKind, status?: number): string {
  if (kind === 'timeout') return 'The server took too long to answer.'
  if (kind === 'network') return 'Could not reach the server.'
  return `The server answered with an error (${String(status ?? 'unknown')}).`
}

export const http = axios.create({ baseURL: '/api', timeout: 5000 })

http.interceptors.response.use(undefined, (error: unknown) => {
  // A request cancelled through its AbortSignal (TanStack Query does this
  // when a query is no longer needed) is not a failure: pass it through.
  if (axios.isCancel(error)) return Promise.reject(error)
  if (error instanceof AxiosError) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return Promise.reject(new ApiError('timeout'))
    }
    if (error.response) {
      return Promise.reject(new ApiError('http', error.response.status))
    }
    return Promise.reject(new ApiError('network'))
  }
  return Promise.reject(
    error instanceof Error ? error : new Error('Request failed'),
  )
})

/**
 * Worth trying again: the request may succeed next time. 4xx answers
 * (bad request, conflict) will not change by repeating them.
 */
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  if (error.kind !== 'http') return true
  return error.status !== undefined && error.status >= 500
}
