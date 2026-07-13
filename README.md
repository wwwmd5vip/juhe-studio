<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT">
  <img src="https://img.shields.io/badge/Go-1.25-00ADD8?logo=go" alt="Go 1.25">
  <img src="https://img.shields.io/badge/Node-20+-339933?logo=node.js" alt="Node 20+">
  <img src="https://img.shields.io/badge/Electron-41-47848F?logo=electron" alt="Electron">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19">
</p>

<h1 align="center">Juhe Studio</h1>
<p align="center"><strong>聚合创作引擎</strong> — 一站式 AI 聚合创作平台</p>

<p align="center">
  <a href="#快速开始">快速开始</a> ·
  <a href="#项目结构">项目结构</a> ·
  <a href="#桌面应用">桌面应用</a> ·
  <a href="#管理后台">管理后台</a> ·
  <a href="#sdk--cli">SDK / CLI</a>
</p>

---

## 简介

Juhe Studio 是一个全栈 AI 聚合创作平台，提供从**桌面客户端**到**后端管理**的完整解决方案：

- **桌面应用**（Electron + React） — 聚合创作引擎桌面客户端，支持多模型对话、AI 工作流、知识库
- **管理后台**（React + Ant Design） — 可视化管理面板，管理用户、渠道、提示词、计费与财务
- **后端 API**（Go + Gin） — 高性能 API 网关，OpenAI 兼容 Relay，21 种上游渠道统一转发
- **SDK / CLI**（TypeScript） — 开发者工具包，命令行管理 API Key、聊天、配额查询

## 项目结构

```
juhe-studio-github/
├── pc/              # Electron 桌面应用（Juhe Studio 客户端）
├── server/          # Go 后端 API（管理后台 + OpenAI 兼容 Relay）
├── admin/           # 管理后台前端（React + Vite + TypeScript + Ant Design）
├── sdk/             # 客户端 SDK / CLI（TypeScript）
└── docker-compose.yml
```

## 快速开始

### Docker Compose 全栈部署（推荐）

```bash
# 1. 准备环境变量
cd server
cp .env.example .env
# 编辑 .env，设置强随机 JWT_SECRET 和数据库密码

# 2. 创建 Docker Compose 环境变量文件
cat > ../.env <<EOF
MYSQL_ROOT_PASSWORD=your-mysql-root-password
DB_PASSWORD=your-db-password
JWT_SECRET=$(openssl rand -base64 64)
ROOT_PASSWORD=your-admin-password
EOF

# 3. 一键启动
cd ..
docker compose up -d
```

启动后访问：

| 服务 | 地址 |
|------|------|
| 管理后台 | http://localhost:7074 |
| 后端 API | http://localhost:7075 |
| MySQL（Docker 映射） | localhost:7073 |

默认管理员账号 `root`，密码为 `ROOT_PASSWORD` 环境变量所设值。

### 本地开发

#### 1. 启动 MySQL

```bash
docker compose up -d mysql
```

#### 2. 启动后端

```bash
cd server
cp .env.example .env
# 修改 DB_HOST=127.0.0.1
go run cmd/server/main.go
```

#### 3. 启动管理后台

```bash
cd admin
npm install
npm run dev
```

## 桌面应用

Juhe Studio 桌面客户端基于 Electron + React 构建，集成了主流 AI 模型提供商。

```bash
cd pc
pnpm install
pnpm dev          # 开发模式
pnpm build:mac    # 构建 macOS 应用
pnpm build:win    # 构建 Windows 应用
pnpm build:linux  # 构建 Linux 应用
```

特性：
- 🧠 多模型对话（OpenAI、Anthropic、Google、DeepSeek、xAI 等）
- 🔄 AI 工作流编排
- 📚 本地知识库（向量存储）
- 🌍 国际化（i18n）
- 🔌 MCP 协议支持

## SDK / CLI

### 安装

```bash
cd sdk
npm install
npm run build
```

### CLI 使用

```bash
# 登录
npx juhe login -u http://localhost:7075 --username root --password <your-password>

# 创建 API Key
npx juhe keys:create -u http://localhost:7075 -t <jwt> -n my-key

# 聊天
npx juhe chat -u http://localhost:7075 -k <api-key> --model gpt-4o -m "hello"

# 查询额度
npx juhe quota -u http://localhost:7075 -k <api-key>
```

### SDK 使用

```ts
import { JuheClient } from '@juhe-management/sdk'

const client = new JuheClient({
  baseURL: 'http://localhost:7075',
  apiKey: 'sk-juhe-...',
})

const completion = await client.chatCompletions({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'hello' }],
})
```

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面客户端 | Electron, React 19, TypeScript, Tailwind CSS, Three.js |
| 管理后台 | React 19, Vite, Ant Design 5, React Router 7, Zustand, React Query |
| 后端 API | Go 1.25, Gin, GORM, MySQL, JWT, Swagger |
| SDK / CLI | TypeScript, Axios, Commander |
| 部署 | Docker Compose, MySQL 8 |

## 上游渠道

支持 **21 种** AI 服务提供商统一代理与计费：

OpenAI · Anthropic · Gemini · DeepSeek · Ollama · SiliconFlow · 火山引擎 · 智谱 · 通义千问 · Moonshot · OpenRouter · xAI · Azure · Vertex AI · Bedrock · Coze · 即梦 · 可灵 · MXAPI · OpenAI-Compatible · Custom

## 关键约定

- **数据库**：MySQL 8
- **货币比例**：1 额度（Quota）= 1 分（RMB）
- **API 协议**：OpenAI Chat Completions 兼容
- **包管理器**：pnpm（桌面端 / 管理后台），npm（SDK）

## License

MIT © Juhe Studio
