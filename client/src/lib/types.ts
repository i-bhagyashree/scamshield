export type Verdict = 'low_risk' | 'suspicious' | 'dangerous'
export type EntityType = 'url' | 'phone' | 'upi' | 'email'

export interface Signal {
  id: string
  label: string
  detail: string
  weight: number
  source: 'pattern' | 'link' | 'domain' | 'community' | 'ai' | 'trust'
}

export interface CommunityMatch {
  type: EntityType
  value: string
  reports: number
  confirmations: number
  categories: string[]
  totalLost: number
  lastReportedAt: string | null
}

export interface CheckResult {
  id: string
  score: number
  ruleScore: number
  verdict: Verdict
  category: string
  categoryLabel: string
  summary: string
  signals: Signal[]
  advice: string[]
  entities: Array<{ type: EntityType; value: string; raw: string; community: CommunityMatch | null }>
  ai: { score: number; summary: string; redFlags: string[] } | null
  amounts: number[]
  createdAt: string
}

export interface User {
  id: number
  name: string
}

export interface Report {
  id: number
  type: EntityType
  value: string
  category: string
  categoryLabel: string
  description: string
  amountLost: number
  confirmations: number
  reporter: string
  reporterBadge: Badge | null
  createdAt: string
  votedByMe: boolean
  flaggedByMe: boolean
  isMine: boolean
}

export interface Stats {
  /** True when the server is showing sample data, not real activity. */
  demo: boolean
  totals: { checks: number; dangerous: number; reports: number; amountLost: number; users: number }
  byCategory: Array<{ category: string; label: string; count: number }>
  daily: Array<{ day: string; dangerous: number; suspicious: number; lowRisk: number }>
  topReported: Array<{ type: EntityType; value: string; reports: number; confirmations: number; categoryLabel: string }>
}

export const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'kyc_bank', label: 'Fake KYC / bank alert' },
  { value: 'otp_fraud', label: 'OTP / PIN theft' },
  { value: 'lottery_prize', label: 'Fake lottery / prize' },
  { value: 'job_task', label: 'Task-based job scam' },
  { value: 'fake_internship', label: 'Fake internship / job offer' },
  { value: 'electricity_bill', label: 'Electricity bill scam' },
  { value: 'digital_arrest', label: '"Digital arrest" / fake officials' },
  { value: 'investment', label: 'Investment / trading scam' },
  { value: 'refund_qr', label: 'Refund / QR code scam' },
  { value: 'loan_app', label: 'Illegal loan app' },
  { value: 'family_emergency', label: 'Family emergency / impersonation' },
  { value: 'remote_access', label: 'Remote-access app scam' },
  { value: 'generic', label: 'Other' },
]

export const TYPE_LABEL: Record<EntityType, string> = { phone: 'Phone', upi: 'UPI ID', url: 'Website', email: 'Email' }

export interface Badge {
  key: 'new' | 'trusted' | 'guardian'
  label: string
}

export interface Summary {
  checks: number
  scamsCaught: number
  suspicious: number
  reports: number
  watching: number
  topCategories: Array<{ label: string; count: number }>
  reputation: { points: number; badge: Badge; nextAt: number | null }
}

export interface WatchItem {
  id: number
  type: EntityType
  value: string
  label: string | null
  createdAt: string
  reports: number
  lastReportedAt: string | null
}

export interface AppNotification {
  id: number
  kind: 'watchlist' | 'circle' | string
  title: string
  body: string
  link: string | null
  read: boolean
  createdAt: string
}

export interface Circle {
  id: number
  name: string
  code: string
  isOwner: boolean
  members: Array<{ id: number; name: string; isOwner: boolean; isMe: boolean; joinedAt: string }>
}
