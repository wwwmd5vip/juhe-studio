# Juhe Management Server

Go 后端服务，包含管理后台 API 与 OpenAI 兼容 Relay。

## 目录结构

```
server/
├── cmd/server/main.go
├── internal/
│   ├── bootstrap/          # 初始化：DB、缓存、日志
│   ├── config/             # 配置读取
│   ├── domain/             # 领域模型
│   ├── repository/         # 数据访问层
│   ├── service/            # 业务逻辑层
│   ├── handler/            # HTTP handler
│   │   ├── admin/          # 管理后台接口
│   │   └── relay/          # OpenAI 兼容转发接口
│   ├── middleware/         # Gin 中间件
│   ├── relay/              # 转发核心
│   │   └── channel/        # 上游适配器
│   ├── dto/                # 请求/响应 DTO
│   └── common/             # 工具、常量、缓存
└── migrations/             # 数据库迁移
```

## 开发

```bash
# 安装依赖
go mod tidy

# 启动服务
go run cmd/server/main.go
```

## 环境变量

复制 `.env.example` 为 `.env` 并填写。
