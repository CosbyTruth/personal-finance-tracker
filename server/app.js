import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { checkDatabase } from './db.js'
import authRoutes from './routes/auth.js'
import financeRoutes from './routes/finance.js'

const app = express()
app.set('trust proxy', 1)
app.disable('x-powered-by')
app.use(helmet())
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Personal Finance Tracker API online' })
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

export default app
