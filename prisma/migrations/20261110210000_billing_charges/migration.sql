-- Billing V1 S3-b2 (2026-11-10): settled charges. Adds the `charge` kind and credit-normal `charge_revenue` account. Each MODIFY
-- writes the full agreed union (S2-c bank_*, S3-b2 charge*, S3-e credit_*; protocol v3.6) so this and S3-e's migration never drop
-- each other's values in either order (appended values: metadata-only). BillingCharge is immutable, one per reservation; shadow
-- and 0-fen charges have no funds transaction. No FKs.
-- Rollback: prisma/rollback/20261110_rollback_billing_charges.sql (refuses while any charge row or charge posting exists).

ALTER TABLE `FundsTransaction` MODIFY `kind` ENUM('topup', 'correction', 'bank_topup', 'charge', 'credit_draw') NOT NULL;
ALTER TABLE `FundsJournalEntry` MODIFY `account` ENUM('customer_wallet_available', 'topup_clearing', 'correction_suspense', 'bank_clearing', 'charge_revenue', 'credit_receivable') NOT NULL;
ALTER TABLE `FundsAccountProjection` MODIFY `account` ENUM('customer_wallet_available', 'topup_clearing', 'correction_suspense', 'bank_clearing', 'charge_revenue', 'credit_receivable') NOT NULL;

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
    CONSTRAINT `BillingCharge_amount_check` CHECK (`quantity` > 0 AND `chargeFen` >= 0 AND `chargeFen` <= `capFen`
      AND `capFen` <= 9007199254740991 AND CHAR_LENGTH(`dayKey`) = 10 AND LEFT(`dayKey`, 7) = `monthKey`
      AND ((`billingMode` = 'shadow' OR `chargeFen` = 0) = (`fundsTransactionId` IS NULL)) AND CHAR_LENGTH(`priceContentHash`) = 64 AND CHAR_LENGTH(`evidenceRef`) > 0 AND CHAR_LENGTH(`createdBy`) > 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TRIGGER `BillingCharge_no_update` BEFORE UPDATE ON `BillingCharge`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='billing_charge_immutable';
CREATE TRIGGER `BillingCharge_no_delete` BEFORE DELETE ON `BillingCharge`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='billing_charge_immutable';
