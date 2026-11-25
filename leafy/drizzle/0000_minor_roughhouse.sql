CREATE TABLE `leafy_platform_controls` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`control` text DEFAULT 'AGENT_CONTROL' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `leafy_remote_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`pairHash` text NOT NULL,
	`tokenHash` text,
	`device` text DEFAULT 'Chrome' NOT NULL,
	`control` text DEFAULT 'DISCONNECTED' NOT NULL,
	`snapshot` text DEFAULT '{}' NOT NULL,
	`expiresAt` integer NOT NULL,
	`lastSeen` integer DEFAULT 0 NOT NULL,
	`revoked` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_leafy_remote_owner` ON `leafy_remote_sessions` (`owner`);--> statement-breakpoint
CREATE TABLE `leafy_ui_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`target` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`result` text DEFAULT '' NOT NULL,
	`createdAt` integer NOT NULL,
	`expiresAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_leafy_ui_target` ON `leafy_ui_commands` (`target`,`status`);