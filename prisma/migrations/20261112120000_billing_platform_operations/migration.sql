-- Billing V1 E1a (2026-11-12): maker/checker platform billing operations (onboard a workspace payer, change billingMode). New
-- table only; no existing table is altered, nothing is backfilled and no money moves. `kind` is a closed set in the service (CHECK
-- keeps it a plain token) so later slices add kinds without DDL. Invariants: drafter <> reviewer and per-state shape (CHECK), one row
-- per operation key (UNIQUE), drafted -> applied | rejected only, frozen request and drafter, no DELETE (triggers).
-- Rollback: prisma/rollback/20261112_rollback_billing_platform_operations.sql (refuses while any row exists).

CREATE TABLE `PlatformBillingOperation` (
    `id` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `operationKey` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `workspaceId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `payerAccountId` VARCHAR(191) COLLATE utf8mb4_bin NULL,
    `request` JSON NOT NULL,
    `contentHash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `state` ENUM('drafted', 'applied', 'rejected') NOT NULL DEFAULT 'drafted',
    `draftedByUserId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `evidenceRef` VARCHAR(191) NOT NULL,
    `reviewedByUserId` VARCHAR(191) COLLATE utf8mb4_bin NULL,
    `reviewEvidenceRef` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `resultRef` VARCHAR(191) COLLATE utf8mb4_bin NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `PlatformBillingOperation_operationKey_key`(`operationKey`),
    INDEX `PlatformBillingOperation_workspaceId_kind_idx`(`workspaceId`, `kind`),
    INDEX `PlatformBillingOperation_state_createdAt_idx`(`state`, `createdAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `PlatformBillingOperation_shape_check` CHECK (`kind` REGEXP '^[a-z][a-z_]{0,31}$' AND `version` >= 1
      AND CHAR_LENGTH(`operationKey`) > 0 AND CHAR_LENGTH(`workspaceId`) > 0 AND CHAR_LENGTH(`evidenceRef`) > 0),
    CONSTRAINT `PlatformBillingOperation_maker_checker_check` CHECK (`reviewedByUserId` IS NULL OR `reviewedByUserId` <> `draftedByUserId`),
    CONSTRAINT `PlatformBillingOperation_state_shape_check` CHECK (
      (`state` = 'drafted' AND `reviewedByUserId` IS NULL AND `reviewedAt` IS NULL AND `reviewEvidenceRef` IS NULL AND `resultRef` IS NULL)
      OR (`state` = 'applied' AND `reviewedByUserId` IS NOT NULL AND `reviewedAt` IS NOT NULL AND `reviewEvidenceRef` IS NOT NULL)
      OR (`state` = 'rejected' AND `reviewedByUserId` IS NOT NULL AND `reviewedAt` IS NOT NULL AND `reviewEvidenceRef` IS NOT NULL
        AND `resultRef` IS NULL))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TRIGGER `PlatformBillingOperation_guard_update` BEFORE UPDATE ON `PlatformBillingOperation`
FOR EACH ROW BEGIN
 IF NOT (BINARY NEW.id <=> BINARY OLD.id) OR NOT (BINARY NEW.kind <=> BINARY OLD.kind)
 OR NOT (BINARY NEW.operationKey <=> BINARY OLD.operationKey) OR NOT (BINARY NEW.workspaceId <=> BINARY OLD.workspaceId)
 OR NOT (BINARY NEW.payerAccountId <=> BINARY OLD.payerAccountId) OR NOT (NEW.request <=> OLD.request)
 OR NOT (BINARY NEW.contentHash <=> BINARY OLD.contentHash) OR NOT (BINARY NEW.draftedByUserId <=> BINARY OLD.draftedByUserId)
 OR NOT (BINARY NEW.evidenceRef <=> BINARY OLD.evidenceRef) OR NOT (NEW.createdAt <=> OLD.createdAt)
 OR NEW.version <> OLD.version + 1 OR OLD.state <> 'drafted' OR NEW.state NOT IN ('applied', 'rejected') THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='platform_billing_operation_immutable'; END IF;
END;
CREATE TRIGGER `PlatformBillingOperation_no_delete` BEFORE DELETE ON `PlatformBillingOperation`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='platform_billing_operation_no_delete';
