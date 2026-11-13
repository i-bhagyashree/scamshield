import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { post } from '../lib/api'
import { useAuth } from '../lib/auth'
import { CATEGORY_OPTIONS, type Report } from '../lib/types'
import ReportCard from '../components/ReportCard'

export default function ReportPage() {
  const { user, ready, refreshUser } = useAuth()
  const [params] = useSearchParams()
  const [form, setForm] = useState({
    value: params.get('value') || '',
    category: CATEGORY_OPTIONS.some((c) => c.value === params.get('category')) ? params.get('category')! : 'generic',
    description: '',
    amountLost: '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<Report | null>(null)

  if (!ready) return null

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const r = await post<{ report: Report }>('/reports', { ...form, amountLost: Number(form.amountLost) || 0 })
      setCreated(r.report)
      if (user?.id === 0) refreshUser()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit')
    } finally {
      setSaving(false)
    }
  }

  if (created) {
    return (
      <div className="narrow">
        <div className="card success">
          <h1>Thank you for reporting 🙏</h1>
          <p>Anyone who checks this {created.type === 'url' ? 'website' : created.type === 'upi' ? 'UPI ID' : created.type} now gets a warning.</p>
          <p className="muted small">If you lost money, also call <a href="tel:1930">1930</a> and file a complaint at <a href="https://cybercrime.gov.in" target="_blank" rel="noreferrer">cybercrime.gov.in</a>. Report fraud calls and SMS on <a href="https://sancharsaathi.gov.in" target="_blank" rel="noreferrer">Sanchar Saathi (Chakshu)</a>.</p>
        </div>
        <ReportCard report={created} />
        <div className="center"><Link to="/community" className="btn btn-primary">See community reports</Link></div>
      </div>
    )
  }

  return (
    <div className="narrow">
      <h1>Report a scammer</h1>
      <p className="muted">
        Your report warns everyone who checks the same number, UPI ID or website. No account needed.
        You'll appear as <strong>{user?.name.split(' ')[0] || 'Anonymous'}</strong>{' '}
        (<Link to="/dashboard#profile">change name</Link>).
      </p>
      <form className="card form" onSubmit={submit}>
        <label>
          Phone number, UPI ID, website or email *
          <input value={form.value} onChange={set('value')} required placeholder="e.g. 98XXXXXXXX or fraud.name@ybl" />
        </label>
        <label>
          Type of scam *
          <select value={form.category} onChange={set('category')}>
            {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <label>
          What happened? *
          <textarea value={form.description} onChange={set('description')} required minLength={10} maxLength={1000} rows={4}
            placeholder="e.g. Called saying my electricity will be cut tonight and asked me to install AnyDesk." />
          <span className="muted small">Don't include your own phone number, OTPs or bank details.</span>
        </label>
        <label>
          Money lost (₹, optional)
          <input type="number" min={0} inputMode="numeric" value={form.amountLost} onChange={set('amountLost')} placeholder="0" />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-lg" disabled={saving}>{saving ? 'Submitting…' : 'Submit report'}</button>
      </form>
    </div>
  )
}
