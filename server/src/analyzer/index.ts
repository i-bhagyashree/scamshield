/**
 * Server entry to the analyzer: wires the pure core (core.ts) to the SQLite community
 * database, live RDAP domain-age lookups and the optional Claude review.
 */
import { analyzeTextWith, analyzeDomainWith } from './core.js'
import { domainAgeSignal } from './domainAge.js'
import { aiAnalyze } from './ai.js'
import { lookupCommunity } from '../lib/community.js'

export * from './core.js'

export interface AnalyzeOptions {
  useAi?: boolean
}

export function analyzeText(text: string, opts: AnalyzeOptions = {}) {
  return analyzeTextWith(text, { lookupCommunity, domainAgeSignal, aiAnalyze: opts.useAi === false ? null : aiAnalyze })
}

/** Fast path used by the browser extension: checks one website without AI. */
export function analyzeDomain(host: string) {
  return analyzeDomainWith(host, { lookupCommunity, domainAgeSignal })
}
