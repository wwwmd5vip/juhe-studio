CREATE TABLE `web_search_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`api_key` text,
	`api_host` text,
	`is_enabled` integer DEFAULT true,
	`engines` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
