-- Migration 0015: Brand Kits
-- 品牌 Kit 系统 — 品牌色/Logo/风格预设跨项目复用
--
-- NOTE: brand_kit_id column on projects is added by safeAddMissingColumns()
-- to avoid "duplicate column" errors on re-run.

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
