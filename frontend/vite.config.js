import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Proxy all /api/* calls to the Express backend during development.
    // This means fetch('/api/analyze') in the browser hits localhost:5000/api/analyze.
    // In production, configure your reverse proxy (nginx / Firebase hosting) to do the same.
    proxy: {
      '/api': {
        target:       'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Warn if any chunk exceeds 600 KB before gzip
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split PapaParse into its own chunk — it's ~50 KB and rarely changes
        manualChunks: {
          papaparse: ['papaparse'],
        },
      },
    },
  },
})
