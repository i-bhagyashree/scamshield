import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ReportCard from '../components/ReportCard'
import { api } from '../lib/api'
import { compact, rupees } from '../lib/format'
import { CATEGORY_OPTIONS, TYPE_LABEL, type EntityType, type Report, type Stats } from '../lib/types'

const SERIES = [
  { key: 'dangerous', label: 'Dangerous' },
  { key: 'suspicious', label: 'Suspicious' },
  { key: 'lowRisk', label: 'Low risk' },
] as const

function DailyChart({ daily }: { daily: Stats['daily'] }) {
  const [hover, setHover] = useState<number | null>(null)
  const [asTable, setAsTable] = useState(false)
  const W = 640, H = 200, pad = { l: 28, r: 8, t: 8, b: 22 }
  const max = Math.max(1, ...daily.map((d) => d.dangerous + d.suspicious + d.lowRisk))
  const niceMax = Math.ceil(max / 5) * 5
  const bw = (W - pad.l - pad.r) / daily.length
  const barW = Math.min(28, bw * 0.62)
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / niceMax)
  const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

  return (
    <div className="chart-card card">
      <div className="chart-head">
        <h3>Checks in the last 14 days</h3>
        <button className="btn btn-link small" onClick={() => setAsTable(!asTable)}>{asTable ? 'Show chart' : 'View as table'}</button>
      </div>
      <div className="legend" aria-hidden={asTable}>
        {SERIES.map((s) => <span key={s.key} className="legend-item"><i className={`swatch sw-${s.key}`} />{s.label}</span>)}
      </div>
      {asTable ? (
        <table className="data-table">
          <thead><tr><th>Day</th>{SERIES.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
          <tbody>{daily.map((d) => <tr key={d.day}><td>{fmtDay(d.day)}</td><td>{d.dangerous}</td><td>{d.suspicious}</td><td>{d.lowRisk}</td></tr>)}</tbody>
        </table>
      ) : (
        <div className="chart-wrap" onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Stacked bar chart of daily checks by risk level">
            {[0, 0.5, 1].map((f) => (
              <g key={f}>
                <line x1={pad.l} x2={W - pad.r} y1={y(niceMax * f)} y2={y(niceMax * f)} className="grid" />
                <text x={pad.l - 6} y={y(niceMax * f) + 4} className="axis" textAnchor="end">{Math.round(niceMax * f)}</text>
              </g>
            ))}
            {daily.map((d, i) => {
              const cx = pad.l + bw * i + bw / 2
              let acc = 0
              const segs = SERIES.map((s) => {
                const v = d[s.key]
                const seg = { key: s.key, y0: acc, y1: acc + v }
                acc += v
                return seg
              }).filter((s) => s.y1 > s.y0)
              return (
                <g key={d.day} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0}>
                  <rect x={pad.l + bw * i} y={pad.t} width={bw} height={H - pad.t - pad.b} className="hit" />
                  {segs.map((s, k) => {
                    const top = y(s.y1), bottom = y(s.y0)
                    const gap = k > 0 ? 2 : 0 // 2px surface gap between stacked segments
                    const h = Math.max(0, bottom - top - gap)
                    const isTop = k === segs.length - 1
                    return isTop ? (
                      <path key={s.key} className={`bar bar-${s.key} ${hover === i ? 'is-hover' : ''}`}
                        d={`M${cx - barW / 2},${top + h} v${-(h - Math.min(4, h))} q0,-${Math.min(4, h)} ${Math.min(4, h)},-${Math.min(4, h)} h${barW - 2 * Math.min(4, h)} q${Math.min(4, h)},0 ${Math.min(4, h)},${Math.min(4, h)} v${h - Math.min(4, h)} z`} />
                    ) : (
                      <rect key={s.key} className={`bar bar-${s.key} ${hover === i ? 'is-hover' : ''}`} x={cx - barW / 2} y={top} width={barW} height={h} />
                    )
                  })}
                  {(i % 2 === 1 || daily.length <= 7) && <text x={cx} y={H - 6} className="axis" textAnchor="middle">{fmtDay(d.day)}</text>}
                </g>
              )
            })}
          </svg>
          {hover !== null && (
            <div className="tooltip" style={{ left: `${((pad.l + bw * hover + bw / 2) / W) * 100}%` }}>
              <strong>{fmtDay(daily[hover].day)}</strong>
              {SERIES.map((s) => <div key={s.key}><i className={`swatch sw-${s.key}`} />{s.label}<b>{daily[hover][s.key]}</b></div>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CategoryBars({ data }: { data: Stats['byCategory'] }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <div className="card chart-card">
      <h3>Most common scams (30 days)</h3>
      {data.length === 0 ? <p className="muted">No data yet.</p> : (
        <ul className="hbars">
          {data.slice(0, 7).map((d) => (
            <li key={d.category} title={`${d.label}: ${d.count}`}>
              <span className="hbar-label">{d.label}</span>
              <span className="hbar-track"><span className="hbar-fill" style={{ width: `${(d.count / max) * 100}%` }} /></span>
              <span className="hbar-value">{d.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function CommunityPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [nextOffset, setNextOffset] = useState<number | null>(0)
  const [filter, setFilter] = useState<{ type: string; category: string }>({ type: '', category: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api<Stats>('/stats').then(setStats).catch((e) => setError(e.message))
  }, [])

  const load = async (offset: number, replace: boolean) => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ offset: String(offset), limit: '10', ...(filter.type && { type: filter.type }), ...(filter.category && { category: filter.category }) })
      const d = await api<{ reports: Report[]; nextOffset: number | null }>(`/reports?${q}`)
      setReports((prev) => (replace ? d.reports : [...prev, ...d.reports]))
      setNextOffset(d.nextOffset)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(0, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  return (
    <div>
      <h1>Community</h1>
      <p className="muted">What people are checking and reporting right now. Every report makes the next check smarter.</p>
      {error && <p className="form-error">{error}</p>}

      {stats && (
        <>
          {stats.demo && <p className="demo-note" role="note">🧪 This site is showing <strong>sample data</strong> for demonstration. Numbers and reports below are made up.</p>}
          <div className="stat-grid">
            <div className="stat card"><span className="stat-value">{compact(stats.totals.checks)}</span><span className="stat-label">Messages checked</span></div>
            <div className="stat card"><span className="stat-value">{compact(stats.totals.dangerous)}</span><span className="stat-label">Scams caught</span></div>
            <div className="stat card"><span className="stat-value">{compact(stats.totals.reports)}</span><span className="stat-label">Community reports</span></div>
            <div className="stat card"><span className="stat-value">{rupees(stats.totals.amountLost)}</span><span className="stat-label">Reported lost</span></div>
          </div>
          <div className="chart-grid">
            <DailyChart daily={stats.daily} />
            <CategoryBars data={stats.byCategory} />
          </div>
          {stats.topReported.length > 0 && (
            <div className="card">
              <h3>Most reported</h3>
              <div className="top-list">
                {stats.topReported.map((t) => {
                  const body = (
                    <>
                      <span className="entity-type">{TYPE_LABEL[t.type as EntityType]}</span>
                      <span className="report-value">{t.value}</span>
                      <span className="muted small">{t.categoryLabel} · {t.reports + t.confirmations} people</span>
                    </>
                  )
                  // Phone numbers are masked in public stats, so they can't be looked up from here.
                  return t.type === 'phone'
                    ? <div key={`${t.type}:${t.value}`} className="top-item">{body}</div>
                    : <Link key={`${t.type}:${t.value}`} to={`/lookup?q=${encodeURIComponent(t.value)}`} className="top-item">{body}</Link>
                })}
              </div>
            </div>
          )}
        </>
      )}

      <div className="feed-head">
        <h2>Latest reports</h2>
        <div className="filters">
          <select aria-label="Filter by type" value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value })}>
            <option value="">All types</option>
            {(['phone', 'upi', 'url', 'email'] as const).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
          <select aria-label="Filter by scam type" value={filter.category} onChange={(e) => setFilter({ ...filter, category: e.target.value })}>
            <option value="">All scams</option>
            {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <Link to="/report" className="btn btn-primary btn-sm">+ Report</Link>
        </div>
      </div>
      <div className="stack">
        {reports.map((r) => <ReportCard key={r.id} report={r} />)}
        {!loading && reports.length === 0 && <div className="card empty"><p>No reports match these filters.</p></div>}
      </div>
      {nextOffset !== null && reports.length > 0 && (
        <div className="center"><button className="btn btn-ghost" disabled={loading} onClick={() => load(nextOffset, false)}>{loading ? 'Loading…' : 'Load more'}</button></div>
      )}
    </div>
  )
}
