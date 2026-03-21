import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// Standalone Vite config for `npm run dev:renderer` (browser preview only).
// The main electron-vite config is at the repo root (electron.vite.config.ts).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src')
    }
  }
})
