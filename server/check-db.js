import 'dotenv/config'
import { checkDatabase, pool } from './db.js'

const result = await checkDatabase()

if (!result.ok) {
  console.error('Database check failed:', result.error || 'Database is not configured')
  if (pool) await pool.end()
  process.exit(1)
}

console.log('Database check passed.')
if (pool) await pool.end()
