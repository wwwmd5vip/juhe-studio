import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'fs'

// pnpm 顶层 node_modules 没有 debug 的 symlink，直接用 pnpm store 的真实绝对路径
// 这样无论是 dev 还是 bundle 都不会因为 require.resolve 找不到顶层 symlink 而挂
const debugBrowser = resolve(
  'node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/browser.js'
)
const debugNode = resolve('node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/index.js')

// 将 SQL 迁移文件复制到构建输出目录
function copyMigrations() {
  const cwd = process.cwd()
  const srcDir = resolve(cwd, 'src/main/db/migrations')
  const destDir = resolve(cwd, 'out/main/db/migrations')
  if (!existsSync(srcDir)) return
  mkdirSync(destDir, { recursive: true })
  const files = readdirSync(srcDir).filter((f) => f.endsWith('.sql'))
  for (const f of files) {
    copyFileSync(resolve(srcDir, f), resolve(destDir, f))
  }
  console.log(`[build] Copied ${files.length} migration files to out/main/db/migrations`)
}

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({ exclude: ['@cherrystudio/client'] }),
      {
        name: 'copy-migrations',
        closeBundle() {
          copyMigrations()
        }
      }
    ],
    build: {
      lib: {
        entry: 'src/main/index.ts',
        formats: ['cjs'],
        fileName: () => 'index.js'
      },
      rollupOptions: {
        external: ['electron']
      }
    },
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@shared': resolve('src/shared'),
        '@cherrystudio/ai-core': resolve('packages/aiCore/src/index.ts'),
        '@cherrystudio/provider-registry': resolve('packages/provider-registry/src/index.ts'),
        '@cherrystudio/client': resolve('packages/client/src/index.ts'),
        // debug@5.x main 字段指向不存在的 src/index.js；显式指向 node.js（main 进程）
        debug: debugNode
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: 'src/preload/index.ts',
        formats: ['cjs'],
        fileName: () => 'index.js'
      }
    },
    resolve: {
      // debug@5.x main 字段指向不存在的 src/index.js；显式指向 node.js（preload 进程）
      alias: {
        debug: debugNode
      }
    }
  },
  renderer: {
    define: {
      // pc/ 不随包分发本地 GUO 模型资产，目录中仅保留远程/内置模型
      __LOCAL_GUO_ASSETS_AVAILABLE__: 'false'
    },
    resolve: {
      alias: [
        { find: '@', replacement: resolve('src/renderer/src') },
        { find: '@renderer', replacement: resolve('src/renderer/src') },
        { find: '@shared', replacement: resolve('src/shared') },
        { find: /^@cherrystudio\/ui$/, replacement: resolve('packages/ui/src/index.ts') },
        { find: /^@cherrystudio\/ui\/(.*)$/, replacement: resolve('packages/ui/src/$1') },
        // debug@5.x main 字段指向不存在的 src/index.js；显式指向 browser.js（renderer 进程）
        { find: 'debug', replacement: debugBrowser }
      ]
    },
    plugins: [
      TanStackRouterVite({
        target: 'react',
        autoCodeSplitting: true,
        routesDirectory: resolve('src/renderer/src/routes'),
        generatedRouteTree: resolve('src/renderer/src/routeTree.gen.ts')
      }),
      tailwindcss(),
      react()
    ],
    esbuild: {
      // Production: strip console.* and debugger statements from renderer
      drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []
    },
    build: {
      // Performance: chunk splitting strategy
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Vendor chunks — split large libraries into separate files
            if (id.includes('node_modules')) {
              if (id.includes('framer-motion')) return 'vendor-framer'
              if (id.includes('@tanstack/react-query')) return 'vendor-react-query'
              if (id.includes('@tanstack/react-router')) return 'vendor-react-router'
              if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react'
              if (id.includes('lucide-react')) return 'vendor-ui'
              if (id.includes('i18next') || id.includes('react-i18next')) return 'vendor-i18n'
              if (id.includes('zod') || id.includes('zustand') || id.includes('zundo')) return 'vendor-state'
              if (id.includes('tailwind-merge') || id.includes('clsx')) return 'vendor-utils'
              if (id.includes('@modelcontextprotocol/sdk')) return 'vendor-mcp'
              if (id.includes('@xyflow')) return 'vendor-xyflow'
              if (id.includes('@sentry')) return 'vendor-sentry'
            }
            // Feature chunks — code-split large routes
            if (id.includes('src/renderer/src/routes/chat')) return 'feature-chat'
            if (id.includes('src/renderer/src/routes/canvas')) return 'feature-canvas'
            if (id.includes('src/renderer/src/routes/generate')) return 'feature-generate'
            if (id.includes('src/renderer/src/routes/queue')) return 'feature-queue'
            if (id.includes('src/renderer/src/routes/settings')) return 'feature-settings'
            if (id.includes('src/renderer/src/routes/agent-squad')) return 'feature-agent-squad'
            if (id.includes('src/renderer/src/routes/smart-tools')) return 'feature-smart-tools'
            if (id.includes('src/renderer/src/routes/research')) return 'feature-research'
            if (id.includes('src/renderer/src/routes/agents')) return 'feature-agents'
            if (id.includes('src/renderer/src/routes/ecommerce')) return 'feature-ecommerce'
            if (id.includes('src/renderer/src/routes/ecommerce-workflow')) return 'feature-ecommerce-workflow'
            if (id.includes('src/renderer/src/routes/video-editor')) return 'feature-video-editor'
          }
        }
      },
      // Performance: enable minification
      minify: 'esbuild',
      // Performance: target modern browsers
      target: 'es2020'
    }
  }
})
