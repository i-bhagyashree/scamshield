import { useState } from 'react'
import { api, post } from '../lib/api'
import { rupees, timeAgo } from '../lib/format'
import { TYPE_LABEL, type Report } from '../lib/types'
import { STATIC_DEMO } from '../lib/staticMode'

const FLAG_REASONS = [
  { value: 'wrong', label: 'This number / ID is not a scammer' },
  { value: 'spam', label: 'Spam or fake report' },
  { value: 'personal', label: 'Contains personal information' },
] as const

export default function ReportCard({ report }: { report: Report }) {
  const [state, setState] = useState({ confirmations: report.confirmations, voted: report.votedByMe })
  const [flagged, setFlagged] = useState(report.flaggedByMe)
  const [flagOpen, setFlagOpen] = useState(false)
  const [removed, setRemoved] = useState<'deleted' | 'hidden' | null>(null)
  const [error, setError] = useState('')

  const confirm = async () => {
    setError('')
    try {
      const r = await post<{ confirmations: number; votedByMe: boolean }>(`/reports/${report.id}/confirm`, {})
      setState({ confirmations: r.confirmations, voted: r.votedByMe })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    }
  }

  const flag = async (reason: string) => {
    setError('')
    setFlagOpen(false)
    try {
      const r = await post<{ flaggedByMe: boolean; hidden: boolean }>(`/reports/${report.id}/flag`, { reason })
      setFlagged(r.flaggedByMe)
      if (r.hidden) setRemoved('hidden')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    }
  }

  const remove = async () => {
    if (!window.confirm('Delete your report? It will stop warning other people.')) return
    try {
      await api(`/reports/${report.id}`, { method: 'DELETE' })
      setRemoved('deleted')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    }
  }

  if (removed) {
    return (
      <div className="report card report-removed muted small">
        {removed === 'deleted' ? 'Your report was deleted.' : 'Thanks. Enough people flagged this report, so it is now hidden.'}
      </div>
    )
  }

  return (
    <article className="report card">
      <div className="report-top">
        <span className="entity-type">{TYPE_LABEL[report.type]}</span>
        <span className="report-value">{report.value}</span>
        <span className="pill pill-suspicious">{report.categoryLabel}</span>
      </div>
      <p className="report-desc">{report.description}</p>
      <div className="report-meta">
        <span className="muted small">
          {report.isMine ? 'You' : report.reporter}
          {report.reporterBadge && report.reporterBadge.key !== 'new' && (
            <span className={`mini-badge badge-${report.reporterBadge.key}`} title={report.reporterBadge.label}>
              {report.reporterBadge.key === 'guardian' ? '🏅' : '🛡️'} {report.reporterBadge.label}
            </span>
          )}
          {' · '}{timeAgo(report.createdAt)}
          {report.amountLost > 0 && <> · <strong className="lost">{rupees(report.amountLost)} lost</strong></>}
        </span>
        <div className="report-actions">
          {STATIC_DEMO ? null : report.isMine ? (
            <button className="btn btn-link btn-sm" onClick={remove}>Delete</button>
          ) : (
            <>
              <div className="flag-wrap">
                <button className={`btn btn-link btn-sm ${flagged ? 'flagged' : ''}`} onClick={() => (flagged ? flag('wrong') : setFlagOpen(!flagOpen))} aria-expanded={flagOpen}>
                  {flagged ? '⚑ Flagged (undo)' : '⚑ Report a problem'}
                </button>
                {flagOpen && (
                  <div className="flag-menu" role="menu">
                    {FLAG_REASONS.map((r) => (
                      <button key={r.value} role="menuitem" onClick={() => flag(r.value)}>{r.label}</button>
                    ))}
                  </div>
                )}
              </div>
              <button className={`btn btn-sm ${state.voted ? 'btn-voted' : 'btn-ghost'}`} onClick={confirm} aria-pressed={state.voted}>
                {state.voted ? '✓ ' : ''}I got this too{state.confirmations > 0 && ` · ${state.confirmations}`}
              </button>
            </>
          )}
        </div>
      </div>
      {error && <p className="form-error small">{error}</p>}
    </article>
  )
}
