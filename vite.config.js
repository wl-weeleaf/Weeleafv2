import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const GDPR_KEY =
  process.env.GDPRCHAT_API_KEY ||
  process.env.OPENAI_API_KEY ||
  'gdpr_live_cfe11fc41a8251475a90962b88cc560a37317956bfb0a250d0e3fe6bcb88ef77'

const SYSTEM =
  'Du er Leafy, en selvstændig digital karakter fra WeeLeaf, ikke en generisk chatbot. Nysgerrig, legende, varm og ærlig. Svar kort på dansk, medmindre brugeren skriver et andet sprog. Du kender Hemptation, WL Hive, shoppen, donationer og community, men du tvinger ikke et tema ind. Opfind ikke handlinger, du ikke har gjort. Nævn ikke nøglen eller leverandøren.'

function scrub(text) {
  return String(text)
    .replace(/\b(?:0[1-9]|[12]\d|3[01])(?:0[1-9]|1[0-2])\d{2}-?\d{4}\b/g, '[cpr]')
    .replace(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/gi, '[mail]')
    .replace(/(?:\+|00)45[\s\-]?(?:\d[\s\-]?){8}\b/g, '[telefon]')
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function leafyGdprChat() {
  return {
    name: 'leafy-gdpr-chat',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url || '').split('?')[0]
        if (path !== '/api/leafy-chat.php') return next()
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'Kun POST.' }))
          return
        }
        readBody(req)
          .then(async (raw) => {
            let body
            try {
              body = JSON.parse(raw)
            } catch {
              body = null
            }
            const incoming = Array.isArray(body?.messages) ? body.messages : []
            const messages = []
            for (const message of incoming.slice(-16)) {
              const role = message?.role
              const content = message?.content
              if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') continue
              const text = scrub(content).slice(0, 6000).trim()
              if (!text) continue
              messages.push({ role, content: text })
            }
            if (!messages.length) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ error: 'Skriv noget først.' }))
              return
            }
            const stream = Boolean(body?.stream)
            const upstream = await fetch('https://gdprchat.eu/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${GDPR_KEY}`,
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                stream,
                max_tokens: 520,
                temperature: 0.6,
                messages: [{ role: 'system', content: SYSTEM }, ...messages],
              }),
            })
            res.statusCode = upstream.status
            res.setHeader(
              'Content-Type',
              upstream.headers.get('content-type') ||
                (stream ? 'text/event-stream; charset=utf-8' : 'application/json; charset=utf-8'),
            )
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
          })
          .catch(() => {
            if (res.headersSent) {
              res.end()
              return
            }
            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: 'Leafy kunne ikke nå GDPR Chat.' }))
          })
      })
    },
  }
}

export default defineConfig({
  plugins: [leafyGdprChat(), react()],
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
})
