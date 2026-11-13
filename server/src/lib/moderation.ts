/**
 * Community moderation for reports.
 * A report is hidden once at least FLAG_THRESHOLD people flag it AND flags outnumber
 * "I got this too" confirmations. Hidden reports disappear from the feed, lookups, stats and
 * risk scores, so one person can't pin a fake report on an innocent number, and a group can't
 * bury a report that many victims have confirmed.
 */
export const FLAG_THRESHOLD = 3

const flags = (a: string) => `(SELECT COUNT(*) FROM report_flags f WHERE f.report_id = ${a}.id)`
const votes = (a: string) => `(SELECT COUNT(*) FROM report_votes v WHERE v.report_id = ${a}.id)`

/** SQL condition that is true for reports that should be shown. `a` is the reports table alias. */
export const VISIBLE_SQL = (a: string) => `(${flags(a)} < ${FLAG_THRESHOLD} OR ${flags(a)} <= ${votes(a)})`
