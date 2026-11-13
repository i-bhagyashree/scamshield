import { Link } from 'react-router-dom'
import { REPO_URL } from '../lib/staticMode'

/** Shown in the browser-only demo for features that need the server. */
export default function FullVersionNotice({ feature }: { feature: string }) {
  return (
    <div className="narrow">
      <div className="card empty full-version">
        <span className="promo-icon" aria-hidden="true">🧪</span>
        <h1>{feature} is in the full version</h1>
        <p className="muted">
          This demo runs entirely in your browser, so features that share data between people
          (reporting, watchlist, family circle and alerts) are turned off. The full version, with a
          Node.js server and database, is on GitHub.
        </p>
        <div className="full-version-actions">
          <Link to="/check" className="btn btn-primary">Check a message</Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="btn btn-ghost">View on GitHub</a>
        </div>
      </div>
    </div>
  )
}
