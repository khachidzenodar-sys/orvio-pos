CREATE TABLE `pos_store` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`document` text NOT NULL
);
