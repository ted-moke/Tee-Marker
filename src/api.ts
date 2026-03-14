const API_BASE = '/api'

async function request<T>(method: string, url: string, data?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: data !== undefined ? JSON.stringify(data) : undefined,
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error || res.statusText)
  return body
}

export const api = {
  get: <T = any>(url: string) => request<T>('GET', url),
  post: <T = any>(url: string, data?: unknown) => request<T>('POST', url, data),
  put: <T = any>(url: string, data?: unknown) => request<T>('PUT', url, data),
}
