import type { Verdict } from './types'

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const units: Array<[number, string]> = [[60, 'minute'], [3600, 'hour'], [86400, 'day'], [2592000, 'month'], [31536000, 'year']]
  let label = 'minute'
  let size = 60
  for (const [s, l] of units) if (seconds >= s) { size = s; label = l }
  const n = Math.floor(seconds / size)
  return `${n} ${label}${n === 1 ? '' : 's'} ago`
}

export function rupees(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`
}

export function compact(n: number): string {
  return n.toLocaleString('en-IN')
}

export const VERDICT_TEXT: Record<Verdict, { title: string; short: string }> = {
  dangerous: { title: 'Very likely a scam', short: 'Dangerous' },
  suspicious: { title: 'Be careful: this looks suspicious', short: 'Suspicious' },
  low_risk: { title: 'No major red flags found', short: 'Low risk' },
}
