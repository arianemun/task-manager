UPDATE `task_templates` SET `priority` = 'DO' WHERE `priority` = 'HIGH';
--> statement-breakpoint
UPDATE `task_templates` SET `priority` = 'SCHEDULE' WHERE `priority` = 'MEDIUM';
--> statement-breakpoint
UPDATE `task_templates` SET `priority` = 'ELIMINATE' WHERE `priority` = 'LOW';
