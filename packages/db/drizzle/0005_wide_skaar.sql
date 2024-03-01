ALTER TABLE receipts ADD `email_id` text(191);--> statement-breakpoint
CREATE UNIQUE INDEX `receipts__email_id__idx` ON `receipts` (`email_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `receipts__donor_id__campaign_id__idx` ON `receipts` (`donor_id`,`campaign_id`);