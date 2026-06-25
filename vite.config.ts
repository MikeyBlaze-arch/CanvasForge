import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    // 开发环境默认使用 localhost，仅本机可访问
    // 如需局域网真机调试，可临时改为 '0.0.0.0'，但默认应使用 localhost 以避免开发环境的 API Key 被局域网内其他设备访问
    host: 'localhost',
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
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
