import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      manifest: {
        name: 'QueueCut — Salon Queue',
        short_name: 'QueueCut',
        description: 'Skip the salon queue with real-time tracking.',
        theme_color: '#111113',
        background_color: '#111113',
        display: 'standalone',
        icons: [
          {
            src: '/favicon.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: '/favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  },
  build: {
    // Raise warning threshold — vendor split below makes this expected
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core — loaded on every page, tiny, cached forever
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-core'
          }
          // Router — always needed
          if (id.includes('node_modules/react-router')) {
            return 'react-router'
          }
          // Charts — only loaded on analytics/revenue pages
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'charts'
          }
          // Icons — medium sized, cacheable
          if (id.includes('node_modules/lucide-react')) {
            return 'icons'
          }
          // Supabase auth client
          if (id.includes('node_modules/@supabase') || id.includes('node_modules/supabase')) {
            return 'supabase'
          }
          // Axios HTTP
          if (id.includes('node_modules/axios')) {
            return 'http-client'
          }
          // All other dependencies bundled as vendor (much smaller now)
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        }
      }
    }
  }
})
