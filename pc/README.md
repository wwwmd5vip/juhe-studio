# 聚合创作引擎（桌面端）

> Electron + React + TypeScript 跨平台 AI 创作桌面应用。

## 环境要求

| 依赖 | 最低版本 |
|------|---------|
| Node.js | 20.0.0 |
| pnpm | 10.27.0（由 `packageManager` 字段锁定） |

## 安装

```bash
cd pc
pnpm install
pnpm packages:build   # 构建 workspace 依赖包（首次必须执行）
```

## 开发

```bash
pnpm dev               # 启动开发模式（热重载）
pnpm dev:watch         # 热重载 + 监听文件变化
```

## 代码质量

```bash
pnpm typecheck         # 类型检查（main + renderer + ai-core）
pnpm lint              # oxlint + ESLint
pnpm format            # Biome 格式化
pnpm test              # Vitest 测试
```

## 打包构建

### 一键打包 Mac + Windows

```bash
pnpm build:all
```

此命令依次执行：
1. `packages:build` — 构建 workspace 依赖包
2. `electron-vite build` — 编译 main / preload / renderer
3. `electron-builder --mac --win` — 同时打包 macOS（dmg + zip）和 Windows（nsis + portable）

产物输出到 `pc/dist/` 目录。

### 单平台打包

```bash
# 仅 macOS（dmg + zip，x64 + arm64）
pnpm build:mac

# 仅 Windows（NSIS 安装包 + 便携版，x64 + arm64）
pnpm build:win

# 仅 Linux（AppImage + deb + snap）
pnpm build:linux

# 不打包，仅编译产物到 out/ 目录
pnpm build

# 打包但不生成安装包（输出到 dist/，用于调试打包过程）
pnpm build:unpack
```

### 产物说明

| 平台 | 格式 | 架构 | 文件名示例 |
|------|------|------|-----------|
| macOS | dmg | x64, arm64 | `聚合创作引擎-1.0.0-rc.0.dmg` |
| macOS | zip | x64, arm64 | `聚合创作引擎-1.0.0-rc.0-mac.zip` |
| Windows | nsis | x64, arm64 | `聚合创作引擎-1.0.0-rc.0-setup.exe` |
| Windows | portable | x64 | `聚合创作引擎-1.0.0-rc.0-portable.exe` |
| Linux | AppImage | x64 | `聚合创作引擎-1.0.0-rc.0.AppImage` |

### macOS 代码签名（可选）

默认 `notarize: false`，本地构建无需证书。如需分发：

1. 在 Apple Developer 获取 Developer ID 证书
2. 设置环境变量：

```bash
export APPLE_ID=your-apple-id@example.com
export APPLE_APP_SPECIFIC_PASSWORD=your-app-specific-password
export APPLE_TEAM_ID=your-team-id
```

3. 修改 `electron-builder.yml` 中 `mac.identity` 为 `Developer ID Application: ...`，`notarize` 为 `true`

## 项目结构

```
pc/
├── src/
│   ├── main/              # Electron 主进程
│   │   ├── ipc/           # IPC 通信处理
│   │   ├── services/      # 业务服务（生成、队列、插件等）
│   │   ├── utils/         # 主进程工具（provider-resolver, file-utils）
│   │   └── db/            # 数据库（libSQL + Drizzle ORM）
│   ├── renderer/          # React 渲染进程
│   │   └── src/
│   │       ├── director-3d/    # 3D 导演台
│   │       ├── stores/         # Zustand 状态管理
│   │       ├── components/     # UI 组件
│   │       └── routes/         # 页面路由
│   ├── preload/           # 预加载脚本
│   └── shared/            # 主进程与渲染进程共享代码
│       ├── constants/     # 常量（provider-mapping 等）
│       ├── utils/         # 工具函数（http-client, error-classifier 等）
│       └── types/         # 类型定义
├── packages/              # workspace 依赖包
├── public/                # 静态资源（3D 模型等）
├── build/                 # 打包资源（图标、entitlements）
├── electron-builder.yml   # electron-builder 配置
└── electron.vite.config.ts
```

## 技术栈

| 组件 | 技术 |
|------|------|
| 框架 | Electron 41 + React 19 |
| 构建 | electron-vite 5 + electron-builder 26 |
| 语言 | TypeScript 5.8 严格模式 |
| 路由 | TanStack Router |
| 状态 | Zustand 5 + Zundo（撤销/重做） |
| 样式 | Tailwind CSS 4 |
| 3D | Three.js + @react-three/fiber |
| 数据库 | libSQL (SQLite) + Drizzle ORM |
| IPC | `domain:action:subaction` 命名约定 |
| 国际化 | i18next（zh-CN / en） |
| 代码质量 | Biome + oxlint + ESLint + Vitest |
