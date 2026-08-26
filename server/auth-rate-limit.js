import { createHash } from 'node:crypto'
import { pool } from './db.js'

const MAX_FAILURES = 5
const WINDOW_MINUTES = 15

export function authRateKey(action, ip, email) {
  return createHash('sha256')
    .update(`${action}:${String(ip || 'unknown')}:${String(email || '').trim().toLowerCase()}`)
    .digest('hex')
}

export async function checkAuthRateLimit(bucketHash) {
  if (!pool) return { allowed: true, retryAfterSeconds: 0 }
  const result = await pool.query(
    `SELECT blocked_until FROM auth_rate_limits
     WHERE bucket_hash=$1 AND blocked_until > NOW()`,
    [bucketHash],
  )
  if (!result.rowCount) return { allowed: true, retryAfterSeconds: 0 }
  const seconds = Math.max(1, Math.ceil((new Date(result.rows[0].blocked_until).getTime() - Date.now()) / 1000))
  return { allowed: false, retryAfterSeconds: seconds }
}

export async function recordAuthFailure(bucketHash) {
  if (!pool) return
  await pool.query(
    `INSERT INTO auth_rate_limits (bucket_hash, attempts, window_started_at)
     VALUES ($1,1,NOW())
     ON CONFLICT (bucket_hash) DO UPDATE SET
       attempts = CASE
         WHEN auth_rate_limits.window_started_at < NOW() - INTERVAL '${WINDOW_MINUTES} minutes' THEN 1
         ELSE auth_rate_limits.attempts + 1
       END,
       window_started_at = CASE
         WHEN auth_rate_limits.window_started_at < NOW() - INTERVAL '${WINDOW_MINUTES} minutes' THEN NOW()
         ELSE auth_rate_limits.window_started_at
       END,
       blocked_until = CASE
         WHEN auth_rate_limits.window_started_at >= NOW() - INTERVAL '${WINDOW_MINUTES} minutes'
          AND auth_rate_limits.attempts + 1 >= ${MAX_FAILURES}
         THEN NOW() + INTERVAL '${WINDOW_MINUTES} minutes'
         ELSE NULL
       END,
       updated_at = NOW()`,
    [bucketHash],
  )
}

export async function clearAuthFailures(bucketHash) {
  if (!pool) return
  await pool.query('DELETE FROM auth_rate_limits WHERE bucket_hash=$1', [bucketHash])
}
