import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function stripBrowserOrigin() {
  return {
    configure(proxy) {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.removeHeader('origin')
        proxyReq.removeHeader('referer')
      })
    },
  }
}

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://weeleaf.com',
        changeOrigin: true,
        secure: true,
      },
      '/corti-auth': {
        target: 'https://auth.eu.corti.app',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/corti-auth/, ''),
        ...stripBrowserOrigin(),
      },
      '/corti-api': {
        target: 'https://api.eu.corti.app',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/corti-api/, ''),
        ...stripBrowserOrigin(),
      },
    },
  },
})
