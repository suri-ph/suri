import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss()
  ],
  build: {
    outDir: "dist-react"
  },
  server: {
    port: 5123,
    strictPort: true
  }
 })