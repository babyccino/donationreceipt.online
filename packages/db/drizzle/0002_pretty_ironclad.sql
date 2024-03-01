ALTER TABLE `donations` RENAME TO `receipts`;--> statement-breakpoint
DROP INDEX IF EXISTS `donations__email_history_id__idx`;--> statement-breakpoint
CREATE INDEX `receipts__email_history_id__idx` ON `receipts` (`email_history_id`);