import './setup.js'
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { db } from '../src/db.js'
import { findOrCreateUser, hashDevice } from '../src/lib/auth.js'

describe('device identity (no sign-up)', () => {
  test('the same device ID always maps to the same user', () => {
    const hash = hashDevice('device-aaaaaaaaaaaaaaaaaaaaaaaa')
    const a = findOrCreateUser(hash, '1.1.1.1')
    const b = findOrCreateUser(hash, '1.1.1.1')
    assert.notEqual(a, 'rate_limited')
    assert.deepEqual(a, b)
  })

  test('only a hash of the device ID is stored', () => {
    const raw = 'device-bbbbbbbbbbbbbbbbbbbbbbbb'
    findOrCreateUser(hashDevice(raw), '1.1.1.2')
    const leaked = db.prepare('SELECT COUNT(*) AS n FROM users WHERE device_hash = ? OR email LIKE ?').get(raw, `%${raw}%`) as { n: number }
    assert.equal(leaked.n, 0)
  })

  test('one IP cannot create unlimited identities', () => {
    let limited = false
    for (let i = 0; i < 40; i++) {
      const r = findOrCreateUser(hashDevice(`device-ratelimit-${String(i).padStart(12, '0')}`), '9.9.9.9')
      if (r === 'rate_limited') limited = true
    }
    assert.ok(limited)
    // Existing identities still work even when the IP is limited.
    const again = findOrCreateUser(hashDevice('device-ratelimit-000000000000'), '9.9.9.9')
    assert.notEqual(again, 'rate_limited')
  })
})
