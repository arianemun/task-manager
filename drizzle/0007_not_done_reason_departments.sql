CREATE TABLE `not_done_reasons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `not_done_reasons_code_unique` ON `not_done_reasons` (`code`);
--> statement-breakpoint
CREATE TABLE `not_done_reason_departments` (
	`reason_id` integer NOT NULL,
	`department_id` integer NOT NULL,
	PRIMARY KEY(`reason_id`, `department_id`),
	FOREIGN KEY (`reason_id`) REFERENCES `not_done_reasons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `not_done_reason_departments_department_idx` ON `not_done_reason_departments` (`department_id`);
