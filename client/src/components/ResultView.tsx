import { useState } from 'react'
import { Link } from 'react-router-dom'
import RiskMeter from './RiskMeter'
import { VERDICT_TEXT, rupees } from '../lib/format'
import { TYPE_LABEL, type CheckResult, type Signal } from '../lib/types'

const SOURCE_LABEL: Record<Signal['source'], string> = {
  pattern: 'Message', link: 'Link', domain: 'Domain age', community: 'Community', ai: 'AI', trust: 'Good sign',
}

function shareText(r: CheckResult, url: string) {
  const head = r.verdict === 'dangerous' ? '⚠️ SCAM ALERT' : r.verdict === 'suspicious' ? '⚠️ Be careful' : 'ℹ️ Checked'
  return `${head}: I checked a message on ScamShield. Result: ${r.categoryLabel} (risk ${r.score}/100). Never share OTPs or PINs. Details: ${url}`
}

export default function ResultView({ result, showActions = true }: { result: CheckResult; showActions?: boolean }) {
  const [copied, setCopied] = useState(false)
  const v = VERDICT_TEXT[result.verdict]
  const shareUrl = `${window.location.origin}/r/${result.id}`
  const warnings = result.signals.filter((s) => s.weight > 0)
  const goodSigns = result.signals.filter((s) => s.weight <= 0)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link', shareUrl)
    }
  }

  return (
    <section className={`result card result-${result.verdict}`} aria-live="polite">
      <div className="result-head">
        <RiskMeter score={result.score} verdict={result.verdict} />
        <div className="result-headline">
          <span className={`pill pill-${result.verdict}`}>{v.short}</span>
          <h2>{v.title}</h2>
          {result.verdict !== 'low_risk' && <p className="result-category">{result.categoryLabel}</p>}
          <p className="result-summary">{result.summary}</p>
          {result.ai && (
            <p className="muted small">Rule engine: {result.ruleScore}/100 · AI review: {result.ai.score}/100</p>
          )}
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="result-section">
          <h3>Warning signs we found ({warnings.length})</h3>
          <ul className="signals">
            {warnings.map((s) => (
              <li key={s.id} className={`signal ${s.weight >= 35 ? 'signal-high' : s.weight >= 15 ? 'signal-med' : 'signal-low'}`}>
                <details>
                  <summary>
                    <span className="signal-label">{s.label}</span>
                    <span className="signal-source">{SOURCE_LABEL[s.source]}</span>
                  </summary>
                  <p>{s.detail}</p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.ai && result.ai.redFlags.length > 0 && (
        <div className="result-section">
          <h3>AI also noticed</h3>
          <ul className="bullets">
            {result.ai.redFlags.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </div>
      )}

      {goodSigns.length > 0 && (
        <div className="result-section">
          <h3>Good signs</h3>
          <ul className="signals">
            {goodSigns.map((s) => (
              <li key={s.id} className="signal signal-good">
                <details>
                  <summary><span className="signal-label">{s.label}</span><span className="signal-source">{SOURCE_LABEL[s.source]}</span></summary>
                  <p>{s.detail}</p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.entities.length > 0 && (
        <div className="result-section">
          <h3>What we found in the message</h3>
          <div className="entities">
            {result.entities.map((e) => (
              <div key={`${e.type}:${e.value}`} className={`entity ${e.community ? 'entity-reported' : ''}`}>
                <span className="entity-type">{TYPE_LABEL[e.type]}</span>
                <span className="entity-value">{e.value}</span>
                {e.community ? (
                  <span className="entity-flag">
                    🚩 Reported {e.community.reports + e.community.confirmations}×
                    {e.community.totalLost > 0 && ` · ${rupees(e.community.totalLost)} lost`}
                  </span>
                ) : (
                  <span className="entity-ok muted small">No reports yet</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="result-section">
        <h3>What you should do</h3>
        <ol className="advice">
          {result.advice.map((a) => <li key={a}>{a}</li>)}
        </ol>
      </div>

      {showActions && (
        <div className="result-actions">
          <a
            className="btn btn-whatsapp"
            href={`https://wa.me/?text=${encodeURIComponent(shareText(result, shareUrl))}`}
            target="_blank"
            rel="noreferrer"
          >
            Warn family on WhatsApp
          </a>
          <button className="btn btn-ghost" onClick={copyLink}>{copied ? 'Link copied ✓' : 'Copy result link'}</button>
          {result.verdict !== 'low_risk' && result.entities.length > 0 && (
            <Link
              className="btn btn-ghost"
              to={`/report?value=${encodeURIComponent(result.entities[0].raw)}&category=${result.category}`}
            >
              Report this sender
            </Link>
          )}
        </div>
      )}
      <p className="muted small privacy-note">
        The shared link shows only the result, never your message.
      </p>
    </section>
  )
}
