import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const resolvePath = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolvePath('./src'),
      '@shared': resolvePath('./shared'),
    },
  },
  server: {
    host: true,
    port: 5173,
    // The Hono API runs separately in dev; proxy keeps the client same-origin.
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
