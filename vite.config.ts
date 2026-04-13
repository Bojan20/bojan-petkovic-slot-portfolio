import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'es2023',
  },
  server: {
    port: 5180,
    host: true, // Listen on 0.0.0.0 — accessible from LAN (phone)
    open: true,
  },
})
