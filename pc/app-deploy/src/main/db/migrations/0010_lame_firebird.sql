CREATE TABLE `mcp_servers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`transport` text NOT NULL,
	`command` text,
	`args` text,
	`env` text,
	`url` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mcp_servers_enabled_idx` ON `mcp_servers` (`enabled`);--> statement-breakpoint
ALTER TABLE `workflows` ADD `view_mode` text DEFAULT 'smart';--> statement-breakpoint
ALTER TABLE `workflows` ADD `version` integer DEFAULT 1;