import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 7071,
    // Docker 环境下关闭文件监听（macOS bind mount 不传播 fs events），
    // 需要 HMR 时手动刷新浏览器。大幅减少 Vite 文件系统开销。
    watch: process.env.VITE_DISABLE_WATCH === 'true' ? null : undefined,
    hmr: {
      // Docker 环境下，容器内部 Vite 端口(7071) 映射到宿主机端口(3001)，
      // 需要告知浏览器端 HMR WebSocket 连接到正确的宿主机端口。
      clientPort: process.env.VITE_HMR_CLIENT_PORT
        ? parseInt(process.env.VITE_HMR_CLIENT_PORT, 10)
        : undefined,
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:7075',
        changeOrigin: true,
        ws: true,
      },
      '/v1': {
        target: process.env.VITE_API_TARGET || 'http://localhost:7075',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': ['antd'],
          'vendor-icons': ['@ant-design/icons'],
          'vendor-utils': ['axios', 'zustand'],
          recharts: ['recharts'],
        },
      },
    },
  },
})
