import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/",
  server: {
    port: 5174,
    host: true, // Listen on all addresses
    allowedHosts: "all", // Allow any host (needed for subdomains on Vite 6+)
    strictPort: true
  },
  build: {
    chunkSizeWarningLimit: 2000,
  }
})
