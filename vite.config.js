import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const GDPR_KEY =
  process.env.GDPRCHAT_API_KEY ||
  process.env.OPENAI_API_KEY ||
  'gdpr_live_cfe11fc41a8251475a90962b88cc560a37317956bfb0a250d0e3fe6bcb88ef77'

function leafyChatDev(req, res, next) {
  const url = req.url || ''
  if (!url.startsWith('/api/leafy-chat.php')) return next()
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end()
    return
  }
  const chunks = []
  req.on('data', (chunk) => chunks.push(chunk))
  req.on('end', async () => {
    try {
      const upstream = await fetch('https://gdprchat.eu/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GDPR_KEY}`,
        },
        body: Buffer.concat(chunks),
      })
      res.statusCode = upstream.status
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
      res.setHeader('Cache-Control', 'no-cache, no-transform')
      if (!upstream.body) {
        res.end(await upstream.text())
        return
      }
      const reader = upstream.body.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(Buffer.from(value))
      }
      res.end()
    } catch {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Leafy kunne ikke nå GDPR Chat.' }))
    }
  })
}

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three'
          if (id.includes('node_modules/gsap')) return 'gsap'
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://weeleaf.com',
        changeOrigin: true,
        secure: true,
        bypass(req) {
          if (req.url?.startsWith('/api/leafy-chat.php')) return req.url
        },
      },
    },
  },
  configureServer(server) {
    return () => {
      server.middlewares.stack.unshift({ route: '', handle: leafyChatDev })
    }
  },
})
