import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@supabase') || id.includes('supabase-js')) {
            return 'supabase-vendor'
          }

          if (/(motion|framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) {
            return 'motion-vendor'
          }

          if (/(recharts|d3-[^\\/]+)[\\/]/.test(id)) {
            return 'charts-vendor'
          }
        },
      },
    },
  },
})
