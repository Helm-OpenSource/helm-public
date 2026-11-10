-- Billing V1 S3-e (2026-11-10): credit facilities (授信) per payer, default none (= 0 credit); the journal ENUM values for draws
-- are the separate migration 20261110200100_billing_credit_funds_enums. No backfill, no facility, no money moves; the batch
-- issuance for existing payers is S6. Invariants: one active/reduced facility per payer (UNIQUE NULL-unless-active key),
-- 0 <= usedFen <= limitFen (CHECK), proposer <> approver (CHECK), legal transitions and frozen terms (trigger), no DELETE.
-- Rollback: prisma/rollback/20261110_rollback_billing_credit_facilities.sql (refuses while any facility or credit row exists).

CREATE TABLE `CreditFacility` (
    `id` VARCHAR(191) NOT NULL,
    `payerAccountId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `state` ENUM('draft', 'approved', 'active', 'reduced', 'expired', 'revoked') NOT NULL DEFAULT 'draft',
    `limitFen` BIGINT NOT NULL DEFAULT 0,
    `usedFen` BIGINT NOT NULL DEFAULT 0,
    `validUntil` DATETIME(3) NULL,
    `activePayerAccountId` VARCHAR(191) COLLATE utf8mb4_bin NULL,
    `operationKey` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `contentHash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `proposedByUserId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `evidenceRef` VARCHAR(191) NOT NULL,
    `approvedByUserId` VARCHAR(191) COLLATE utf8mb4_bin NULL,
    `approvalRef` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `activatedAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `CreditFacility_payerAccountId_operationKey_key`(`payerAccountId`, `operationKey`),
    UNIQUE INDEX `CreditFacility_activePayerAccountId_key`(`activePayerAccountId`),
    INDEX `CreditFacility_payerAccountId_state_idx`(`payerAccountId`, `state`),
    PRIMARY KEY (`id`),
    CONSTRAINT `CreditFacility_amount_check` CHECK (`usedFen` >= 0 AND `usedFen` <= `limitFen` AND `limitFen` <= 9007199254740991
      AND (`limitFen` > 0 OR `state` IN ('reduced', 'expired', 'revoked')) AND `version` >= 1),
    CONSTRAINT `CreditFacility_maker_checker_check` CHECK (`approvedByUserId` IS NULL OR `approvedByUserId` <> `proposedByUserId`),
    CONSTRAINT `CreditFacility_state_shape_check` CHECK (
      ((`state` IN ('active', 'reduced') AND `activePayerAccountId` = `payerAccountId`)
        OR (`state` NOT IN ('active', 'reduced') AND `activePayerAccountId` IS NULL))
      AND ((`state` = 'draft' AND `approvedByUserId` IS NULL) OR `state` = 'revoked'
        OR (`state` IN ('approved', 'active', 'reduced', 'expired') AND `approvedByUserId` IS NOT NULL))
      AND ((`approvedByUserId` IS NULL) = (`approvedAt` IS NULL))
      AND ((`approvedByUserId` IS NULL) = (`approvalRef` IS NULL))
      AND ((`state` IN ('expired', 'revoked')) = (`closedAt` IS NOT NULL))
      AND (`state` NOT IN ('active', 'reduced') OR `activatedAt` IS NOT NULL)
      AND CHAR_LENGTH(`operationKey`) > 0 AND CHAR_LENGTH(`contentHash`) = 64 AND CHAR_LENGTH(`evidenceRef`) > 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Mirrors the service transitions: draft -> approved -> active -> reduced* -> expired | revoked, revoke from any open state.
-- Terms, proposer and approval never change; limitFen only falls (reduce); usedFen only rises while drawable (repayment is S5).
-- `version` is the configuration version (+1 per lifecycle step); a draw-only update keeps it, so operator CAS is not raced by usage.
CREATE TRIGGER `CreditFacility_guard_update` BEFORE UPDATE ON `CreditFacility`
FOR EACH ROW BEGIN
 IF NOT (BINARY NEW.id <=> BINARY OLD.id) OR NOT (BINARY NEW.payerAccountId <=> BINARY OLD.payerAccountId)
 OR NOT (BINARY NEW.operationKey <=> BINARY OLD.operationKey) OR NOT (BINARY NEW.contentHash <=> BINARY OLD.contentHash)
 OR NOT (BINARY NEW.proposedByUserId <=> BINARY OLD.proposedByUserId) OR NOT (BINARY NEW.evidenceRef <=> BINARY OLD.evidenceRef)
 OR NOT (NEW.validUntil <=> OLD.validUntil) OR NOT (NEW.createdAt <=> OLD.createdAt)
 OR (OLD.approvedByUserId IS NOT NULL AND (NOT (BINARY NEW.approvedByUserId <=> BINARY OLD.approvedByUserId)
   OR NOT (BINARY NEW.approvalRef <=> BINARY OLD.approvalRef) OR NOT (NEW.approvedAt <=> OLD.approvedAt)))
 OR (OLD.activatedAt IS NOT NULL AND NOT (NEW.activatedAt <=> OLD.activatedAt))
 OR OLD.state IN ('expired', 'revoked')
 OR NOT (NEW.version = OLD.version + 1 OR (NEW.version = OLD.version AND NEW.usedFen > OLD.usedFen AND NEW.state = OLD.state
   AND NEW.limitFen = OLD.limitFen AND BINARY NEW.activePayerAccountId <=> BINARY OLD.activePayerAccountId AND NEW.closedAt <=> OLD.closedAt))
 OR NEW.usedFen < OLD.usedFen OR (NEW.usedFen > OLD.usedFen AND NOT (NEW.state = OLD.state AND OLD.state IN ('active', 'reduced')))
 OR (NOT (NEW.limitFen <=> OLD.limitFen) AND NOT (NEW.state = 'reduced' AND OLD.state IN ('active', 'reduced') AND NEW.limitFen < OLD.limitFen))
 OR NOT ((NEW.state = OLD.state AND OLD.state IN ('active', 'reduced')) OR (OLD.state = 'draft' AND NEW.state = 'approved')
   OR (OLD.state = 'approved' AND NEW.state = 'active') OR (OLD.state IN ('active', 'reduced') AND NEW.state IN ('reduced', 'expired'))
   OR NEW.state = 'revoked') THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='credit_facility_guard'; END IF;
END;
CREATE TRIGGER `CreditFacility_no_delete` BEFORE DELETE ON `CreditFacility`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='credit_facility_no_delete';
