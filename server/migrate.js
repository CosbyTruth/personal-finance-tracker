import 'dotenv/config'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const migrationDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations')
const lockKey = 1852141337

export async function runMigrations(database) {
  const client = await database.connect()
  try {
    await client.query('SELECT pg_advisory_lock($1)', [lockKey])
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(160) PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    )

    const files = (await readdir(migrationDirectory))
      .filter((name) => /^\d+.*\.sql$/.test(name))
      .sort()

    for (const version of files) {
      const sql = await readFile(path.join(migrationDirectory, version), 'utf8')
      const checksum = createHash('sha256').update(sql).digest('hex')
      const applied = await client.query(
        'SELECT checksum FROM schema_migrations WHERE version=$1',
        [version],
      )
      if (applied.rowCount) {
        if (applied.rows[0].checksum !== checksum) {
          throw new Error(`Migration drift detected for ${version}`)
        }
        continue
      }

      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query(
          'INSERT INTO schema_migrations(version, checksum) VALUES ($1,$2)',
          [version, checksum],
        )
        await client.query('COMMIT')
        console.log(`Applied migration ${version}`)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [lockKey]).catch(() => {})
    client.release()
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) {
  const { pool } = await import('./db.js')
  if (!pool) {
    console.error('DATABASE_URL is missing.')
    process.exitCode = 1
  } else {
    try {
      await runMigrations(pool)
      console.log('Database migrations are current.')
    } catch (error) {
      console.error('Database migration failed:', error)
      process.exitCode = 1
    } finally {
      await pool.end()
    }
  }
}
