-- Billing V1 emergency rollback (2026-11-12, owner ruling): one platform finance person may switch a payer enforce -> shadow at once;
-- a different person must confirm within 24 hours. New table only; no existing table is altered and no money moves. Invariants:
-- confirmer <> executor and per-state shape (CHECK), one record per (evidence, workspace) (UNIQUE), pending_review -> confirmed only,
-- frozen facts, no DELETE (triggers). Overdue records are reported, never auto-reverted.
-- Rollback: prisma/rollback/20261112_rollback_billing_platform_emergency_rollbacks.sql (refuses while any row exists).

CREATE TABLE `PlatformEmergencyRollback` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `payerAccountId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `fromMode` ENUM('enforce') NOT NULL,
    `toMode` ENUM('shadow') NOT NULL,
    `state` ENUM('pending_review', 'confirmed') NOT NULL DEFAULT 'pending_review',
    `executedByUserId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `evidenceRef` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `executedAt` DATETIME(3) NOT NULL,
    `reviewDueAt` DATETIME(3) NOT NULL,
    `confirmedByUserId` VARCHAR(191) COLLATE utf8mb4_bin NULL,
    `confirmEvidenceRef` VARCHAR(191) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `PlatformEmergencyRollback_evidenceRef_workspaceId_key`(`evidenceRef`, `workspaceId`),
    INDEX `PlatformEmergencyRollback_state_reviewDueAt_idx`(`state`, `reviewDueAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `PlatformEmergencyRollback_due_check` CHECK (`reviewDueAt` = `executedAt` + INTERVAL 24 HOUR AND `version` >= 1),
    CONSTRAINT `PlatformEmergencyRollback_second_person_check` CHECK (`confirmedByUserId` IS NULL OR `confirmedByUserId` <> `executedByUserId`),
    CONSTRAINT `PlatformEmergencyRollback_state_shape_check` CHECK (
      (`state` = 'pending_review' AND `confirmedByUserId` IS NULL AND `confirmedAt` IS NULL AND `confirmEvidenceRef` IS NULL)
      OR (`state` = 'confirmed' AND `confirmedByUserId` IS NOT NULL AND `confirmedAt` IS NOT NULL AND `confirmEvidenceRef` IS NOT NULL))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TRIGGER `PlatformEmergencyRollback_guard_update` BEFORE UPDATE ON `PlatformEmergencyRollback`
FOR EACH ROW BEGIN
 IF NOT (BINARY NEW.id <=> BINARY OLD.id) OR NOT (BINARY NEW.workspaceId <=> BINARY OLD.workspaceId)
 OR NOT (BINARY NEW.payerAccountId <=> BINARY OLD.payerAccountId) OR NOT (NEW.fromMode <=> OLD.fromMode)
 OR NOT (NEW.toMode <=> OLD.toMode) OR NOT (BINARY NEW.executedByUserId <=> BINARY OLD.executedByUserId)
 OR NOT (BINARY NEW.evidenceRef <=> BINARY OLD.evidenceRef) OR NOT (NEW.executedAt <=> OLD.executedAt)
 OR NOT (NEW.reviewDueAt <=> OLD.reviewDueAt) OR NOT (NEW.createdAt <=> OLD.createdAt) OR NEW.version <> OLD.version + 1
 OR OLD.state <> 'pending_review' OR NEW.state <> 'confirmed' THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='platform_emergency_rollback_immutable'; END IF;
END;
CREATE TRIGGER `PlatformEmergencyRollback_no_delete` BEFORE DELETE ON `PlatformEmergencyRollback`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='platform_emergency_rollback_no_delete';
