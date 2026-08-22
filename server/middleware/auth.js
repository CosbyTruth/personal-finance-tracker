import { AUTH_COOKIE, verifyAuthToken } from '../auth-token.js'

export function requireAuth(req, res, next) {
  const cookieToken = req.cookies?.[AUTH_COOKIE]
  const authHeader = req.get('authorization') || ''
  const bearerToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null
  const token = cookieToken || bearerToken

  if (!token) return res.status(401).json({ message: 'Authentication required' })

  try {
    const payload = verifyAuthToken(token)
    req.auth = {
      userId: Number(payload.sub),
      email: payload.email,
      name: payload.name,
    }
    return next()
  } catch {
    return res.status(401).json({ message: 'Your session is invalid or has expired' })
  }
}
