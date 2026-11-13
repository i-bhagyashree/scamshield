import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import { classifyValue } from '../analyzer/extract.js'
import { registrableDomain } from '../analyzer/url.js'
import { CATEGORIES, type Category } from '../analyzer/rules.js'
import { lookupCommunity } from '../lib/community.js'
import { currentUser, optionalAuth, requireAuth } from '../lib/auth.js'
import { rateLimit } from '../lib/rateLimit.js'
import { maskPhone } from './check.js'
import { notifyWatchers } from '../lib/notify.js'
import { REPUTATION_SQL, badgeFor } from '../lib/reputation.js'
import { VISIBLE_SQL } from '../lib/moderation.js'

export const reportsRouter = Router()

const reportLimiter = rateLimit({ name: 'report', windowMs: 60 * 60_000, max: 15 })
const CATEGORY_KEYS = Object.keys(CATEGORIES) as [Category, ...Category[]]

const ReportSchema = z.object({
  value: z.string().trim().min(3).max(300),
  category: z.enum(CATEGORY_KEYS),
  description: z.string().trim().min(10, 'Describe what happened in at least 10 characters').max(1000),
  amountLost: z.coerce.number().int().min(0).max(100_000_000).default(0),
})

interface ReportRow {
  id: number
  type: 'phone' | 'upi' | 'url' | 'email'
  value: string
  category: Category
  description: string
  amount_lost: number
  created_at: string
  confirmations: number
  reporter: string | null
  reporter_rep: number | null
  user_id: number | null
  voted?: number
  flagged?: number
}

function present(r: ReportRow, me: number | null = null) {
  return {
    id: r.id,
    type: r.type,
    value: r.type === 'phone' ? maskPhone(r.value) : r.value,
    category: r.category,
    categoryLabel: CATEGORIES[r.category]?.label ?? r.category,
    description: r.description,
    amountLost: r.amount_lost,
    confirmations: r.confirmations,
    reporter: r.reporter ? r.reporter.split(' ')[0] : 'Anonymous',
    reporterBadge: r.reporter && r.reporter_rep != null && r.reporter_rep > 0 ? badgeFor(r.reporter_rep) : null,
    createdAt: `${r.created_at.replace(' ', 'T')}Z`,
    votedByMe: Boolean(r.voted),
    flaggedByMe: Boolean(r.flagged),
    isMine: me !== null && r.user_id === me,
  }
}

const SELECT_REPORTS = `
  SELECT r.*, u.name AS reporter, ${REPUTATION_SQL('r')} AS reporter_rep,
         (SELECT COUNT(*) FROM report_votes v WHERE v.report_id = r.id) AS confirmations,
         (SELECT COUNT(*) FROM report_votes v WHERE v.report_id = r.id AND v.user_id = @me) AS voted,
         (SELECT COUNT(*) FROM report_flags f WHERE f.report_id = r.id AND f.user_id = @me) AS flagged
  FROM reports r LEFT JOIN users u ON u.id = r.user_id`

/** Public feed with optional filters. Phone numbers are masked in the feed. */
reportsRouter.get('/reports', optionalAuth, (req, res) => {
  const type = typeof req.query.type === 'string' && ['phone', 'upi', 'url', 'email'].includes(req.query.type) ? req.query.type : null
  const category = typeof req.query.category === 'string' && req.query.category in CATEGORIES ? req.query.category : null
  const limit = Math.min(Number(req.query.limit) || 20, 50)
  const offset = Math.max(Number(req.query.offset) || 0, 0)
  const rows = db.prepare(`${SELECT_REPORTS}
    WHERE (@type IS NULL OR r.type = @type) AND (@category IS NULL OR r.category = @category) AND ${VISIBLE_SQL('r')}
    ORDER BY r.created_at DESC, r.id DESC LIMIT @limit OFFSET @offset`)
    .all({ me: currentUser(res)?.id ?? -1, type, category, limit, offset }) as ReportRow[]
  const me = currentUser(res)?.id ?? null
  res.json({ reports: rows.map((r) => present(r, me)), nextOffset: rows.length === limit ? offset + limit : null })
})

/** Look up a single number, UPI ID, website or email. */
reportsRouter.get('/lookup', optionalAuth, (req, res) => {
  const entity = classifyValue(String(req.query.value || ''))
  if (!entity) {
    res.status(400).json({ error: 'Enter a 10-digit mobile number, a UPI ID (name@bank), a website or an email.' })
    return
  }
  const value = entity.type === 'url' ? registrableDomain(entity.normalized) : entity.normalized
  const values = entity.type === 'url' && value !== entity.normalized ? [value, entity.normalized] : [value]
  const summary = values.map((v) => lookupCommunity(entity.type, v)).sort((a, b) => b.reports - a.reports)[0]
  const rows = db.prepare(`${SELECT_REPORTS} WHERE r.type = @type AND r.value IN (${values.map((_, i) => `@v${i}`).join(',')})
    AND ${VISIBLE_SQL('r')} ORDER BY r.created_at DESC LIMIT 20`)
    .all({ me: currentUser(res)?.id ?? -1, type: entity.type, ...Object.fromEntries(values.map((v, i) => [`v${i}`, v])) }) as ReportRow[]
  const me = currentUser(res)
  const watching = me
    ? Boolean(db.prepare('SELECT 1 FROM watchlist WHERE user_id = ? AND type = ? AND value = ?').get(me.id, entity.type, entity.normalized))
    : false
  res.json({
    type: entity.type,
    value: entity.normalized,
    watching,
    reports: summary.reports,
    confirmations: summary.confirmations,
    totalLost: summary.totalLost,
    categories: summary.categories.map((c) => CATEGORIES[c as Category]?.label ?? c),
    lastReportedAt: summary.lastReportedAt,
    items: rows.map((r) => ({ ...present(r, me?.id ?? null), value: r.value })),
  })
})

reportsRouter.post('/reports', reportLimiter, requireAuth, (req, res) => {
  const body = ReportSchema.parse(req.body)
  const user = currentUser(res)!
  const entity = classifyValue(body.value)
  if (!entity) {
    res.status(400).json({ error: 'That does not look like a phone number, UPI ID, website or email.' })
    return
  }
  const duplicate = db.prepare(`SELECT id FROM reports WHERE user_id = ? AND type = ? AND value = ?`).get(user.id, entity.type, entity.normalized)
  if (duplicate) {
    res.status(409).json({ error: 'You have already reported this. Thank you!' })
    return
  }
  const result = db.prepare(`INSERT INTO reports (user_id, type, value, category, description, amount_lost) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(user.id, entity.type, entity.normalized, body.category, body.description, body.amountLost)
  const row = db.prepare(`${SELECT_REPORTS} WHERE r.id = @id`).get({ me: user.id, id: result.lastInsertRowid }) as ReportRow
  const notified = notifyWatchers(entity.type, entity.normalized, CATEGORIES[body.category].label, user.id)
  res.status(201).json({ report: present(row, user.id), notified })
})

/** "I got this too": adds weight to a report. Toggles on repeat. */
reportsRouter.post('/reports/:id/confirm', requireAuth, (req, res) => {
  const user = currentUser(res)!
  const id = Number(req.params.id)
  const report = db.prepare('SELECT user_id FROM reports WHERE id = ?').get(id) as { user_id: number | null } | undefined
  if (!report) {
    res.status(404).json({ error: 'Report not found.' })
    return
  }
  if (report.user_id === user.id) {
    res.status(400).json({ error: 'You cannot confirm your own report.' })
    return
  }
  const removed = db.prepare('DELETE FROM report_votes WHERE report_id = ? AND user_id = ?').run(id, user.id)
  if (!removed.changes) db.prepare('INSERT INTO report_votes (report_id, user_id) VALUES (?, ?)').run(id, user.id)
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM report_votes WHERE report_id = ?').get(id) as { n: number }
  res.json({ confirmations: n, votedByMe: !removed.changes })
})

const flagLimiter = rateLimit({ name: 'flag', windowMs: 60 * 60_000, max: 30 })

/** "Report a problem": flags a report as wrong, spam or containing personal info. Toggles on repeat. */
reportsRouter.post('/reports/:id/flag', flagLimiter, requireAuth, (req, res) => {
  const user = currentUser(res)!
  const id = Number(req.params.id)
  const { reason } = z.object({ reason: z.enum(['wrong', 'spam', 'personal']) }).parse(req.body)
  const report = db.prepare('SELECT user_id FROM reports WHERE id = ?').get(id) as { user_id: number | null } | undefined
  if (!report) {
    res.status(404).json({ error: 'Report not found.' })
    return
  }
  if (report.user_id === user.id) {
    res.status(400).json({ error: 'This is your own report. You can delete it instead.' })
    return
  }
  const removed = db.prepare('DELETE FROM report_flags WHERE report_id = ? AND user_id = ?').run(id, user.id)
  if (!removed.changes) db.prepare('INSERT INTO report_flags (report_id, user_id, reason) VALUES (?, ?, ?)').run(id, user.id, reason)
  const visible = db.prepare(`SELECT ${VISIBLE_SQL('r')} AS v FROM reports r WHERE r.id = ?`).get(id) as { v: number }
  res.json({ flaggedByMe: !removed.changes, hidden: !visible.v })
})

/** Reporters can delete their own reports. */
reportsRouter.delete('/reports/:id', requireAuth, (req, res) => {
  const user = currentUser(res)!
  const result = db.prepare('DELETE FROM reports WHERE id = ? AND user_id = ?').run(Number(req.params.id), user.id)
  res.status(result.changes ? 204 : 404).end()
})
