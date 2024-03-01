CREATE TABLE `support_tickets` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`user_id` text(191) NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`from` text NOT NULL,
	`created_at` integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL,
	`updated_at` integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `email_histories` RENAME TO `campaigns`;--> statement-breakpoint
DROP INDEX IF EXISTS `email_histories__account_id__idx`;--> statement-breakpoint
CREATE INDEX `support_tickets__user_id__idx` ON `support_tickets` (`user_id`);--> statement-breakpoint
CREATE INDEX `campaigns__account_id__idx` ON `campaigns` (`account_id`);