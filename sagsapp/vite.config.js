import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // .env holds server-side Corti secrets; keep Vite from reading it (and reloading on save).
  envDir: 'web-env',
  server: {
    port: 5180,
    proxy: { '/api': 'http://localhost:8787' },
  },
})
