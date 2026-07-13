CREATE TABLE `chat_assistants` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `emoji` text NOT NULL DEFAULT '💬',
  `system_prompt` text NOT NULL DEFAULT '',
  `description` text NOT NULL DEFAULT '',
  `model_id` text,
  `provider_id` text,
  `is_preset` integer NOT NULL DEFAULT false,
  `sort_order` integer NOT NULL DEFAULT 0,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);

CREATE INDEX `chat_assistants_preset_idx` ON `chat_assistants` (`is_preset`);
