/**
 * Looks up when a domain was registered using RDAP (the free, official successor to WHOIS).
 * Scam sites are usually days or weeks old. Results are cached in SQLite for 7 days.
 */
import { db } from '../db.js'
import { config } from '../config.js'
import type { Signal } from './url.js'

const CACHE_DAYS = 7
const TIMEOUT_MS = 3500

const getCached = db.prepare(`SELECT registered_at FROM domain_cache WHERE domain = ? AND checked_at > datetime('now', ?)`)
const putCached = db.prepare(`INSERT INTO domain_cache (domain, registered_at, checked_at) VALUES (?, ?, datetime('now'))
  ON CONFLICT(domain) DO UPDATE SET registered_at = excluded.registered_at, checked_at = excluded.checked_at`)

interface RdapResponse {
  events?: Array<{ eventAction?: string; eventDate?: string }>
}

/**
 * Returns { date } for a definitive answer (including "registry has no date" / not found),
 * or null when the lookup failed and should be retried later instead of cached.
 */
async function fetchRegistrationDate(domain: string): Promise<{ date: string | null } | null> {
  const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
    // rdap.org rejects requests without a descriptive User-Agent.
    headers: { Accept: 'application/rdap+json, application/json', 'User-Agent': 'ScamShield/1.0 (domain-age check)' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: 'follow',
  })
  if (res.status === 404) return { date: null }
  if (!res.ok) return null
  const data = (await res.json()) as RdapResponse
  const reg = data.events?.find((e) => e.eventAction === 'registration')
  return { date: reg?.eventDate ?? null }
}

/** Returns the registration date (ISO string), or null if unknown. Never throws. */
export async function getDomainRegistration(domain: string): Promise<string | null> {
  const cached = getCached.get(domain, `-${CACHE_DAYS} days`) as { registered_at: string | null } | undefined
  if (cached) return cached.registered_at
  if (!config.networkChecks) return null
  try {
    const result = await fetchRegistrationDate(domain)
    if (result) putCached.run(domain, result.date)
    return result?.date ?? null
  } catch {
    return null // network error or timeout: do not cache, just skip the signal
  }
}

export function ageInDays(isoDate: string, now = Date.now()): number {
  return Math.floor((now - new Date(isoDate).getTime()) / 86_400_000)
}

export async function domainAgeSignal(domain: string): Promise<Signal | null> {
  const registered = await getDomainRegistration(domain)
  if (!registered) return null
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
