CREATE TABLE `user_departments` (
	`user_id` integer NOT NULL,
	`department_id` integer NOT NULL,
	`joined_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `department_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_departments_department_idx` ON `user_departments` (`department_id`);--> statement-breakpoint
INSERT INTO `user_departments` (`user_id`, `department_id`, `joined_at`)
SELECT `id`, `department_id`, COALESCE(`department_joined_at`, date('now'))
FROM `users`
WHERE `department_id` IS NOT NULL;