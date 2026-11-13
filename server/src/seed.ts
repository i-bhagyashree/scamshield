/**
 * Demo data so the app does not look empty on first run. All numbers, UPI IDs and
 * domains below are made up. Disable with SEED_DEMO=0 in production.
 */
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { db } from './db.js'
import { config } from './config.js'
import { analyzeText } from './analyzer/index.js'

const DEMO_REPORTS: Array<[type: string, value: string, category: string, description: string, lost: number, daysAgo: number]> = [
  ['url', 'sbi-kyc-update-online.xyz', 'kyc_bank', 'Got SMS saying my YONO account will be blocked today, link asked for net banking password and OTP.', 0, 1],
  ['phone', '9000012345', 'electricity_bill', 'Caller said electricity will be cut at 9:30 pm tonight and asked me to install AnyDesk to pay the bill.', 0, 1],
  ['upi', 'taskreward.desk77@ybl', 'job_task', 'Telegram task group. Paid me ₹150 for liking videos, then asked for ₹5,000 "prepaid task" deposit. Lost it.', 5000, 2],
  ['phone', '7000098765', 'digital_arrest', 'Video call from fake "Mumbai Police" saying a FedEx parcel in my name had drugs. Kept me on call for 3 hours.', 0, 2],
  ['url', 'flipkrat-bigsale.shop', 'generic', 'Fake Flipkart sale page with iPhone for ₹999. Took payment, no order.', 999, 3],
  ['email', 'hr.onboarding.desk@gmail.com', 'fake_internship', 'Offer letter for "Data Analyst Intern at a top MNC" with no interview. Asked ₹2,499 for laptop and training kit.', 2499, 3],
  ['upi', 'kbc.lottery.office@paytm', 'lottery_prize', 'WhatsApp message with KBC logo saying I won ₹25 lakh, asked ₹12,500 as GST to release prize.', 0, 4],
  ['phone', '8000054321', 'family_emergency', 'Message: "Mummy this is my new number, phone broke, send ₹8000 urgently". My son was at home.', 0, 5],
  ['url', 'quick-loan-approval.top', 'loan_app', 'Instant loan app asked for contacts permission, then started threatening messages to my relatives.', 0, 6],
  ['upi', 'refund.helpdesk01@okaxis', 'refund_qr', 'Sent a "collect" request saying it is my refund. Would have debited ₹4,999 if I entered PIN.', 0, 7],
  ['url', 'tradeprofit-vip.live', 'investment', 'WhatsApp "stock VIP group" with fake app showing 300% profit. Could not withdraw.', 45000, 9],
  ['phone', '9000012345', 'electricity_bill', 'Same number called my father too, same electricity script.', 0, 10],
]

const DEMO_MESSAGES = [
  'Dear Customer, your SBI YONO account will be blocked today. Update your KYC immediately: http://sbi-kyc-update-online.xyz/login',
  'Congratulations! You have won Rs 25,00,000 in KBC lucky draw. Pay processing fee of Rs 12,500 to claim. Contact 9000012345',
  'Part time job! Earn Rs 3000 daily by liking YouTube videos. Join our Telegram task group now.',
  'Dear consumer your electricity power will be disconnected tonight at 9.30pm because previous month bill was not updated. Call electricity officer 9000012345',
  'Your OTP for login is 482913. Do not share it with anyone. -HDFC Bank',
  'Hi, are we still meeting for lunch tomorrow at 1?',
  'Selected for internship at our company without interview! Pay registration fee Rs 1999 to receive offer letter.',
  'This is Mumbai Police Cyber Cell. A FedEx parcel in your name contains drugs. You are under digital arrest. Do not tell anyone.',
  'Guaranteed 40% monthly returns! Join our stock market VIP group for insider tips.',
  'Mummy this is my new number, phone kharab ho gaya, urgent 8000 bhejo please',
]

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
    users.slice(1).filter((u) => u !== reporter).slice(0, i % 3).forEach((u) => insertVote.run(r.lastInsertRowid, u))
  })

  // Spread demo checks over the last 14 days so the dashboard has a trend line.
  const insertCheck = db.prepare(`INSERT INTO checks (id, user_id, input_text, score, verdict, category, result_json, source, created_at)
    VALUES (?, NULL, NULL, ?, ?, ?, ?, 'web', datetime('now', ?))`)
  const results = await Promise.all(DEMO_MESSAGES.map((m) => analyzeText(m, { useAi: false })))
  for (let day = 0; day < 14; day++) {
    const count = 3 + ((day * 7) % 6)
    for (let k = 0; k < count; k++) {
      const r = results[(day * 3 + k) % results.length]
      insertCheck.run(randomBytes(9).toString('base64url'), r.score, r.verdict, r.category, JSON.stringify(r), `-${day} days`)
    }
  }
}
