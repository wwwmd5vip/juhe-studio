CREATE TABLE `generations` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`provider_id` text NOT NULL,
	`model_id` text NOT NULL,
	`prompt` text NOT NULL,
	`negative_prompt` text,
	`seed` integer,
	`width` integer,
	`height` integer,
	`steps` integer,
	`cfg_scale` integer,
	`parameters` text,
	`result_urls` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `generations_status_idx` ON `generations` (`status`);--> statement-breakpoint
CREATE INDEX `generations_type_idx` ON `generations` (`type`);--> statement-breakpoint
CREATE INDEX `generations_created_at_idx` ON `generations` (`created_at`);--> statement-breakpoint
CREATE TABLE `models` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`name` text NOT NULL,
	`display_name` text,
	`type` text NOT NULL,
	`capabilities` text,
	`parameters` text,
	`is_enabled` integer DEFAULT true,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `models_provider_idx` ON `models` (`provider_id`);--> statement-breakpoint
CREATE INDEX `models_type_idx` ON `models` (`type`);--> statement-breakpoint
CREATE TABLE `prompt_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`description` text,
	`tags` text,
	`is_favorite` integer DEFAULT false,
	`usage_count` integer DEFAULT 0,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `prompt_templates_category_idx` ON `prompt_templates` (`category`);--> statement-breakpoint
CREATE INDEX `prompt_templates_favorite_idx` ON `prompt_templates` (`is_favorite`);--> statement-breakpoint
CREATE TABLE `providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`base_url` text,
	`api_key` text,
	`is_enabled` integer DEFAULT true,
	`is_custom` integer DEFAULT false,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workflows` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`nodes` text NOT NULL,
	`edges` text NOT NULL,
	`viewport` text,
	`is_favorite` integer DEFAULT false,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workflows_favorite_idx` ON `workflows` (`is_favorite`);