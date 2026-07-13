CREATE TABLE `quick_phrases` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`is_favorite` integer DEFAULT false,
	`order_key` integer DEFAULT 0,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
CREATE INDEX `quick_phrases_favorite_idx` ON `quick_phrases` (`is_favorite`);
CREATE INDEX `quick_phrases_order_idx` ON `quick_phrases` (`order_key`);
