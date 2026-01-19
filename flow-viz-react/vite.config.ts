import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',   // <-- ez kell LAN-hoz (vagy: true)
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',  // FastAPI backend
        changeOrigin: true,
        secure: false,
        // WebSocket support for future features
        ws: true,
      }
    }
  }
})
