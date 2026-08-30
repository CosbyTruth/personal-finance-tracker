import express from 'express'
import bcrypt from 'bcryptjs'
import { pool } from '../db.js'
import { AUTH_COOKIE, authCookieOptions, createAuthToken } from '../auth-token.js'
import { requireAuth } from '../middleware/auth.js'
import { ensureDefaultFinanceCategories } from '../finance-defaults.js'
import { validatePassword } from '../password-policy.js'
import { authRateKey, checkAuthRateLimit, clearAuthFailures, recordAuthFailure } from '../auth-rate-limit.js'

const router = express.Router()
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('kora-dummy-password-value', 12)

async function enforceAuthLimit(req, res, action, email) {
  const key = authRateKey(action, req.ip, email)
  const limit = await checkAuthRateLimit(key)
  if (!limit.allowed) {
    res.set('Retry-After', String(limit.retryAfterSeconds))
    res.status(429).json({ message: 'Too many attempts. Please wait a few minutes and try again.' })
    return null
  }
  return key
}

function ensureDatabase(res) {
  if (!pool) {
    res.status(503).json({ message: 'Database is not configured' })
    return false
  }
  return true
}

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, createdAt: row.created_at }
}

function sendAuthenticatedUser(req, res, user, status = 200, mobileClient = false) {
  const token = createAuthToken(user)
  res.cookie(AUTH_COOKIE, token, authCookieOptions())

  // Native apps cannot rely on browser cookies. Only return the bearer token
  // through the explicit mobile route or when a compatible client identifies itself.
  const payload = mobileClient || req.get('x-kora-client') === 'mobile' ? { user, token } : { user }
  return res.status(status).json(payload)
}

router.post('/register', async (req, res) => {
  if (!ensureDatabase(res)) return

  const name = String(req.body?.name || '').trim()
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')

  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({ message: 'Name must be between 2 and 80 characters' })
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return res.status(400).json({ message: 'Enter a valid email address' })
  }

  const passwordResult = validatePassword(password)
  if (!passwordResult.valid) {
    return res.status(400).json({ message: passwordResult.message, code: 'WEAK_PASSWORD' })
  }
  const rateKey = await enforceAuthLimit(req, res, 'register', email)
  if (!rateKey) return

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const passwordHash = await bcrypt.hash(password, 12)
    const result = await client.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [name, email, passwordHash],
    )
    const user = publicUser(result.rows[0])
    await ensureDefaultFinanceCategories(user.id, client)
    await client.query('COMMIT')
    await clearAuthFailures(rateKey).catch(() => {})

    return sendAuthenticatedUser(req, res, user, 201)
  } catch (error) {
    await client.query('ROLLBACK')
    if (error.code === '23505') {
      await recordAuthFailure(rateKey)
      return res.status(409).json({ message: 'An account with that email already exists' })
    }
    console.error('Registration failed:', error)
    return res.status(500).json({ message: 'Could not create the account' })
  } finally {
    client.release()
  }
})

async function login(req, res, mobileClient = false) {
  if (!ensureDatabase(res)) return

  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' })
  }
  const rateKey = await enforceAuthLimit(req, res, 'login', email)
  if (!rateKey) return

  try {
    const result = await pool.query(
      `SELECT id, name, email, password_hash, created_at
       FROM users WHERE email = $1 LIMIT 1`,
      [email],
    )
    const row = result.rows[0]
    const passwordMatches = await bcrypt.compare(password, row?.password_hash || DUMMY_PASSWORD_HASH)
    if (!row || !passwordMatches) {
      await recordAuthFailure(rateKey)
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    const user = publicUser(row)
    await ensureDefaultFinanceCategories(user.id)
    await clearAuthFailures(rateKey).catch(() => {})
    return sendAuthenticatedUser(req, res, user, 200, mobileClient)
  } catch (error) {
    console.error('Login failed:', error)
    return res.status(500).json({ message: 'Could not sign in' })
  }
}

router.post('/login', (req, res) => login(req, res))
router.post('/mobile/login', (req, res) => login(req, res, true))

router.post('/logout', (req, res) => {
  const options = authCookieOptions()
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path,
  })
  return res.status(204).end()
})

router.get('/me', requireAuth, async (req, res) => {
  if (!ensureDatabase(res)) return

  try {
    const result = await pool.query(
      `SELECT id, name, email, created_at FROM users WHERE id = $1 LIMIT 1`,
      [req.auth.userId],
    )
    if (!result.rows[0]) return res.status(401).json({ message: 'Account no longer exists' })

    return res.json({ user: publicUser(result.rows[0]) })
  } catch (error) {
    console.error('Session lookup failed:', error)
    return res.status(500).json({ message: 'Could not load your account' })
  }
})

export default router
