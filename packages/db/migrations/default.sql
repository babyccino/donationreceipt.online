CREATE TABLE `accounts` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`user_id` text(191) NOT NULL,
	`type` text NOT NULL,
	`provider` text(191) NOT NULL,
	`provider_account_id` text(191) NOT NULL,
	`access_token` text,
	`expires_at` integer,
	`id_token` text,
	`refresh_token` text,
	`refresh_token_expires_at` integer,
	`scope` text,
	`token_type` text(191),
	`created_at` integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL,
	`updated_at` integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL,
	`realmid` text,
	`company_name` text
);
--> statement-breakpoint
CREATE TABLE `billing_addresses` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`user_id` text(191) NOT NULL,
	`name` text,
	`phone` text,
	`city` text,
	`country` text,
	`line1` text,
	`line2` text,
	`postal_code` text,
	`state` text,
	`created_at` integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL,
	`updated_at` integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`account_id` text(191) NOT NULL,
	`name` text NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`created_at` integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `donee_infos` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`account_id` text(191) NOT NULL,
	`company_name` text NOT NULL,
	`company_address` text NOT NULL,
	`country` text NOT NULL,
	`registration_number` text NOT NULL,
	`signatory_name` text NOT NULL,
	`signature` text NOT NULL,
	`small_logo` text NOT NULL,
	`large_logo` text NOT NULL,
	`created_at` integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL,
	`updated_at` integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `prices` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`active` integer,
	`unit_amount` integer,
	`currency` text,
	`type` text,
	`interval` text,
	`interval_count` integer,
	`metadata` text,
	`created_at` integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL,
	`updated_at` integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`active` integer,
	`name` text,
	`metadata` text,
	`created_at` integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL,
	`updated_at` integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`email_id` text(191),
	`campaign_id` text(191) NOT NULL,
	`email_status` text NOT NULL,
	`donor_id` text(191) NOT NULL,
	`total` integer NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`session_token` text(191) NOT NULL,
	`user_id` text(191) NOT NULL,
	`account_id` text(191),
	`expires` integer NOT NULL,
	`created_at` integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL,
	`updated_at` integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`user_id` text(191) NOT NULL,
	`status` text,
	`metadata` text,
	`cancel_at_period_end` integer,
	`current_period_start` integer NOT NULL,
	`current_period_end` integer NOT NULL,
	`ended_at` integer,
	`cancel_at` integer,
	`canceled_at` integer,
	`created_at` integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL,
	`updated_at` integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE `user_datas` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`account_id` text(191) NOT NULL,
	`items` text,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`created_at` integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL,
	`updated_at` integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text(191) PRIMARY KEY NOT NULL,
	`name` text(191),
	`email` text(191) NOT NULL,
	`country` text NOT NULL,
	`emailVerified` integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL,
	`image` text(191),
	`created_at` integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL,
	`updated_at` integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `verification_tokens` (
	`identifier` text(191) PRIMARY KEY NOT NULL,
	`token` text(191) NOT NULL,
	`expires` integer NOT NULL,
	`created_at` integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL,
	`updated_at` integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts__user_id__realmid__idx` ON `accounts` (`user_id`,`realmid`);--> statement-breakpoint
CREATE INDEX `accounts__userId__idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `billing_addresses__user_id__idx` ON `billing_addresses` (`user_id`);--> statement-breakpoint
CREATE INDEX `campaigns__account_id__idx` ON `campaigns` (`account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `donee_infos__account_id__idx` ON `donee_infos` (`account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `receipts__email_id__idx` ON `receipts` (`email_id`);--> statement-breakpoint
CREATE INDEX `receipts__campaign_id__idx` ON `receipts` (`campaign_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `receipts__campaign_id__donor_id__idx` ON `receipts` (`campaign_id`,`donor_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions__sessionToken__idx` ON `sessions` (`session_token`);--> statement-breakpoint
CREATE INDEX `sessions__userId__idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions__user_id__idx` ON `subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `support_tickets__user_id__idx` ON `support_tickets` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_data__account_id__idx` ON `user_datas` (`account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users__email__idx` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `verification_tokens__token__idx` ON `verification_tokens` (`token`);
