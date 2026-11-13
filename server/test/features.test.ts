import './setup.js'
import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { db } from '../src/db.js'
import { notifyWatchers, notifyCircle } from '../src/lib/notify.js'
import { badgeFor, reputationOf } from '../src/lib/reputation.js'
import { lookupCommunity } from '../src/lib/community.js'
import { analyzeText } from '../src/analyzer/index.js'

function user(name: string): number {
  const email = `${name.toLowerCase()}-${Math.random().toString(36).slice(2)}@test.dev`
  return Number(db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name, email, 'x').lastInsertRowid)
}
const notesFor = (id: number) => db.prepare('SELECT kind, title, body, link FROM notifications WHERE user_id = ?').all(id) as Array<{ kind: string; title: string; body: string; link: string }>

beforeEach(() => {
  db.exec('DELETE FROM notifications; DELETE FROM watchlist; DELETE FROM circle_members; DELETE FROM circles; DELETE FROM report_votes; DELETE FROM reports;')
})

describe('watchlist alerts', () => {
  test('watchers are notified when a watched value is reported, but not the reporter', () => {
    const alice = user('Alice'), bob = user('Bob')
    db.prepare(`INSERT INTO watchlist (user_id, type, value, label) VALUES (?, 'phone', '9876501234', 'Unknown caller')`).run(alice)
    db.prepare(`INSERT INTO watchlist (user_id, type, value) VALUES (?, 'phone', '9876501234')`).run(bob)
    const n = notifyWatchers('phone', '9876501234', 'Electricity bill scam', bob)
    assert.equal(n, 1)
    const [note] = notesFor(alice)
    assert.equal(note.kind, 'watchlist')
    assert.match(note.body, /Unknown caller \(9876501234\)/)
    assert.equal(notesFor(bob).length, 0)
  })

  test('a watch on a domain matches reports on its subdomains', () => {
    const alice = user('Alice'), reporter = user('R')
    db.prepare(`INSERT INTO watchlist (user_id, type, value) VALUES (?, 'url', 'shady-shop.xyz')`).run(alice)
    assert.equal(notifyWatchers('url', 'login.shady-shop.xyz', 'Suspicious message', reporter), 1)
  })
})

describe('family circle alerts', () => {
  test('other members are alerted without the message text, with a cooldown', () => {
    const mom = user('Sunita Sharma'), son = user('Rahul Sharma'), outsider = user('Other')
    const c = db.prepare(`INSERT INTO circles (name, code, owner_id) VALUES ('Family', 'TESTCODE', ?)`).run(mom).lastInsertRowid
    db.prepare('INSERT INTO circle_members (circle_id, user_id) VALUES (?, ?), (?, ?)').run(c, mom, c, son)

    const t0 = Date.now()
    assert.equal(notifyCircle(mom, 'Sunita Sharma', 'abc123', 91, 'Fake KYC / bank alert', t0), 1)
    const [note] = notesFor(son)
    assert.match(note.title, /Sunita received a dangerous message/)
    assert.equal(note.link, '/r/abc123')
    assert.equal(notesFor(mom).length, 0)
    assert.equal(notesFor(outsider).length, 0)

    // Second dangerous check 5 minutes later: suppressed. After 16 minutes: allowed again.
    assert.equal(notifyCircle(mom, 'Sunita Sharma', 'def456', 88, 'OTP / PIN theft', t0 + 5 * 60_000), 0)
    assert.equal(notifyCircle(mom, 'Sunita Sharma', 'ghi789', 88, 'OTP / PIN theft', t0 + 16 * 60_000), 1)
  })

  test('a user without a circle notifies nobody', () => {
    assert.equal(notifyCircle(user('Loner'), 'Loner', 'x', 90, 'Scam'), 0)
  })
})

describe('reporter reputation', () => {
  test('badges by confirmation count', () => {
    assert.equal(badgeFor(0).key, 'new')
    assert.equal(badgeFor(3).key, 'trusted')
    assert.equal(badgeFor(10).key, 'guardian')
  })

  test('reputation counts confirmations from others, and trusted reports raise the risk weight', async () => {
    const reporter = user('Rep')
    const voters = [user('V1'), user('V2'), user('V3')]
    const old = db.prepare(`INSERT INTO reports (user_id, type, value, category, description) VALUES (?, 'phone', '9111111111', 'generic', 'older report')`).run(reporter).lastInsertRowid
    for (const v of voters) db.prepare('INSERT INTO report_votes (report_id, user_id) VALUES (?, ?)').run(old, v)
    assert.equal(reputationOf(reporter), 3)

    const plain = user('Plain')
    db.prepare(`INSERT INTO reports (user_id, type, value, category, description) VALUES (?, 'phone', '9222222222', 'generic', 'by new user')`).run(plain)
    db.prepare(`INSERT INTO reports (user_id, type, value, category, description) VALUES (?, 'phone', '9333333333', 'generic', 'by trusted user')`).run(reporter)

    assert.equal(lookupCommunity('phone', '9222222222').trustedReports, 0)
    assert.equal(lookupCommunity('phone', '9333333333').trustedReports, 1)

    const weightOf = async (num: string) => (await analyzeText(`call ${num}`, { useAi: false })).signals.find((s) => s.source === 'community')!.weight
    assert.ok((await weightOf('9333333333')) > (await weightOf('9222222222')))
  })
})
