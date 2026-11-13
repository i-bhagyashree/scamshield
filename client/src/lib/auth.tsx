import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, patch } from './api'
import type { User } from './types'

/**
 * There is no sign-in. Each browser has an anonymous identity (see getDeviceId), loaded here.
 * `user` is null only while loading or if the server can't be reached.
 */
interface AuthContextValue {
  user: User | null
  ready: boolean
  setName: (name: string) => Promise<void>
  /** Re-reads the profile, e.g. after this device's first save created its identity. */
  refreshUser: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  const refreshUser = useCallback(() => {
    api<{ user: User }>('/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setReady(true))
  }, [])

  useEffect(refreshUser, [refreshUser])

  const setName = useCallback(async (name: string) => {
    const d = await patch<{ user: User }>('/me/profile', { name })
    setUser(d.user)
  }, [])

  return <AuthContext.Provider value={{ user, ready, setName, refreshUser }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
