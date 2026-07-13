CREATE TABLE `memories` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`subject_type` text DEFAULT 'user' NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`scope` text DEFAULT 'user' NOT NULL,
	`confidence` integer DEFAULT 100,
	`status` text DEFAULT 'active' NOT NULL,
	`expires_at` text,
	`source_type` text DEFAULT 'chat',
	`source_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);

CREATE INDEX `memories_subject_idx` ON `memories` (`subject_id`, `subject_type`);
CREATE INDEX `memories_type_idx` ON `memories` (`type`);
CREATE INDEX `memories_scope_idx` ON `memories` (`scope`);
CREATE INDEX `memories_status_idx` ON `memories` (`status`);
CREATE INDEX `memories_created_at_idx` ON `memories` (`created_at`);
