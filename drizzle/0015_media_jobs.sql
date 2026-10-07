CREATE TABLE `media_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attachment_id` integer NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`attachment_id`) REFERENCES `message_attachments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `media_jobs_status_idx` ON `media_jobs` (`status`);
