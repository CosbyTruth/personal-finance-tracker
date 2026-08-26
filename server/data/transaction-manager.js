import { pool } from '../db.js'

export async function withTransaction(work, { isolationLevel = 'READ COMMITTED' } = {}) {
  if (!pool) throw new Error('Database is not configured')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`)
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
