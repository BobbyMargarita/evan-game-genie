import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-only middleware that runs the Vercel-style handlers in api/ so the app
// works under `npm run dev` without the Vercel CLI. In production Vercel
// serves api/*.js as real serverless functions.
function apiDev() {
  return {
    name: 'api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const m = req.url.match(/^\/api\/([a-z]+)(\?|$)/)
        if (!m) return next()
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.js`)
          await mod.default(req, res)
        } catch (e) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: String(e) }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), apiDev()],
})
