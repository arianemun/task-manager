PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user_departments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`department_id` integer NOT NULL,
	`joined_at` text NOT NULL,
	`left_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_user_departments`("user_id", "department_id", "joined_at", "left_at") SELECT "user_id", "department_id", "joined_at", NULL FROM `user_departments`;--> statement-breakpoint
DROP TABLE `user_departments`;--> statement-breakpoint
ALTER TABLE `__new_user_departments` RENAME TO `user_departments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `user_departments_department_idx` ON `user_departments` (`department_id`);--> statement-breakpoint
CREATE INDEX `user_departments_user_idx` ON `user_departments` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_departments_open_unique` ON `user_departments` (`user_id`,`department_id`) WHERE "user_departments"."left_at" is null;