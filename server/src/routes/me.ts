/** Signed-in user features: dashboard summary, watchlist, notifications and family circle. */
import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { db } from '../db.js'
import { classifyValue } from '../analyzer/extract.js'
import { registrableDomain } from '../analyzer/url.js'
import { CATEGORIES, type Category } from '../analyzer/rules.js'
import { currentUser, optionalAuth, requireAuth } from '../lib/auth.js'
import { lookupCommunity } from '../lib/community.js'
import { badgeFor, nextBadgeAt, reputationOf } from '../lib/reputation.js'
import { rateLimit } from '../lib/rateLimit.js'

export const meRouter = Router()
// Reading the profile never creates an identity, so just visiting the site doesn't add a database row.
// id 0 means "this device hasn't saved anything yet".
meRouter.get('/me', optionalAuth, (_req, res) => {
  res.json({ user: currentUser(res) ?? { id: 0, name: 'Anonymous' } })
})

// Any other /me or /circle request creates this device's anonymous identity on first use.
meRouter.use('/me', requireAuth)
meRouter.use('/circle', requireAuth)

const iso = (d: string | null) => (d ? `${d.replace(' ', 'T')}Z` : null)
const MAX_WATCHES = 50

// ---------- Profile ----------

meRouter.patch('/me/profile', (req, res) => {
  const user = currentUser(res)!
  const { name } = z.object({ name: z.string().trim().min(1, 'Enter a name').max(40) }).parse(req.body)
  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, user.id)
  res.json({ user: { ...user, name } })
})

// ---------- Dashboard ----------

meRouter.get('/me/summary', (_req, res) => {
  const user = currentUser(res)!
  const c = db.prepare(`SELECT COUNT(*) AS checks, COALESCE(SUM(verdict = 'dangerous'), 0) AS dangerous,
      COALESCE(SUM(verdict = 'suspicious'), 0) AS suspicious FROM checks WHERE user_id = ?`).get(user.id) as Record<string, number>
  const r = db.prepare(`SELECT COUNT(*) AS reports, COALESCE(SUM(amount_lost), 0) AS lost FROM reports WHERE user_id = ?`).get(user.id) as Record<string, number>
  const topCats = (db.prepare(`SELECT category, COUNT(*) AS n FROM checks WHERE user_id = ? AND verdict = 'dangerous'
      GROUP BY category ORDER BY n DESC LIMIT 3`).all(user.id) as Array<{ category: Category; n: number }>)
    .map((x) => ({ label: CATEGORIES[x.category]?.label ?? x.category, count: x.n }))
  const { n: watching } = db.prepare('SELECT COUNT(*) AS n FROM watchlist WHERE user_id = ?').get(user.id) as { n: number }
  const reputation = reputationOf(user.id)
  res.json({
    checks: c.checks,
    scamsCaught: c.dangerous,
    suspicious: c.suspicious,
    reports: r.reports,
    watching,
    topCategories: topCats,
    reputation: { points: reputation, badge: badgeFor(reputation), nextAt: nextBadgeAt(reputation) },
  })
})

// ---------- Watchlist ----------

const WatchSchema = z.object({
  value: z.string().trim().min(3).max(300),
  label: z.string().trim().max(40).optional().transform((v) => v || null),
})

function watchItem(row: { id: number; type: 'phone' | 'upi' | 'url' | 'email'; value: string; label: string | null; created_at: string }) {
  const lookups = row.type === 'url' && registrableDomain(row.value) !== row.value
    ? [lookupCommunity('url', row.value), lookupCommunity('url', registrableDomain(row.value))]
    : [lookupCommunity(row.type, row.value)]
  const best = lookups.sort((a, b) => b.reports - a.reports)[0]
  return {
    id: row.id,
    type: row.type,
    value: row.value,
    label: row.label,
    createdAt: iso(row.created_at),
    reports: best.reports + best.confirmations,
    lastReportedAt: best.lastReportedAt,
  }
}

meRouter.get('/me/watchlist', (_req, res) => {
  const user = currentUser(res)!
  const rows = db.prepare('SELECT * FROM watchlist WHERE user_id = ? ORDER BY created_at DESC').all(user.id) as Parameters<typeof watchItem>[0][]
  res.json({ items: rows.map(watchItem) })
})

meRouter.post('/me/watchlist', (req, res) => {
  const user = currentUser(res)!
  const { value, label } = WatchSchema.parse(req.body)
  const entity = classifyValue(value)
  if (!entity) {
    res.status(400).json({ error: 'Enter a 10-digit mobile number, a UPI ID, a website or an email.' })
    return
  }
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM watchlist WHERE user_id = ?').get(user.id) as { n: number }
  if (n >= MAX_WATCHES) {
    res.status(400).json({ error: `You can watch up to ${MAX_WATCHES} items. Remove some first.` })
    return
  }
  const result = db.prepare('INSERT OR IGNORE INTO watchlist (user_id, type, value, label) VALUES (?, ?, ?, ?)').run(user.id, entity.type, entity.normalized, label)
  if (!result.changes) {
    res.status(409).json({ error: 'You are already watching this.' })
    return
  }
  const row = db.prepare('SELECT * FROM watchlist WHERE id = ?').get(result.lastInsertRowid) as Parameters<typeof watchItem>[0]
  res.status(201).json({ item: watchItem(row) })
})

meRouter.delete('/me/watchlist/:id', (req, res) => {
  const user = currentUser(res)!
  const result = db.prepare('DELETE FROM watchlist WHERE id = ? AND user_id = ?').run(Number(req.params.id), user.id)
  res.status(result.changes ? 204 : 404).end()
})

/** Remove by value: used by the "Watching ✓" toggle on the lookup page. */
meRouter.delete('/me/watchlist', (req, res) => {
  const user = currentUser(res)!
  const entity = classifyValue(String(req.query.value || ''))
  if (!entity) {
    res.status(400).json({ error: 'Invalid value' })
    return
  }
  db.prepare('DELETE FROM watchlist WHERE user_id = ? AND type = ? AND value = ?').run(user.id, entity.type, entity.normalized)
  res.status(204).end()
})

// ---------- Notifications ----------

meRouter.get('/me/notifications', (_req, res) => {
  const user = currentUser(res)!
  const rows = db.prepare(`SELECT id, kind, title, body, link, read_at, created_at FROM notifications
    WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50`).all(user.id) as Array<Record<string, string | number | null>>
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').get(user.id) as { n: number }
  res.json({
    unread: n,
    items: rows.map((r) => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, link: r.link, read: r.read_at !== null, createdAt: iso(r.created_at as string) })),
  })
})

meRouter.get('/me/notifications/unread-count', (_req, res) => {
  const user = currentUser(res)!
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').get(user.id) as { n: number }
  res.json({ unread: n })
})

meRouter.post('/me/notifications/read-all', (_req, res) => {
  const user = currentUser(res)!
  db.prepare(`UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL`).run(user.id)
  res.status(204).end()
})

// ---------- Family circle ----------

const joinLimiter = rateLimit({ name: 'circle-join', windowMs: 15 * 60_000, max: 10 })

function newCode(): string {
  // 8 characters without look-alikes (0/O, 1/I/L) so it's easy to read out over the phone.
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from(randomBytes(8), (b) => alphabet[b % alphabet.length]).join('')
}

function circleFor(userId: number) {
  const circle = db.prepare(`SELECT c.id, c.name, c.code, c.owner_id FROM circles c
    JOIN circle_members m ON m.circle_id = c.id WHERE m.user_id = ?`).get(userId) as
    | { id: number; name: string; code: string; owner_id: number }
    | undefined
  if (!circle) return null
  const members = (db.prepare(`SELECT u.id, u.name, m.joined_at FROM circle_members m JOIN users u ON u.id = m.user_id
    WHERE m.circle_id = ? ORDER BY m.joined_at`).all(circle.id) as Array<{ id: number; name: string; joined_at: string }>)
    .map((m) => ({ id: m.id, name: m.name, isOwner: m.id === circle.owner_id, isMe: m.id === userId, joinedAt: iso(m.joined_at) }))
  return { id: circle.id, name: circle.name, code: circle.code, isOwner: circle.owner_id === userId, members }
}

meRouter.get('/me/circle', (_req, res) => {
  res.json({ circle: circleFor(currentUser(res)!.id) })
})

meRouter.post('/circle', (req, res) => {
  const user = currentUser(res)!
  const { name } = z.object({ name: z.string().trim().min(2, 'Give your circle a name').max(40) }).parse(req.body)
  if (circleFor(user.id)) {
    res.status(409).json({ error: 'You are already in a circle. Leave it first.' })
    return
  }
  const tx = db.transaction(() => {
    const c = db.prepare('INSERT INTO circles (name, code, owner_id) VALUES (?, ?, ?)').run(name, newCode(), user.id)
    db.prepare('INSERT INTO circle_members (circle_id, user_id) VALUES (?, ?)').run(c.lastInsertRowid, user.id)
  })
  tx()
  res.status(201).json({ circle: circleFor(user.id) })
})

meRouter.post('/circle/join', joinLimiter, (req, res) => {
  const user = currentUser(res)!
  const { code } = z.object({ code: z.string().trim().toUpperCase().min(6).max(12) }).parse(req.body)
  if (circleFor(user.id)) {
    res.status(409).json({ error: 'You are already in a circle. Leave it first.' })
    return
  }
  const circle = db.prepare('SELECT id FROM circles WHERE code = ?').get(code) as { id: number } | undefined
  if (!circle) {
    res.status(404).json({ error: 'No circle found with that code. Check it and try again.' })
    return
  }
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM circle_members WHERE circle_id = ?').get(circle.id) as { n: number }
  if (n >= 20) {
    res.status(400).json({ error: 'This circle is full (20 members).' })
    return
  }
  db.prepare('INSERT INTO circle_members (circle_id, user_id) VALUES (?, ?)').run(circle.id, user.id)
  res.json({ circle: circleFor(user.id) })
})

meRouter.post('/circle/leave', (_req, res) => {
  const user = currentUser(res)!
  const circle = circleFor(user.id)
  if (!circle) {
    res.status(404).json({ error: 'You are not in a circle.' })
    return
  }
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM circle_members WHERE circle_id = ? AND user_id = ?').run(circle.id, user.id)
    const remaining = db.prepare('SELECT user_id FROM circle_members WHERE circle_id = ? ORDER BY joined_at LIMIT 1').get(circle.id) as { user_id: number } | undefined
    if (!remaining) db.prepare('DELETE FROM circles WHERE id = ?').run(circle.id)
    else if (circle.isOwner) db.prepare('UPDATE circles SET owner_id = ? WHERE id = ?').run(remaining.user_id, circle.id) // hand over ownership
  })
  tx()
  res.status(204).end()
})

/** Owner can remove a member. */
meRouter.delete('/circle/members/:userId', (req, res) => {
  const user = currentUser(res)!
  const circle = circleFor(user.id)
  const target = Number(req.params.userId)
  if (!circle?.isOwner || target === user.id) {
    res.status(403).json({ error: 'Only the circle owner can remove other members.' })
    return
  }
  db.prepare('DELETE FROM circle_members WHERE circle_id = ? AND user_id = ?').run(circle.id, target)
  res.json({ circle: circleFor(user.id) })
})
