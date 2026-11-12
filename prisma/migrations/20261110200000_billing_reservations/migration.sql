-- Billing V1 S3-b1 (2026-11-10): per grant x mode x Asia/Shanghai day/month budget buckets and spend reservations. New tables
-- only; no money moves. Buckets count settled + reserved (held/unknown) fen (shadow in their own rows) and are written only
-- under the PayerAccount lock with a version CAS. A reservation freezes its admission snapshot (grant/price version, price hash, charge, database time,
-- period keys); one per (payer, idempotencyKey) and (payer, operationRef); triggers allow only held->unknown, held|unknown->settled|released, no delete. No FKs.
-- Rollback: prisma/rollback/20261110_rollback_billing_reservations.sql (refuses while any row exists).

CREATE TABLE `BudgetBucket` (
    `grantId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `billingMode` ENUM('shadow', 'enforce') NOT NULL,
    `periodKind` ENUM('day', 'month') NOT NULL,
    `periodKey` VARCHAR(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `payerAccountId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `settledFen` BIGINT NOT NULL DEFAULT 0,
    `reservedFen` BIGINT NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`grantId`, `billingMode`, `periodKind`, `periodKey`),
    CONSTRAINT `BudgetBucket_amount_check` CHECK (`settledFen` >= 0 AND `reservedFen` >= 0 AND `version` >= 0
      AND `settledFen` + `reservedFen` <= 9007199254740991
      AND CHAR_LENGTH(`periodKey`) = IF(`periodKind` = 'day', 10, 7))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BillingReservation` (
    `id` VARCHAR(191) NOT NULL,
    `payerAccountId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `idempotencyKey` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `operationRef` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `contentHash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `grantId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `grantVersion` INTEGER NOT NULL,
    `productId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `priceVersionId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `priceContentHash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `billingEventRef` VARCHAR(191) NOT NULL,
    `meterUnit` VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `quantity` BIGINT NOT NULL,
    `chargeFen` BIGINT NOT NULL,
    `billingMode` ENUM('shadow', 'enforce') NOT NULL,
    `reservedAt` DATETIME(3) NOT NULL,
    `dayKey` VARCHAR(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `monthKey` VARCHAR(7) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `state` ENUM('held', 'unknown', 'settled', 'released') NOT NULL DEFAULT 'held',
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdBy` VARCHAR(191) NOT NULL,
    `unknownKey` VARCHAR(191) COLLATE utf8mb4_bin NULL,
    `unknownEvidenceRef` VARCHAR(191) NULL,
    `unknownAt` DATETIME(3) NULL,
    `resolutionKey` VARCHAR(191) COLLATE utf8mb4_bin NULL,
    `releaseReason` ENUM('not_executed', 'failed', 'partial_unusable', 'unknown_released') NULL,
    `resolutionEvidenceRef` VARCHAR(191) NULL,
    `resolvedBy` VARCHAR(191) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `BillingReservation_payerAccountId_idempotencyKey_key`(`payerAccountId`, `idempotencyKey`),
    UNIQUE INDEX `BillingReservation_payerAccountId_operationRef_key`(`payerAccountId`, `operationRef`),
    UNIQUE INDEX `BillingReservation_payerAccountId_unknownKey_key`(`payerAccountId`, `unknownKey`),
    UNIQUE INDEX `BillingReservation_payerAccountId_resolutionKey_key`(`payerAccountId`, `resolutionKey`),
    INDEX `BillingReservation_payerAccountId_state_idx`(`payerAccountId`, `state`),
    PRIMARY KEY (`id`),
    CONSTRAINT `BillingReservation_amount_check` CHECK (`quantity` > 0 AND `chargeFen` > 0 AND `chargeFen` <= 9007199254740991
      AND `grantVersion` >= 1 AND `version` >= 1 AND CHAR_LENGTH(`dayKey`) = 10 AND CHAR_LENGTH(`monthKey`) = 7
      AND LEFT(`dayKey`, 7) = `monthKey`),
    CONSTRAINT `BillingReservation_shape_check` CHECK (CHAR_LENGTH(`idempotencyKey`) > 0 AND CHAR_LENGTH(`operationRef`) > 0
      AND CHAR_LENGTH(`contentHash`) = 64
      AND CHAR_LENGTH(`priceContentHash`) = 64 AND CHAR_LENGTH(`createdBy`) > 0
      AND ((`unknownEvidenceRef` IS NULL) = (`unknownAt` IS NULL)) AND ((`unknownKey` IS NULL) = (`unknownAt` IS NULL)) AND (`state` <> 'unknown' OR `unknownAt` IS NOT NULL)
      AND ((`state` IN ('settled', 'released')) = (`resolvedAt` IS NOT NULL AND `resolutionEvidenceRef` IS NOT NULL
        AND `resolvedBy` IS NOT NULL AND `resolutionKey` IS NOT NULL))
      AND ((`state` = 'released') = (`releaseReason` IS NOT NULL)))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TRIGGER `BudgetBucket_no_delete` BEFORE DELETE ON `BudgetBucket`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='budget_bucket_retained';
CREATE TRIGGER `BudgetBucket_guard_update` BEFORE UPDATE ON `BudgetBucket`
FOR EACH ROW BEGIN
 IF NOT (BINARY NEW.grantId <=> BINARY OLD.grantId) OR NOT (NEW.billingMode <=> OLD.billingMode) OR NOT (NEW.periodKind <=> OLD.periodKind)
 OR NOT (BINARY NEW.periodKey <=> BINARY OLD.periodKey) OR NOT (BINARY NEW.payerAccountId <=> BINARY OLD.payerAccountId)
 OR NEW.version <> OLD.version + 1 THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='budget_bucket_identity_immutable'; END IF;
END;
CREATE TRIGGER `BillingReservation_no_delete` BEFORE DELETE ON `BillingReservation`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='billing_reservation_retained';
-- The admission snapshot is frozen; settled/released are terminal; the unknown marker, once set, never changes.
CREATE TRIGGER `BillingReservation_guard_update` BEFORE UPDATE ON `BillingReservation`
FOR EACH ROW BEGIN
 IF NOT (BINARY NEW.id <=> BINARY OLD.id) OR NOT (BINARY NEW.payerAccountId <=> BINARY OLD.payerAccountId)
 OR NOT (BINARY NEW.idempotencyKey <=> BINARY OLD.idempotencyKey) OR NOT (BINARY NEW.operationRef <=> BINARY OLD.operationRef)
 OR NOT (BINARY NEW.contentHash <=> BINARY OLD.contentHash)
 OR NOT (BINARY NEW.grantId <=> BINARY OLD.grantId) OR NOT (NEW.grantVersion <=> OLD.grantVersion)
 OR NOT (BINARY NEW.productId <=> BINARY OLD.productId) OR NOT (BINARY NEW.priceVersionId <=> BINARY OLD.priceVersionId)
 OR NOT (BINARY NEW.priceContentHash <=> BINARY OLD.priceContentHash) OR NOT (BINARY NEW.billingEventRef <=> BINARY OLD.billingEventRef)
 OR NOT (BINARY NEW.meterUnit <=> BINARY OLD.meterUnit) OR NOT (NEW.quantity <=> OLD.quantity) OR NOT (NEW.chargeFen <=> OLD.chargeFen)
 OR NOT (NEW.billingMode <=> OLD.billingMode) OR NOT (NEW.reservedAt <=> OLD.reservedAt)
 OR NOT (BINARY NEW.dayKey <=> BINARY OLD.dayKey) OR NOT (BINARY NEW.monthKey <=> BINARY OLD.monthKey)
 OR NOT (BINARY NEW.createdBy <=> BINARY OLD.createdBy) OR NOT (NEW.createdAt <=> OLD.createdAt)
 OR (OLD.unknownAt IS NOT NULL AND (NOT (BINARY NEW.unknownEvidenceRef <=> BINARY OLD.unknownEvidenceRef)
   OR NOT (BINARY NEW.unknownKey <=> BINARY OLD.unknownKey)
   OR NOT (NEW.unknownAt <=> OLD.unknownAt)))
 OR OLD.state IN ('settled', 'released') OR NEW.version <> OLD.version + 1
 OR NOT ((NEW.state = 'unknown' AND OLD.state = 'held') OR (NEW.state IN ('settled', 'released') AND OLD.state IN ('held', 'unknown')))
 OR (NEW.state = 'released' AND ((OLD.state = 'unknown') <> (NEW.releaseReason <=> 'unknown_released'))) THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='billing_reservation_snapshot_immutable'; END IF;
END;
