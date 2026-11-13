/**
 * Reporter reputation = how many times other people confirmed ("I got this too") this user's reports.
 * Trusted reporters' reports count for more in the risk score, which makes fake reports less effective.
 */
import { db } from '../db.js'

export const TRUSTED_AT = 3
export const GUARDIAN_AT = 10

export interface Badge {
  key: 'new' | 'trusted' | 'guardian'
  label: string
}

/** SQL expression for a reporter's reputation; `alias` is the reports table alias. */
export const REPUTATION_SQL = (alias: string) => `(SELECT COUNT(*) FROM report_votes rv JOIN reports rr ON rr.id = rv.report_id
  WHERE rr.user_id = ${alias}.user_id AND rv.user_id != rr.user_id)`

export function badgeFor(reputation: number): Badge {
  if (reputation >= GUARDIAN_AT) return { key: 'guardian', label: 'Top guardian' }
  if (reputation >= TRUSTED_AT) return { key: 'trusted', label: 'Trusted reporter' }
  return { key: 'new', label: 'New reporter' }
}

export function nextBadgeAt(reputation: number): number | null {
  if (reputation < TRUSTED_AT) return TRUSTED_AT
  if (reputation < GUARDIAN_AT) return GUARDIAN_AT
  return null
}

const repStmt = db.prepare(`SELECT COUNT(*) AS n FROM report_votes v JOIN reports r ON r.id = v.report_id
  WHERE r.user_id = ? AND v.user_id != r.user_id`)

export function reputationOf(userId: number): number {
  return (repStmt.get(userId) as { n: number }).n
}
