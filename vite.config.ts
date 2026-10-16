/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base: '/ghost-bureau/' нужен для деплоя в подпапку GitHub Pages
// (https://<user>.github.io/ghost-bureau/). На локальном dev-сервере
// Vite всё равно отдаёт с корня, так что это не мешает разработке.
export default defineConfig({
  plugins: [react()],
  base: '/ghost-bureau/',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
