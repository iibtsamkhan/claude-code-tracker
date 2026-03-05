CREATE INDEX `usageHistories_userId_idx` ON `usageHistories` (`userId`);--> statement-breakpoint
CREATE INDEX `usageHistories_projectId_idx` ON `usageHistories` (`projectId`);--> statement-breakpoint
CREATE INDEX `usageHistories_user_project_idx` ON `usageHistories` (`userId`,`projectId`);--> statement-breakpoint
CREATE INDEX `usageHistories_timestamp_idx` ON `usageHistories` (`timestamp`);--> statement-breakpoint
CREATE INDEX `usageHistories_provider_idx` ON `usageHistories` (`provider`);--> statement-breakpoint
CREATE INDEX `usageHistories_model_idx` ON `usageHistories` (`model`);--> statement-breakpoint
CREATE INDEX `usageHistories_conversationId_idx` ON `usageHistories` (`conversationId`);