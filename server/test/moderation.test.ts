import './setup.js'
import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { db } from '../src/db.js'
import { lookupCommunity } from '../src/lib/community.js'

const user = (n: string) => Number(db.prepare(`INSERT INTO users (name, email, password_hash) VALUES (?, ?, '')`).run(n, `${n}-${Math.random()}@t.dev`).lastInsertRowid)
const report = (by: number, value: string) => Number(db.prepare(`INSERT INTO reports (user_id, type, value, category, description) VALUES (?, 'phone', ?, 'generic', 'test report')`).run(by, value).lastInsertRowid)
const flag = (id: number, by: number) => db.prepare(`INSERT INTO report_flags (report_id, user_id, reason) VALUES (?, ?, 'wrong')`).run(id, by)
const vote = (id: number, by: number) => db.prepare(`INSERT INTO report_votes (report_id, user_id) VALUES (?, ?)`).run(id, by)

beforeEach(() => db.exec('DELETE FROM report_flags; DELETE FROM report_votes; DELETE FROM reports;'))

describe('report moderation', () => {
  test('a report flagged by 3 people stops counting', () => {
    const id = report(user('Troll'), '9000000001')
    flag(id, user('A'))
    flag(id, user('B'))
    assert.equal(lookupCommunity('phone', '9000000001').reports, 1, 'two flags are not enough')
    flag(id, user('C'))
    assert.equal(lookupCommunity('phone', '9000000001').reports, 0, 'hidden after three flags')
  })

  test('a report confirmed by more people than flagged stays visible', () => {
    const id = report(user('Victim'), '9000000002')
    for (const n of ['V1', 'V2', 'V3', 'V4']) vote(id, user(n))
    for (const n of ['F1', 'F2', 'F3']) flag(id, user(n))
    assert.equal(lookupCommunity('phone', '9000000002').reports, 1)
  })

  test('deleting a report removes its flags and votes', () => {
    const id = report(user('Owner'), '9000000003')
    vote(id, user('X'))
    flag(id, user('Y'))
    db.prepare('DELETE FROM reports WHERE id = ?').run(id)
    const left = db.prepare('SELECT (SELECT COUNT(*) FROM report_votes) + (SELECT COUNT(*) FROM report_flags) AS n').get() as { n: number }
    assert.equal(left.n, 0)
  })
})
