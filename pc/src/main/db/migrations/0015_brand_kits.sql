-- Migration 0015: Brand Kits
-- 品牌 Kit 系统 — 品牌色/Logo/风格预设跨项目复用

CREATE TABLE IF NOT EXISTS brand_kits (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    primary_color TEXT NOT NULL DEFAULT '#FF5733',
    secondary_color TEXT DEFAULT '#333333',
    logo_path TEXT,
    font_family TEXT DEFAULT 'Inter',
    style_description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 将 brand_kit_id 关联到 projects 表（可选）
ALTER TABLE projects ADD COLUMN brand_kit_id TEXT REFERENCES brand_kits(id) ON DELETE SET NULL;
