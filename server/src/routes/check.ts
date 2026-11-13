import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { db } from '../db.js'
import { analyzeDomain, analyzeText, type AnalysisResult } from '../analyzer/index.js'
import { normalizeUrl } from '../analyzer/extract.js'
import { currentUser, optionalAuth, requireAuth } from '../lib/auth.js'
import { rateLimit } from '../lib/rateLimit.js'
import { notifyCircle } from '../lib/notify.js'

export const checkRouter = Router()

const checkLimiter = rateLimit({ name: 'check', windowMs: 60_000, max: 20 })
const domainLimiter = rateLimit({ name: 'domain', windowMs: 60_000, max: 120 })

const CheckSchema = z.object({
  text: z.string().trim().min(3, 'Paste a message, link, number or UPI ID to check').max(8000, 'That is too long. Paste only the suspicious part.'),
  source: z.enum(['web', 'extension', 'ocr']).default('web'),
})

const insertCheck = db.prepare(`INSERT INTO checks (id, user_id, input_text, score, verdict, category, result_json, source)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)

function newId(): string {
  return randomBytes(9).toString('base64url')
}

/** Masks phone numbers in a shared result so that a public link never exposes them fully. */
function publicView(result: AnalysisResult): AnalysisResult {
  return {
    ...result,
    entities: result.entities.map((e) => (e.type === 'phone' ? { ...e, raw: maskPhone(e.value), value: maskPhone(e.value) } : e)),
  }
}

export function maskPhone(p: string): string {
  return p.length === 10 ? `${p.slice(0, 2)}XXXX${p.slice(6)}` : p
}

checkRouter.post('/check', checkLimiter, optionalAuth, async (req, res) => {
  const { text, source } = CheckSchema.parse(req.body)
  const user = currentUser(res)
  const result = await analyzeText(text)
  const id = newId()
  // The message is kept only when the browser has a device identity, for its private history
  // (deletable from the dashboard). Shared result links never include it.
  insertCheck.run(id, user?.id ?? null, user ? text : null, result.score, result.verdict, result.category, JSON.stringify(result), source)
  if (user && result.verdict === 'dangerous') notifyCircle(user.id, user.name, id, result.score, result.categoryLabel)
  res.json({ id, ...result, createdAt: new Date().toISOString() })
})

/** Shareable result. Never returns the original message text. */
checkRouter.get('/check/:id', (req, res) => {
  const row = db.prepare('SELECT result_json, created_at FROM checks WHERE id = ?').get(req.params.id) as
    | { result_json: string; created_at: string }
    | undefined
  if (!row) {
    res.status(404).json({ error: 'This result does not exist or was deleted.' })
    return
  }
  res.json({ id: req.params.id, ...publicView(JSON.parse(row.result_json)), createdAt: `${row.created_at.replace(' ', 'T')}Z` })
})

/** Used by the browser extension. Receives only a hostname, never the full URL or page content. */
checkRouter.get('/check-domain', domainLimiter, async (req, res) => {
  const host = normalizeUrl(String(req.query.host || ''))
  if (!host || !host.includes('.')) {
    res.status(400).json({ error: 'Provide a valid ?host=' })
    return
  }
  res.json(await analyzeDomain(host))
})

checkRouter.get('/me/checks', requireAuth, (_req, res) => {
  const user = currentUser(res)!
  const rows = db.prepare(`SELECT id, input_text, score, verdict, category, created_at FROM checks
    WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`).all(user.id) as Array<Record<string, unknown>>
  res.json({ checks: rows.map((r) => ({ ...r, created_at: `${String(r.created_at).replace(' ', 'T')}Z` })) })
})

checkRouter.delete('/me/checks/:id', requireAuth, (req, res) => {
  const user = currentUser(res)!
  const result = db.prepare('DELETE FROM checks WHERE id = ? AND user_id = ?').run(req.params.id, user.id)
  res.status(result.changes ? 204 : 404).end()
})
