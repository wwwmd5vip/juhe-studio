CREATE TABLE `showcase_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`input` text NOT NULL,
	`result` text,
	`error_msg` text,
	`point_cost` integer,
	`generation_task_ids` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `showcase_tasks_status_idx` ON `showcase_tasks` (`status`);--> statement-breakpoint
CREATE INDEX `showcase_tasks_updated_at_idx` ON `showcase_tasks` (`updated_at`);
