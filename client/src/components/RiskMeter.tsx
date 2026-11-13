import type { Verdict } from '../lib/types'

/** Semi-circular gauge showing the 0-100 risk score. */
export default function RiskMeter({ score, verdict, size = 180 }: { score: number; verdict: Verdict; size?: number }) {
  const r = 70
  const circumference = Math.PI * r
  const offset = circumference * (1 - score / 100)
  return (
    <div className={`meter meter-${verdict}`} style={{ width: size }} role="img" aria-label={`Risk score ${score} out of 100`}>
      <svg viewBox="0 0 180 104">
        <path d="M20 90a70 70 0 0 1 140 0" className="meter-track" />
        <path d="M20 90a70 70 0 0 1 140 0" className="meter-fill" style={{ strokeDasharray: circumference, strokeDashoffset: offset }} />
      </svg>
      <div className="meter-value">
        <span className="meter-score">{score}</span>
        <span className="meter-max">/100 risk</span>
      </div>
    </div>
  )
}
