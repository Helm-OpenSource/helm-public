-- Billing V1 S3-b2 (2026-11-10): settled charges. Adds the `charge` funds kind and the credit-normal `charge_revenue` account
-- (ENUM values appended, metadata-only) and the immutable BillingCharge row (one per reservation, one per funds transaction).
-- A charge is created only by settling a reservation in its frozen period buckets; a shadow charge has no funds transaction. No FKs.
-- Rollback: prisma/rollback/20261110_rollback_billing_charges.sql (refuses while any charge row or charge posting exists).

ALTER TABLE `FundsTransaction` MODIFY `kind` ENUM('topup', 'correction', 'charge') NOT NULL;
ALTER TABLE `FundsJournalEntry` MODIFY `account` ENUM('customer_wallet_available', 'topup_clearing', 'correction_suspense', 'charge_revenue') NOT NULL;
ALTER TABLE `FundsAccountProjection` MODIFY `account` ENUM('customer_wallet_available', 'topup_clearing', 'correction_suspense', 'charge_revenue') NOT NULL;

CREATE TABLE `BillingCharge` (
    `id` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `payerAccountId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `grantId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `operationRef` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `idempotencyKey` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `billingMode` ENUM('shadow', 'enforce') NOT NULL,
    `fundsTransactionId` VARCHAR(191) COLLATE utf8mb4_bin NULL,
    `priceVersionId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `priceContentHash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `quantity` BIGINT NOT NULL,
    `chargeFen` BIGINT NOT NULL,
    `capFen` BIGINT NOT NULL,
    `dayKey` VARCHAR(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `monthKey` VARCHAR(7) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `evidenceRef` VARCHAR(191) NOT NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `BillingCharge_reservationId_key`(`reservationId`),
    UNIQUE INDEX `BillingCharge_fundsTransactionId_key`(`fundsTransactionId`),
    INDEX `BillingCharge_payerAccountId_createdAt_idx`(`payerAccountId`, `createdAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `BillingCharge_amount_check` CHECK (`quantity` > 0 AND `chargeFen` > 0 AND `chargeFen` <= `capFen`
      AND `capFen` <= 9007199254740991 AND CHAR_LENGTH(`dayKey`) = 10 AND LEFT(`dayKey`, 7) = `monthKey`
      AND ((`billingMode` = 'shadow') = (`fundsTransactionId` IS NULL)) AND CHAR_LENGTH(`priceContentHash`) = 64 AND CHAR_LENGTH(`evidenceRef`) > 0 AND CHAR_LENGTH(`createdBy`) > 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TRIGGER `BillingCharge_no_update` BEFORE UPDATE ON `BillingCharge`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='billing_charge_immutable';
CREATE TRIGGER `BillingCharge_no_delete` BEFORE DELETE ON `BillingCharge`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='billing_charge_immutable';
