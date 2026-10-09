ALTER TABLE `notifications` ADD `bundle_count` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `notification_deliveries` ADD `next_attempt_at` integer;
--> statement-breakpoint
ALTER TABLE `push_subscriptions` ADD `disabled_at` integer;
--> statement-breakpoint
CREATE INDEX `notification_deliveries_push_queue_idx` ON `notification_deliveries` (`channel`,`status`,`next_attempt_at`);
