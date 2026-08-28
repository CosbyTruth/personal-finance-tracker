import 'dotenv/config'
import app from './app.js'

const productionRuntime = process.env.NODE_ENV === 'production'
  || process.env.CONTEXT === 'production'
  || process.env.NETLIFY === 'true'
const port = Number(productionRuntime
  ? process.env.PORT || 5001
  : process.env.DEV_API_PORT || 5010)

const server = app.listen(port)

server.once('listening', () => {
  console.log(`Kora Money API running on http://localhost:${port}`)
})

server.once('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Kora Money API could not start: port ${port} is already in use.`)
  } else {
    console.error('Kora Money API could not start:', error.message)
  }
  process.exitCode = 1
})
