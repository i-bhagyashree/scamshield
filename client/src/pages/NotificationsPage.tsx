import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, post } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useNotifications } from '../lib/notifications'
import { timeAgo } from '../lib/format'
import type { AppNotification } from '../lib/types'

export default function NotificationsPage() {
  const { user, ready } = useAuth()
  const { refresh } = useNotifications()
  const [items, setItems] = useState<AppNotification[] | null>(null)

  useEffect(() => {
    if (!user) return
    api<{ items: AppNotification[] }>('/me/notifications').then(async (d) => {
      setItems(d.items)
      if (d.items.some((n) => !n.read)) {
        await post('/me/notifications/read-all', {})
        refresh()
      }
    }).catch(() => setItems([]))
  }, [user, refresh])

  if (!ready) return null
  if (!user) return <div className="card empty"><p>Could not load your notifications. Check that the server is running and reload.</p></div>

  return (
    <div className="narrow">
      <h1>Notifications</h1>
      {items?.length === 0 && (
        <div className="card empty">
          <p>No alerts yet. Add numbers to your <Link to="/dashboard#watchlist">watchlist</Link> or start a <Link to="/dashboard#circle">family circle</Link> to get alerts here.</p>
        </div>
      )}
      <div className="stack">
        {items?.map((n) => {
          const body = (
            <>
              <div className="notif-top">
                <strong>{n.title}</strong>
                {!n.read && <span className="dot-new" aria-label="New" />}
              </div>
              <p>{n.body}</p>
              <span className="muted small">{timeAgo(n.createdAt)}</span>
            </>
          )
          return n.link
            ? <Link key={n.id} to={n.link} className={`card notif notif-${n.kind} ${n.read ? '' : 'unread'}`}>{body}</Link>
            : <div key={n.id} className={`card notif notif-${n.kind} ${n.read ? '' : 'unread'}`}>{body}</div>
        })}
      </div>
    </div>
  )
}
