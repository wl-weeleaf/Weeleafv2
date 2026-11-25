CREATE TABLE `leafy_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`excerpt` text DEFAULT '' NOT NULL,
	`visions` integer DEFAULT 0 NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_leafy_uploads_owner` ON `leafy_uploads` (`owner`,`createdAt`);--> statement-breakpoint
CREATE TABLE `leafy_settings` (
	`owner` text PRIMARY KEY NOT NULL,
	`autoCookies` integer DEFAULT 1 NOT NULL,
	`cookieChoice` text DEFAULT 'necessary' NOT NULL,
	`viewUntil` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `leafy_remote_sessions` ADD `kind` text DEFAULT 'chrome' NOT NULL;--> statement-breakpoint
ALTER TABLE `leafy_remote_sessions` ADD `capabilities` text DEFAULT '{}' NOT NULL;