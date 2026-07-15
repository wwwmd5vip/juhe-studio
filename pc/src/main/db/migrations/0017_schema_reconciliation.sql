-- Migration 0017: Schema reconciliation (CREATE TABLE 部分)
-- 仅包含有 IF NOT EXISTS 保护的安全 DDL

-- ==================== creator_tasks (from 0014) ====================
CREATE TABLE IF NOT EXISTS `creator_tasks` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `projects`(`id`) ON DELETE CASCADE,
  `runtime_task_id` text NOT NULL,
  `template_slot_id` text NOT NULL,
  `slot_index` integer NOT NULL DEFAULT 0,
  `status` text NOT NULL DEFAULT 'pending',
  `runtime_status` text NOT NULL DEFAULT 'pending',
  `error_message` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
CREATE INDEX IF NOT EXISTS `creator_tasks_project_idx` ON `creator_tasks` (`project_id`);
CREATE INDEX IF NOT EXISTS `creator_tasks_runtime_idx` ON `creator_tasks` (`runtime_task_id`);

-- ==================== versions (from 0014) ====================
CREATE TABLE IF NOT EXISTS `versions` (
  `id` text PRIMARY KEY NOT NULL,
  `task_id` text NOT NULL REFERENCES `creator_tasks`(`id`) ON DELETE CASCADE,
  `generation_id` text,
  `version_number` integer NOT NULL DEFAULT 1,
  `file_path` text NOT NULL,
  `mime_type` text NOT NULL DEFAULT 'image/png',
  `is_selected` integer NOT NULL DEFAULT 1,
  `metadata` text,
  `created_at` text NOT NULL
);
CREATE INDEX IF NOT EXISTS `versions_task_idx` ON `versions` (`task_id`);

-- ==================== deliverables (from 0014) ====================
CREATE TABLE IF NOT EXISTS `deliverables` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `projects`(`id`) ON DELETE CASCADE,
  `task_id` text NOT NULL REFERENCES `creator_tasks`(`id`) ON DELETE CASCADE,
  `version_id` text REFERENCES `versions`(`id`) ON DELETE SET NULL,
  `version_file_path` text,
  `task_runtime_status` text,
  `label` text NOT NULL,
  `slot_index` integer NOT NULL DEFAULT 0,
  `is_selected` integer NOT NULL DEFAULT 1,
  `sort_order` integer NOT NULL DEFAULT 0,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
CREATE INDEX IF NOT EXISTS `deliverables_project_idx` ON `deliverables` (`project_id`);
