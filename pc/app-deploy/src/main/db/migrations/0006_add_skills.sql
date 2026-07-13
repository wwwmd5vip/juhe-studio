CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`content` text NOT NULL,
	`category` text DEFAULT 'custom',
	`is_enabled` integer DEFAULT true,
	`is_builtin` integer DEFAULT false,
	`metadata` text,
	`icon` text,
	`order_key` integer DEFAULT 0,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);

CREATE INDEX `skills_category_idx` ON `skills` (`category`);
CREATE INDEX `skills_enabled_idx` ON `skills` (`is_enabled`);
CREATE INDEX `skills_order_idx` ON `skills` (`order_key`);
