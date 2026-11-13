import type { NextFunction, Request, Response } from 'express'

/**
 * Small in-memory fixed-window rate limiter, keyed by client IP.
 * Good enough for a single server instance; swap for Redis when scaling horizontally.
 */
export function rateLimit({ windowMs, max, name }: { windowMs: number; max: number; name: string }) {
  const hits = new Map<string, { count: number; resetAt: number }>()

  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key)
  }, windowMs).unref()

  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${name}:${req.ip}`
    const now = Date.now()
    let entry = hits.get(key)
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs }
      hits.set(key, entry)
    }
    entry.count++
    res.setHeader('RateLimit-Limit', String(max))
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)))
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)))
      res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' })
      return
    }
    next()
  }
}
