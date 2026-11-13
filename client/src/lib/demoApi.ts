/**
 * Browser-only backend for the static demo (GitHub Pages), used when VITE_STATIC_DEMO=1.
 * The same analyzer core as the server runs here. Community data is the bundled sample set.
 * Features that need a shared server (reporting, watchlist, family circle) return a clear error.
 */
import {
  analyzeTextWith,
  domainAgeSignalFromDate,
  type AnalyzerDeps,
  type CommunityMatch,
} from '../../../server/src/analyzer/core'
import { CATEGORIES, type Category } from '../../../server/src/analyzer/rules'
import { classifyValue } from '../../../server/src/analyzer/extract'
import { registrableDomain } from '../../../server/src/analyzer/url'
import { DEMO_MESSAGES, DEMO_REPORTERS, DEMO_REPORTS, demoChecksOnDay, demoConfirmations } from '../../../server/src/demoData'
import type { CheckResult, Report, Stats } from './types'

export class DemoApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export const FULL_VERSION_ONLY =
  'This feature needs the full version with a server. This demo runs entirely in your browser, so reporting, the watchlist and family alerts are turned off.'

const DAY = 86_400_000
const isoDaysAgo = (d: number) => new Date(Date.now() - d * DAY).toISOString()
const maskPhone = (p: string) => (p.length === 10 ? `${p.slice(0, 2)}XXXX${p.slice(6)}` : p)

// ---------- Sample community data ----------

const SAMPLE_REPORTS: Report[] = DEMO_REPORTS.map(([type, value, category, description, lost, daysAgo], i) => ({
  id: i + 1,
  type,
  value,
  category,
  categoryLabel: CATEGORIES[category as Category]?.label ?? category,
  description,
  amountLost: lost,
  confirmations: demoConfirmations(i),
  reporter: DEMO_REPORTERS[i % DEMO_REPORTERS.length],
  reporterBadge: null,
  createdAt: isoDaysAgo(daysAgo),
  votedByMe: false,
  flaggedByMe: false,
  isMine: false,
}))

function lookupCommunity(type: CommunityMatch['type'], value: string): CommunityMatch {
  const rows = SAMPLE_REPORTS.filter((r) => r.type === type && r.value === value)
  return {
    type,
    value,
    reports: rows.length,
    confirmations: rows.reduce((n, r) => n + r.confirmations, 0),
    trustedReports: 0,
    categories: [...new Set(rows.map((r) => r.category))],
    totalLost: rows.reduce((n, r) => n + r.amountLost, 0),
    lastReportedAt: rows.length ? rows.map((r) => r.createdAt).sort().at(-1)! : null,
  }
}

// ---------- Live domain age from the browser (RDAP), cached per visit ----------

const ageCache = new Map<string, string | null>()

async function domainAgeSignal(domain: string) {
  try {
    if (!ageCache.has(domain)) {
      const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
        headers: { Accept: 'application/rdap+json, application/json' },
        signal: AbortSignal.timeout(3500),
      })
      const data = res.ok ? ((await res.json()) as { events?: Array<{ eventAction?: string; eventDate?: string }> }) : null
      ageCache.set(domain, data?.events?.find((e) => e.eventAction === 'registration')?.eventDate ?? null)
    }
    const date = ageCache.get(domain)
    return date ? domainAgeSignalFromDate(domain, date) : null
  } catch {
    return null // blocked by the browser or offline: skip this signal
  }
}

const deps: AnalyzerDeps = { lookupCommunity, domainAgeSignal, aiAnalyze: null }

// ---------- Results kept in this browser so /r/:id links work here ----------

const RESULTS_KEY = 'scamshield_demo_results'

function loadResults(): Record<string, CheckResult> {
  try {
    return JSON.parse(localStorage.getItem(RESULTS_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveResult(r: CheckResult) {
  try {
    const all = loadResults()
    all[r.id] = r
    const ids = Object.keys(all)
    for (const old of ids.slice(0, Math.max(0, ids.length - 50))) delete all[old] // keep the last 50
    localStorage.setItem(RESULTS_KEY, JSON.stringify(all))
  } catch {
    /* storage unavailable: the result still shows, it just can't be reopened later */
  }
}

// ---------- Sample stats (computed once from the sample messages) ----------

let statsPromise: Promise<Stats> | null = null

function buildStats(): Promise<Stats> {
  statsPromise ??= Promise.all(DEMO_MESSAGES.map((m) => analyzeTextWith(m, { ...deps, domainAgeSignal: async () => null }))).then((results) => {
    const daily: Stats['daily'] = []
    const byCat = new Map<string, number>()
    let checks = 0
    let dangerous = 0
    for (let day = 13; day >= 0; day--) {
      const row = { day: isoDaysAgo(day).slice(0, 10), dangerous: 0, suspicious: 0, lowRisk: 0 }
      for (let k = 0; k < demoChecksOnDay(day); k++) {
        const r = results[(day * 3 + k) % results.length]
        checks++
        if (r.verdict === 'dangerous') { row.dangerous++; dangerous++ } else if (r.verdict === 'suspicious') row.suspicious++
        else row.lowRisk++
        if (r.verdict !== 'low_risk' && r.category !== 'generic') byCat.set(r.category, (byCat.get(r.category) || 0) + 1)
      }
      daily.push(row)
    }
    const grouped = new Map<string, { type: Report['type']; value: string; reports: number; confirmations: number; categoryLabel: string }>()
    for (const r of SAMPLE_REPORTS) {
      const key = `${r.type}:${r.value}`
      const g = grouped.get(key) ?? { type: r.type, value: r.type === 'phone' ? maskPhone(r.value) : r.value, reports: 0, confirmations: 0, categoryLabel: r.categoryLabel }
      g.reports++
      g.confirmations += r.confirmations
      grouped.set(key, g)
    }
    return {
      demo: true,
      totals: { checks, dangerous, reports: SAMPLE_REPORTS.length, amountLost: SAMPLE_REPORTS.reduce((n, r) => n + r.amountLost, 0), users: 0 },
      byCategory: [...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([category, count]) => ({ category, label: CATEGORIES[category as Category]?.label ?? category, count })),
      daily,
      topReported: [...grouped.values()].sort((a, b) => b.reports + b.confirmations - (a.reports + a.confirmations)).slice(0, 6),
    }
  })
  return statsPromise
}

// ---------- Router ----------

export async function demoApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase()
  const url = new URL(path, 'http://demo')
  const p = url.pathname
  const body = options.body ? JSON.parse(String(options.body)) : {}

  if (method === 'GET' && p === '/me') return { user: { id: 0, name: 'Anonymous' } } as T

  if (method === 'POST' && p === '/check') {
    const text = String(body.text || '').trim()
    if (text.length < 3) throw new DemoApiError('Paste a message, link, number or UPI ID to check', 400)
    if (text.length > 8000) throw new DemoApiError('That is too long. Paste only the suspicious part.', 400)
    const r = await analyzeTextWith(text, deps)
    const result: CheckResult = { id: crypto.randomUUID().slice(0, 12), ...r, createdAt: new Date().toISOString() }
    saveResult(result)
    return result as T
  }

  const resultMatch = p.match(/^\/check\/([\w-]+)$/)
  if (method === 'GET' && resultMatch) {
    const r = loadResults()[resultMatch[1]]
    if (!r) throw new DemoApiError('In this demo, results are saved only in the browser that ran the check.', 404)
    return r as T
  }

  if (method === 'GET' && p === '/stats') return (await buildStats()) as T

  if (method === 'GET' && p === '/reports') {
    const type = url.searchParams.get('type')
    const category = url.searchParams.get('category')
    const offset = Number(url.searchParams.get('offset')) || 0
    const limit = Number(url.searchParams.get('limit')) || 20
    const rows = SAMPLE_REPORTS.filter((r) => (!type || r.type === type) && (!category || r.category === category))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const page = rows.slice(offset, offset + limit).map((r) => ({ ...r, value: r.type === 'phone' ? maskPhone(r.value) : r.value }))
    return { reports: page, nextOffset: offset + limit < rows.length ? offset + limit : null } as T
  }

  if (method === 'GET' && p === '/lookup') {
    const entity = classifyValue(url.searchParams.get('value') || '')
    if (!entity) throw new DemoApiError('Enter a 10-digit mobile number, a UPI ID (name@bank), a website or an email.', 400)
    const values = entity.type === 'url' ? [...new Set([registrableDomain(entity.normalized), entity.normalized])] : [entity.normalized]
    const summary = values.map((v) => lookupCommunity(entity.type, v)).sort((a, b) => b.reports - a.reports)[0]
    return {
      type: entity.type,
      value: entity.normalized,
      watching: false,
      reports: summary.reports,
      confirmations: summary.confirmations,
      totalLost: summary.totalLost,
      categories: summary.categories.map((c) => CATEGORIES[c as Category]?.label ?? c),
      lastReportedAt: summary.lastReportedAt,
      items: SAMPLE_REPORTS.filter((r) => r.type === entity.type && values.includes(r.value)),
    } as T
  }

  throw new DemoApiError(FULL_VERSION_ONLY, 501)
}
