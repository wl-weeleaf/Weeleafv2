import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // .env holds server-side Corti secrets; keep Vite from reading it (and reloading on save).
  envDir: 'web-env',
  server: {
    port: 5180,
    proxy: { '/api': 'http://localhost:8787' },
    // The browser may only talk to this app and to Corti's speech service.
    headers: {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'", // inline needed by the dev server only
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self' data:",
        "connect-src 'self' ws://localhost:5180 wss://*.corti.app",
        "frame-ancestors 'none'",
      ].join('; '),
    },
  },
})
