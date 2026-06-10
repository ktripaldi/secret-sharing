import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { createApp } from './app.ts'
import { createDb } from './lib/db.ts'
import { sweepExpired } from './lib/store.ts'
import { DB_PATH, PORT, SWEEP_INTERVAL_MS } from './constants.ts'

const db = createDb(DB_PATH)
const app = createApp({ db })

// Serve the built client in production. In dev, Vite serves the SPA and proxies
// /api here, so these only take effect once ./dist exists.
app.use('/*', serveStatic({ root: './dist' }))
app.get('/*', serveStatic({ path: './dist/index.html' })) // SPA fallback for /s/:id

const sweepTimer = setInterval(() => {
  try {
    const removed = sweepExpired(db, Date.now())
    if (removed > 0) console.log(`[api] swept ${removed} expired secrets`)
  } catch (err) {
    console.error('[api] sweep failed', err)
  }
}, SWEEP_INTERVAL_MS)
sweepTimer.unref()

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port}`)
})
