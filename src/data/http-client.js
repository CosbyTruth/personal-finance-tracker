const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const DEFAULT_TIMEOUT_MS = 15000

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'REQUEST_FAILED', data = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.data = data
    this.email = data?.email
  }
}

function mutationHeaders(path, method) {
  if (method === 'POST' && path === '/api/finance/transactions') {
    return { 'Idempotency-Key': crypto.randomUUID() }
  }
  return {}
}

export async function request(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase()
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS)
  const hasBody = options.body !== undefined && options.body !== null

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      method,
      credentials: 'include',
      signal: options.signal || controller.signal,
      headers: {
        Accept: 'application/json',
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...mutationHeaders(path, method),
        ...(options.headers || {}),
      },
    })

    if (response.status === 204) return null
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new ApiError(data.message || 'Something went wrong', {
        status: response.status,
        code: data.code || 'REQUEST_FAILED',
        data,
      })
    }
    return data
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error.name === 'AbortError') {
      throw new ApiError('The request took too long. Check your connection and try again.', { code: 'TIMEOUT' })
    }
    throw new ApiError('Kora could not reach the server. Check your connection and try again.', { code: 'NETWORK_ERROR' })
  } finally {
    window.clearTimeout(timeout)
  }
}
