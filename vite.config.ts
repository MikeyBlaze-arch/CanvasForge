import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/autodl': {
        target: 'https://www.autodl.art',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/autodl/, '/api/v1/adl_dev/dev/instance/pro'),
        headers: {
          'Accept': 'application/json',
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
