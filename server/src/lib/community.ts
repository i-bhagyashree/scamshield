import { db } from '../db.js'
import type { EntityType } from '../analyzer/extract.js'
import { REPUTATION_SQL, TRUSTED_AT } from './reputation.js'
import { VISIBLE_SQL } from './moderation.js'
import type { CommunityMatch } from '../analyzer/core.js'

export type { CommunityMatch }

const lookupStmt = db.prepare(`
  SELECT COUNT(*)                          AS reports,
         COALESCE(SUM((SELECT COUNT(*) FROM report_votes v WHERE v.report_id = r.id)), 0) AS confirmations,
         COALESCE(SUM(CASE WHEN r.user_id IS NOT NULL AND ${REPUTATION_SQL('r')} >= ${TRUSTED_AT} THEN 1 ELSE 0 END), 0) AS trusted_reports,
         GROUP_CONCAT(DISTINCT r.category) AS categories,
         COALESCE(SUM(r.amount_lost), 0)   AS total_lost,
         MAX(r.created_at)                 AS last_reported_at
  FROM reports r
  WHERE r.type = ? AND r.value = ? AND ${VISIBLE_SQL('r')}
`)

export function lookupCommunity(type: EntityType, value: string): CommunityMatch {
  const row = lookupStmt.get(type, value) as {
    reports: number; confirmations: number; trusted_reports: number; categories: string | null; total_lost: number; last_reported_at: string | null
  }
  return {
    type,
    value,
    reports: row.reports,
    confirmations: row.confirmations,
    trustedReports: row.trusted_reports,
    categories: row.categories ? row.categories.split(',') : [],
    totalLost: row.total_lost,
    lastReportedAt: row.last_reported_at ? `${row.last_reported_at.replace(' ', 'T')}Z` : null,
  }
}
