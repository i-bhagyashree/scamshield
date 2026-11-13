/**
 * Looks up when a domain was registered using RDAP (the free, official successor to WHOIS).
 * Scam sites are usually days or weeks old. Results are cached in SQLite for 7 days.
 */
import { db } from '../db.js'
import { config } from '../config.js'
import type { Signal } from './url.js'
import { domainAgeSignalFromDate } from './core.js'

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

export async function domainAgeSignal(domain: string): Promise<Signal | null> {
  const registered = await getDomainRegistration(domain)
  return registered ? domainAgeSignalFromDate(domain, registered) : null
}
