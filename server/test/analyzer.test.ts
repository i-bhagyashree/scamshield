import './setup.js'
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeText, combineWeights } from '../src/analyzer/index.js'
import { extractEntities, classifyValue } from '../src/analyzer/extract.js'
import { analyzeUrl, registrableDomain, levenshtein } from '../src/analyzer/url.js'
import { db } from '../src/db.js'

const analyze = (t: string) => analyzeText(t, { useAi: false })

describe('entity extraction', () => {
  test('finds links, phones, UPI IDs, emails and amounts', () => {
    const { entities, amounts } = extractEntities(
      'Pay Rs 1,999 to refund.desk@ybl or call +91 98765-43210. Visit http://sbi-kyc.xyz/login, mail hr@company.com. Prize ₹25 lakh!',
    )
    const byType = (t: string) => entities.filter((e) => e.type === t).map((e) => e.normalized)
    assert.deepEqual(byType('upi'), ['refund.desk@ybl'])
    assert.deepEqual(byType('email'), ['hr@company.com'])
    assert.deepEqual(byType('phone'), ['9876543210'])
    assert.deepEqual(byType('url'), ['sbi-kyc.xyz'])
    assert.deepEqual(amounts, [1999, 2_500_000])
  })

  test('does not treat the domain of an email as a link', () => {
    const { entities } = extractEntities('Write to careers@infosys.com')
    assert.equal(entities.filter((e) => e.type === 'url').length, 0)
  })

  test('classifies single lookup values', () => {
    assert.equal(classifyValue('98765 43210')?.type, 'phone')
    assert.equal(classifyValue('someone@okaxis')?.type, 'upi')
    assert.equal(classifyValue('https://www.Example.xyz/path')?.normalized, 'example.xyz')
    assert.equal(classifyValue('a@gmail.com')?.type, 'email')
    assert.equal(classifyValue('hello there'), null)
  })
})

describe('link analysis', () => {
  test('flags brand impersonation', () => {
    const ids = analyzeUrl('sbi-kyc-update.xyz').map((s) => s.id.split(':')[0])
    assert.ok(ids.includes('brand'))
    assert.ok(ids.includes('tld'))
  })

  test('flags typosquatting', () => {
    assert.ok(analyzeUrl('flipkrat.com').some((s) => s.id.startsWith('typo')))
    assert.ok(analyzeUrl('phonepay.com').some((s) => s.id.startsWith('typo')))
    // Contains the brand token itself, so it is caught as impersonation instead.
    assert.ok(analyzeUrl('hdfcbnak.com').some((s) => s.id.startsWith('brand')))
  })

  test('trusts official domains and their subdomains', () => {
    const s = analyzeUrl('netbanking.hdfcbank.com')
    assert.equal(s.length, 1)
    assert.ok(s[0].weight < 0)
  })

  test('flags raw IPs, shorteners and APKs', () => {
    assert.ok(analyzeUrl('192.168.10.5').some((s) => s.id.startsWith('ip')))
    assert.ok(analyzeUrl('bit.ly').some((s) => s.id.startsWith('short')))
    assert.ok(analyzeUrl('files.example.com', 'https://files.example.com/bill.apk').some((s) => s.id.startsWith('apk')))
  })

  test('registrable domain handles Indian second-level suffixes', () => {
    assert.equal(registrableDomain('a.b.sbi.co.in'), 'sbi.co.in')
    assert.equal(registrableDomain('login.secure.example.com'), 'example.com')
  })

  test('levenshtein distance', () => {
    assert.equal(levenshtein('flipkart', 'flipkrat'), 2)
    assert.equal(levenshtein('paytm', 'paytm'), 0)
  })
})

describe('scoring', () => {
  test('noisy-OR combines signals without exceeding 100', () => {
    const sig = (weight: number) => ({ id: String(weight), label: '', detail: '', weight, source: 'pattern' as const })
    assert.equal(combineWeights([sig(40), sig(40)]), 64)
    assert.ok(combineWeights([sig(90), sig(90), sig(90)]) <= 100)
    assert.equal(combineWeights([sig(-20)]), 0)
  })
})

describe('end-to-end verdicts', () => {
  const dangerous: Array<[string, string]> = [
    ['Dear Customer, your SBI account will be blocked today. Update KYC immediately: http://sbi-kyc-update.xyz', 'kyc_bank'],
    ['Congratulations! You have won Rs 25 lakh in KBC lucky draw. Pay processing fee Rs 12500 to claim prize money.', 'lottery_prize'],
    ['Part time job! Earn Rs 3000 daily by liking YouTube videos. Join Telegram task group now', 'job_task'],
    ['You are selected for internship without interview. Pay registration fee of Rs 1999 to get your offer letter.', 'fake_internship'],
    ['Dear consumer your electricity power will be disconnected tonight. Previous month bill was not updated. Call electricity officer 9000012345', 'electricity_bill'],
    ['This is CBI. A FedEx parcel in your name contains drugs. You are under digital arrest. Do not tell anyone.', 'digital_arrest'],
    ['Bank se bol raha hoon, aapka khata band ho jayega. Jo OTP aaya hai woh batao turant', 'otp_fraud'],
    ['Enter your UPI PIN to receive cashback of Rs 5000', 'refund_qr'],
    ['Install AnyDesk so our executive can fix your account immediately', 'remote_access'],
  ]
  for (const [text, category] of dangerous) {
    test(`dangerous: ${category}`, async () => {
      const r = await analyze(text)
      assert.ok(r.score >= 60, `expected >= 60, got ${r.score} (${r.signals.map((s) => s.id).join(', ')})`)
      assert.equal(r.verdict, 'dangerous')
      assert.equal(r.category, category)
    })
  }

  const safe = [
    'Hi, are we still meeting for lunch tomorrow at 1?',
    'Your OTP for login is 482913. Do not share it with anyone. -HDFC Bank',
    'Your Amazon order has been shipped and will arrive on Friday. Track at https://www.amazon.in/orders',
    'Happy birthday! Have a great year ahead 🎉',
    'Never share your OTP, PIN or CVV with anyone. SBI never asks for these details.',
  ]
  for (const text of safe) {
    test(`low risk: "${text.slice(0, 30)}..."`, async () => {
      const r = await analyze(text)
      assert.equal(r.verdict, 'low_risk', `got ${r.score}: ${r.signals.map((s) => s.id).join(', ')}`)
    })
  }

  test('community reports raise the score of an otherwise plain message', async () => {
    db.prepare(`INSERT INTO reports (type, value, category, description) VALUES ('phone', '9123456780', 'family_emergency', 'test report one')`).run()
    db.prepare(`INSERT INTO reports (type, value, category, description) VALUES ('phone', '9123456780', 'family_emergency', 'test report two')`).run()
    const r = await analyze('Hello, please call me back on 9123456780')
    assert.equal(r.verdict, 'dangerous')
    assert.equal(r.entities[0].community?.reports, 2)
    assert.equal(r.category, 'family_emergency')
  })
})
