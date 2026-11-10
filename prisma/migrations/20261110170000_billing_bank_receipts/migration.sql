-- Billing V1 S2-c (2026-11-10): maker/checker bank receipts and platform finance grants; new tables plus appended (metadata-only)
-- ENUM values `bank_topup` / `bank_clearing`. No backfill, no money moves. Invariants: drafter <> reviewer and per-state shape (CHECK),
-- one live receipt per bank transaction (UNIQUE NULL-on-reject key), legal transitions, immutable facts and no DELETE (triggers).
-- Rollback: prisma/rollback/20261110_rollback_billing_bank_receipts.sql (refuses while any related row exists).

ALTER TABLE `FundsTransaction` MODIFY `kind` ENUM('topup', 'correction', 'bank_topup') NOT NULL;
ALTER TABLE `FundsJournalEntry` MODIFY `account` ENUM('customer_wallet_available', 'topup_clearing', 'correction_suspense', 'bank_clearing') NOT NULL;
ALTER TABLE `FundsAccountProjection` MODIFY `account` ENUM('customer_wallet_available', 'topup_clearing', 'correction_suspense', 'bank_clearing') NOT NULL;

CREATE TABLE `PlatformFinanceGrant` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `role` ENUM('maker', 'checker') NOT NULL,
    `state` ENUM('active', 'revoked') NOT NULL DEFAULT 'active',
    `activeUserId` VARCHAR(191) COLLATE utf8mb4_bin NULL,
    `grantedByUserId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `evidenceRef` VARCHAR(191) NOT NULL,
    `revokedByUserId` VARCHAR(191) COLLATE utf8mb4_bin NULL,
    `revokedAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `PlatformFinanceGrant_role_activeUserId_key`(`role`, `activeUserId`),
    INDEX `PlatformFinanceGrant_userId_idx`(`userId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `PlatformFinanceGrant_no_self_grant_check` CHECK (`grantedByUserId` <> `userId`),
    CONSTRAINT `PlatformFinanceGrant_state_check` CHECK ((`state` = 'active' AND `activeUserId` = `userId` AND `revokedAt` IS NULL)
      OR (`state` = 'revoked' AND `activeUserId` IS NULL AND `revokedAt` IS NOT NULL AND `revokedByUserId` IS NOT NULL))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BankReceipt` (
    `id` VARCHAR(191) NOT NULL,
    `payerAccountId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `receivingAccountRef` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `bankTxnRef` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `activeBankTxnRef` VARCHAR(191) COLLATE utf8mb4_bin NULL,
    `payerNameDigest` VARCHAR(191) COLLATE utf8mb4_bin NULL,
    `amountFen` BIGINT NOT NULL,
    `currency` VARCHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'CNY',
    `valueDate` DATE NOT NULL,
    `state` ENUM('drafted', 'reviewed', 'posted', 'rejected') NOT NULL DEFAULT 'drafted',
    `draftedByUserId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `reviewedByUserId` VARCHAR(191) COLLATE utf8mb4_bin NULL,
    `reviewedAt` DATETIME(3) NULL,
    `evidenceRef` VARCHAR(191) NOT NULL,
    `reviewEvidenceRef` VARCHAR(191) NULL,
    `fundsTransactionId` VARCHAR(191) COLLATE utf8mb4_bin NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `BankReceipt_receivingAccountRef_activeBankTxnRef_key`(`receivingAccountRef`, `activeBankTxnRef`),
    UNIQUE INDEX `BankReceipt_fundsTransactionId_key`(`fundsTransactionId`),
    INDEX `BankReceipt_payerAccountId_state_idx`(`payerAccountId`, `state`),
    INDEX `BankReceipt_state_createdAt_idx`(`state`, `createdAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `BankReceipt_amount_check` CHECK (`amountFen` > 0 AND `amountFen` <= 9007199254740991 AND `currency` = 'CNY'
      AND `version` >= 1),
    CONSTRAINT `BankReceipt_maker_checker_check` CHECK (`reviewedByUserId` IS NULL OR `reviewedByUserId` <> `draftedByUserId`),
    CONSTRAINT `BankReceipt_state_shape_check` CHECK (
      (`state` = 'drafted' AND `reviewedByUserId` IS NULL AND `reviewedAt` IS NULL AND `fundsTransactionId` IS NULL)
      OR (`state` = 'reviewed' AND `reviewedByUserId` IS NOT NULL AND `reviewedAt` IS NOT NULL AND `fundsTransactionId` IS NULL)
      OR (`state` = 'posted' AND `reviewedByUserId` IS NOT NULL AND `reviewedAt` IS NOT NULL AND `fundsTransactionId` IS NOT NULL)
      OR (`state` = 'rejected' AND `reviewedByUserId` IS NOT NULL AND `reviewedAt` IS NOT NULL AND `fundsTransactionId` IS NULL)),
    CONSTRAINT `BankReceipt_active_key_check` CHECK ((`state` = 'rejected' AND `activeBankTxnRef` IS NULL)
      OR (`state` <> 'rejected' AND `activeBankTxnRef` = `bankTxnRef`))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Only drafted -> reviewed | rejected and reviewed -> posted; the bank facts, the drafter and a set reviewer never change.
CREATE TRIGGER `BankReceipt_guard_update` BEFORE UPDATE ON `BankReceipt`
FOR EACH ROW BEGIN
 IF NOT (BINARY NEW.id <=> BINARY OLD.id) OR NOT (BINARY NEW.payerAccountId <=> BINARY OLD.payerAccountId)
 OR NOT (BINARY NEW.receivingAccountRef <=> BINARY OLD.receivingAccountRef) OR NOT (BINARY NEW.bankTxnRef <=> BINARY OLD.bankTxnRef)
 OR NOT (BINARY NEW.payerNameDigest <=> BINARY OLD.payerNameDigest) OR NOT (NEW.amountFen <=> OLD.amountFen)
 OR NOT (BINARY NEW.currency <=> BINARY OLD.currency) OR NOT (NEW.valueDate <=> OLD.valueDate)
 OR NOT (BINARY NEW.draftedByUserId <=> BINARY OLD.draftedByUserId) OR NOT (BINARY NEW.evidenceRef <=> BINARY OLD.evidenceRef)
 OR NOT (NEW.createdAt <=> OLD.createdAt) OR NEW.version <> OLD.version + 1
 OR (OLD.reviewedByUserId IS NOT NULL AND NOT (BINARY NEW.reviewedByUserId <=> BINARY OLD.reviewedByUserId))
 OR NOT ((OLD.state = 'drafted' AND NEW.state IN ('reviewed', 'rejected')) OR (OLD.state = 'reviewed' AND NEW.state = 'posted')) THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='bank_receipt_immutable'; END IF;
END;
CREATE TRIGGER `BankReceipt_no_delete` BEFORE DELETE ON `BankReceipt`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='bank_receipt_no_delete';
CREATE TRIGGER `PlatformFinanceGrant_no_delete` BEFORE DELETE ON `PlatformFinanceGrant`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='platform_finance_grant_no_delete';
