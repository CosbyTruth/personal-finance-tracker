import jwt from 'jsonwebtoken'

export const AUTH_COOKIE = 'pft_auth'

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not configured')
  return secret
}

export function createAuthToken(user) {
  return jwt.sign(
    { sub: String(user.id), email: user.email, name: user.name },
    getSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  )
}

export function verifyAuthToken(token) {
  return jwt.verify(token, getSecret())
}

export function authCookieOptions() {
  const productionDetected =
    process.env.CONTEXT === 'production' || process.env.NETLIFY === 'true'

  const secure =
    process.env.COOKIE_SECURE === 'true' ||
    (process.env.COOKIE_SECURE !== 'false' && productionDetected)

  const configuredSameSite = String(process.env.COOKIE_SAME_SITE || 'lax').toLowerCase()
  const sameSite = ['lax', 'strict', 'none'].includes(configuredSameSite) ? configuredSameSite : 'lax'

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  }
}
