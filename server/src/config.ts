import 'dotenv/config'

const isProd = process.env.NODE_ENV === 'production'

export const config = {
  port: Number(process.env.PORT || 5150),
  dbPath: process.env.DB_PATH || 'scamshield.db',
  /** Comma-separated list of allowed browser origins. Chrome extensions are always allowed. */
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5180').split(',').map((s) => s.trim()),
  /** Turn off live network lookups (domain age). Used by tests and offline demos. */
  networkChecks: process.env.DISABLE_NETWORK_CHECKS !== '1',
  /** AI analysis turns on automatically when Anthropic credentials are configured. */
  aiEnabled: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) && process.env.DISABLE_AI !== '1',
  isProd,
  /** Sample reports/checks: on by default in development, off in production unless SEED_DEMO=1. */
  demoData: process.env.SEED_DEMO ? process.env.SEED_DEMO === '1' : !isProd,
}
