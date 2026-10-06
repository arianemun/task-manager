CREATE TABLE `staff_leaves` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`reason` text NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `staff_leaves_user_id_idx` ON `staff_leaves` (`user_id`);--> statement-breakpoint
CREATE INDEX `staff_leaves_range_idx` ON `staff_leaves` (`start_date`,`end_date`);--> statement-breakpoint
ALTER TABLE `users` ADD `department_joined_at` text;