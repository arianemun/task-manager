ALTER TABLE `task_occurrences` ADD `done_by_occurrence_id` integer REFERENCES task_occurrences(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `task_occurrences_done_by_occ_idx` ON `task_occurrences` (`done_by_occurrence_id`);--> statement-breakpoint
ALTER TABLE `task_templates` ADD `completion_mode` text DEFAULT 'INDIVIDUAL' NOT NULL;