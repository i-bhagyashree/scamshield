/**
 * No sign-up: every browser gets a random device ID (generated client-side, sent as `X-Device-Id`).
 * The server stores only a SHA-256 hash of it and maps it to an anonymous user row, so reports,
 * watchlist, family circle and notifications all work without an account.
 * The device ID works like a password: anyone who has it can act as that device.
 */
import type { NextFunction, Request, Response } from 'express'
import { createHash } from 'node:crypto'
import { db } from '../db.js'

export interface AuthUser {
  id: number
  name: string
}

const DEVICE_RE = /^[A-Za-z0-9_-]{20,64}$/
const CREATE_LIMIT_PER_HOUR = 30

const findStmt = db.prepare('SELECT id, name FROM users WHERE device_hash = ?')
const createStmt = db.prepare(`INSERT INTO users (name, email, password_hash, device_hash) VALUES ('Anonymous', ?, '', ?)`)

export function hashDevice(deviceId: string): string {
  return createHash('sha256').update(deviceId).digest('hex')
}

function deviceHashOf(req: Request): string | null {
  const id = req.get('x-device-id')
  return id && DEVICE_RE.test(id) ? hashDevice(id) : null
}

// Limits how many new identities one IP can create, so scripted fake reports are harder.
const creations = new Map<string, { count: number; resetAt: number }>()
setInterval(() => {
  const now = Date.now()
  for (const [ip, e] of creations) if (e.resetAt <= now) creations.delete(ip)
}, 60 * 60_000).unref()

function allowCreate(ip: string): boolean {
  const now = Date.now()
  const e = creations.get(ip)
  if (!e || e.resetAt <= now) {
    creations.set(ip, { count: 1, resetAt: now + 60 * 60_000 })
    return true
  }
  e.count++
  return e.count <= CREATE_LIMIT_PER_HOUR
}

export function findOrCreateUser(hash: string, ip: string): AuthUser | 'rate_limited' {
  const found = findStmt.get(hash) as AuthUser | undefined
  if (found) return found
  if (!allowCreate(ip)) return 'rate_limited'
  const result = createStmt.run(`anon-${hash.slice(0, 24)}@device.local`, hash)
  return { id: Number(result.lastInsertRowid), name: 'Anonymous' }
}

/** Attaches the device's user if it already exists; never creates or rejects. */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const hash = deviceHashOf(req)
  res.locals.user = hash ? ((findStmt.get(hash) as AuthUser | undefined) ?? null) : null
  next()
}

/** Ensures the request comes from a device with an identity, creating one on first use. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const hash = deviceHashOf(req)
  if (!hash) {
    res.status(400).json({ error: 'Missing device ID. Please reload the page.' })
    return
  }
  const user = findOrCreateUser(hash, req.ip || 'unknown')
  if (user === 'rate_limited') {
    res.status(429).json({ error: 'Too many new devices from your network. Please try again later.' })
    return
  }
  res.locals.user = user
  next()
}

export function currentUser(res: Response): AuthUser | null {
  return (res.locals.user as AuthUser | null) ?? null
}
