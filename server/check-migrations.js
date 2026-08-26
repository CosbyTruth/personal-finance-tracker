import 'dotenv/config'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './db.js'

if (!pool) {
  console.error('DATABASE_URL is missing.')
  process.exit(1)
}

const directory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations')
const client = await pool.connect()
try {
  await client.query('BEGIN')
  const files = (await readdir(directory)).filter((name) => /^\d+.*\.sql$/.test(name)).sort()
  for (const file of files) {
    await client.query(await readFile(path.join(directory, file), 'utf8'))
  }
  await client.query('SET CONSTRAINTS ALL IMMEDIATE')
  const invalid = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM (
       SELECT journal_id, currency
       FROM ledger_postings
       GROUP BY journal_id, currency
       HAVING COUNT(*) < 2
          OR SUM(amount) FILTER (WHERE side='Debit')
             IS DISTINCT FROM
             SUM(amount) FILTER (WHERE side='Credit')
     ) invalid_journals`,
  )
  const empty = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM ledger_journals j
     WHERE NOT EXISTS (SELECT 1 FROM ledger_postings p WHERE p.journal_id=j.id)`,
  )
  if (invalid.rows[0].count || empty.rows[0].count) {
    throw new Error(`Ledger backfill validation failed: ${invalid.rows[0].count} unbalanced, ${empty.rows[0].count} empty`)
  }
  console.log(`Migration dry run passed for ${files.length} files; ledger backfill is balanced.`)
} catch (error) {
  console.error('Migration dry run failed:', error.message)
  process.exitCode = 1
} finally {
  await client.query('ROLLBACK').catch(() => {})
  client.release()
  await pool.end()
}
