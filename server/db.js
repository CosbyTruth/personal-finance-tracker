import pg from 'pg'
import dotenv from 'dotenv'

const localRuntime = process.env.NETLIFY !== 'true' && process.env.CONTEXT !== 'production'
dotenv.config({ override: localRuntime })

const { Pool } = pg
const databaseUrl = process.env.DATABASE_URL
const isLocal = /localhost|127\.0\.0\.1/.test(databaseUrl || '')
const sslMode = String(process.env.DATABASE_SSL || 'auto').toLowerCase()

function normalizedConnectionString(value) {
  if (!value) return value
  try {
    const parsed = new URL(value)
    parsed.searchParams.delete('sslmode')
    parsed.searchParams.delete('uselibpqcompat')
    return parsed.toString()
  } catch {
    return value
  }
}

function sslConfig() {
  if (sslMode === 'false' || sslMode === 'disable') return false
  if (sslMode === 'insecure' || sslMode === 'require') return { rejectUnauthorized: false }
  if (sslMode === 'true' || sslMode === 'verify-full') return { rejectUnauthorized: true }
  return isLocal ? false : { rejectUnauthorized: true }
}

const defaultPoolMax = process.env.CONTEXT || process.env.NETLIFY ? 3 : 10

export const pool = databaseUrl
  ? new Pool({
      connectionString: normalizedConnectionString(databaseUrl),
      ssl: sslConfig(),
      max: Number(process.env.DB_POOL_MAX || defaultPoolMax),
      idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
      connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
    })
  : null

if (pool) {
  pool.on('error', (error) => {
    console.error('Unexpected PostgreSQL pool error:', error.message)
  })
}

export async function checkDatabase() {
  if (!pool) return { configured: false, ok: false }

  try {
    const result = await pool.query('SELECT NOW() AS current_time')
    return { configured: true, ok: true, currentTime: result.rows[0].current_time }
  } catch (error) {
    console.error('Database connection check failed:', error.message)
    return { configured: true, ok: false }
  }
}
