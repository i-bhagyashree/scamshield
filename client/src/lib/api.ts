import { STATIC_DEMO } from './staticMode'

const DEVICE_KEY = 'scamshield_device'
let memoryDeviceId: string | null = null

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function newDeviceId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 40)
}

/** Random ID that identifies this browser to the server. No account or sign-up needed. */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = newDeviceId()
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    // Storage blocked (private mode): keep an ID for this visit only.
    memoryDeviceId ??= newDeviceId()
    return memoryDeviceId
  }
}

/** Switches this browser to another device's data (used by "Use on another device"). */
export function setDeviceId(id: string) {
  try {
    localStorage.setItem(DEVICE_KEY, id)
  } catch {
    memoryDeviceId = id
  }
}

export const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{20,64}$/

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (STATIC_DEMO) {
    // Browser-only demo: loaded on demand so the normal build doesn't include it.
    const { demoApi, DemoApiError } = await import('./demoApi')
    try {
      return await demoApi<T>(path, options)
    } catch (err) {
      if (err instanceof DemoApiError) throw new ApiError(err.message, err.status)
      throw err
    }
  }
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        'X-Device-Id': getDeviceId(),
        ...options.headers,
      },
    })
  } catch {
    throw new ApiError('Cannot reach the server. Check your internet connection.', 0)
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong', res.status)
  return data as T
}

export const post = <T,>(path: string, body: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(body) })
export const patch = <T,>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
