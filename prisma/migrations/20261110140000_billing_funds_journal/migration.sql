-- Billing V1 S2-a (2026-11-10): append-only funds journal, rebuildable projection and durable billing outbox. New tables only;
-- nothing is backfilled and no money moves. Database invariants: byte-exact UNIQUE (payerAccountId, operationKey), UNIQUE
-- reversalOfId, positive bounded fen, one line per account per transaction, non-negative wallet projection (CHECK), and
-- triggers rejecting UPDATE/DELETE of transactions and entries. Balancing is validated in the posting transaction and
-- re-verified by recomputeFundsProjection (a row trigger cannot see the whole transaction). No FKs (relationMode "prisma").
-- Rollback: prisma/rollback/20261110_rollback_billing_funds_journal.sql (refuses while any row exists).

CREATE TABLE `FundsTransaction` (
    `id` VARCHAR(191) NOT NULL,
    `payerAccountId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `kind` ENUM('topup', 'correction') NOT NULL,
    `operationKey` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `contentHash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `reversalOfId` VARCHAR(191) COLLATE utf8mb4_bin NULL,
    `currency` VARCHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'CNY',
    `evidenceRef` VARCHAR(191) NOT NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `FundsTransaction_reversalOfId_key`(`reversalOfId`),
    UNIQUE INDEX `FundsTransaction_payerAccountId_operationKey_key`(`payerAccountId`, `operationKey`),
    PRIMARY KEY (`id`),
    CONSTRAINT `FundsTransaction_currency_check` CHECK (`currency` = 'CNY'),
    CONSTRAINT `FundsTransaction_shape_check` CHECK (CHAR_LENGTH(`operationKey`) > 0 AND CHAR_LENGTH(`contentHash`) = 64
      AND CHAR_LENGTH(`evidenceRef`) > 0 AND CHAR_LENGTH(`createdBy`) > 0
      AND (`reversalOfId` IS NULL OR (`kind` = 'correction' AND `reversalOfId` <> `id`)))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `FundsJournalEntry` (
    `id` VARCHAR(191) NOT NULL,
    `transactionId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `lineNo` INTEGER NOT NULL,
    `payerAccountId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `account` ENUM('customer_wallet_available', 'topup_clearing', 'correction_suspense') NOT NULL,
    `direction` ENUM('debit', 'credit') NOT NULL,
    `amountFen` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `FundsJournalEntry_payerAccountId_account_idx`(`payerAccountId`, `account`),
    UNIQUE INDEX `FundsJournalEntry_transactionId_lineNo_key`(`transactionId`, `lineNo`),
    UNIQUE INDEX `FundsJournalEntry_transactionId_account_key`(`transactionId`, `account`),
    PRIMARY KEY (`id`),
    CONSTRAINT `FundsJournalEntry_amount_check` CHECK (`amountFen` > 0 AND `amountFen` <= 9007199254740991 AND `lineNo` >= 1)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `FundsAccountProjection` (
    `payerAccountId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `account` ENUM('customer_wallet_available', 'topup_clearing', 'correction_suspense') NOT NULL,
    `balanceFen` BIGINT NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`payerAccountId`, `account`),
    CONSTRAINT `FundsAccountProjection_wallet_nonnegative_check` CHECK (`account` <> 'customer_wallet_available' OR `balanceFen` >= 0),
    CONSTRAINT `FundsAccountProjection_version_check` CHECK (`version` >= 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BillingOutbox` (
    `id` VARCHAR(191) NOT NULL,
    `aggregateType` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `aggregateId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `eventType` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `payload` TEXT NOT NULL,
    `payloadHash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deliveredAt` DATETIME(3) NULL,
    INDEX `BillingOutbox_deliveredAt_createdAt_idx`(`deliveredAt`, `createdAt`),
    UNIQUE INDEX `BillingOutbox_aggregateType_aggregateId_eventType_key`(`aggregateType`, `aggregateId`, `eventType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TRIGGER `FundsTransaction_no_update` BEFORE UPDATE ON `FundsTransaction`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='funds_transaction_immutable';
CREATE TRIGGER `FundsTransaction_no_delete` BEFORE DELETE ON `FundsTransaction`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='funds_transaction_immutable';
CREATE TRIGGER `FundsJournalEntry_no_update` BEFORE UPDATE ON `FundsJournalEntry`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='funds_entry_immutable';
CREATE TRIGGER `FundsJournalEntry_no_delete` BEFORE DELETE ON `FundsJournalEntry`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='funds_entry_immutable';
