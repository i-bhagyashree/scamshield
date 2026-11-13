import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { compact } from '../lib/format'
import type { Stats } from '../lib/types'

const STEPS = [
  { n: 1, title: 'Paste or upload', text: 'Paste the SMS, WhatsApp message, link, number or UPI ID. You can also upload a screenshot.' },
  { n: 2, title: 'We analyse it', text: 'Scam patterns, fake links, website age and community reports are checked in seconds.' },
  { n: 3, title: 'Know what to do', text: 'You get a clear risk score, every warning sign explained, and exact next steps.' },
]

const FEATURES = [
  { icon: '🔍', title: 'Explains every warning sign', text: 'Not just "safe" or "unsafe". You see exactly what looks wrong and why it matters.' },
  { icon: '🌐', title: 'Catches fake links', text: 'Spots fake bank domains, misspelled brand names and websites created only days ago.' },
  { icon: '🗣️', title: 'Understands Hinglish', text: '"Khata band ho jayega", "OTP batao": scam scripts in Hindi-English are caught too.' },
  { icon: '👥', title: 'Community reports', text: 'Numbers, UPI IDs and websites reported by others are flagged instantly.' },
  { icon: '📷', title: 'Screenshot reading', text: 'Upload a screenshot. The text is read on your device, so the image never leaves it.' },
  { icon: '🔒', title: 'No sign-up, private', text: 'No account needed. Shared results never include your message.' },
]

const SCAMS = [
  { icon: '🏦', name: 'Fake KYC / bank alerts' },
  { icon: '🔑', name: 'OTP & PIN theft' },
  { icon: '💼', name: 'Task-based part-time jobs' },
  { icon: '🎓', name: 'Fake internships with fees' },
  { icon: '⚡', name: 'Electricity bill threats' },
  { icon: '👮', name: '"Digital arrest" calls' },
  { icon: '🎁', name: 'Lottery, KBC & refunds' },
  { icon: '📈', name: 'Trading & crypto groups' },
  { icon: '💸', name: 'Instant loan apps' },
  { icon: '👪', name: '"Mummy, new number" texts' },
]

const FAQ = [
  { q: 'Is ScamShield free?', a: 'Yes. Checking messages, looking up numbers, reporting scammers, the watchlist and family circle are all free, with no sign-up.' },
  { q: 'Do you store my message?', a: 'Your message is saved only in your private history on this browser, and you can delete it any time from My Shield. Shared result links never include the message, and phone numbers are masked.' },
  { q: 'How accurate is it?', a: 'ScamShield combines 20+ scam patterns, link analysis, live website-age checks and community reports. It catches the common Indian scam scripts well, but no tool is perfect: if in doubt, contact the company through its official app.' },
  { q: 'Can it be wrong about a genuine message?', a: 'Sometimes. Genuine OTP messages, delivery updates and messages from official domains score low. If a real message looks suspicious, the warning signs list tells you exactly why, so you can judge for yourself.' },
  { q: 'I already lost money. What now?', a: 'Call 1930 (National Cyber Crime Helpline) immediately and file a complaint at cybercrime.gov.in. Then call your bank to block your card or UPI. The first few hours matter most.' },
]

function HeroPreview() {
  return (
    <div className="preview" aria-hidden="true">
      <div className="preview-msg">
        <span className="preview-from">VM-SBIUPD · SMS</span>
        Dear Customer, your YONO account will be blocked today. Update PAN/KYC now: sbi-kyc-update.xyz
      </div>
      <div className="preview-card">
        <div className="preview-head">
          <div className="preview-score"><b>93</b><span>/100</span></div>
          <div>
            <span className="pill pill-dangerous">Dangerous</span>
            <strong className="preview-title">Very likely a scam</strong>
            <span className="muted small">Fake KYC / bank alert</span>
          </div>
        </div>
        <ul className="preview-signals">
          <li><i className="sev-high" />Pretends to be SBI</li>
          <li><i className="sev-high" />Threatens to block your account</li>
          <li><i className="sev-high" />Website reported by 3 people</li>
          <li><i className="sev-med" />Cheap .xyz domain</li>
        </ul>
      </div>
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    api<Stats>('/stats').then(setStats).catch(() => {})
  }, [])

  const quickCheck = (e: FormEvent) => {
    e.preventDefault()
    navigate(text.trim() ? `/check?text=${encodeURIComponent(text.trim())}` : '/check')
  }

  return (
    <div className="home">
      <section className="home-hero">
        <div className="home-hero-text">
          <span className="eyebrow">🛡️ Free scam checker for India</span>
          <h1>Got a suspicious message? <span className="gradient-text">Check it in seconds.</span></h1>
          <p className="hero-sub">
            ScamShield tells you if an SMS, WhatsApp message, link, phone number or UPI ID is a scam, explains why in
            plain language, and tells you exactly what to do next.
          </p>
          <form className="quick-check" onSubmit={quickCheck}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a message, link, number or UPI ID…" aria-label="Message to check" />
            <button className="btn btn-primary btn-lg">Check now</button>
          </form>
          <div className="hero-links">
            <Link to="/check">📷 Upload a screenshot</Link>
            <Link to="/lookup">🔎 Look up a number</Link>
            <Link to="/learn">📚 Learn the scams</Link>
          </div>
        </div>
        <HeroPreview />
      </section>

      {stats && (
        <section className="home-stats" aria-label="Community numbers">
          <div><b>{compact(stats.totals.checks)}</b><span>messages checked</span></div>
          <div><b>{compact(stats.totals.dangerous)}</b><span>scams caught</span></div>
          <div><b>{compact(stats.totals.reports)}</b><span>scammers reported</span></div>
          <div><b>Free</b><span>no sign-up needed</span></div>
          {stats.demo && <p className="demo-note demo-note-inline">🧪 Sample data for demonstration</p>}
        </section>
      )}

      <section className="home-section">
        <h2 className="section-title">How it works</h2>
        <div className="steps">
          {STEPS.map((s) => (
            <div key={s.n} className="step card">
              <span className="step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section">
        <h2 className="section-title">Why ScamShield</h2>
        <div className="features">
          {FEATURES.map((f) => (
            <div key={f.title} className="feature">
              <span className="feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section">
        <h2 className="section-title">Scams we catch</h2>
        <p className="section-sub">The scripts behind most fraud in India, in English and Hinglish.</p>
        <div className="scam-chips">
          {SCAMS.map((s) => (
            <Link key={s.name} to="/learn" className="scam-chip"><span aria-hidden="true">{s.icon}</span>{s.name}</Link>
          ))}
        </div>
      </section>

      <section className="home-section split">
        <div className="card promo">
          <span className="promo-icon">👪</span>
          <h3>Protect your family</h3>
          <p>Create a family circle. If your parents check a dangerous message, you get an alert so you can call them before they pay.</p>
          <Link to="/dashboard#circle" className="btn btn-ghost">Start a family circle →</Link>
        </div>
        <div className="card promo">
          <span className="promo-icon">👀</span>
          <h3>Watch a number</h3>
          <p>Unsure about a caller or an online buyer? Add them to your watchlist. If anyone reports them later, you'll know.</p>
          <Link to="/dashboard#watchlist" className="btn btn-ghost">Open my watchlist →</Link>
        </div>
        <div className="card promo">
          <span className="promo-icon">🧩</span>
          <h3>Chrome extension</h3>
          <p>Get a warning before you type anything on a scam website, and right-click any text to check it.</p>
          <p className="small muted">Install: open <code>chrome://extensions</code>, turn on Developer mode, click "Load unpacked" and pick the <code>extension</code> folder.</p>
        </div>
      </section>

      <section className="home-section faq-section">
        <h2 className="section-title">Questions</h2>
        <div className="faq">
          {FAQ.map((f) => (
            <details key={f.q} className="card faq-item">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="cta-band">
        <h2>When in doubt, check it first.</h2>
        <p>It takes 5 seconds and could save your savings.</p>
        <Link to="/check" className="btn btn-light btn-lg">Check a message now</Link>
      </section>
    </div>
  )
}
