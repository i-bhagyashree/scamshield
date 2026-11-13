/**
 * Demo data so the app does not look empty on first run. All numbers, UPI IDs and
 * domains below are made up. Disable with SEED_DEMO=0 in production.
 */
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { db } from './db.js'
import { config } from './config.js'
import { analyzeText } from './analyzer/index.js'
import { DEMO_MESSAGES, DEMO_REPORTS, demoChecksOnDay, demoConfirmations } from './demoData.js'

export async function seedDemoData() {
  if (!config.demoData) return
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM reports').get() as { n: number }
  if (n === 0) await seedBase()
}

async function seedBase() {
  console.log('[seed] Adding demo users, reports and checks...')
  const hash = bcrypt.hashSync('demo1234', 10)
  const insertUser = db.prepare('INSERT OR IGNORE INTO users (name, email, password_hash) VALUES (?, ?, ?)')
  const users = ['Demo User', 'Priya Sharma', 'Rohit Verma', 'Ananya Iyer'].map((name, i) => {
    const email = i === 0 ? 'demo@scamshield.dev' : `${name.split(' ')[0].toLowerCase()}@example.com`
    insertUser.run(name, email, hash)
    return (db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number }).id
  })

  const insertReport = db.prepare(`INSERT INTO reports (user_id, type, value, category, description, amount_lost, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?))`)
  const insertVote = db.prepare('INSERT OR IGNORE INTO report_votes (report_id, user_id) VALUES (?, ?)')
  DEMO_REPORTS.forEach(([type, value, category, description, lost, daysAgo], i) => {
    const reporter = users[1 + (i % 3)]
    const r = insertReport.run(reporter, type, value, category, description, lost, `-${daysAgo} days`)
    // A few confirmations from other users.
    users.slice(1).filter((u) => u !== reporter).slice(0, demoConfirmations(i)).forEach((u) => insertVote.run(r.lastInsertRowid, u))
  })

  // Spread demo checks over the last 14 days so the dashboard has a trend line.
  const insertCheck = db.prepare(`INSERT INTO checks (id, user_id, input_text, score, verdict, category, result_json, source, created_at)
    VALUES (?, NULL, NULL, ?, ?, ?, ?, 'web', datetime('now', ?))`)
  const results = await Promise.all(DEMO_MESSAGES.map((m) => analyzeText(m, { useAi: false })))
  for (let day = 0; day < 14; day++) {
    const count = demoChecksOnDay(day)
    for (let k = 0; k < count; k++) {
      const r = results[(day * 3 + k) % results.length]
      insertCheck.run(randomBytes(9).toString('base64url'), r.score, r.verdict, r.category, JSON.stringify(r), `-${day} days`)
    }
  }
}
