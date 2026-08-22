import 'dotenv/config'

const required = ['DATABASE_URL', 'JWT_SECRET']
const missing = required.filter((key) => !process.env[key])

if (missing.length) {
  console.error(`Environment check failed. Missing: ${missing.join(', ')}`)
  process.exit(1)
}

if (String(process.env.JWT_SECRET).length < 32) {
  console.error('Environment check failed. JWT_SECRET should be at least 32 characters.')
  process.exit(1)
}

console.log('Environment check passed.')
