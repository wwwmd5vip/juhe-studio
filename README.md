# Juhe Management

> 基于 Go 的 AI 管理系统，为聚合创作引擎提供 OpenAI 兼容 API、渠道转发、提示词管理、计费与财务能力。

## 项目结构

```
juhe-management/
├── server/          # Go 后端 API（管理后台 + OpenAI Relay）
├── admin/           # 管理后台前端（React + Vite + TypeScript）
├── sdk/             # 客户端 SDK / CLI（TypeScript）
├── docs/            # 设计文档与 OpenAPI 规范
└── docker-compose.yml
```

## 快速开始

### 方式一：Docker Compose 全栈部署（推荐）

1. 准备后端环境变量

```bash
cd server
cp .env.example .env
# 按需修改 JWT_SECRET 等配置
```

2. 一键启动

```bash
docker-compose up -d
```

启动后访问：
- 管理后台：http://localhost:7071（Vite 开发模式）或 http://localhost:7074（Docker 部署）
- 后端 API：http://localhost:7075
- MySQL：localhost:7073（Docker 映射端口）

默认账号：`root`
密码：通过 `ROOT_PASSWORD` 环境变量设置（Docker Compose 中默认为 `juhe123456`，直接运行时随机生成并输出到控制台）。

### 方式二：本地开发

#### 1. 启动 MySQL

```bash
docker-compose up -d mysql
```

#### 2. 启动后端

```bash
cd server
cp .env.example .env
# 修改 .env 中的 DB_HOST 为 127.0.0.1（默认）
go run cmd/server/main.go
```

#### 3. 启动管理后台

```bash
cd admin
npm install
npm run dev
```

## 客户端 SDK / CLI

### 安装

```bash
cd sdk
npm install
npm run build
```

### CLI 使用

```bash
# 登录
npx juhe login -u http://localhost:7075 --username root --password juhe123456

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

## 设计文档

- `docs/PRD.md` — 产品需求文档
- `docs/ARCHITECTURE.md` — 技术架构
- `docs/DATABASE.md` — 数据库设计
- `docs/OPENAPI.md` — 接口设计
- `docs/openapi.yaml` — OpenAPI 3.0 规范

## 关键约定

- **数据库**：MySQL 8
- **货币比例**：1 额度（Quota）= 1 分（RMB）
- **上游渠道类型**：21 种（OpenAI / Anthropic / Gemini / DeepSeek / Ollama / SiliconFlow / 火山引擎 / 智谱 / 通义千问 / Moonshot / OpenRouter / xAI / Azure / Vertex / Bedrock / Coze / 即梦 / 可灵 / MXAPI / OpenAI-Compatible / Custom）
