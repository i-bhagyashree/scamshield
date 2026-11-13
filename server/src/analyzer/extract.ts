/**
 * Pulls structured entities (links, phone numbers, UPI IDs, emails, money amounts)
 * out of free-form text such as an SMS, WhatsApp forward or email body.
 */

export type EntityType = 'url' | 'phone' | 'upi' | 'email'

export interface Entity {
  type: EntityType
  /** Value exactly as it appeared in the text. */
  raw: string
  /** Canonical form used for community-database lookups. */
  normalized: string
}

export interface Extracted {
  entities: Entity[]
  amounts: number[]
}

// Known UPI handles (the part after "@"). Used to tell UPI IDs apart from emails.
export const UPI_HANDLES = new Set([
  'upi', 'ybl', 'ibl', 'axl', 'paytm', 'ptyes', 'ptaxis', 'pthdfc', 'ptsbi', 'okaxis', 'okhdfcbank',
  'okicici', 'oksbi', 'apl', 'yapl', 'rapl', 'abfspay', 'axisbank', 'icici', 'hdfcbank', 'sbi',
  'kotak', 'indus', 'federal', 'idfcbank', 'aubank', 'jupiteraxis', 'fbl', 'freecharge', 'airtel',
  'jio', 'postbank', 'pnb', 'barodampay', 'cnrb', 'boi', 'unionbank', 'yesbank', 'ikwik', 'waaxis',
  'wahdfcbank', 'wasbi', 'waicici', 'slc', 'timecosmos', 'naviaxis', 'superyes', 'axb', 'ibl',
])

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"'`]+|(?:[a-z0-9-]+\.)+(?:com|in|net|org|xyz|top|club|online|site|info|live|shop|co|io|me|ly|cc|tk|ml|ga|cf|gq|buzz|icu|vip|work|click|link|app|page|store|fun|cyou|rest|sbs|bar|monster|loan|win|bid)(?:\/[^\s<>"'`]*)?)/gi
const EMAIL_OR_UPI_RE = /\b([a-z0-9._-]{1,256})@([a-z][a-z0-9.-]{1,64})\b/gi
// Indian mobile numbers: optional +91 / 0 prefix, 10 digits starting 6-9, allowing spaces/dashes.
const PHONE_RE = /(?:\+?91[\s-]?|\b0)?\b([6-9]\d{4}[\s-]?\d{5})\b/g
const AMOUNT_RE = /(?:₹|rs\.?|inr|rupees?)\s*([\d,]+(?:\.\d+)?)\s*(lakh|lac|crore|cr|k)?|([\d,]+(?:\.\d+)?)\s*(lakh|lac|crore|cr)\b/gi

function trimUrl(u: string): string {
  return u.replace(/[).,;:!?\]}'"]+$/, '')
}

export function normalizeUrl(raw: string): string | null {
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`
    const url = new URL(withScheme)
    return url.hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  const last10 = digits.slice(-10)
  return /^[6-9]\d{9}$/.test(last10) ? last10 : null
}

function parseAmount(num: string, unit?: string): number {
  const value = parseFloat(num.replace(/,/g, ''))
  if (Number.isNaN(value)) return 0
  switch ((unit || '').toLowerCase()) {
    case 'k': return value * 1_000
    case 'lakh': case 'lac': return value * 100_000
    case 'crore': case 'cr': return value * 10_000_000
    default: return value
  }
}

export function extractEntities(text: string): Extracted {
  const entities: Entity[] = []
  const seen = new Set<string>()
  const push = (e: Entity) => {
    const key = `${e.type}:${e.normalized}`
    if (!seen.has(key)) { seen.add(key); entities.push(e) }
  }

  // Emails and UPI IDs share the same "x@y" shape, so classify by handle.
  const atSpans: Array<[number, number]> = []
  for (const m of text.matchAll(EMAIL_OR_UPI_RE)) {
    const [full, user, domain] = m
    atSpans.push([m.index!, m.index! + full.length])
    const handle = domain.toLowerCase()
    if (!handle.includes('.') || UPI_HANDLES.has(handle)) {
      push({ type: 'upi', raw: full, normalized: `${user.toLowerCase()}@${handle}` })
    } else {
      push({ type: 'email', raw: full, normalized: full.toLowerCase() })
    }
  }
  const insideAt = (i: number) => atSpans.some(([s, e]) => i >= s && i < e)

  for (const m of text.matchAll(URL_RE)) {
    if (insideAt(m.index!)) continue
    const raw = trimUrl(m[1])
    const host = normalizeUrl(raw)
    if (host && host.includes('.')) push({ type: 'url', raw, normalized: host })
  }

  for (const m of text.matchAll(PHONE_RE)) {
    const normalized = normalizePhone(m[0])
    if (normalized) push({ type: 'phone', raw: m[0].trim(), normalized })
  }

  const amounts: number[] = []
  for (const m of text.matchAll(AMOUNT_RE)) {
    const amount = m[1] ? parseAmount(m[1], m[2]) : parseAmount(m[3], m[4])
    if (amount > 0) amounts.push(amount)
  }

  return { entities, amounts }
}

/** Detects which kind of single value a user typed into the lookup box. */
export function classifyValue(value: string): Entity | null {
  const v = value.trim()
  if (!v) return null
  const at = v.match(/^([a-z0-9._-]{1,256})@([a-z][a-z0-9.-]{1,64})$/i)
  if (at) {
    const handle = at[2].toLowerCase()
    if (!handle.includes('.') || UPI_HANDLES.has(handle)) return { type: 'upi', raw: v, normalized: v.toLowerCase() }
    return { type: 'email', raw: v, normalized: v.toLowerCase() }
  }
  const phone = normalizePhone(v)
  if (phone && v.replace(/[\s+()-]/g, '').length <= 13 && /^[\d\s+()-]+$/.test(v)) return { type: 'phone', raw: v, normalized: phone }
  const host = normalizeUrl(v)
  if (host && host.includes('.') && !/\s/.test(v)) return { type: 'url', raw: v, normalized: host }
  return null
}
