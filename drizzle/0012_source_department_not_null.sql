PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_task_occurrences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`template_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`period_key` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`due_at` integer,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`completed_at` integer,
	`note` text,
	`reason_code` text,
	`attachment_path` text,
	`completed_by_user_id` integer,
	`done_by_occurrence_id` integer,
	`source_department_id` integer NOT NULL,
	`edited_at` integer,
	`reviewed_by` integer,
	`review_status` text,
	`review_note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `task_templates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`completed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`done_by_occurrence_id`) REFERENCES `__new_task_occurrences`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_task_occurrences`("id", "template_id", "user_id", "period_key", "period_start", "period_end", "due_at", "status", "completed_at", "note", "reason_code", "attachment_path", "completed_by_user_id", "done_by_occurrence_id", "source_department_id", "edited_at", "reviewed_by", "review_status", "review_note", "created_at", "updated_at") SELECT "id", "template_id", "user_id", "period_key", "period_start", "period_end", "due_at", "status", "completed_at", "note", "reason_code", "attachment_path", "completed_by_user_id", "done_by_occurrence_id", "source_department_id", "edited_at", "reviewed_by", "review_status", "review_note", "created_at", "updated_at" FROM `task_occurrences`;--> statement-breakpoint
DROP TABLE `task_occurrences`;--> statement-breakpoint
ALTER TABLE `__new_task_occurrences` RENAME TO `task_occurrences`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `task_occurrences_unique` ON `task_occurrences` (`template_id`,`user_id`,`period_key`);--> statement-breakpoint
CREATE INDEX `task_occurrences_user_period_idx` ON `task_occurrences` (`user_id`,`period_start`);--> statement-breakpoint
CREATE INDEX `task_occurrences_status_idx` ON `task_occurrences` (`status`);--> statement-breakpoint
CREATE INDEX `task_occurrences_template_id_idx` ON `task_occurrences` (`template_id`);--> statement-breakpoint
CREATE INDEX `task_occurrences_reason_code_idx` ON `task_occurrences` (`reason_code`);--> statement-breakpoint
CREATE INDEX `task_occurrences_period_end_idx` ON `task_occurrences` (`period_end`);--> statement-breakpoint
CREATE INDEX `task_occurrences_user_period_end_idx` ON `task_occurrences` (`user_id`,`period_end`);--> statement-breakpoint
CREATE INDEX `task_occurrences_completed_by_idx` ON `task_occurrences` (`completed_by_user_id`);--> statement-breakpoint
CREATE INDEX `task_occurrences_done_by_occ_idx` ON `task_occurrences` (`done_by_occurrence_id`);--> statement-breakpoint
CREATE INDEX `task_occurrences_source_department_idx` ON `task_occurrences` (`source_department_id`);