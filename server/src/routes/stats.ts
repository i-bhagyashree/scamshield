import { Router } from 'express'
import { db } from '../db.js'
import { CATEGORIES, type Category } from '../analyzer/rules.js'
import { maskPhone } from './check.js'
import { VISIBLE_SQL } from '../lib/moderation.js'
import { config } from '../config.js'

export const statsRouter = Router()

let cache: { at: number; body: unknown } | null = null
const CACHE_MS = 30_000

statsRouter.get('/stats', (_req, res) => {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    res.json(cache.body)
    return
  }

  const totals = db.prepare(`SELECT
      (SELECT COUNT(*) FROM checks) AS checks,
      (SELECT COUNT(*) FROM checks WHERE verdict = 'dangerous') AS dangerous,
      (SELECT COUNT(*) FROM reports r WHERE ${VISIBLE_SQL('r')}) AS reports,
      (SELECT COALESCE(SUM(amount_lost), 0) FROM reports r WHERE ${VISIBLE_SQL('r')}) AS amount_lost,
      (SELECT COUNT(*) FROM users) AS users`).get() as Record<string, number>

  const byCategory = (db.prepare(`SELECT category, COUNT(*) AS n FROM checks
      WHERE verdict != 'low_risk' AND category != 'generic' AND created_at > datetime('now', '-30 days')
      GROUP BY category ORDER BY n DESC`).all() as Array<{ category: Category; n: number }>)
    .map((r) => ({ category: r.category, label: CATEGORIES[r.category]?.label ?? r.category, count: r.n }))

  const dailyRows = db.prepare(`SELECT date(created_at) AS day,
      SUM(verdict = 'dangerous') AS dangerous, SUM(verdict = 'suspicious') AS suspicious, SUM(verdict = 'low_risk') AS low_risk
      FROM checks WHERE created_at > datetime('now', '-14 days') GROUP BY day`).all() as Array<{ day: string; dangerous: number; suspicious: number; low_risk: number }>
  const byDay = new Map(dailyRows.map((r) => [r.day, r]))
  const daily = Array.from({ length: 14 }, (_, i) => {
    const day = new Date(Date.now() - (13 - i) * 86_400_000).toISOString().slice(0, 10)
    const r = byDay.get(day)
    return { day, dangerous: r?.dangerous ?? 0, suspicious: r?.suspicious ?? 0, lowRisk: r?.low_risk ?? 0 }
  })

  const topReported = (db.prepare(`SELECT r.type, r.value, COUNT(DISTINCT r.id) AS reports,
      (SELECT COUNT(*) FROM report_votes v JOIN reports r2 ON r2.id = v.report_id WHERE r2.type = r.type AND r2.value = r.value) AS confirmations,
      MAX(r.category) AS category
      FROM reports r WHERE ${VISIBLE_SQL('r')} GROUP BY r.type, r.value ORDER BY reports + confirmations DESC, MAX(r.created_at) DESC LIMIT 6`).all() as
      Array<{ type: string; value: string; reports: number; confirmations: number; category: Category }>)
    .map((r) => ({ ...r, value: r.type === 'phone' ? maskPhone(r.value) : r.value, categoryLabel: CATEGORIES[r.category]?.label ?? r.category }))

  const body = {
    demo: config.demoData,
    totals: { checks: totals.checks, dangerous: totals.dangerous, reports: totals.reports, amountLost: totals.amount_lost, users: totals.users },
    byCategory,
    daily,
    topReported,
  }
  cache = { at: Date.now(), body }
  res.json(body)
})
