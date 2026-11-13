import express, { type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ZodError } from 'zod'
import { config } from './config.js'
import { checkRouter } from './routes/check.js'
import { reportsRouter } from './routes/reports.js'
import { statsRouter } from './routes/stats.js'
import { meRouter } from './routes/me.js'
import { seedDemoData } from './seed.js'

const app = express()
app.set('trust proxy', 1)
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({
  origin(origin, cb) {
    // Same-origin requests, the configured web app, and the browser extension.
    if (!origin || config.corsOrigins.includes(origin) || origin.startsWith('chrome-extension://')) cb(null, true)
    else cb(null, false)
  },
}))
app.use(express.json({ limit: '64kb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ai: config.aiEnabled, networkChecks: config.networkChecks })
})
app.use('/api', checkRouter)
app.use('/api', reportsRouter)
app.use('/api', statsRouter)
app.use('/api', meRouter)
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// In production the server also serves the built React app (one deploy, one URL).
const here = path.dirname(fileURLToPath(import.meta.url))
const clientDist = path.resolve(here, '../../client/dist')
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues[0]?.message ?? 'Invalid input' })
    return
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Invalid JSON body' })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' })
})

await seedDemoData()
app.listen(config.port, (err?: Error) => {
  if (err) {
    console.error(`Could not start on port ${config.port}: ${err.message}. Set PORT in server/.env to a free port.`)
    process.exit(1)
  }
  console.log(`ScamShield API running on http://localhost:${config.port}`)
  console.log(`  AI analysis: ${config.aiEnabled ? 'ON (Claude)' : 'OFF (set ANTHROPIC_API_KEY to enable)'}`)
  console.log(`  Domain age checks: ${config.networkChecks ? 'ON' : 'OFF'}`)
})
