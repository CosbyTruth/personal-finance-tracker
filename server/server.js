import 'dotenv/config'
import app from './app.js'

const port = Number(process.env.PORT || 5001)

app.listen(port, () => {
  console.log(`Kora Money API running on http://localhost:${port}`)
})
