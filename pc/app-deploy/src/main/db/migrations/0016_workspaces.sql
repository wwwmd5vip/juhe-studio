-- Migration 0016: Workspaces
-- 多空间/工作区系统
--
-- NOTE: workspace_id columns on chat_sessions, workflows, prompt_templates,
-- skills, memories are added by safeAddMissingColumns() to avoid "duplicate
-- column" errors on re-run.

CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'folder',
    color TEXT DEFAULT '#6366f1',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
