import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', () => {
            // Suppress connection errors while backend is restarting
          })
        },
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        rewrite: (path) => '/api' + path,
        configure: (proxy) => {
          proxy.on('error', () => {
            // Suppress ECONNABORTED / ECONNREFUSED noise in the Vite console.
            // These fire when the backend restarts (--reload) or the WS closes normally.
            // The frontend's own reconnect loop handles re-establishing the connection.
          })
        },
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})
