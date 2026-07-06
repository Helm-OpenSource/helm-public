-- AlterTable
ALTER TABLE `Notification` ADD COLUMN `dedupeKey` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Notification_workspaceId_dedupeKey_key` ON `Notification`(`workspaceId`, `dedupeKey`);
