ALTER TABLE `generations` ADD COLUMN `priority` text DEFAULT 'normal';--> statement-breakpoint
ALTER TABLE `generations` ADD COLUMN `progress` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `generations` ADD COLUMN `stage` text DEFAULT 'queued';--> statement-breakpoint
ALTER TABLE `generations` ADD COLUMN `started_at` text;--> statement-breakpoint
ALTER TABLE `generations` ADD COLUMN `completed_at` text;--> statement-breakpoint
ALTER TABLE `generations` ADD COLUMN `external_task_id` text;--> statement-breakpoint
ALTER TABLE `generations` ADD COLUMN `external_provider` text;--> statement-breakpoint
ALTER TABLE `generations` ADD COLUMN `outputs` text;--> statement-breakpoint
ALTER TABLE `prompt_templates` ADD COLUMN `cover_image` text;--> statement-breakpoint
ALTER TABLE `prompt_templates` ADD COLUMN `aspect_ratio` text;
