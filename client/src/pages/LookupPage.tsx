import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ReportCard from '../components/ReportCard'
import { api, post } from '../lib/api'
import { rupees, timeAgo } from '../lib/format'
import { TYPE_LABEL, type EntityType, type Report } from '../lib/types'
import { STATIC_DEMO } from '../lib/staticMode'

interface LookupResult {
  type: EntityType
  value: string
  reports: number
  confirmations: number
  totalLost: number
  categories: string[]
  lastReportedAt: string | null
  watching: boolean
  items: Report[]
}

function WatchButton({ value, watching }: { value: string; watching: boolean }) {
  const [on, setOn] = useState(watching)
  const [busy, setBusy] = useState(false)
  useEffect(() => setOn(watching), [watching])
  const toggle = async () => {
    setBusy(true)
    try {
      if (on) await api(`/me/watchlist?value=${encodeURIComponent(value)}`, { method: 'DELETE' })
      else await post('/me/watchlist', { value })
      setOn(!on)
    } catch {
      /* already watching or limit reached: leave state as is */
    } finally {
      setBusy(false)
    }
  }
  return (
    <button className={`btn btn-sm ${on ? 'btn-voted' : 'btn-ghost'}`} onClick={toggle} disabled={busy} aria-pressed={on}>
      {on ? '✓ Watching' : '👀 Watch for reports'}
    </button>
  )
}

export default function LookupPage() {
  const [params, setParams] = useSearchParams()
  const [value, setValue] = useState(params.get('q') || '')
  const [result, setResult] = useState<LookupResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const run = async (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    setError('')
    try {
      setResult(await api<LookupResult>(`/lookup?value=${encodeURIComponent(q.trim())}`))
    } catch (e) {
      setResult(null)
      setError(e instanceof Error ? e.message : 'Lookup failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const q = params.get('q')
    if (q) run(q)
  }, [params])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setParams({ q: value.trim() })
  }

  const people = result ? result.reports + result.confirmations : 0

  return (
    <div className="narrow">
      <h1>Look up a number, UPI ID or website</h1>
      <p className="muted">Got a call, a payment request or a link from someone you don't know? See if other people have reported it.</p>
      <form className="card lookup-form" onSubmit={onSubmit}>
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="98XXXXXXXX, name@ybl or website.com" aria-label="Value to look up" />
        <button className="btn btn-primary" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}

      {result && (
        <>
          <section className={`card lookup-summary ${people ? 'lookup-bad' : 'lookup-clean'}`}>
            <div className="lookup-icon">{people ? '🚩' : '✓'}</div>
            <div>
              <p className="muted small">{TYPE_LABEL[result.type]}</p>
              <h2 className="break">{result.value}</h2>
              {people ? (
                <p>
                  Reported by <strong>{people} {people === 1 ? 'person' : 'people'}</strong> for {result.categories.join(', ')}.
                  {result.totalLost > 0 && <> People report losing <strong>{rupees(result.totalLost)}</strong>.</>}
                  {result.lastReportedAt && <> Last reported {timeAgo(result.lastReportedAt)}.</>}
                </p>
              ) : (
                <p>
                  No reports yet. That's a good sign, but it doesn't prove it's safe: new scam numbers appear every day.{' '}
                  <Link to={`/check?text=${encodeURIComponent(result.value)}`}>Run a full check</Link> or{' '}
                  <Link to={`/report?value=${encodeURIComponent(result.value)}`}>report it</Link> if it scammed you.
                </p>
              )}
              {!STATIC_DEMO && <WatchButton value={result.value} watching={result.watching} />}
              {!people && !STATIC_DEMO && <p className="muted small watch-hint">Watch it and we'll alert you if anyone reports it later.</p>}
            </div>
          </section>
          <div className="stack">
            {result.items.map((r) => <ReportCard key={r.id} report={r} />)}
          </div>
        </>
      )}
    </div>
  )
}
