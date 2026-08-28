import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')
  const apiPort = Number(environment.DEV_API_PORT || 5010)

  return {
    plugins: [react()],
    server: {
      port: 5174,
      proxy: {
        '/api': `http://localhost:${apiPort}`,
      },
    },
  }
})
