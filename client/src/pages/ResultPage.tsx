import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ResultView from '../components/ResultView'
import { api } from '../lib/api'
import { timeAgo } from '../lib/format'
import type { CheckResult } from '../lib/types'

/** Public, shareable result. The server never returns the original message here. */
export default function ResultPage() {
  const { id } = useParams()
  const [result, setResult] = useState<CheckResult | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<CheckResult>(`/check/${id}`).then(setResult).catch((e) => setError(e.message))
  }, [id])

  if (error) return <div className="card empty"><h2>Result not found</h2><p>{error}</p><Link className="btn btn-primary" to="/check">Check a message</Link></div>
  if (!result) return <div className="card loading-card"><div className="loading-step active"><span className="dot" /> Loading result…</div></div>

  return (
    <div className="narrow">
      <p className="muted small">Someone shared this ScamShield result · checked {timeAgo(result.createdAt)}</p>
      <ResultView result={result} />
      <div className="center"><Link className="btn btn-primary" to="/check">Check your own message</Link></div>
    </div>
  )
}
