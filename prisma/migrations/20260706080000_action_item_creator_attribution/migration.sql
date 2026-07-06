-- AlterTable
ALTER TABLE `ActionItem` ADD COLUMN `createdByUserId` VARCHAR(191) NULL,
    ADD COLUMN `contentAuthorship` ENUM('USER', 'SYSTEM', 'AI') NULL;

-- AddForeignKey
ALTER TABLE `ActionItem` ADD CONSTRAINT `ActionItem_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
