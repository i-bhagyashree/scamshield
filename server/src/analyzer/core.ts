/**
 * Pure analysis core (no database, network or Node APIs), shared by the server and the
 * browser-only demo build. The server injects community lookups, domain age and AI.
 *
 * The analysis pipeline:
 *   1. extract entities (links, numbers, UPI IDs, emails)
 *   2. pattern rules on the text
 *   3. link heuristics + live domain-age lookups
 *   4. community reports for every entity
 *   5. optional AI second opinion (in parallel with step 3)
 *   6. combine into one 0-100 risk score, verdict, category and advice
 */
import { extractEntities, type Entity } from './extract.js'
import { RULES, TRUST_RULES, CATEGORIES, matchRule, ruleWeight, type Category } from './rules.js'
import { analyzeUrl, isWellKnown, registrableDomain, SHORTENERS, type Signal } from './url.js'

/** How often a value appears in the community database (see lib/community.ts on the server). */
export interface CommunityMatch {
  type: Entity['type']
  value: string
  reports: number
  confirmations: number
  /** Reports filed by trusted reporters (people whose earlier reports others confirmed). */
  trustedReports: number
  categories: string[]
  totalLost: number
  lastReportedAt: string | null
}

/** The AI second opinion (see ai.ts on the server). */
export interface AiVerdict {
  risk_score: number
  category: Category | 'not_scam'
  summary: string
  red_flags: string[]
}

/** Data sources the core needs. Each environment (server, browser demo) provides its own. */
export interface AnalyzerDeps {
  lookupCommunity: (type: Entity['type'], value: string) => CommunityMatch
  domainAgeSignal: (domain: string) => Promise<Signal | null>
  aiAnalyze?: ((text: string, ruleFindings: string[]) => Promise<AiVerdict | null>) | null
}

export type Verdict = 'low_risk' | 'suspicious' | 'dangerous'

export interface EntityResult {
  type: Entity['type']
  value: string
  raw: string
  community: CommunityMatch | null
}

export interface AnalysisResult {
  score: number
  ruleScore: number
  verdict: Verdict
  category: Category
  categoryLabel: string
  summary: string
  signals: Signal[]
  advice: string[]
  entities: EntityResult[]
  ai: { score: number; summary: string; redFlags: string[] } | null
  amounts: number[]
}

const MAX_LINKS_TO_CHECK = 3

/**
 * Combines independent warning signs with a "noisy-OR": each sign is treated as an
 * independent chance of fraud, so two 40-point signs give 64 (not 80), and the score
 * approaches but never exceeds 100. Trust signals (negative weights) are subtracted after.
 */
export function combineWeights(signals: Signal[]): number {
  const positive = signals.filter((s) => s.weight > 0)
  const negative = signals.filter((s) => s.weight < 0).reduce((sum, s) => sum + s.weight, 0)
  const safeProb = positive.reduce((p, s) => p * (1 - Math.min(s.weight, 95) / 100), 1)
  return clamp(Math.round((1 - safeProb) * 100 + negative))
}

export function verdictFor(score: number): Verdict {
  if (score >= 60) return 'dangerous'
  if (score >= 30) return 'suspicious'
  return 'low_risk'
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n))
}

export function communitySignal(m: CommunityMatch): Signal | null {
  if (m.reports === 0) return null
  const what = { phone: 'phone number', upi: 'UPI ID', url: 'website', email: 'email address' }[m.type]
  const people = m.reports + m.confirmations
  const trusted = m.trustedReports > 0 ? ` (including ${m.trustedReports} trusted reporter${m.trustedReports === 1 ? '' : 's'})` : ''
  return {
    id: `community:${m.type}:${m.value}`,
    label: `This ${what} was reported by ${people} ${people === 1 ? 'person' : 'people'}`,
    detail: `${m.value} is in the ScamShield community database${trusted}${m.totalLost > 0 ? `, with ₹${m.totalLost.toLocaleString('en-IN')} reported lost` : ''}. Do not pay or share anything with it.`,
    // Reports from trusted reporters count extra, so a single fake account has less influence.
    weight: Math.min(40 + people * 8 + m.trustedReports * 10, 90),
    source: 'community',
  }
}

function pickCategory(signals: Signal[], ruleCats: Map<string, Category>, community: CommunityMatch[], ai: AiVerdict | null): Category {
  const totals = new Map<Category, number>()
  for (const s of signals) {
    const cat = ruleCats.get(s.id)
    if (cat) totals.set(cat, (totals.get(cat) || 0) + s.weight)
  }
  if (totals.size) return [...totals.entries()].sort((a, b) => b[1] - a[1])[0][0]
  const reported = community.find((c) => c.categories.length)?.categories[0]
  if (reported && reported in CATEGORIES) return reported as Category
  if (ai && ai.category !== 'not_scam') return ai.category
  return 'generic'
}

function templateSummary(verdict: Verdict, categoryLabel: string, signals: Signal[]): string {
  const warnings = signals.filter((s) => s.weight > 0).length
  if (verdict === 'dangerous') return `This matches a known scam type: ${categoryLabel}. We found ${warnings} warning sign${warnings === 1 ? '' : 's'}. Do not click, pay or share anything.`
  if (verdict === 'suspicious') return `This message has ${warnings} warning sign${warnings === 1 ? '' : 's'}. Check with the company through its official app or website before you do anything.`
  return warnings
    ? 'We found only minor warning signs. Stay careful with links and never share OTPs or PINs.'
    : 'We found no common scam patterns. That does not guarantee it is safe, so still never share OTPs, PINs or passwords.'
}

export async function analyzeTextWith(text: string, deps: AnalyzerDeps): Promise<AnalysisResult> {
  const { lookupCommunity, domainAgeSignal } = deps
  const { entities, amounts } = extractEntities(text)
  const signals: Signal[] = []
  const ruleCats = new Map<string, Category>()

  // 1. Pattern rules
  for (const rule of [...RULES, ...TRUST_RULES]) {
    const hits = matchRule(rule, text)
    if (!hits) continue
    signals.push({ id: rule.id, label: rule.label, detail: rule.detail, weight: ruleWeight(rule, hits), source: rule.weight < 0 ? 'trust' : 'pattern' })
    if (rule.category) ruleCats.set(rule.id, rule.category)
  }
  if (amounts.some((a) => a >= 100_000) && signals.some((s) => s.weight > 0)) {
    signals.push({ id: 'big_amount', label: 'Mentions a large sum of money', detail: `The message mentions ₹${Math.max(...amounts).toLocaleString('en-IN')}. Big, unexpected sums are bait.`, weight: 10, source: 'pattern' })
  }

  // 2. Link heuristics (sync)
  const urls = entities.filter((e) => e.type === 'url').slice(0, MAX_LINKS_TO_CHECK)
  for (const u of urls) signals.push(...analyzeUrl(u.normalized, u.raw))

  // 3. Community database
  const entityResults: EntityResult[] = entities.map((e) => {
    const lookupValue = e.type === 'url' ? registrableDomain(e.normalized) : e.normalized
    const match = lookupCommunity(e.type, lookupValue)
    const exact = e.type === 'url' && lookupValue !== e.normalized ? lookupCommunity('url', e.normalized) : null
    const best = exact && exact.reports > match.reports ? exact : match
    return { type: e.type, value: e.normalized, raw: e.raw, community: best.reports > 0 ? best : null }
  })
  for (const er of entityResults) {
    const s = er.community && communitySignal(er.community)
    if (s) signals.push(s)
  }

  // 4. Domain age + AI in parallel
  const ruleFindings = signals.filter((s) => s.weight > 0).map((s) => s.label)
  const ageTargets = [...new Set(urls.map((u) => registrableDomain(u.normalized)))]
    .filter((d) => !isWellKnown(d) && !SHORTENERS.has(d))
  const [ageSignals, ai] = await Promise.all([
    Promise.all(ageTargets.map((d) => domainAgeSignal(d))),
    deps.aiAnalyze ? deps.aiAnalyze(text, ruleFindings) : Promise.resolve(null),
  ])
  for (const s of ageSignals) if (s) signals.push(s)

  // 5. Scoring
  const ruleScore = combineWeights(signals)
  let score = ruleScore
  if (ai) {
    // Blend rules and AI, but never let AI pull a confirmed community report below "dangerous".
    score = Math.round(0.45 * ruleScore + 0.55 * ai.risk_score)
    if (ruleScore >= 80) score = Math.max(score, ruleScore - 10)
  }
  const reported = entityResults.filter((e) => e.community)
  if (reported.length) score = Math.max(score, reported.some((e) => (e.community!.reports + e.community!.confirmations) >= 2) ? 75 : 60)
  score = clamp(score)

  const verdict = verdictFor(score)
  const category = verdict === 'low_risk' && !ruleCats.size ? 'generic' : pickCategory(signals, ruleCats, reported.map((e) => e.community!), ai)
  const info = CATEGORIES[category]

  signals.sort((a, b) => b.weight - a.weight)

  return {
    score,
    ruleScore,
    verdict,
    category,
    categoryLabel: verdict === 'low_risk' && category === 'generic' ? 'No known scam pattern' : info.label,
    summary: ai?.summary || templateSummary(verdict, info.label, signals),
    signals,
    advice: verdict === 'low_risk'
      ? ['Never share an OTP, UPI PIN or password, even if the message looks genuine.', 'When in doubt, contact the company through its official app or website.']
      : info.advice,
    entities: entityResults,
    ai: ai ? { score: ai.risk_score, summary: ai.summary, redFlags: ai.red_flags } : null,
    amounts,
  }
}

/** Fast path used by the browser extension: checks one website without AI. */
export async function analyzeDomainWith(host: string, deps: AnalyzerDeps): Promise<Pick<AnalysisResult, 'score' | 'verdict' | 'signals'> & { host: string; reported: CommunityMatch | null }> {
  const { lookupCommunity, domainAgeSignal } = deps
  const reg = registrableDomain(host)
  const signals = analyzeUrl(host, `https://${host}`)
  const match = lookupCommunity('url', reg)
  const exact = reg !== host ? lookupCommunity('url', host) : null
  const best = exact && exact.reports > match.reports ? exact : match
  const cs = communitySignal(best)
  if (cs) signals.push(cs)
  if (!isWellKnown(host) && !SHORTENERS.has(reg)) {
    const age = await domainAgeSignal(reg)
    if (age) signals.push(age)
  }
  let score = combineWeights(signals)
  if (best.reports > 0) score = Math.max(score, best.reports + best.confirmations >= 2 ? 75 : 60)
  signals.sort((a, b) => b.weight - a.weight)
  return { host, score, verdict: verdictFor(score), signals, reported: best.reports > 0 ? best : null }
}

export function ageInDays(isoDate: string, now = Date.now()): number {
  return Math.floor((now - new Date(isoDate).getTime()) / 86_400_000)
}

/** Turns a domain's registration date into a warning (new site) or trust (old site) signal. */
export function domainAgeSignalFromDate(domain: string, registered: string): Signal | null {
  const days = ageInDays(registered)
  if (Number.isNaN(days) || days < 0) return null
  if (days <= 30) {
    return { id: `age:${domain}`, label: `Website is only ${days} day${days === 1 ? '' : 's'} old`, detail: `${domain} was registered on ${registered.slice(0, 10)}. Most scam websites are created days before a campaign and abandoned soon after.`, weight: 35, source: 'domain' }
  }
  if (days <= 180) {
    return { id: `age:${domain}`, label: `Website is new (${Math.round(days / 30)} months old)`, detail: `${domain} was registered on ${registered.slice(0, 10)}. Newer domains are more likely to be throwaway sites.`, weight: 12, source: 'domain' }
  }
  if (days > 3 * 365) {
    return { id: `age:${domain}`, label: `Website has existed for ${Math.floor(days / 365)} years`, detail: `${domain} was registered on ${registered.slice(0, 10)}. An older domain is a mildly positive sign, but it does not prove the site is safe.`, weight: -5, source: 'trust' }
  }
  return null
}
