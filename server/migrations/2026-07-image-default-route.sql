-- ============================================================
-- MIGRATION: 2026-07-image-default-route
-- Purpose: 给默认 image 模型（juhe-gpt-image-2）补齐 image generation
--          路由 + pricing，避免桌面端发来图生图时报
--          "no available channel for model and group" 或
--          "no pricing configured for image generation"。
--
-- 跑前条件：MySQL 8+，至少一条 status=1 的 image-capable channel 已经存在
--          （任何 type='openai'、models 包含 'juhe-gpt-image-2'、status=1 的渠道都行）。
--          如果你完全没有 channel，请先在 admin UI → 渠道管理 → 新建一条。
--
-- 跑法（任选其一）：
--   A) mysql -u root -p juhe_management < 2026-07-image-default-route.sql
--   B) 通过 admin UI 完成，下面 SQL 都是 admin 页面的"按数据库视角"等价操作
--
-- 备份后再跑：mysqldump -u root -p juhe_management > backup_before_$(date +%F).sql
-- ============================================================

SET @now := NOW();

-- 0) 调整 sql_mode，避免 ONLY_FULL_GROUP_BY 在 ON DUPLICATE KEY 时炸
SET @old_mode := @@SESSION.sql_mode;
SET SESSION sql_mode = '';

-- ============================================================
-- 1) 确保有一条 status=1 且 models 里带 'juhe-gpt-image-2' 的渠道
-- ============================================================
-- 这条是"占位"插入：如果你已经手动在 admin UI 加好了，PLATFORM_INSERTED_OK 是 0，
-- 不影响现状；如果你一行 channel 都没有，这会插一条占位（请到 admin UI 改成真实密钥）。
INSERT INTO channels (
    type, name, base_url, auth_type, keys, models, groups,
    weight, priority, status, timeout_seconds, auto_ban,
    fail_count, consecutive_failures, created_at, updated_at
)
SELECT
    'openai',
    'placeholder-juhe-gpt-image-2',
    'http://REPLACE-WITH-REAL-UPSTREAM/',
    'api-key',
    'sk-REPLACE-WITH-REAL-KEY',
    'juhe-gpt-image-2',
    'default',
    10, 10, 1, 60, 1, 0, 0, @now, @now
FROM (SELECT 1) AS one
WHERE NOT EXISTS (
    SELECT 1 FROM channels
    WHERE status = 1
      AND FIND_IN_SET('juhe-gpt-image-2', REPLACE(models, ' ', '')) > 0
);

-- ============================================================
-- 2) 把所有"覆盖 juhe-gpt-image-2 模型"的 enabled channel 都钉进 abilities
--    保证 (group='default', model_name='juhe-gpt-image-2', enabled=1, status=1) 至少一条
-- ============================================================
INSERT INTO abilities (
    `group`, model_name, channel_id, priority, weight, enabled, created_at, updated_at
)
SELECT
    'default',
    'juhe-gpt-image-2',
    c.id,
    10, 10, 1, @now, @now
FROM channels c
WHERE c.status = 1
  AND FIND_IN_SET('juhe-gpt-image-2', REPLACE(c.models, ' ', '')) > 0
ON DUPLICATE KEY UPDATE
    enabled = 1,
    priority = 10,
    weight = 10,
    updated_at = @now;

-- ============================================================
-- 3) 给 (model_name, group) 加 image pricing：billing_mode=fixed 且 cents>0
--    CalculateImageCost 要求 pricing != nil && *FixedPriceCents != 0，否则抛 ErrNoImagePricing
-- ============================================================
INSERT INTO pricings (
    model_name, `group`, billing_mode,
    model_ratio, completion_ratio, cached_tokens_ratio,
    fixed_price_cents, image_ratio,
    effective_from, created_at, updated_at
) VALUES (
    'juhe-gpt-image-2', 'default', 'fixed',
    1.00000000, 1.00000000, 1.00000000,
    100, 1.00000000,
    @now, @now, @now
)
ON DUPLICATE KEY UPDATE
    billing_mode = 'fixed',
    fixed_price_cents = 100,
    image_ratio = 1.0,
    updated_at = @now;

-- ============================================================
-- 4) (可选) 确保 prices.model_name ∈ channels.models 的最小一致
--    让 admin UI 的"模型下拉"也能看到这张图
-- ============================================================
-- INSERT IGNORE INTO models (model_name, type, status, ...)
--     VALUES ('juhe-gpt-image-2', 'image', 1, ...);
-- 如果你的 admin 是从 channels.models 反向算 model 列表，无需此步。

-- 还原 sql_mode
SET SESSION sql_mode = @old_mode;

-- ============================================================
-- 验证：
--   SELECT a.id, a.`group`, a.model_name, a.enabled,
--          c.id AS channel_id, c.status, c.name
--     FROM abilities a
--     JOIN channels c ON c.id = a.channel_id
--    WHERE a.model_name = 'juhe-gpt-image-2';
--   -- 预期：至少一行 enabled=1, status=1
--
--   SELECT id, model_name, `group`, billing_mode, fixed_price_cents
--     FROM pricings
--    WHERE model_name = 'juhe-gpt-image-2';
--   -- 预期：billing_mode='fixed', fixed_price_cents=100（>0）
-- ============================================================
