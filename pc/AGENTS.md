<!-- AGENTS.md — 聚合创作引擎 (Juhe Studio) -->

> 本文档供 AI Coding Agent 阅读。项目所有注释、文档和用户界面以中文为主，代码本身使用英文标识符。
> 最后更新：2026-07-02（安全加固、构建优化、文档校验后更新）。

---

## 1. 项目概述

**聚合创作引擎**（Juhe Studio）是一款面向创作者和设计师的 AI 聚合创作桌面应用，基于 Electron + React + TypeScript 构建。它支持多模型 API 接入，提供从文本到图像、视频的一站式 AI 创作能力，包含无限画布工作流、智能图像处理、提示词系统、AI 聊天、深度研究、MCP 工具调用、NewAPI 账号集成、Agent Squad 多智能体协作、MGP Lite 记忆系统、电商固定工作流、电商橱窗简单模式、ComfyUI 调用等功能。

- **仓库**: `wwwmd5vip/juhe-studio`
- **产品名称**: 聚合创作引擎
- **App ID**: `com.juhe-studio.app`
- **版本**: `1.0.0-rc.0`
- **License**: MIT
- **包管理器**: pnpm `10.27.0`（`package.json` 中通过 `packageManager` 锁定）
- **Node 要求**: `>= 20.0.0`
- **操作系统**: macOS（主要开发平台）、Windows、Linux

---

## 2. 关键配置文件

| 文件 | 作用 |
|------|------|
| `package.json` | 根项目依赖、scripts、引擎要求、workspace 依赖声明 |
| `pnpm-workspace.yaml` | pnpm workspace 定义，包含 `packages/*` 和 `packages/vectorstores/*` |
| `electron.vite.config.ts` | electron-vite 构建配置，定义 main/preload/renderer 三端入口、别名、chunk 拆分 |
| `electron-builder.yml` | 应用打包与分发配置（dmg/zip、nsis/portable、AppImage/deb、GitHub Releases draft） |
| `tsconfig.json` / `tsconfig.node.json` / `tsconfig.web.json` | TypeScript 基础配置、主进程/预加载配置、渲染进程配置 |
| `biome.json` | 代码格式化与 lint 规则（缩进、引号、import 排序等） |
| `eslint.config.mjs` | ESLint 配置（TS + React + Hooks 规则） |
| `vitest.config.ts` | 根目录测试配置（node 环境、别名、覆盖率） |
| `drizzle.config.ts` | Drizzle ORM 配置，schema 与迁移输出目录，开发用 `file:./dev.db` |
| `.github/workflows/ci.yml` | CI：lint、format check、type check、test |
| `.github/workflows/build.yml` | 跨平台构建与发布（macOS/Windows/Linux + draft release） |
| `.npmrc` | npm 配置（`link-workspace-packages=true`） |

---

## 3. 技术栈与运行时架构

### 3.1 桌面端架构

采用标准 **Electron 主从架构**（Electron `^41.2.1`）：

- **Main Process** (`src/main/`)：Node.js 环境，负责窗口管理、数据库操作、文件系统、API 调用、安全存储、自动更新、系统托盘、全局快捷键。
- **Renderer Process** (`src/renderer/src/`)：Chromium 环境，React 19 SPA，负责所有 UI 渲染和用户交互。
- **Preload Script** (`src/preload/index.ts`)：在两者间建立安全桥梁，通过 `contextBridge` 暴露严格白名单 API。
- **Shared** (`src/shared/`)：主/渲染进程共享的 TypeScript 类型、常量与工具函数。

关键主进程配置（来自 `src/main/index.ts`）：

- 默认窗口尺寸 `1400×900`，最小尺寸 `900×600`，使用 `electron-window-state` 恢复位置与大小。
- `contextIsolation: true`（上下文隔离启用）
- `nodeIntegration: false`（渲染进程无 Node API）
- `sandbox: false`（预加载脚本需要文件系统访问，故关闭 sandbox；依赖 `contextBridge` 限制暴露面）
- `titleBarStyle: 'hiddenInset'`（macOS 隐藏标题栏样式）
- `backgroundThrottling: true`（后台节流）
- `webSecurity: true`（启用同源策略保护；本地图片通过 `juhe-image://` 自定义协议安全加载）
- 开发环境启用 `remote-debugging-port: 9222`
- 启动时请求单实例锁（`app.requestSingleInstanceLock()`）
- macOS 点击关闭按钮默认隐藏窗口而非退出应用
- 应用启动时先运行数据库迁移，再从数据库恢复生成队列状态，并恢复电商橱窗运行中任务

> 注意：主进程已注册 `juhe-image://` 自定义协议，仅允许访问 `app.getPath('userData')` 目录下的本地图片，在 `webSecurity: true` 下安全加载。即梦服务使用独立的本地 HTTP 图片服务器（端口 `19527+`）为外部 API 提供可下载图片 URL。Splash 窗口已加固为 `nodeIntegration: false, contextIsolation: true, sandbox: true`。

### 3.2 前端技术栈

| 类别 | 技术 / 版本 |
|------|-------------|
| UI 框架 | React `^19.2.0` + TypeScript `^5.8.3` |
| 构建工具 | Vite `^6.3.5`（通过 `electron-vite` `^5.0.0` 包装） |
| 路由 | TanStack Router `^1.139.3`（基于文件自动生成路由树 `routeTree.gen.ts`） |
| 状态管理 | Zustand `^5.0.5`（按领域拆分，共 32 个 store）+ Zundo `^2.3.0` + TanStack Query `^5.85.5` |
| 样式 | Tailwind CSS `^4.1.13` + `@tailwindcss/vite` `^4.3.0` + `@cherrystudio/ui`（Shadcn UI + Radix UI 底层） |
| 动画 | Framer Motion `^12.40.0` |
| 国际化 | i18next `^23.11.5` + react-i18next `^14.1.2`（默认 `zh-CN`，备用 `en`） |
| 编辑器 | TipTap / CodeMirror（通过 `@cherrystudio/ui` 及 `@cherrystudio/extension-table-plus`） |
| 画布 | React Flow（`@xyflow/react` `^12.11.0`） |
| 图标 | lucide-react `^0.545.0` |
| 验证 | zod `^4.1.5` |

渲染进程入口（`src/renderer/src/main.tsx`）初始化：

- `QueryClient`（`staleTime: 5min`, `retry: 1`）
- `createRouter`（`defaultPreload: 'intent'`）
- `ToastProvider`
- `AppInit`：加载聊天会话历史、Provider 配置、网络监听，并记录性能计时日志

### 3.3 后端/主进程技术栈

| 类别 | 技术 |
|------|------|
| ORM | Drizzle ORM `^0.44.5`（`drizzle-kit` `^0.31.4`） |
| 数据库 | libSQL (SQLite) — 本地文件 `app.db`（位于 `app.getPath('userData')`） |
| 迁移 | `drizzle-kit generate` + SQL 文件迁移（`src/main/db/migrations/`，含 16 个迁移文件） |
| 配置持久化 | `electron-store` `^8.2.0`（JSON 文件，默认主题/语言/窗口状态/providers） |
| API 密钥存储 | 当前为**明文存储**（见 `src/main/services/secure-storage.ts`）；历史 `enc:` 前缀密文无法解密，会被置空 |
| 自动更新 | `electron-updater` `^6.7.0`（GitHub Releases 源，draft release） |
| 窗口状态 | `electron-window-state` `^5.0.3`（`window-state.json`） |
| MCP | `@modelcontextprotocol/sdk` `^1.29.0` + `src/main/services/mcp.ts` |

### 3.4 Monorepo 包结构

项目使用 pnpm workspace（`pnpm-workspace.yaml`）：

| 包名 | 说明 | 消费者/备注 |
|------|------|-------------|
| `@cherrystudio/ai-sdk-provider` | Vercel AI SDK Provider 聚合封装（CherryIN 路由） | `ai-core`, `main` |
| `@cherrystudio/ai-core` | 统一 AI Provider 接口、流处理、工具调用、图像生成 | `main`, `renderer` |
| `@cherrystudio/provider-registry` | Provider 与模型元数据注册表 | `main`, `renderer`（通过源码路径别名引用，不随 `packages:build` 构建） |
| `@cherrystudio/ui` | React 组件库（Shadcn UI + Tailwind + Radix + 图标） | `renderer` |
| `@cherrystudio/extension-table-plus` | TipTap 表格扩展 | `renderer` |
| `@vectorstores/libsql` | libSQL 向量存储适配器 | `main` |
| `mcp-trace` | MCP 链路追踪（`trace-core` / `trace-node` / `trace-web`） | 当前未在 `src/` 中集成使用 |
| `volcengine-nodejs-sdk` | 火山引擎 SDK（内部维护） | `main` |

### 3.5 附属服务

- **`prompts-service/`**：独立的 Express 后端服务，提供远程提示词库 REST API（含认证、文件上传）。有自己的 `package.json`、TypeScript 源码和测试。前端通过主进程 IPC（`src/main/ipc/prompt-library.ts`）和客户端（`src/main/services/prompts-service.ts`）与之通信。

---

## 4. 代码组织

### 4.1 目录结构

```
src/
├── main/                       # Electron 主进程
│   ├── index.ts                # 入口：窗口创建、生命周期、模块初始化
│   ├── ipc/                    # IPC 处理器（19 个文件：index + 18 个领域文件）
│   │   ├── index.ts            # 聚合注册所有 IPC，含 DB CRUD 与窗口控制
│   │   ├── agent-squad.ts      # Agent Squad 多智能体执行
│   │   ├── chat.ts             # AI 聊天会话与流式响应
│   │   ├── comfy.ts            # ComfyUI 工作流调用
│   │   ├── ecommerce-showcase.ts # 电商橱窗简单模式
│   │   ├── ecommerce-workflow.ts # 电商固定工作流
│   │   ├── generation.ts       # 生成任务（文生图/视频）
│   │   ├── image-processing.ts # 图像处理任务
│   │   ├── memory.ts           # MGP Lite 记忆系统
│   │   ├── mcp.ts              # MCP 服务器与工具调用
│   │   ├── newapi.ts           # NewAPI 账号/密钥集成
│   │   ├── prompt-library.ts   # 远程提示词库（prompts-service）
│   │   ├── prompt.ts           # 提示词优化/模板
│   │   ├── providers.ts        # Provider 连接测试、模型拉取
│   │   ├── quick-phrases.ts    # 快捷短语
│   │   ├── skills.ts           # 技能系统
│   │   ├── video-generation.ts # 视频生成任务
│   │   └── websearch.ts        # 网络搜索
│   ├── services/               # 核心业务服务
│   │   ├── generation.ts       # 生成队列与任务调度
│   │   ├── generation-router.ts# 生成 Provider 路由
│   │   ├── queue.ts            # 并发控制队列
│   │   ├── secure-storage.ts   # API Key 存储（当前明文兼容层）
│   │   ├── plugin-engine.ts    # 插件引擎
│   │   ├── prompt-optimizer.ts # 提示词优化服务
│   │   ├── prompts-service.ts  # 远程提示词库客户端
│   │   ├── aliyun-generation.ts# 阿里云生成服务
│   │   ├── jimeng-generation.ts# 即梦生成服务（含本地图片服务器）
│   │   ├── video-generation.ts # 视频生成服务
│   │   ├── audio-generation.ts # 音频生成服务
│   │   ├── image-processing.ts # 图像处理服务
│   │   ├── agent-squad-executor.ts # Agent Squad 执行器
│   │   ├── newapi-client.ts    # NewAPI HTTP 客户端
│   │   ├── mcp.ts              # MCP SDK 封装
│   │   ├── notifications.ts    # 系统通知
│   │   ├── workflow-execution.ts # 工作流节点执行
│   │   ├── ecommerce-workflow/ # 电商固定工作流执行引擎（含 LLM/视觉/流式/Agent 执行器）
│   │   ├── ecommerce-showcase/ # 电商橱窗执行引擎（含解析器、提示词模板）
│   │   └── websearch/          # 搜索 provider 适配（含 providers 子目录、types）
│   ├── db/
│   │   ├── schema.ts           # Drizzle ORM 表定义（16 张表）
│   │   ├── index.ts            # DB 连接初始化（libSQL client，userData/app.db）
│   │   ├── migrate.ts          # 迁移运行器（多路径 fallback 策略）
│   │   ├── migrate-provider-keys.ts # 历史密钥迁移
│   │   └── migrations/         # SQL 迁移文件（16 个迁移文件含 0000–0013 + meta）
│   ├── stores/
│   │   └── config.ts           # electron-store 配置实例
│   ├── tray.ts                 # 系统托盘
│   ├── updater.ts              # 自动更新逻辑
│   └── shortcuts.ts            # 全局快捷键
├── renderer/src/               # Electron 渲染进程
│   ├── main.tsx                # React 入口
│   ├── routes/                 # TanStack Router 路由文件（文件即路由，30 个路由文件）
│   ├── pages/                  # 页面级组件（目录存在但当前为空）
│   ├── components/             # 业务组件（22 个子目录/文件，含 canvas-v2/chat/common/dashboard/ecommerce/ecommerce-showcase/ecommerce-workflow/generate/image-process/layout/lora/newapi/prompts/provider/settings/smart-tools/TopView/ui/video）
│   ├── stores/                 # Zustand stores（按领域拆分，32 个 store 文件 + __tests__）
│   ├── hooks/                  # 自定义 React Hooks
│   ├── i18n/                   # 国际化
│   │   ├── index.ts            # i18n 初始化（zh-CN 默认）
│   │   └── locales/            # zh-CN.json, en.json
│   ├── lib/                    # 渲染进程工具库
│   ├── styles/                 # 全局 CSS / Tailwind 入口
│   └── utils/                  # 渲染进程工具函数
├── preload/
│   └── index.ts                # contextBridge 暴露的 API 定义（window.api + window.electron）
└── shared/
    ├── types/                  # 跨进程共享的 TypeScript 类型
    ├── constants/              # 常量
    ├── utils/                  # 共享工具函数
    ├── ecommerce-workflow/     # 电商固定工作流共享定义/模板/工具/提示词
    └── __tests__/              # 共享模块的单元测试（含 ecommerce-workflow、ecommerce-showcase 子目录）
```

### 4.2 路径别名

```
@/             -> src/renderer/src/*
@renderer/*    -> src/renderer/src/*
@main/*        -> src/main/*
@preload/*     -> src/preload/*
@shared/*      -> src/shared/*
@cherrystudio/ui                  -> packages/ui/src/index.ts
@cherrystudio/ai-core             -> packages/aiCore/src/index.ts
@cherrystudio/provider-registry   -> packages/provider-registry/src/index.ts
@cherrystudio/ai-sdk-provider     -> packages/ai-sdk-provider/src/index.ts
```

---

## 5. 构建与开发命令

所有命令通过根目录 `package.json` 的 scripts 执行：

```bash
# 安装依赖（含 workspace 包）
pnpm install

# 开发模式（热重载）
pnpm dev
pnpm dev:watch

# 构建
pnpm build              # Vite 编译主进程(CJS)/预加载(CJS)/渲染进程(ESM+代码分割)
pnpm build:unpack       # 构建 + 本地解包（不调签名）
pnpm build:mac          # 构建 + macOS 打包 (dmg + zip, x64 + arm64)
pnpm build:win          # 构建 + Windows 打包 (nsis + portable, x64 + arm64)
pnpm build:linux        # 构建 + Linux 打包 (AppImage + deb)
pnpm build:all          # 一键打包 Mac + Windows（先构建 workspace 包，再编译，最后同时打包两平台）

# 类型检查
pnpm typecheck          # 先构建 ai-sdk-provider，再并行检查 main/renderer/aicore
pnpm typecheck:main     # tsc --noEmit -p tsconfig.node.json
pnpm typecheck:renderer # tsc --noEmit -p tsconfig.web.json

# 代码质量
pnpm lint               # oxlint --fix && eslint . --fix --cache
pnpm format             # biome format --write && biome lint --write

# 测试
pnpm test               # vitest run（node 环境，运行 src/**/*.test.ts）
pnpm test:main          # vitest run --project main（当前无多项目配置，脚本未实际生效）
pnpm test:renderer      # vitest run --project renderer（当前无多项目配置，脚本未实际生效）

# Workspace 包构建（CI/发布前必须先执行）
pnpm packages:build     # 构建 ai-sdk-provider、ai-core、extension-table-plus、vectorstores

# 其他
pnpm preview            # electron-vite preview
pnpm postinstall        # electron-builder install-app-deps
pnpm generate:agent-prompts  # 生成 Agent 提示词注册表
```

### 5.1 构建流程说明

1. `pnpm packages:build` 必须先执行，因为主/渲染进程依赖 workspace 包的构建产物。
2. `pnpm build` 调用 `electron-vite build`，并行编译：
   - `main`（CJS，entry: `src/main/index.ts`，external: electron）
   - `preload`（CJS，entry: `src/preload/index.ts`）
   - `renderer`（ESM + 代码分割，target: `es2020`，minify: `esbuild`）
3. 渲染进程 Rollup `manualChunks` 策略：
   - Vendor chunks: `vendor-react`, `vendor-router`, `vendor-ui`, `vendor-i18n`
   - Feature chunks: `feature-chat`, `feature-canvas`, `feature-generate`, `feature-queue`, `feature-settings`
4. `electron-builder` 读取 `electron-builder.yml`，将 `out/`、`resources/` 和 `src/main/db/migrations` 打包为各平台安装包。
5. 产物输出到 `dist/`。
6. `asarUnpack` 包含 `@libsql`、`drizzle-orm` 和迁移文件。

### 5.2 已知脚本注意事项

- `pnpm test:main` / `pnpm test:renderer` 引用了 `--project` 参数，但根目录没有 `vitest.workspace.ts` 或多项目配置，当前不会按预期工作。如需启用，需补充 Vitest workspace 配置。
- `pnpm typecheck` 会先执行 `pnpm --filter @cherrystudio/ai-sdk-provider build`，因为类型检查依赖其构建产物。
- `开发说明.md` 中提到的 `pnpm test:aicore`、`pnpm i18n:check`、`pnpm styles:canonical`、`pnpm ci`、`pnpm i18n:sync` 等脚本在当前 `package.json` 中不存在，请勿依赖。

---

## 6. 代码风格指南

### 6.1 格式化（Biome）

项目使用 **Biome** 作为首要格式化工具，配置位于 `biome.json`：

- **缩进**: 2 个空格
- **引号**: 单引号（JS/JSX 均使用单引号）
- **尾逗号**: 不使用
- **分号**: `asNeeded`（需要时才加）
- **行尾**: LF
- **行宽**: 120
- **导入排序**: Biome 自动整理（`organizeImports: on`）
- **扫描范围**: `src/**/*` 和 `packages/**/*`，排除 `node_modules`、`dist`、`out`、`build`、`coverage`、`demo`、`*.gen.ts`、`src/main/db/migrations`

运行 `pnpm format` 统一修复格式和 import 排序。

### 6.2 Lint（ESLint + oxlint）

- **oxlint**: 快速修复常见错误和性能问题。
- **ESLint** (`eslint.config.mjs`): TypeScript + React + React Hooks 规则。
  - `react/react-in-jsx-scope`: off（React 19 不需要）
  - `react/prop-types`: off（使用 TS）
  - `@typescript-eslint/no-explicit-any`: warn
  - `@typescript-eslint/no-unused-vars`: warn，允许 `_` 前缀参数
  - `no-console`: off
  - 主进程文件（`src/main/**/*.ts`）自动禁用 `react-hooks/rules-of-hooks` 和 `exhaustive-deps`
  - 忽略 `**/*.gen.ts`、`src/main/db/migrations/**`、`src/shared/ecommerce-workflow/prompts/generate-registry.js`

### 6.3 TypeScript

- **严格模式**: `strict: true`
- **模块**: `ESNext`，`moduleResolution: bundler`
- **目标**: `ES2022`
- JSX: `react-jsx`
- 生成文件（如 `*.gen.ts`）和 `src/main/db/migrations/` 被排除在 lint/format 之外。

### 6.4 命名与结构约定

- 文件命名：路由/页面使用 kebab-case（如 `agent-squad.tsx`），普通模块使用 camelCase。
- IPC 通道命名：采用 `domain:action:subaction` 格式，例如 `db:generations:list`、`generation:create`、`chat:stream`。
- Store 文件：按领域拆分，每个 Zustand store 一个文件，位于 `src/renderer/src/stores/`。
- 组件：优先使用 `@cherrystudio/ui` 中的 Shadcn UI 组件；自定义业务组件放在 `src/renderer/src/components/`。

### 6.5 国际化（i18n）强制规范

- **所有用户可见字符串必须走 i18n**，禁止硬编码中文或英文在 UI 代码中。
- 翻译文件位于 `src/renderer/src/i18n/locales/zh-CN.json` 和 `en.json`。
- 添加新字符串后，同步更新两个语言文件。
- 代码中使用 `t('key')` 或 `i18n.t('key')`。

### 6.6 日志与性能

- 主进程 IPC 和关键服务中常见性能计时日志，格式为 `[Module:Action] ⏱️ 描述 in Xms`。
- 错误日志需包含上下文对象（如 `{ error: error.message, stack: error.stack }`），避免直接抛裸错误。

---

## 7. 测试策略

### 7.1 测试框架

- **Vitest** 作为测试运行器（全局 API 启用，无需显式 import `describe/it/expect`）。
- 根配置位于 `vitest.config.ts`，默认环境为 `node`。
- 根配置 `include` 为 `src/**/*.test.ts`，覆盖 `src/shared/__tests__/`、`src/main/services/__tests__/`、`src/main/db/__tests__/` 以及渲染进程中的部分测试。
- 别名映射：`@shared` -> `src/shared`，`@main` -> `src/main`。
- 覆盖率：v8 provider，输出 text/json/html。

### 7.2 测试文件位置

- 共享工具/类型测试：`src/shared/__tests__/*.test.ts`
- 主进程服务测试：`src/main/services/__tests__/*.test.ts`
- 主进程数据库测试：`src/main/db/__tests__/*.test.ts`
- 电商工作流共享测试：`src/shared/__tests__/ecommerce-workflow/*.test.ts`
- 电商橱窗共享测试：`src/shared/__tests__/ecommerce-showcase/*.test.ts`
- 电商工作流内部测试：`src/shared/ecommerce-workflow/__tests__/*.test.ts`
- 渲染进程组件测试：`src/renderer/src/components/common/__tests__/*.test.ts`
- 渲染进程 store 测试：`src/renderer/src/stores/__tests__/*.test.ts`
- 各 package 内部测试：`packages/<pkg>/src/**/*.test.ts` / `packages/<pkg>/tests/**/*.test.ts`（由各自 `package.json` 的 `test` 脚本执行）

### 7.3 运行测试

```bash
pnpm test          # 根目录运行 src/**/*.test.ts
pnpm test:main     # 当前未配置 workspace project，不会生效
pnpm test:renderer # 当前未配置 workspace project，不会生效

# 各包测试
pnpm --filter @cherrystudio/ai-core test
pnpm --filter @cherrystudio/ui test
pnpm --filter @cherrystudio/provider-registry test
pnpm --filter @vectorstores/libsql test
```

---

## 8. 数据库与持久化

### 8.1 ORM 与表

使用 **Drizzle ORM** + **libSQL (SQLite)**。数据库文件为 `app.db`（生产环境位于 `app.getPath('userData')`）或 `dev.db`（开发时 drizzle-kit 使用）。

核心表（`src/main/db/schema.ts`，共 16 张表）：

| 表名 | 说明 |
|------|------|
| `generations` | 生成任务（图/视频/文本），含状态机（pending/processing/completed/failed/cancelled）、优先级、进度、外部任务 ID |
| `workflows` | 画布工作流（节点/边 JSON、viewport、view_mode） |
| `ecommerce_workflows` | 电商固定工作流（模板/上下文/步骤/模块/状态） |
| `prompt_templates` | 提示词模板库（类别、标签、使用次数） |
| `providers` | API Provider 配置（密钥当前明文存储），支持单密钥（apiKey）和双密钥（accessKeyId + secretAccessKey，如火山引擎） |
| `models` | 模型元数据（类型：llm/image/video/embedding） |
| `settings` | 键值设置 |
| `chat_sessions` | 聊天会话（标题、provider/model 绑定、systemPrompt） |
| `chat_messages` | 聊天消息（角色、内容、blocks 字段——1:1 Cherry Studio 架构、token 用量、延迟） |
| `chat_assistants` | 聊天助手预设（含 emoji、systemPrompt、provider/model 绑定、排序） |
| `quick_phrases` | 快捷短语（含收藏与排序） |
| `skills` | 技能系统（名称、内容、分类、内置/自定义、元数据） |
| `memories` | MGP Lite 记忆（支持 subject/type/scope/confidence/expires_at 等语义字段） |
| `web_search_providers` | 网络搜索 Provider 配置（支持 Tavily/SearXNG/Exa/Jina/Zhipu/Bocha/Querit/Fetch） |
| `mcp_servers` | MCP 服务器配置（transport: stdio/sse/streamable-http） |
| `showcase_tasks` | 电商橱窗简单模式任务（卖点/方案/图片生成，含积分记费） |

关系定义：`providers` ↔ `models`（一对多），`chat_sessions` ↔ `chat_messages`（一对多）。

### 8.2 迁移流程

1. 修改 `src/main/db/schema.ts` 中的表定义。
2. 运行 `npx drizzle-kit generate` 生成新的 SQL 迁移文件到 `src/main/db/migrations/`。
3. 应用启动时，`src/main/db/migrate.ts` 自动运行 `migrate()` 执行未应用的迁移。
   - 迁移器采用多路径 fallback 策略，兼容开发、打包后、不同平台路径差异。
   - 迁移成功后还会调用 `migrateProviderKeysToPlaintext()` 处理历史密钥格式。

> 注意：`drizzle.config.ts` 中 `dbCredentials.url` 指向 `file:./dev.db`，但实际运行时使用 `src/main/db/index.ts` 中的连接逻辑（`userData/app.db`）。

> 注意：迁移目录中 `0009_*` 与 `0010_*` 各有两个文件，这是历史合并残留。Drizzle 按文件名排序执行，不影响迁移结果，但新增迁移时应避免再次冲突。

---

## 9. 安全考虑

### 9.1 API 密钥保护

- **当前实现**：`src/main/services/secure-storage.ts` 使用 Electron `safeStorage` API（OS 级密钥链加密）保护 API 密钥。加密值以 `encv2:` 前缀 + base64 编码存储。当 OS 密钥链不可用时降级为 `plain:` 前缀明文。
- **历史加密值**：以 `enc:` 开头的旧加密值在当前实现中无法解密，会返回空字符串，需要用户重新输入或重新获取。
- **渲染进程不可见**：`src/main/ipc/index.ts` 在返回 Provider 列表时直接返回明文；UI 层负责将密钥字段显示为 `***`。更新时如果值为 `***` 则跳过该字段，防止覆盖。

### 9.2 进程隔离

- `contextIsolation: true`（启用上下文隔离）
- `nodeIntegration: false`（渲染进程无 Node API）
- `sandbox: false`（预加载脚本需要文件系统访问，故关闭 sandbox；但依赖 contextBridge 限制暴露面）
- 主窗口设置 `webSecurity: true`，通过 `juhe-image://` 自定义协议安全加载本地图片，仅允许访问 `userData` 目录。

### 9.3 数据安全

- 从数据库读取生成记录返回渲染进程前，主动剥离 `data:` 开头的 base64 数据，防止 IPC 传输导致 OOM（见 `src/main/ipc/index.ts` 中 `db:generations:list` 与 `db:generations:get` 的实现）。
- `electron-store` 存储用户配置（非敏感）。

---

## 10. 部署与发布

### 10.1 CI/CD

GitHub Actions 工作流：

- **`.github/workflows/ci.yml`** — 每次 push/PR 到 `main` 或 `develop` 时运行：
  - `pnpm install --frozen-lockfile`
  - `pnpm lint`
  - `pnpm biome check`
  - `pnpm typecheck:main`
  - `pnpm typecheck:renderer`
  - `pnpm test`（在独立的 test job 中运行）

- **`.github/workflows/build.yml`** — push 到 `main`、tag `v*` 或 PR 到 `main` 时触发：
  - 并行在 `macos-latest`、`windows-latest`、`ubuntu-latest` 上构建
  - 每个平台先执行 `pnpm packages:build`，再执行对应平台打包脚本
  - 产物：`.dmg`、`.zip`、`.exe`、`.portable`、`.AppImage`、`.deb`
  - PR 不上传 artifact
  - 当 push tag `v*` 时，自动创建 GitHub Draft Release 并上传所有产物

### 10.2 自动更新

- 使用 `electron-updater`，发布源指向 GitHub Releases（draft）。
- 主进程 `src/main/updater.ts` 处理更新检查、下载、安装。
- 渲染进程通过 IPC `updater:*` 与更新状态交互。

### 10.3 代码签名（macOS）

- `build/entitlements.mac.plist` 定义沙盒权限（JIT、未签名可执行内存、dyld 环境变量）。
- CI 中默认 `notarize: false`；发布正式版时需设置 `APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID` 环境变量，并切换为 `Developer ID Application` 证书。

---

## 11. 开发工作流与约定

### 11.1 提交规范

- 遵循 **Conventional Commits** 规范。
- 提交前建议运行 `pnpm lint` 和 `pnpm test`。

### 11.2 新增功能的标准步骤

1. 如需修改数据库：更新 `src/main/db/schema.ts`，运行 `npx drizzle-kit generate` 生成迁移，更新 `src/main/db/migrations/`。
2. 如需新增 IPC：
   - 在 `src/main/ipc/` 下添加或修改对应领域文件，使用 `ipcMain.handle('domain:action', ...)`。
   - 在 `src/preload/index.ts` 的 `api` 对象中暴露同名方法。
   - 渲染进程通过 `window.api.domain.action()` 调用。
3. 如需新增页面：在 `src/renderer/src/routes/` 创建 `.tsx` 文件（TanStack Router 自动生成路由）。
4. 如需新增组件：优先在 `@cherrystudio/ui` 实现通用组件；业务组件放在 `src/renderer/src/components/`。
5. 所有用户可见文本必须加入 `src/renderer/src/i18n/locales/zh-CN.json` 和 `en.json`。

### 11.3 性能注意

- Vite 渲染构建已配置 `manualChunks`，将 React、Router、UI 库、各功能路由拆分为独立 chunk。
- 构建目标为 `es2020`，minify 使用 `esbuild`。
- 主进程数据库查询建议记录耗时日志，便于排查性能瓶颈。
- 避免在 IPC 中传输大体积 base64 图像数据；应使用文件路径或本地图片服务器 URL。

---

## 12. 参考文档索引

项目根目录和 `docs/` 下包含更多详细文档：

| 文档 | 内容 |
|------|------|
| `docs/PRD.md` | 产品需求文档 — 功能清单、优先级、用户故事 |
| `docs/ARCHITECTURE.md` | 技术架构详述 — 模块设计、IPC 规范、安全策略、参考实现 |
| `docs/ROADMAP.md` | 开发路线图 — M1-M5 里程碑、任务分配 |
| `docs/UI-DESIGN-REFERENCE.md` | UI/UX 设计参考 — 设计语言、布局、动画规范 |
| `docs/DEMO-ANALYSIS.md` | 20+ 参考项目的功能与架构分析 |
| `docs/IMPLEMENTATION-PLAN.md` | 主实现计划 |
| `docs/M2-IMPLEMENTATION-PLAN.md` | M2 阶段实现计划 |
| `docs/M4-FINETUNE-RESEARCH.md` | M4 微调研究 |
| `docs/M4-VIDEO-RESEARCH.md` | M4 视频研究 |
| `docs/new-api-interface-analysis.md` | NewAPI 接口分析 |
| `docs/new-api-openapi.json` | NewAPI OpenAPI 规格文档 |
| `docs/aliyun/` | 阿里云相关文档 |
| `docs/jimeng/` | 即梦相关文档 |
| `docs/superpowers/` | Superpowers 技能系统文档 |
| `开发说明.md` | 中文版快速开始与开发规范速查（部分内容已过时，以本文档和 `package.json` 为准） |

---

## 13. 常见问题（Agent 必读）

**Q: 修改了 `packages/` 下的代码但应用没变化？**
A: Workspace 包需要重新构建。运行 `pnpm packages:build` 或进入对应包目录运行 `pnpm build`。注意 `@cherrystudio/provider-registry` 当前通过源码路径别名被引用，不随 `packages:build` 构建。

**Q: 新增 IPC 后渲染进程报 `window.api.xxx is not a function`？**
A: 检查三处：1) `src/main/ipc/` 中是否 `ipcMain.handle` 注册；2) `src/preload/index.ts` 中 `api` 对象是否暴露；3) 重启开发服务器（preload 变更需重启）。

**Q: 数据库 schema 改了如何生成迁移？**
A: `npx drizzle-kit generate`。确保 `drizzle.config.ts` 中的 `url` 可访问。迁移文件生成后应用启动会自动执行。

**Q: 为什么测试文件很多但 `pnpm test:main` / `pnpm test:renderer` 不生效？**
A: 根目录的 `vitest.config.ts` 未配置多 project workspace，因此 `--project` 参数不会生效。当前 `pnpm test` 运行 `src/**/*.test.ts`；各 package 的测试需通过 `pnpm --filter <pkg> test` 运行。

**Q: 能否直接引用 `fs` / `path` 等 Node 模块在渲染进程？**
A: 不能。渲染进程无 Node 集成，所有文件系统/原生操作必须通过 Preload 暴露的 IPC API 调用主进程完成。

**Q: 图片如何在渲染进程安全显示？**
A: 主进程已注册 `juhe-image://` 自定义协议，在 `webSecurity: true` 下安全加载 `userData` 目录下的本地图片。即梦服务使用独立的本地 HTTP 图片服务器（端口 19527+）为外部 API 提供可下载图片 URL。

**Q: API Key 存储是否加密？**
A: 当前版本使用 Electron `safeStorage` API（OS 级密钥链加密）存储 API 密钥，加密值以 `encv2:` 前缀存储。OS 密钥链不可用时降级为 `plain:` 明文。历史 `enc:` 前缀的加密值无法解密，会被置空，用户需重新配置。

**Q: 如何添加新的电商固定工作流模板？**
A: 在 `src/shared/ecommerce-workflow/templates/` 下新增模板文件，并在 `src/shared/ecommerce-workflow/templates/index.ts` 注册。模板需符合 `EcommerceWorkflowTemplate` 类型定义。

**Q: 新增页面后路由没有生效？**
A: TanStack Router 基于文件系统自动生成路由树。新增/删除/重命名 `src/renderer/src/routes/` 下的文件后，需重新运行 `pnpm dev` 或执行路由生成命令以更新 `routeTree.gen.ts`。

**Q: prompts-service 是什么？**
A: `prompts-service/` 是一个独立的 Express 后端服务，提供远程提示词库 REST API。它有自己的 TypeScript 源码、测试和构建流程。主进程通过 `src/main/services/prompts-service.ts` 客户端和 `src/main/ipc/prompt-library.ts` IPC 处理器与之交互。

**Q: 如何新增一个 IPC 领域模块？**
A: 1) 在 `src/main/ipc/` 新建文件，如 `mydomain.ts`；2) 在其中 `import { ipcMain } from 'electron'` 并注册 handler；3) 在 `src/preload/index.ts` 的 `api` 对象中新增对应方法；4) 主进程 `src/main/index.ts` 中 `import './ipc'` 会自动聚合注册。
