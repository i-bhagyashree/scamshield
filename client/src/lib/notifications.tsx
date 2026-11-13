import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'
import { useAuth } from './auth'

interface Ctx {
  unread: number
  refresh: () => void
}

const NotificationsContext = createContext<Ctx>({ unread: 0, refresh: () => {} })
const POLL_MS = 60_000

/** Polls the unread count every minute (and when the tab regains focus) while signed in. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [unread, setUnread] = useState(0)

  // Devices that haven't saved anything yet (id 0) can't have notifications, so don't poll.
  const active = Boolean(user && user.id > 0)
  const refresh = useCallback(() => {
    if (!active) return
    api<{ unread: number }>('/me/notifications/unread-count').then((d) => setUnread(d.unread)).catch(() => {})
  }, [active])

  useEffect(() => {
    if (!active) {
      setUnread(0)
      return
    }
    refresh()
    const timer = setInterval(refresh, POLL_MS)
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [active, refresh])

  return <NotificationsContext.Provider value={{ unread, refresh }}>{children}</NotificationsContext.Provider>
}

export const useNotifications = () => useContext(NotificationsContext)
