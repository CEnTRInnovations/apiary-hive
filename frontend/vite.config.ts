import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost' } },
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
