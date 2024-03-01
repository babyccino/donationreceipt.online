ALTER TABLE `receipts` RENAME COLUMN `email_history_id` TO `campaign_id`;--> statement-breakpoint
DROP INDEX IF EXISTS `receipts__email_history_id__idx`;--> statement-breakpoint
CREATE INDEX `receipts__campaign_id__idx` ON `receipts` (`campaign_id`);