PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_task_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`category_id` integer,
	`priority` text DEFAULT 'MEDIUM' NOT NULL,
	`requires_note` integer DEFAULT false NOT NULL,
	`requires_attachment` integer DEFAULT false NOT NULL,
	`recurrence_type` text DEFAULT 'DAILY' NOT NULL,
	`recurrence_config` text DEFAULT '{}' NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`due_time` text,
	`skip_holidays` integer DEFAULT true NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `task_categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_task_templates`("id", "title", "description", "category_id", "priority", "requires_note", "requires_attachment", "recurrence_type", "recurrence_config", "start_date", "end_date", "due_time", "skip_holidays", "is_active", "created_by", "created_at", "updated_at") SELECT "id", "title", "description", "category_id", "priority", "requires_note", "requires_attachment", "recurrence_type", "recurrence_config", "start_date", "end_date", "due_time", "skip_holidays", "is_active", "created_by", "created_at", "updated_at" FROM `task_templates`;--> statement-breakpoint
DROP TABLE `task_templates`;--> statement-breakpoint
ALTER TABLE `__new_task_templates` RENAME TO `task_templates`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `task_templates_category_id_idx` ON `task_templates` (`category_id`);--> statement-breakpoint
CREATE INDEX `task_templates_is_active_idx` ON `task_templates` (`is_active`);