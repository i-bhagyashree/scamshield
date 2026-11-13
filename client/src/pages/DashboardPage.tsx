import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { DEVICE_ID_PATTERN, api, getDeviceId, post, setDeviceId } from '../lib/api'
import { useAuth } from '../lib/auth'
import { VERDICT_TEXT, timeAgo } from '../lib/format'
import { TYPE_LABEL, type Circle, type Summary, type Verdict, type WatchItem } from '../lib/types'

const BADGE_ICON = { new: '🌱', trusted: '🛡️', guardian: '🏅' } as const

function ReputationCard({ rep }: { rep: Summary['reputation'] }) {
  const prev = rep.badge.key === 'new' ? 0 : rep.badge.key === 'trusted' ? 3 : 10
  const pct = rep.nextAt ? Math.min(100, ((rep.points - prev) / (rep.nextAt - prev)) * 100) : 100
  return (
    <div className="card rep-card">
      <div className="rep-top">
        <span className="rep-icon" aria-hidden="true">{BADGE_ICON[rep.badge.key]}</span>
        <div>
          <p className="muted small">Your reporter badge</p>
          <h3 className={`badge-text badge-${rep.badge.key}`}>{rep.badge.label}</h3>
        </div>
      </div>
      <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="small muted">
        {rep.nextAt
          ? `${rep.points} confirmation${rep.points === 1 ? '' : 's'} on your reports. ${rep.nextAt - rep.points} more to reach ${rep.nextAt === 3 ? 'Trusted reporter' : 'Top guardian'}.`
          : `${rep.points} confirmations. You're a Top guardian!`}
      </p>
      <p className="small">Trusted reporters' reports carry more weight in everyone's risk score.</p>
    </div>
  )
}

function Watchlist({ onChange }: { onChange: () => void }) {
  const [items, setItems] = useState<WatchItem[] | null>(null)
  const [form, setForm] = useState({ value: '', label: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api<{ items: WatchItem[] }>('/me/watchlist').then((d) => setItems(d.items)).catch((e) => setError(e.message))
  }, [])

  const add = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const d = await post<{ item: WatchItem }>('/me/watchlist', form)
      setItems((prev) => [d.item, ...(prev || [])])
      setForm({ value: '', label: '' })
      onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: number) => {
    await api(`/me/watchlist/${id}`, { method: 'DELETE' })
    setItems((prev) => prev?.filter((i) => i.id !== id) ?? null)
    onChange()
  }

  return (
    <section className="card" id="watchlist">
      <h2>👀 Watchlist</h2>
      <p className="muted small">Got a call or payment request you're unsure about? Watch the number, UPI ID or website. If anyone reports it later, you'll get an alert.</p>
      <form className="watch-form" onSubmit={add}>
        <input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="98XXXXXXXX, name@ybl or site.com" aria-label="Value to watch" required />
        <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Note (optional), e.g. 'OLX buyer'" aria-label="Note" maxLength={40} />
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Adding…' : 'Watch'}</button>
      </form>
      {error && <p className="form-error">{error}</p>}
      {items?.length === 0 && <p className="muted small">Nothing on your watchlist yet.</p>}
      <ul className="watch-list">
        {items?.map((w) => (
          <li key={w.id} className={w.reports ? 'watch-hit' : ''}>
            <span className="entity-type">{TYPE_LABEL[w.type]}</span>
            <div className="watch-body">
              <span className="report-value">{w.value}</span>
              {w.label && <span className="muted small">{w.label}</span>}
            </div>
            {w.reports > 0
              ? <Link className="watch-status bad" to={`/lookup?q=${encodeURIComponent(w.value)}`}>🚩 Reported {w.reports}×</Link>
              : <span className="watch-status ok">✓ No reports</span>}
            <button className="btn btn-link btn-sm" onClick={() => remove(w.id)} aria-label={`Stop watching ${w.value}`}>Remove</button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ProfileCard() {
  const { user, setName } = useAuth()
  const [name, setNameInput] = useState(user?.name === 'Anonymous' ? '' : user?.name ?? '')
  const [saved, setSaved] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const [restore, setRestore] = useState('')
  const [error, setError] = useState('')

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await setName(name)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  const useCode = (e: FormEvent) => {
    e.preventDefault()
    const code = restore.trim()
    if (!DEVICE_ID_PATTERN.test(code)) {
      setError('That code does not look right. Copy it again from your other device.')
      return
    }
    if (!window.confirm('Switch this browser to the data from your other device? Anything saved only on this browser will no longer be shown here.')) return
    setDeviceId(code)
    window.location.reload()
  }

  return (
    <section className="card" id="profile">
      <h2>🙂 Your profile</h2>
      <p className="muted small">No account needed. This browser is remembered automatically. Your name is shown on your reports and to your family circle.</p>
      <form className="inline-form" onSubmit={save}>
        <input value={name} onChange={(e) => setNameInput(e.target.value)} placeholder="Your name" maxLength={40} aria-label="Your name" required />
        <button className="btn btn-primary">{saved ? 'Saved ✓' : 'Save'}</button>
      </form>
      <details className="device-transfer">
        <summary>Use ScamShield on another phone or browser</summary>
        <p className="small muted">
          Copy this code and paste it on your other device to see the same watchlist, family circle and alerts.
          <strong> Keep it private:</strong> anyone with this code can use your ScamShield data.
        </p>
        <div className="inline-form">
          <input readOnly value={showCode ? getDeviceId() : '•'.repeat(24)} aria-label="Your device code" className="code-input" />
          <button type="button" className="btn btn-ghost" onClick={() => setShowCode(!showCode)}>{showCode ? 'Hide' : 'Show'}</button>
          <button type="button" className="btn btn-ghost" onClick={async () => {
            try { await navigator.clipboard.writeText(getDeviceId()) } catch { setShowCode(true) }
          }}>Copy</button>
        </div>
        <form className="inline-form" onSubmit={useCode}>
          <input value={restore} onChange={(e) => setRestore(e.target.value)} placeholder="Paste a code from your other device" aria-label="Code from another device" />
          <button className="btn btn-ghost">Use this code</button>
        </form>
      </details>
      {error && <p className="form-error">{error}</p>}
    </section>
  )
}

function FamilyCircle() {
  const { user, setName: saveMyName } = useAuth()
  const needsName = !user || user.name === 'Anonymous'
  const [myName, setMyName] = useState('')
  const [circle, setCircle] = useState<Circle | null | undefined>(undefined)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api<{ circle: Circle | null }>('/me/circle').then((d) => setCircle(d.circle)).catch((e) => setError(e.message))
  }, [])

  const run = async (fn: () => Promise<void>) => {
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  // Family alerts say "<name> received a dangerous message", so ask for a name first.
  const ensureName = async () => {
    if (!needsName) return
    if (!myName.trim()) throw new Error('Enter your name first, so your family knows who the alerts are about.')
    await saveMyName(myName.trim())
  }
  const create = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      await ensureName()
      setCircle((await post<{ circle: Circle }>('/circle', { name })).circle)
    })
  }
  const join = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      await ensureName()
      setCircle((await post<{ circle: Circle }>('/circle/join', { code })).circle)
    })
  }
  const leave = () => {
    if (!window.confirm('Leave this family circle? You will stop getting alerts about its members.')) return
    run(async () => {
      await post('/circle/leave', {})
      setCircle(null)
    })
  }
  const removeMember = (id: number, memberName: string) => {
    if (!window.confirm(`Remove ${memberName} from the circle?`)) return
    run(async () => setCircle((await api<{ circle: Circle }>(`/circle/members/${id}`, { method: 'DELETE' })).circle))
  }

  const inviteText = circle
    ? `Join my family circle "${circle.name}" on ScamShield so we get alerted if any of us receives a scam message. Sign up at ${window.location.origin} and enter code ${circle.code}`
    : ''

  return (
    <section className="card" id="circle">
      <h2>👪 Family circle</h2>
      <p className="muted small">
        When anyone in your circle checks a <strong>dangerous</strong> message, everyone else gets an alert so they can call and help.
        Members only see the scam type and risk score, never the message.
      </p>
      {error && <p className="form-error">{error}</p>}
      {circle === undefined ? null : circle ? (
        <>
          <div className="circle-head">
            <div>
              <h3>{circle.name}</h3>
              <p className="small muted">Invite code: <code className="code">{circle.code}</code></p>
            </div>
            <div className="circle-actions">
              <a className="btn btn-whatsapp btn-sm" href={`https://wa.me/?text=${encodeURIComponent(inviteText)}`} target="_blank" rel="noreferrer">Invite on WhatsApp</a>
              <button className="btn btn-ghost btn-sm" onClick={async () => {
                try { await navigator.clipboard.writeText(circle.code); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { window.prompt('Copy the code', circle.code) }
              }}>{copied ? 'Copied ✓' : 'Copy code'}</button>
            </div>
          </div>
          <ul className="members">
            {circle.members.map((m) => (
              <li key={m.id}>
                <span className="avatar" aria-hidden="true">{m.name[0]?.toUpperCase()}</span>
                <span className="member-name">{m.name}{m.isMe && ' (you)'}</span>
                {m.isOwner && <span className="muted small">Owner</span>}
                {circle.isOwner && !m.isMe && <button className="btn btn-link btn-sm" onClick={() => removeMember(m.id, m.name)}>Remove</button>}
              </li>
            ))}
          </ul>
          {circle.members.length === 1 && <p className="small muted">You're the only member. Share the invite code with your family.</p>}
          <button className="btn btn-link btn-sm" onClick={leave}>Leave circle</button>
        </>
      ) : (
        <div className="circle-setup">
          {needsName && (
            <div>
              <label className="small" htmlFor="my-name">Your name (family will see this)</label>
              <input id="my-name" value={myName} onChange={(e) => setMyName(e.target.value)} placeholder="e.g. Rahul" maxLength={40} />
            </div>
          )}
          <form onSubmit={create}>
            <label className="small" htmlFor="circle-name">Start a circle</label>
            <div className="inline-form">
              <input id="circle-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sharma Family" required minLength={2} maxLength={40} />
              <button className="btn btn-primary">Create</button>
            </div>
          </form>
          <form onSubmit={join}>
            <label className="small" htmlFor="circle-code">Or join with a code</label>
            <div className="inline-form">
              <input id="circle-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="8-character code" required minLength={6} maxLength={12} />
              <button className="btn btn-ghost">Join</button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

interface HistoryItem { id: string; input_text: string; score: number; verdict: Verdict; created_at: string }

function History() {
  const [items, setItems] = useState<HistoryItem[] | null>(null)
  useEffect(() => {
    api<{ checks: HistoryItem[] }>('/me/checks').then((d) => setItems(d.checks)).catch(() => setItems([]))
  }, [])
  const remove = async (id: string) => {
    await api(`/me/checks/${id}`, { method: 'DELETE' })
    setItems((prev) => prev?.filter((i) => i.id !== id) ?? null)
  }
  return (
    <section id="history">
      <h2>My checks</h2>
      <p className="muted small">Only you can see these messages. Delete anything you don't want saved.</p>
      {items?.length === 0 && <div className="card empty"><p>You haven't checked anything yet.</p><Link to="/check" className="btn btn-primary">Check a message</Link></div>}
      <div className="stack">
        {items?.map((i) => (
          <div key={i.id} className="card history-item">
            <div className={`history-score score-${i.verdict}`}>{i.score}</div>
            <div className="history-body">
              <p className="history-text">{i.input_text}</p>
              <p className="muted small">{VERDICT_TEXT[i.verdict].short} · {timeAgo(i.created_at)}</p>
            </div>
            <div className="history-actions">
              <Link to={`/r/${i.id}`} className="btn btn-ghost btn-sm">View</Link>
              <button className="btn btn-link btn-sm" onClick={() => remove(i.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function DashboardPage() {
  const { user, ready, refreshUser } = useAuth()
  const [summary, setSummary] = useState<Summary | null>(null)
  const loadSummary = () => {
    api<Summary>('/me/summary').then((s) => {
      setSummary(s)
      if (user?.id === 0) refreshUser() // opening My Shield created this device's identity
    }).catch(() => {})
  }
  const { hash } = useLocation()

  // Support links like /dashboard#watchlist once the sections have rendered.
  useEffect(() => {
    if (!hash || !summary) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash, summary])

  useEffect(() => {
    if (user) loadSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  if (!ready) return null
  if (!user) return <div className="card empty"><p>Could not load your data. Check that the server is running and reload.</p></div>

  return (
    <div className="dashboard">
      <h1>{user.name === 'Anonymous' ? 'My Shield' : `Hi, ${user.name.split(' ')[0]} 👋`}</h1>
      {summary && (
        <>
          <div className="stat-grid">
            <div className="stat card"><span className="stat-value">{summary.checks}</span><span className="stat-label">Messages checked</span></div>
            <div className="stat card stat-danger"><span className="stat-value">{summary.scamsCaught}</span><span className="stat-label">Scams caught</span></div>
            <div className="stat card"><span className="stat-value">{summary.reports}</span><span className="stat-label">Scammers reported</span></div>
            <div className="stat card"><span className="stat-value">{summary.watching}</span><span className="stat-label">On watchlist</span></div>
          </div>
          {summary.scamsCaught > 0 && (
            <p className="caught-line">
              🎉 You avoided <strong>{summary.scamsCaught}</strong> scam{summary.scamsCaught === 1 ? '' : 's'}
              {summary.topCategories.length > 0 && <>. Most common: <strong>{summary.topCategories[0].label}</strong></>}.
            </p>
          )}
        </>
      )}
      <div className="dash-grid">
        <div className="dash-main">
          <Watchlist onChange={loadSummary} />
          <FamilyCircle />
        </div>
        <aside className="dash-side">
          <ProfileCard />
          {summary && <ReputationCard rep={summary.reputation} />}
          <div className="card">
            <h3>Help others</h3>
            <p className="small muted">Report scam numbers you receive. Every confirmed report raises your badge.</p>
            <Link to="/report" className="btn btn-primary btn-sm">Report a scammer</Link>
          </div>
        </aside>
      </div>
      <History />
    </div>
  )
}
