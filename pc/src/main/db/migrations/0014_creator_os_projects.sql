-- Migration 0014: Creator OS — Project-centric ecommerce visual production platform
-- Adds 5 new domain tables + 3 nullable project_id foreign key columns on existing task tables.

-- ==================== projects ====================
CREATE TABLE `projects` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `category` text NOT NULL DEFAULT 'product_set',
  `status` text NOT NULL DEFAULT 'draft',
  `description` text,
  `batch_status` text DEFAULT 'idle',
  `batch_error` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
CREATE INDEX `projects_updated_at_idx` ON `projects` (`updated_at`);
CREATE INDEX `projects_batch_status_idx` ON `projects` (`batch_status`);

-- ==================== assets ====================
CREATE TABLE `assets` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `projects`(`id`) ON DELETE CASCADE,
  `kind` text NOT NULL DEFAULT 'source',
  `file_path` text NOT NULL,
  `mime_type` text NOT NULL DEFAULT 'image/png',
  `width` integer,
  `height` integer,
  `metadata` text,
  `status` text NOT NULL DEFAULT 'active',
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
CREATE INDEX `assets_project_idx` ON `assets` (`project_id`);
CREATE INDEX `assets_kind_idx` ON `assets` (`kind`);

-- ==================== creator_tasks ====================
CREATE TABLE `creator_tasks` (
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
CREATE INDEX `creator_tasks_project_idx` ON `creator_tasks` (`project_id`);
CREATE INDEX `creator_tasks_runtime_idx` ON `creator_tasks` (`runtime_task_id`);

-- ==================== versions ====================
CREATE TABLE `versions` (
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
CREATE INDEX `versions_task_idx` ON `versions` (`task_id`);

-- ==================== deliverables ====================
CREATE TABLE `deliverables` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `projects`(`id`) ON DELETE CASCADE,
  `task_id` text NOT NULL REFERENCES `creator_tasks`(`id`) ON DELETE CASCADE,
  `version_id` text REFERENCES `versions`(`id`) ON DELETE SET NULL,
  `label` text NOT NULL,
  `slot_index` integer NOT NULL DEFAULT 0,
  `is_selected` integer NOT NULL DEFAULT 1,
  `sort_order` integer NOT NULL DEFAULT 0,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
CREATE INDEX `deliverables_project_idx` ON `deliverables` (`project_id`);

-- ==================== Nullable project_id columns on existing tables ====================
-- These are backward-compatible: old rows remain NULL, new rows can reference a project.

ALTER TABLE `generations` ADD COLUMN `project_id` text REFERENCES `projects`(`id`) ON DELETE SET NULL;
ALTER TABLE `ecommerce_workflows` ADD COLUMN `project_id` text REFERENCES `projects`(`id`) ON DELETE SET NULL;
ALTER TABLE `showcase_tasks` ADD COLUMN `project_id` text REFERENCES `projects`(`id`) ON DELETE SET NULL;
