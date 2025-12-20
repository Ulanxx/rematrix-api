const DEFAULT_BASE_URL = 'http://localhost:3000'

function getBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL
}

function getToken(): string | null {
  return localStorage.getItem('rematrix_jwt')
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${getBaseUrl()}${path}`
  const token = getToken()

  const headers = new Headers(init?.headers || {})
  if (!headers.has('content-type') && init?.body) {
    headers.set('content-type', 'application/json')
  }
  if (token) {
    headers.set('authorization', `Bearer ${token}`)
  }

  if (!headers.has('cache-control')) {
    headers.set('cache-control', 'no-cache')
  }
  if (!headers.has('pragma')) {
    headers.set('pragma', 'no-cache')
  }

  const res = await fetch(url, {
    ...init,
    headers,
    cache: 'no-store',
  })

  const text = await res.text()
  const payload = text ? (JSON.parse(text) as unknown) : null

  if (!res.ok) {
    const payloadMessage =
      payload &&
      typeof payload === 'object' &&
      'message' in payload &&
      typeof (payload as { message?: unknown }).message === 'string'
        ? (payload as { message: string }).message
        : null

    const message =
      payloadMessage
        ? payloadMessage
        : `${res.status} ${res.statusText}`
    throw new Error(message)
  }

  return payload as T
}

export const apiClient = {
  get<T>(path: string): Promise<T> {
    return request<T>(path)
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  },
  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  },
  delete<T>(path: string): Promise<T> {
    return request<T>(path, {
      method: 'DELETE',
    })
  },
}
