-- CreateTable
CREATE TABLE `TrialApplication` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `organizationName` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `useCase` LONGTEXT NOT NULL,
    `status` ENUM('PENDING', 'CONTACTED', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `submittedLocale` VARCHAR(191) NULL,
    `decisionReason` LONGTEXT NULL,
    `decidedByUserId` VARCHAR(191) NULL,
    `decidedAt` DATETIME(3) NULL,
    `notifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TrialApplication_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `TrialApplication_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
