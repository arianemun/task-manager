ALTER TABLE `notifications` ADD `dedupe_key` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_user_dedupe_uidx` ON `notifications` (`user_id`,`dedupe_key`) WHERE `dedupe_key` IS NOT NULL;
