ALTER TABLE `task_occurrences` ADD `reason_code` text;--> statement-breakpoint
ALTER TABLE `task_occurrences` ADD `edited_at` integer;--> statement-breakpoint
CREATE INDEX `task_occurrences_reason_code_idx` ON `task_occurrences` (`reason_code`);