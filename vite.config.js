import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
      },
      '/xai': {
        target: 'https://api.x.ai',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/xai/, '/v1'),
      },
      '/corti-auth': {
        target: 'https://auth.eu.corti.app',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/corti-auth/, ''),
      },
      '/corti-api': {
        target: 'https://api.eu.corti.app',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/corti-api/, ''),
      },
      '/corti-ai': {
        target: 'https://ai.eu.corti.app',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/corti-ai/, ''),
      },
    },
  },
})
