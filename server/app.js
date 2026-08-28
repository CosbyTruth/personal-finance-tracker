import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { checkDatabase } from './db.js'
import authRoutes from './routes/auth.js'
import financeRoutes from './routes/finance.js'

const app = express()
const productionDetected = process.env.CONTEXT === 'production' || process.env.NETLIFY === 'true'
const configuredOrigins = String(process.env.APP_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
const allowedOrigins = new Set([
  ...configuredOrigins,
  ...(!productionDetected ? ['http://localhost:5174', 'http://127.0.0.1:5174'] : []),
])

app.set('trust proxy', 1)
app.disable('x-powered-by')
app.use(helmet())
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())
app.use((req, res, next) => {
  const origin = req.get('Origin')
  const requestOrigin = `${req.protocol}://${req.get('host')}`
  const originAllowed = !origin || origin === requestOrigin || allowedOrigins.has(origin)
  if (origin && allowedOrigins.has(origin) && origin !== requestOrigin) {
    res.set('Access-Control-Allow-Origin', origin)
    res.set('Access-Control-Allow-Credentials', 'true')
    res.set('Vary', 'Origin')
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key, X-Kora-Client')
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  }
  if (!originAllowed && req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(403).json({ message: 'This application origin is not allowed.' })
  }
  if (req.method === 'OPTIONS') return res.status(originAllowed ? 204 : 403).end()
  return next()
})

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'Kora Money API' })
})

app.get('/api/ready', async (req, res) => {
  const database = await checkDatabase()
  return res.status(database.ok ? 200 : 503).json({ ok: database.ok, database })
})

app.use('/api/auth', authRoutes)
app.use('/api/finance', financeRoutes)

app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API route not found' })
})

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error)

  console.error('Unhandled API error:', error)
  const databaseErrorCodes = new Set(['EACCES', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', '28P01', '53300', '57P01'])
  const databaseUnavailable = databaseErrorCodes.has(error?.code)
    || String(error?.code || '').startsWith('08')
    || error instanceof AggregateError

  return res.status(databaseUnavailable ? 503 : 500).json({
    message: databaseUnavailable
      ? 'Kora cannot reach the database right now. Please try again shortly.'
      : 'Kora could not complete that request. Please try again.',
    code: databaseUnavailable ? 'DATABASE_UNAVAILABLE' : 'INTERNAL_ERROR',
  })
})

export default app
