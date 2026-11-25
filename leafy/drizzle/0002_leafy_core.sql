CREATE TABLE `leafy_core_meta` (
	`profileId` text PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`crossContext` integer DEFAULT 1 NOT NULL,
	`personalMemory` text DEFAULT '' NOT NULL,
	`permissions` text DEFAULT '[]' NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `leafy_core_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`profileId` text NOT NULL,
	`kind` text DEFAULT 'preference' NOT NULL,
	`text` text NOT NULL,
	`source` text DEFAULT 'user' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`deletedAt` integer
);
--> statement-breakpoint
CREATE INDEX `idx_core_notes_profile` ON `leafy_core_notes` (`profileId`,`status`);--> statement-breakpoint
CREATE TABLE `leafy_core_skills` (
	`id` text PRIMARY KEY NOT NULL,
	`profileId` text NOT NULL,
	`name` text NOT NULL,
	`instructions` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`deletedAt` integer
);
--> statement-breakpoint
CREATE TABLE `leafy_identity` (
	`owner` text PRIMARY KEY NOT NULL,
	`profileId` text NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_leafy_identity_profile` ON `leafy_identity` (`profileId`);