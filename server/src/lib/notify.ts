/**
 * Creates in-app notifications for:
 *  - watchlist hits: someone reported a value you are watching
 *  - family circle alerts: someone in your circle checked a dangerous message
 */
import { db } from '../db.js'
import { registrableDomain } from '../analyzer/url.js'
import type { EntityType } from '../analyzer/extract.js'

const insertNotification = db.prepare(`INSERT INTO notifications (user_id, kind, title, body, link) VALUES (?, ?, ?, ?, ?)`)

export function notify(userId: number, kind: string, title: string, body: string, link: string | null = null) {
  insertNotification.run(userId, kind, title, body, link)
}

const TYPE_WORD: Record<EntityType, string> = { phone: 'number', upi: 'UPI ID', url: 'website', email: 'email' }

/**
 * Tells everyone watching `value` that it was just reported. A watch on a website also matches
 * reports on its subdomains (watching "example.xyz" matches a report on "login.example.xyz").
 * Returns how many people were notified.
 */
export function notifyWatchers(type: EntityType, value: string, categoryLabel: string, reporterId: number): number {
  const candidates = type === 'url' ? [...new Set([value, registrableDomain(value)])] : [value]
  const watchers = db.prepare(`SELECT DISTINCT user_id, label, value FROM watchlist
    WHERE type = ? AND value IN (${candidates.map(() => '?').join(',')}) AND user_id != ?`)
    .all(type, ...candidates, reporterId) as Array<{ user_id: number; label: string | null; value: string }>

  const tx = db.transaction(() => {
    for (const w of watchers) {
      const name = w.label ? `${w.label} (${w.value})` : w.value
      notify(
        w.user_id,
        'watchlist',
        `⚠️ A ${TYPE_WORD[type]} on your watchlist was reported`,
        `${name} was just reported (${categoryLabel}). Do not pay or share anything with it.`,
        `/lookup?q=${encodeURIComponent(value)}`,
      )
    }
  })
  tx()
  return watchers.length
}

/** At most one circle alert per user per 15 minutes, so checking several scams in a row doesn't spam the family. */
const CIRCLE_COOLDOWN_MS = 15 * 60_000
const lastCircleAlert = new Map<number, number>()

/** Alerts the other members of a user's family circle. Never includes the message text. */
export function notifyCircle(userId: number, userName: string, checkId: string, score: number, categoryLabel: string, now = Date.now()): number {
  const last = lastCircleAlert.get(userId)
  if (last && now - last < CIRCLE_COOLDOWN_MS) return 0
  const members = db.prepare(`SELECT m2.user_id FROM circle_members m1
    JOIN circle_members m2 ON m2.circle_id = m1.circle_id
    WHERE m1.user_id = ? AND m2.user_id != ?`).all(userId, userId) as Array<{ user_id: number }>

  const first = userName.split(' ')[0]
  const tx = db.transaction(() => {
    for (const m of members) {
      notify(
        m.user_id,
        'circle',
        `🛡️ ${first} received a dangerous message`,
        `${first} checked a message flagged as ${categoryLabel} (risk ${score}/100). You may want to call them and make sure they did not pay or share anything.`,
        `/r/${checkId}`,
      )
    }
  })
  tx()
  if (members.length) lastCircleAlert.set(userId, now)
  return members.length
}
