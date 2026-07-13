CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`attachments` text,
	`model_id` text,
	`tokens_used` integer,
	`latency` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chat_messages_session_idx` ON `chat_messages` (`session_id`);--> statement-breakpoint
CREATE INDEX `chat_messages_created_at_idx` ON `chat_messages` (`created_at`);--> statement-breakpoint
CREATE TABLE `chat_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text DEFAULT 'New Chat' NOT NULL,
	`provider_id` text,
	`model_id` text,
	`system_prompt` text,
	`is_favorite` integer DEFAULT false,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chat_sessions_created_at_idx` ON `chat_sessions` (`created_at`);--> statement-breakpoint
CREATE INDEX `chat_sessions_favorite_idx` ON `chat_sessions` (`is_favorite`);