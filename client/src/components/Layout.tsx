import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useNotifications } from '../lib/notifications'
import { useTheme } from '../lib/theme'

const NAV = [
  { to: '/check', label: 'Check' },
  { to: '/lookup', label: 'Lookup' },
  { to: '/community', label: 'Community' },
  { to: '/report', label: 'Report' },
  { to: '/learn', label: 'Learn' },
]

export function Logo() {
  return (
    <svg viewBox="0 0 64 64" width="28" height="28" aria-hidden="true">
      <path d="M32 4 8 13v17c0 15 10 26 24 30 14-4 24-15 24-30V13L32 4Z" fill="currentColor" />
      <path d="m22 32 7 7 14-15" fill="none" stroke="var(--logo-check)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Layout() {
  const { user } = useAuth()
  const { unread } = useNotifications()
  const { theme, toggle } = useTheme()
  const [open, setOpen] = useState(false)

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="topbar">
        <div className="container topbar-inner">
          <Link to="/" className="brand" onClick={() => setOpen(false)}>
            <span className="brand-logo"><Logo /></span>
            ScamShield
          </Link>
          <div className="topbar-right">
            <button
              className="icon-btn theme-toggle"
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? (
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor" /><g stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8" /></g></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" fill="currentColor" /></svg>
              )}
            </button>
            {user && (
              <Link to="/notifications" className="icon-btn bell" aria-label={unread ? `${unread} new notifications` : 'Notifications'} onClick={() => setOpen(false)}>
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z" fill="currentColor" /></svg>
                {unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
              </Link>
            )}
            <button className="menu-btn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>
              <span /><span /><span />
            </button>
          </div>
          <nav className={`nav ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className="nav-link">{n.label}</NavLink>
            ))}
            <NavLink to="/dashboard" className="nav-link">My Shield</NavLink>
          </nav>
        </div>
      </header>

      <main id="main" className="container main">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="container">
          <div className="helpline">
            <span className="helpline-icon" aria-hidden="true">📞</span>
            <div>
              <strong>Lost money to fraud?</strong> Call <a href="tel:1930">1930</a> right away and report at{' '}
              <a href="https://cybercrime.gov.in" target="_blank" rel="noreferrer">cybercrime.gov.in</a>. The first few hours matter most.
            </div>
          </div>
          <div className="footer-inner">
            <div className="footer-brand">
              <Link to="/" className="brand"><span className="brand-logo"><Logo /></span>ScamShield</Link>
              <p className="muted small">Free scam checker for India. Explains every warning sign in plain language.</p>
            </div>
            <nav className="footer-links" aria-label="Footer">
              <Link to="/check">Check a message</Link>
              <Link to="/lookup">Look up a number</Link>
              <Link to="/community">Community</Link>
              <Link to="/learn">Know the scams</Link>
              <a href="https://sancharsaathi.gov.in" target="_blank" rel="noreferrer">Sanchar Saathi</a>
            </nav>
          </div>
          <p className="muted small footer-note">ScamShield gives guidance, not guarantees. Always check with the official company or bank.</p>
        </div>
      </footer>
    </div>
  )
}
