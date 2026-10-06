ALTER TABLE `users` ADD `full_name_normalized` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `deleted_at` integer;--> statement-breakpoint
CREATE INDEX `users_full_name_normalized_idx` ON `users` (`full_name_normalized`);--> statement-breakpoint
CREATE INDEX `users_deleted_at_idx` ON `users` (`deleted_at`);