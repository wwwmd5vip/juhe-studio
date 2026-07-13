# 修复 "no available channel for model and group" + "no pricing configured for image generation"

## 这是什么问题

桌面端 `pc/` 在做图生图（证件照、扩图、背景移除、变体、超分）时，提交到
`POST /v1/images/generations`，并 inline `body.images: [...]`。admin 后端
（`server/`）通过 `relay.Dispatcher.SelectChannel(...)` 找 `(modelName, group)`
对应的可用渠道。判定走 `channel_repo.go:245-253`：

```sql
SELECT a.* FROM abilities a
JOIN channels c ON c.id = a.channel_id
WHERE a.`group` = ?          -- 用户所在的 group
  AND a.model_name = ?       -- 选中的模型名
  AND a.enabled = 1
  AND c.status = 1
```

如果这条 SQL 返 0 行 → 抛 `ErrNoAvailableChannel` → 返回给桌面 500 + juhe_error
`no available channel for model and group`，被桌面翻译成：

```
ERR_PROVIDER_NO_CHANNEL: provider 后端没有可路由 (模型=juhe-gpt-image-2, 你的用户分组)
                        的可用渠道。
```

紧接着，billing 阶段调 `billing_service.go:121 CalculateImageCost(...)`，它要求：

```go
if pricing == nil { return 0, ErrNoImagePricing }
if pricing.FixedPriceCents == nil || *pricing.FixedPriceCents == 0 {
    return 0, ErrNoImagePricing
}
```

否则抛 `ErrNoImagePricing` → 桌面翻译成：

```
ERR_PROVIDER_NO_PRICING: provider 后端没有给模型「juhe-gpt-image-2」配置
                         image generation 定价。
```

## 两种修法

### A. 一次性 SQL patch（已写好）

跑：

```bash
mysql -u root -p juhe_management \
  < server/migrations/2026-07-image-default-route.sql
```

文件里做三件事：
1. **占位 channel**：如果一条 `status=1` 且 `models` 含 `juhe-gpt-image-2` 的渠道都没有，就插一条占位（**记得在 admin UI 里改成真实 baseURL + apiKey**）。
2. **abilities**：把所有 status=1 且 models 含该模型的渠道都绑到 `(group='default', model_name='juhe-gpt-image-2', enabled=1, priority=10)`。
3. **pricings**：插一条 `(model_name='juhe-gpt-image-2', group='default', billing_mode='fixed', fixed_price_cents=100, image_ratio=1.0)`。

跑完验证：

```sql
-- abilities 行
SELECT a.model_name, a.`group`, a.enabled, c.status, c.name
  FROM abilities a JOIN channels c ON c.id=a.channel_id
 WHERE a.model_name='juhe-gpt-image-2';

-- pricing 行
SELECT model_name, `group`, billing_mode, fixed_price_cents, image_ratio
  FROM pricings WHERE model_name='juhe-gpt-image-2';
```

两条都应该有结果，且 `enabled=1, status=1, billing_mode='fixed', fixed_price_cents=100`。

### B. 自动 Seed（已加到 `bootstrap.SeedImageCapabilities`）

`server/internal/bootstrap/seed.go` 新增 `SeedImageCapabilities(db)`，
`main.go` 启动时自动调用（已注册），效果与 SQL patch 相同但**幂等可重复**：

- 找到所有 `status=1` 且 `models` 含目标模型的 channel；
- upsert abilities；
- upsert pricings（image 必须 `billing_mode='fixed'` 且 `fixed_price_cents>0`）。

构建 + 启动：

```bash
cd server
go build ./...
./server   # 启动时自动 seed
```

启动日志里如果看到 `WARNING: ...failed...` 行，逐条修即可（一般是 channel 名字不匹配）。

> ⚠️ 这条 seed 不会凭空创建 channel。如果 admin 数据库里一条 image 渠道都没有，
> 重启前后都仍然 NoAvailableChannel，需要先在 admin UI → 渠道管理新建一条再
> 触发本 seed。

## 涉及模型清单

Seed 范围：

| 模型 | 类型 | 来源 |
|------|------|------|
| `juhe-gpt-image-2` | image | admin 预置 image 模型 |
| `juhe-nano` | image | admin 预置 image 模型 |
| `juhe-nano-pro` | image | admin 预置 image 模型 |
| `juhe-nano2` | image | admin 预置 image 模型 |

新增别的 image 模型时，把 `SeedImageCapabilities` 内 slice 同步加上即可。

## 桌面端已经做的对应工作

- `pc/src/main/services/image-processing.ts:71-138` 改走 `/v1/images/generations`
  而非 `/images/edits`（适配 mxapi / 聚合中转普遍实现）。
- `pc/src/main/services/image-processing.ts:151-225` 加了 `translateJuheError`，
  把 juhe_error 5xx 翻译成 `ERR_PROVIDER_NO_PRICING` / `ERR_PROVIDER_NO_CHANNEL`
  等 actionable 错误，桌面端不再把"HTTP 500 + JSON"原始暴露给用户。
