// Imported first by every test file: isolated in-memory DB, no network, no AI calls.
process.env.DB_PATH = ':memory:'
process.env.DISABLE_NETWORK_CHECKS = '1'
process.env.DISABLE_AI = '1'
process.env.SEED_DEMO = '0'
