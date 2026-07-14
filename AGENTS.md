# AGENTS.md — Juhe Studio 仓库项目指南

> 本文档供 AI 编码助手（如 Kimi Code、Claude Code）阅读，介绍仓库中两个独立项目的架构、约定和开发流程。
> 最后更新：2026-07-14（基于代码库实际结构校验更新）。

---

## 1. 仓库概览

本仓库（`juhe-studio`）包含**两个独立项目**：

| 项目 | 目录 | 语言 | 用途 |
|------|------|------|------|
| **Juhe Management**（管理后台） | `server/`, `admin/`, `sdk/` | Go + React + TypeScript | AI 管理中台：OpenAI 兼容 API、多渠道转发、提示词管理、计费财务 |
| **聚合创作引擎**（桌面应用） | `pc/` | Electron + React + TypeScript | 面向创作者的跨平台 AI 桌面应用，有多模型接入、无限画布工作流、智能体协作等 |

> ⚠️ **重要**：`pc/` 项目有自己独立的 `pc/AGENTS.md`（568 行），包含 Electron 架构、`pnpm` workspace 约定、IPC 通信模式、数据库迁移等详细指导。修改 `pc/` 下的代码时请同时参见那个文件。

---

## 2. Juhe Management 项目结构

```
juhe-studio/
├── server/                  # Go 后端 API
│   ├── cmd/server/main.go   # 入口：Swagger 注解 + 手动组装依赖、注册路由、优雅关闭（459 行）
│   ├── internal/
│   │   ├── bootstrap/       # DB 连接初始化、root 用户种子、默认设置/提示词模板/渠道故障种子（2 文件）
│   │   ├── config/          # 环境变量配置加载（.env → Config 结构体，1 文件）
│   │   ├── common/
│   │   │   ├── captcha/     # 图形验证码生成与验证（内存存储 + 定期清理）
│   │   │   ├── email/       # SMTP 邮件发送，支持从 settings 表动态读取配置
│   │   │   ├── errcode/     # 错误码定义
│   │   │   └── utils/       # 工具函数：JWT、bcrypt、Key 生成、模板渲染
│   │   ├── domain/          # GORM 领域模型（26 个实体 + channel_type.go + endpoint_type.go）
│   │   ├── dto/             # 请求/响应数据结构（12 文件）
│   │   ├── repository/      # 数据访问层（24 文件 + 1 测试）
│   │   ├── service/         # 业务逻辑层（24 文件 + 15 测试）
│   │   ├── handler/
│   │   │   ├── admin/       # 管理后台 HTTP Handler（23 文件 + 2 测试）
│   │   │   ├── relay/       # OpenAI 兼容转发 Handler（3 文件 + 1 测试）
│   │   │   ├── e2e_test.go        # 端到端集成测试
│   │   │   ├── feedback_handler.go # 公开反馈提交
│   │   │   └── release_handler.go  # 版本发布查询
│   │   ├── middleware/      # Gin 中间件（5 个 + 1 测试）：auth、cors、rate_limit、sensitive_word、tracing
│   │   ├── relay/           # 转发核心：Adaptor 接口、Dispatcher、ChannelContext（4 文件 + 1 测试）
│   │   │   └── channel/     # 上游适配器：BaseAdaptor + 8 种 Adaptor + factory（10 文件 + 1 测试）
│   │   ├── scheduler/       # 定时任务：日账单聚合、订阅续费、渠道健康检查、日志清理（2 文件）
│   │   ├── ws/              # WebSocket Hub：实时推送额度变动、消费通知（2 文件 + 1 测试）
│   │   └── pkg/             # 内部小工具包（预留，当前空）
│   ├── docs/                # Swagger 文档（自动生成）
│   ├── migrations/          # SQL 迁移脚本（3 个文件）
│   ├── .env.example         # 环境变量模板（75 行）
│   └── Dockerfile           # 多阶段构建：golang:1.25-alpine → alpine:3.20
├── admin/                   # 管理后台前端（React 19 + Vite 6）
│   ├── src/
│   │   ├── api/             # API 调用层（23 文件 + client.ts）
│   │   ├── components/      # 共享组件（22 个文件/子目录）
│   │   ├── contexts/        # React Context：FinanceContext
│   │   ├── hooks/           # 自定义 Hook：useAuth、useWebSocket、useKeyboardShortcuts
│   │   ├── pages/           # 页面组件（30 个 .tsx 文件，全部 React.lazy() 懒加载）
│   │   ├── stores/          # Zustand 状态：authStore、themeStore
│   │   ├── styles/          # 全局样式：channel-colors.ts、theme-tokens.ts
│   │   ├── types/           # TypeScript 类型定义：api.ts
│   │   └── utils/           # 工具：errorCodes.ts
│   ├── nginx.conf           # 生产 Nginx：反向代理 /api + /v1、gzip、SSE 流式代理、安全头
│   ├── Dockerfile           # 生产多阶段构建：node:20-alpine → nginx:1.27-alpine
│   └── Dockerfile.dev       # 开发用 Dockerfile（热重载、卷挂载源码、端口 7071）
├── sdk/                     # TypeScript SDK / CLI
│   └── src/
│       ├── index.ts         # 入口导出
│       ├── core/            # client.ts（JuheClient）、errors.ts、stream.ts、types.ts
│       └── cli/cli.ts       # Commander CLI（login、keys:*、chat、image、quota、prompts:*）
├── pc/                      # 聚合创作引擎 Electron 桌面应用（详见 pc/AGENTS.md）
├── docker-compose.yml       # MySQL 8 + server + admin 全栈部署（含健康检查）
├── task_plan.md             # 实现计划与里程碑
└── progress.md              # 进度日志
```

> 注：设计文档（PRD.md、ARCHITECTURE.md 等）位于 `pc/docs/` 目录下，而非根目录。

---

## 3. 技术栈

### 后端 (server/)

| 组件 | 技术 | 版本 |
|------|------|------|
| 语言 | Go | **1.25.0**（go.mod）/ Dockerfile: 1.25-alpine |
| Web 框架 | Gin | v1.10.0 |
| ORM | GORM + MySQL 驱动 | v1.31.1 / v1.6.0 |
| 数据库 / 测试库 | MySQL 8.0 / SQLite（内存） | - |
| 定时任务 | robfig/cron/v3 | v3.0.1 |
| JWT / 密码哈希 | golang-jwt / bcrypt | v5.3.1 / v0.36.0 |
| 速率限制 | golang.org/x/time (token bucket) | v0.15.0 |
| 测试框架 | testify | v1.11.1 |
| WebSocket | gorilla/websocket | v1.5.3 |
| Swagger | swaggo/swag + gin-swagger | v1.16.6 / v1.6.1 |
| HTML 清理 | microcosm-cc/bluemonday | v1.0.27 |

### 管理后台 (admin/)

| 组件 | 技术 | 版本 |
|------|------|------|
| 框架 / 构建 / 语言 | React 19 / Vite 6 / TS 5.7 严格模式 | - |
| UI / 图表 / 路由 | Ant Design 5.22 / recharts 3.8 / react-router 7 | - |
| 数据获取 / 状态 / Lint | @tanstack/react-query 5 / Zustand 5 / ESLint 10.5 | - |

### SDK/CLI (sdk/)

| 组件 | 技术 |
|------|------|
| HTTP / CLI | axios 1.7 / commander 15（optionalDependency） |
| 包名 / 分发 | `@juhe-management/sdk` v0.1.0 / ESM + CJS 双输出 |
| CLI bin | `juhe` → `dist/cjs/cli/cli.js` |

---

## 4. 后端分层架构

```
HTTP Handler  ──→  Middleware  ──→  Service  ──→  Repository  ──→  GORM / MySQL
     │                │
     ├── /api/* 管理后台（JWTAuth + RateLimiter + AdminAuth）
     ├── /api/public/* 公开接口（RateLimiter 仅）
     ├── /v1/*  OpenAI Relay（TokenAuth + RateLimiter + SensitiveWordFilter）
     ├── /v1/webhooks/:provider（RateLimiter 仅，handler 内校验签名）
     ├── /api/auth/* 认证（login/register/captcha/verify-email 等，部分公开）
     ├── /api/ws WebSocket（需 JWTAuth）
     ├── /api/import/* CSV 批量导入（需 JWTAuth + AdminAuth）
     └── /api/swagger/*any Swagger UI（需 JWTAuth + AdminAuth）
```

### 4.1 中间件注册顺序（main.go 中严格顺序）

1. `RequestID()` — UUID v4 追踪（设置 X-Request-Id 响应头）
2. `CORS()` — 跨域处理
3. `gin.Logger()` — 请求日志
4. `gin.Recovery()` — panic 恢复

后续按路由分组叠加 `RateLimiter()`, `JWTAuth()`, `AdminAuth()`, `TokenAuth()`, `SensitiveWordFilter()`。

### 4.2 请求流程（以 Chat Completions 为例）

1. `POST /v1/chat/completions` → `TokenAuth`（校验 API Key、加载 Token + User、更新 `last_used_at`、校验 `AllowedIPs`）
2. `RateLimiter` → 按 Key 或 IP 的 token bucket 限流（默认 60 req/min）
3. `SensitiveWordFilter` → 检查 prompt 中的敏感词
4. `RelayHandler.ChatCompletions` → 读取请求 body（含大小限制 `MAX_REQUEST_BODY_BYTES`）
5. `RelayService` → 查询定价、验证模型限制（`ModelLimits` + `CrossGroupRetry`）、预扣额度
6. `Dispatcher.SelectChannel` → 加权随机选择上游渠道（权重 = ability.weight + ability.priority×10 + 1）
7. `channel.NewAdaptor(channelType)` → 获取对应 Adaptor（BaseAdaptor 提供连接池复用的 HTTP 客户端）
8. Adaptor 转换请求、发往上游、解析响应 → 应用渠道 `StatusCodeMapping`
9. `BillingService` → 结算（多退少补）、写消费日志（含 IP/User-Agent）和额度流水
10. 返回 OpenAI 兼容响应 + WebSocket Hub 实时推送额度变动

### 4.3 依赖注入模式

在 `main.go` 中**手动组装**所有依赖（不使用 Wire/DI 框架）：

1. `config.Load()` → 加载 `.env`
2. `bootstrap.NewDB(cfg)` → 连接 MySQL、`AutoMigrate()` 所有 26 张表
3. `bootstrap.SeedRootUser/SeedDefaultSettings/SeedPromptTemplates/SeedChannelFailures/SeedImageCapabilities` → 种子数据
4. 创建所有 Repository → Service → Handler，显式传递依赖
5. `captcha.NewStore()` + `email.NewSender(...)` + `ws.NewHub(settingRepo)`
6. 注册路由分组，挂载中间件和 Handler
7. 启动 `scheduler.New(...)` 定时任务
8. HTTP Server 配置超时参数，支持 SIGINT/SIGTERM 优雅关闭

---

## 5. 领域模型（GORM 实体）

共 **26 张数据库表**，通过 `db.AutoMigrate()` 自动建表：

| 模型 | 表名 | 说明 |
|------|------|------|
| User | `users` | 用户/管理员，含额度、角色（root=100, admin=10, user=1） |
| Token | `tokens` | API Key（`sk-juhe-*`），SHA256 存储，含额度/模型限制/AllowedIPs/限流 |
| Channel | `channels` | 上游渠道，支持 21 种类型 + 5 种认证方式 |
| Model | `models` | AI 模型元数据（含 UpstreamName/EndpointTypes/ContextWindow 等扩展字段） |
| Vendor | `vendors` | 模型厂商 |
| Pricing | `pricings` | 定价（token 倍率/固定价/阶梯价） |
| Ability | `abilities` | 渠道×模型×分组 路由能力矩阵 |
| Log | `logs` | 消费日志（含 IP/User-Agent 追踪） |
| Prompt | `prompts` | 提示词（image/agent/package，Mustache 变量渲染） |
| PromptCategory | `prompt_categories` | 提示词分类 |
| PromptVersion | `prompt_versions` | 提示词版本历史与回滚 |
| PromptTemplate | `prompt_templates` | 预置提示词模板（系统种子数据） |
| PromptPackageItem | `prompt_package_items` | 封装功能步骤（有序列表） |
| QuotaTransaction | `quota_transactions` | 额度变动流水 |
| TopUp | `top_ups` | 充值订单 |
| Redemption | `redemptions` | 兑换码（批量生成/兑换/删除） |
| QuotaPackage | `quota_packages` | 额度包（充值套餐） |
| DailyBill | `daily_bills` | 日账单（定时任务聚合） |
| SubscriptionPlan | `subscription_plans` | 订阅套餐 |
| UserSubscription | `user_subscriptions` | 用户订阅 |
| Setting | `settings` | 系统设置（键值对，支持 string/int/bool/json） |
| AdminAuditLog | `admin_audit_logs` | 管理操作审计日志（create/update/delete + target type + diff） |
| ChannelTestLog | `channel_test_logs` | 渠道健康检查日志 |
| EmailVerification | `email_verifications` | 邮箱验证令牌 |
| Feedback | `feedbacks` | 用户反馈（公开提交，含分类和联系方式） |
| Release | `releases` | 系统版本发布记录（Markdown 格式） |

---

## 6. 核心约定与编码规范

### 6.1 关键约定

- **数据库**：MySQL 8，字符集 `utf8mb4`
- **货币单位**：1 Quota = 1 分（RMB），所有额度字段使用 `BIGINT` 整数存储
- **密码哈希**：bcrypt，成本因子通过 `BCRYPT_COST` 环境变量配置（默认 10）
- **API Key**：前缀 `sk-juhe-`，仅存储 SHA256 哈希，完整 Key 创建时一次性返回 + `key_mask`
- **API 响应格式**：`{"code": 0, "message": "ok", "data": ...}`
- **分页格式**：`{"data": [...], "pagination": {"page": 1, "page_size": 20, "total": 100, "total_pages": 5}}`
- **OpenAI 错误格式**：`{"error": {"message": "...", "type": "juhe_error", "code": "internal_error"}}`
- **验证码**：图形验证码（`/api/auth/captcha`），5 分钟 TTL，4 位字符（排除 0/O/1/I/l）

### 6.2 Go 编码规范

- 模块路径：`github.com/juhe-management/server`
- 包命名：全小写，与目录名一致；文件命名：小写 + 下划线
- 依赖注入：`main.go` 中手动组装，不使用 Wire/DI 框架
- 错误处理：返回明确的 sentinel error
- 配置：`.env` + `config.Config` 结构体，无全局变量，硬编码默认值
- 数据库迁移：`db.AutoMigrate()` + GORM tag + SQL 迁移脚本（`migrations/`）
- 日志：标准库 `log` 包，生产环境输出到文件
- Context：Service 和 Repository 方法统一接收 `context.Context` 作为第一个参数
- Handler 注册：每个资源包提供 `RegisterXxxRoutes(r *gin.RouterGroup, h *XxxHandler, ...)` 函数
- Swagger：`main.go` 和 Handler 上注释注解，`swag init` 自动生成
- 测试：每个 `_test.go` 定义 `newTestDB(t)` 创建独立内存 SQLite，`require` 断言，完全隔离

### 6.3 前端编码规范

- **语言**：TypeScript 严格模式（`strict: true, noUnusedLocals: true, noUnusedParameters: true`）
- **组件**：`.tsx`，每页面一个文件在 `src/pages/`；导入别名 `@/` → `src/`
- **状态管理**：Zustand（authStore、themeStore）持久化到 localStorage；React Query 管理服务端数据
- **API**：统一通过 `src/api/client.ts` 的 axios 实例，拦截器附加 JWT，401 自动跳转登录
- **路由**：所有页面 `React.lazy()` + `Suspense`，守卫：`ProtectedRoute` + `AdminRoute`；错误边界：`ErrorBoundary`
- **主题**：Ant Design `ConfigProvider` + `themeStore` 明暗切换，持久化到 `localStorage` (`juhe_theme`)
- **Lint（ESLint flat config）**：`no-explicit-any` → off；`no-unused-vars` → warn（`_` 前缀忽略）
- **空状态**：统一使用 `EmptyState` 组件

### 6.4 SDK 编码规范

- 包名：`@juhe-management/sdk`；源码：`src/index.ts`（入口）、`src/core/`（核心）、`src/cli/`（CLI）
- 构建产物：ESM + CJS 双输出；入口：`dist/cjs/index.js`；CLI bin：`juhe`
- 两个 axios 实例：`admin`（/api）、`relay`（/v1），分别使用 adminToken / apiKey
- `JuheClient.unwrap` 私有方法统一处理 `{code, message, data}` 响应格式
- `commander` 是 optionalDependency — 仅 CLI 使用

---

## 7. 开发命令

### 7.1 启动开发环境

```bash
# 1. 启动 MySQL
docker-compose up -d mysql

# 2. 启动后端（PORT 通过 .env 配置，默认 7075）
cd server
cp .env.example .env
# 编辑 .env 中的 JWT_SECRET 和 DB 连接信息
go run cmd/server/main.go

# 3. 启动管理后台（dev 端口 7071，自动代理 /api 和 /v1 到后端）
cd admin
npm install
npm run dev
```

### 7.2 构建与测试

```bash
# 后端
cd server && go build ./...             # 编译
cd server && go test ./...              # 测试（27 个 _test.go 文件）
cd server && swag init -g cmd/server/main.go -o docs/  # Swagger

# 前端
cd admin && npx tsc --noEmit            # TypeScript 检查
cd admin && npm run lint                # Lint（eslint .）
cd admin && npm run lint:fix            # Lint 自动修复（eslint . --fix）
cd admin && npm run build               # 构建（tsc && vite build）

# SDK
cd sdk && npm install && npm run build
```

### 7.3 Docker 部署

```bash
docker-compose up -d  # 全栈启动（MySQL:7073 + server:7075 + admin:7074）
# 访问：http://localhost:7074（管理后台）/ :7075（API）
# 默认账号：root / juhe123456
```

---

## 8. 测试策略

### 8.1 后端测试（27 个 `_test.go` 文件）

- **框架**：testify（`require` + `assert`）+ SQLite 内存数据库
- **分布**：
  - `service/` 15 个（billing、channel、dashboard、pricing、prompt、prompt_version、quota_package、redemption、relay_stream、sensitive_word、subscription、top_up、user 等）
  - `handler/` 4 个（admin×2 + relay + e2e_test.go）
  - `scheduler/` 1 个
  - `repository/` 1 个
  - `relay/` 2 个（relay_test.go + channel/adaptor_test.go）
  - `cmd/server/` 1 个（swagger_test.go）
  - `common/` 3 个（captcha、email、utils/template）
  - `middleware/` 1 个（auth_test.go）
  - `ws/` 1 个（hub_test.go）
- **特点**：每个测试创建独立内存 DB，`require` 断言，端到端测试在 `handler/e2e_test.go` 用 `httptest.NewServer()` 启动完整路由

### 8.2 前端测试

- 编译期：TypeScript `strict` 模式 + ESLint 静态检查（`npm run lint`）
- 当前无自动化 UI 测试

---

## 9. 环境变量（server/.env）

完整变量列表见 `.env.example`（75 行）。关键变量分类：

| 类别 | 关键变量 |
|------|---------|
| **数据库** | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_CHARSET`, `DB_MAX_OPEN_CONNS`, `DB_MAX_IDLE_CONNS`, `DB_CONN_MAX_LIFETIME`, `DB_CONN_MAX_IDLE_TIME` |
| **安全** | `JWT_SECRET`（生产必填）、`BCRYPT_COST`(10)、`ROOT_USERNAME`(root)、`ROOT_PASSWORD`、`MIN_PASSWORD_LENGTH`(8)、`WEBHOOK_SECRET` |
| **服务** | `PORT`(7075)、`ENV`、`CORS_ALLOWED_ORIGINS`、`LOG_LEVEL`(info)、`LOG_FILE`、`LOG_RETENTION_DAYS`(90) |
| **HTTP** | `HTTP_READ_TIMEOUT`(30)、`HTTP_WRITE_TIMEOUT`(600)、`HTTP_IDLE_TIMEOUT`(120)、`HTTP_READ_HEADER_TIMEOUT`(10)、`MAX_REQUEST_BODY_BYTES`(10MB) |
| **调度** | `SCHEDULER_ENABLED`(true)、`SCHEDULER_SCHEDULE`、`HEALTH_CHECK_*`(默认关闭) |
| **邮件** | `SMTP_HOST`、`SMTP_PORT`, `SMTP_USERNAME`、`SMTP_PASSWORD`、`SMTP_FROM` |
| **Redis（预留）** | `REDIS_ADDR`、`REDIS_PASSWORD`、`REDIS_DB` |

---

## 10. 渠道转发架构

### 渠道类型（21 种）

| 类型 | Adaptor | 类型 | Adaptor |
|------|---------|------|---------|
| `openai` | OpenAIAdaptor | `siliconflow` | OpenAIAdaptor |
| `openai-compatible` | OpenAIAdaptor | `volcengine` | OpenAIAdaptor |
| `anthropic` | AnthropicAdaptor | `zhipu` | OpenAIAdaptor |
| `gemini` | GeminiAdaptor | `qwen` | OpenAIAdaptor |
| `deepseek` | DeepSeekAdaptor | `moonshot` | OpenAIAdaptor |
| `ollama` | OllamaAdaptor | `openrouter` | OpenAIAdaptor |
| `jimeng` | JimengAdaptor | `xai` | OpenAIAdaptor |
| `kling` | KlingAdaptor | `custom` | OpenAIAdaptor |
| `mxapi` | MXAPIAdaptor | `azure`/`vertex`/`bedrock`/`coze` | 预留（无独立 Adaptor） |

### Adaptor 接口（`internal/relay/channel/adaptor.go`）

5 个方法：`GetRequestURL` → `SetupRequestHeader` → `ConvertRequest` → `DoRequest` → `ParseResponse`。所有 Adaptor 内嵌 `BaseAdaptor`（HTTP 连接池 MaxIdleConns=100、可配置超时默认 60s、TLS 握手 10s、KeepAlive 30s）。

### 渠道选择策略

`Dispatcher.SelectChannel` 加权随机算法（`weight + priority×10 + 1`），支持：排除已失败渠道、模糊模型匹配（prefix/suffix/contain）、跨分组查询（`CrossGroupRetry`）、Key 随机轮询，仅返回 `status=1` 且未被 auto-ban 的渠道。

---

## 11. 计费模型

| 模式 | 适用场景 | 计算公式 |
|------|----------|---------|
| `token` | LLM 对话 | `(prompt_tokens + completion_tokens × completion_ratio) × model_ratio × group_ratio` |
| `fixed` | 图像/音频 | `n × fixed_price_cents × model_ratio × group_ratio` |
| `tiered` | 阶梯定价 | 预留 |

### 预扣+结算流程

请求到达 → 估算费用 → 预扣 → 上游返回成功则多退少补 / 失败则全额退款 → 异步写消费日志 + 额度流水 → WebSocket 推送通知。

---

## 12. 管理后台前端

### 12.1 页面结构（30 个页面，全部懒加载）

| 角色 | 路由 |
|------|------|
| 公开 | `/login`, `/register`, `/register-success`, `*`(404) |
| 用户 | `/dashboard`, `/tokens`, `/recharge`, `/billing`, `/profile` |
| 已登录 | `/playground` |
| Admin | `/admin`(Dashboard), `/admin/users`, `/admin/channels`, `/admin/models`, `/admin/pricing`, `/admin/prompts`, `/admin/tokens`, `/admin/topups`, `/admin/redemptions`, `/admin/daily-bills`, `/admin/quota-transactions`, `/admin/logs`, `/admin/quota-packages`, `/admin/subscriptions`, `/admin/vendors`, `/admin/settings`, `/admin/audit-logs`, `/admin/releases`, `/admin/system-health`, `/admin/feedbacks` |

### 12.2 共享组件

| 组件 | 说明 |
|------|------|
| `Layout` / `ProtectedRoute` / `AdminRoute` / `HomeRedirect` | 布局与路由守卫 |
| `ErrorBoundary` / `EmptyState` | 错误边界 / 空状态 |
| `FetchModelsModal` / `ModelMappingEditor` | 渠道模型映射编辑 |
| `PromptCategoriesModal` / `PromptVersionsModal` / `PromptPackageItemsModal` | 提示词管理弹窗 |
| `CsvImportModal` / `ConfirmPasswordModal` | CSV 导入 / 密码确认 |
| `UserFinanceTab` / `ChannelTestModal` / `ChannelLoadChart` | 财务/渠道测试/图表 |
| `CapabilitySelector` / `SkeletonTable` / `SkeletonCard` | 能力选择 / 骨架屏 |
| `channels/` / `playground/` | 渠道子组件 / API Playground 子组件 |

### 12.3 状态管理

- **authStore**（Zustand）：JWT Token + 用户信息 → `localStorage` (`juhe_token`)
- **themeStore**（Zustand）：明暗主题 → `localStorage` (`juhe_theme`)
- **FinanceContext**（React Context）：用户财务数据
- **Hooks**：`useAuth`、`useWebSocket`（实时额度通知）、`useKeyboardShortcuts`

---

## 13. Nginx 生产配置

管理后台（admin）Nginx 配置要点：

- `resolver 127.0.0.11 valid=30s ipv6=off` — Docker 内嵌 DNS
- `location /` → SPA `try_files $uri $uri/ /index.html`
- `location /api/` + `/v1/` → `proxy_pass http://$backend`（含 `X-Forwarded-Proto`, `X-Request-Id`）
- `/v1/` 流水线配置：`proxy_read_timeout 600s`、`proxy_buffering off`、`proxy_request_buffering off`、`chunked_transfer_encoding on`
- `gzip on`(min_length 1000)、`client_max_body_size 10m`、安全头（CSP、X-Content-Type-Options、X-Frame-Options 等）

---

## 14. Docker 部署

`docker-compose.yml` 编排 3 个服务（均 `restart: unless-stopped`）：

| 服务 | 端口 | 健康检查 | 依赖 |
|------|------|---------|------|
| mysql (`mysql:8.0`) | 7073:3306 | `mysqladmin ping` | - |
| server（多阶段构建） | 7075:8080 | `wget /api/public/status` | mysql healthy |
| admin（多阶段构建 + nginx） | 7074:80 | `wget localhost:80` | server healthy |

> server Dockerfile `EXPOSE 8080`，docker-compose 中 `PORT=8080`，一致。开发用 `Dockerfile.dev`（端口 7071）。

---

## 15. CI/CD

GitHub Actions 位于 `pc/.github/workflows/`（桌面应用使用）：CI（lint/format/typecheck/test）+ Build（跨平台构建+draft release）。Juhe Management 后端/前端/SDK 各自通过本地命令测试和构建（见第 7 节）。

---

## 16. 安全注意事项

- **API Key**：SHA256 哈希存储，一次性展示；支持 `AllowedIPs` 白名单和 `last_used_at` 追踪
- **密码**：bcrypt 哈希（成本=10），可配最小长度；修改密码需验证旧密码
- **JWT**：默认 24h 过期；生产环境必设 `JWT_SECRET` 强随机值
- **验证码**：登录/注册需 captcha（5 分钟 TTL）
- **邮箱验证**：注册时可启用 SMTP 验证流程
- **速率限制**：全局 token bucket 限流（60 req/min），支持按 Key/IP
- **请求追踪**：UUID v4 `X-Request-Id`；**审计日志**：所有管理操作异步记录
- **请求体限制**：`MAX_REQUEST_BODY_BYTES`（10MB）→ 超限 413
- **敏感词过滤**：可选中间件（`/v1/chat/completions`、`/v1/images/generations`）
- **XSS 防护**：`bluemonday` HTML 清理；**SQL 注入**：全 GORM 参数化查询
- **渠道健康检查**：连续失败自动下线，`channel_test_logs` 记录
- **CORS**：`CORS_ALLOWED_ORIGINS` 配置
- **生产环境必改**：`JWT_SECRET`、DB 密码、`ROOT_PASSWORD`、`WEBHOOK_SECRET`

---

## 17. 新增功能模块

- **WebSocket**（`internal/ws/`）：Hub 模式，`/api/ws`，实时推送额度变动/消费通知
- **Swagger**：`/api/swagger/*any`，`swag init` 自动生成
- **Captcha**：`GET /api/auth/captcha`，PNG base64，`sync.Map` 内存存储
- **邮箱验证**：SMTP 配置从 settings 表动态读取，`/api/auth/verify-email` + `/resend-verification`
- **CSV 导入**：`/api/import/users`、`/tokens`、`/channels`，前端 `CsvImportModal`
- **API Playground**：`/playground` 页面，支持流式 SSE
- **反馈 & 版本**：`POST /api/public/feedback`、`GET /api/public/releases/latest`、CRUD /api/releases
- **公开设置**：`/api/public/setting/default-vision-model`、`/default-llm-model`
- **调度器状态**：`GET /api/scheduler/status`

---

## 18. 当前开发状态

**整体状态**：Juhe Management MVP 功能完整，测试全部通过。

- Go 编译：`go build ./...` ✅ | Go 测试：`go test ./...` ✅（27 文件）
- TS 检查：`npx tsc --noEmit` ✅ | ESLint：`npm run lint` ✅（0 errors）
- 前端构建：`npm run build` ✅ | SDK 构建：✅ | Docker 全栈：✅

**核心功能**：21 种渠道 × 8 种 Adaptor、30 个管理页面、SDK + CLI、token/fixed 计费 + 预扣结算、提示词管理（分类/版本/封装）+ Mustache 渲染、Captcha、速率限制、审计日志、敏感词过滤、定时任务（日账单/订阅续费/健康检查/日志清理）、WebSocket、Embeddings + Audio 中转、邮箱验证、CSV 批量导入、Docker 全栈 + Swagger。

---

## 19. 聚合创作引擎（pc/）概览

`pc/` 是独立的 Electron + React + TypeScript 桌面应用，使用 **pnpm workspace** monorepo。详细开发指南见 `pc/AGENTS.md`。

### 快速参考

| 项 | 详情 |
|------|------|
| 入口 | `pc/src/main/index.ts` + `pc/src/renderer/src/main.tsx` |
| 包管理器 | pnpm 10.27.0（`packageManager` 锁定） |
| 数据库 | libSQL (SQLite) — Drizzle ORM（14 迁移文件） |
| 路由 / IPC | TanStack Router（29 个路由文件）/ `domain:action:subaction`（20 个 IPC 文件） |
| 样式 | Tailwind CSS 4 + Shadcn UI（`@cherrystudio/ui`） |
| i18n | 强制国际化，`zh-CN` 默认、`en` 备用 |
| 状态管理 | Zustand（34 store）+ Zundo + TanStack Query |
| 构建 | `electron-vite` → `electron-builder`（macOS/Windows/Linux） |
| 代码质量 | Biome + oxlint + ESLint + Vitest |
| 版本 | 0.1.0，App ID: `com.juhe-studio.app`，Node >= 20.0.0 |

### 关键命令

```bash
cd pc
pnpm install && pnpm packages:build   # 必须先构建 workspace 包
pnpm dev               # 开发模式
pnpm build             # 构建
pnpm typecheck         # 类型检查
pnpm lint              # oxlint + ESLint
pnpm format            # Biome 格式化
pnpm test              # Vitest
```

### workspace 包（8 个）

`@cherrystudio/ai-sdk-provider`、`@cherrystudio/ai-core`、`@cherrystudio/provider-registry`、`@cherrystudio/ui`、`@cherrystudio/extension-table-plus`、`@vectorstores/libsql`、`mcp-trace`、`volcengine-nodejs-sdk`。还依赖 `@juhe-management/client`（workspace:*）。

---

## 20. 设计文档索引

设计文档位于 `pc/docs/` 目录下（`pc/` 项目的专属文档），根目录另有项目级文档：

| 文件 | 内容 |
|------|------|
| `pc/docs/PRD.md` | 产品需求：用户故事、功能清单、MoSCoW 优先级、验收标准 |
| `pc/docs/ARCHITECTURE.md` | 技术架构：分层设计、数据流、安全、性能 |
| `pc/docs/ROADMAP.md` | 开发路线图：M1-M5 里程碑、任务分配 |
| `pc/docs/IMPLEMENTATION-PLAN.md` | 主实现计划 |
| `pc/docs/M2-IMPLEMENTATION-PLAN.md` | M2 阶段实现计划 |
| `pc/docs/M4-FINETUNE-RESEARCH.md` | M4 微调研究 |
| `pc/docs/M4-VIDEO-RESEARCH.md` | M4 视频研究 |
| `pc/docs/UI-DESIGN-REFERENCE.md` | UI/UX 设计参考 |
| `pc/docs/DEMO-ANALYSIS.md` | 20+ 参考项目的功能与架构分析 |
| `pc/docs/new-api-interface-analysis.md` | NewAPI 接口分析 |
| `pc/docs/new-api-openapi.json` | NewAPI OpenAPI 规格文档 |
| `pc/findings.md` | new-api 架构调研与可借鉴模式 |
| `pc/docs/aliyun/` | 阿里云相关文档 |
| `pc/docs/jimeng/` | 即梦相关文档 |
| `pc/docs/superpowers/` | Superpowers 技能系统文档 |
| `task_plan.md` | Juhe Management 实现计划与里程碑 |
| `progress.md` | Juhe Management 详细开发进度日志 |
| `pc/AGENTS.md` | 聚合创作引擎桌面应用开发指南（独立项目，568 行） |
| `pc/开发说明.md` | 中文版快速开始与开发规范速查 |
