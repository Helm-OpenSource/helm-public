-- Billing V1 S3-a (2026-11-10): product catalog, immutable price versions and default-off spend grants. New tables only; no
-- real price, reservation or charge. Triggers make products/price versions append-only and fix each grant's binding (see below).
-- No FKs (relationMode "prisma"). Rollback: prisma/rollback/20261110_rollback_billing_price_grants.sql (refuses while rows exist).

CREATE TABLE `BillingProduct` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `BillingProduct_code_key`(`code`),
    PRIMARY KEY (`id`),
    CONSTRAINT `BillingProduct_shape_check` CHECK (CHAR_LENGTH(`code`) > 0 AND CHAR_LENGTH(`createdBy`) > 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BillingPriceVersion` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `version` INTEGER NOT NULL,
    `billingEventRef` VARCHAR(191) NOT NULL,
    `meterUnit` VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `acceptanceRef` VARCHAR(191) NOT NULL,
    `scopeKind` ENUM('workspace', 'consumer_principal') NOT NULL,
    `unitPriceFenNumerator` BIGINT NOT NULL,
    `unitPriceDenominator` BIGINT NOT NULL,
    `rounding` ENUM('half_up') NOT NULL,
    `currency` VARCHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'CNY',
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveUntil` DATETIME(3) NULL,
    `approvalRef` VARCHAR(191) NOT NULL,
    `contentHash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `BillingPriceVersion_productId_version_key`(`productId`, `version`),
    PRIMARY KEY (`id`),
    CONSTRAINT `BillingPriceVersion_shape_check` CHECK (`version` >= 1 AND `currency` = 'CNY'
      AND `unitPriceFenNumerator` >= 0 AND `unitPriceFenNumerator` <= 9007199254740991
      AND `unitPriceDenominator` >= 1 AND `unitPriceDenominator` <= 9007199254740991
      AND (`effectiveUntil` IS NULL OR `effectiveUntil` > `effectiveFrom`) AND CHAR_LENGTH(`contentHash`) = 64
      AND CHAR_LENGTH(`billingEventRef`) > 0 AND CHAR_LENGTH(`meterUnit`) > 0 AND CHAR_LENGTH(`acceptanceRef`) > 0
      AND CHAR_LENGTH(`approvalRef`) > 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SpendGrant` (
    `id` VARCHAR(191) NOT NULL,
    `payerAccountId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `productId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `priceVersionId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `state` ENUM('disabled', 'active', 'paused', 'revoked', 'expired') NOT NULL DEFAULT 'disabled',
    `triggerKind` ENUM('user_initiated', 'scheduled') NOT NULL DEFAULT 'user_initiated',
    `perChargeLimitFen` BIGINT NOT NULL DEFAULT 0,
    `dailyLimitFen` BIGINT NOT NULL DEFAULT 0,
    `monthlyLimitFen` BIGINT NOT NULL DEFAULT 0,
    `validFrom` DATETIME(3) NOT NULL,
    `validUntil` DATETIME(3) NOT NULL,
    `operationKey` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `contentHash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdByUserId` VARCHAR(191) NOT NULL,
    `evidenceRef` VARCHAR(191) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `revokedByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `SpendGrant_payerAccountId_operationKey_key`(`payerAccountId`, `operationKey`),
    INDEX `SpendGrant_payerAccountId_state_idx`(`payerAccountId`, `state`),
    PRIMARY KEY (`id`),
    CONSTRAINT `SpendGrant_limits_check` CHECK (`perChargeLimitFen` >= 0 AND `perChargeLimitFen` <= `dailyLimitFen`
      AND `dailyLimitFen` <= `monthlyLimitFen` AND `monthlyLimitFen` <= 9007199254740991
      AND (`state` <> 'active' OR `perChargeLimitFen` > 0)),
    CONSTRAINT `SpendGrant_shape_check` CHECK (`version` >= 1 AND `validUntil` > `validFrom` AND CHAR_LENGTH(`contentHash`) = 64
      AND CHAR_LENGTH(`operationKey`) > 0 AND CHAR_LENGTH(`evidenceRef`) > 0
      AND ((`state` = 'revoked') = (`revokedAt` IS NOT NULL AND `revokedByUserId` IS NOT NULL)))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TRIGGER `BillingProduct_no_update` BEFORE UPDATE ON `BillingProduct`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='billing_product_immutable';
CREATE TRIGGER `BillingProduct_no_delete` BEFORE DELETE ON `BillingProduct`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='billing_product_immutable';
CREATE TRIGGER `BillingPriceVersion_no_update` BEFORE UPDATE ON `BillingPriceVersion`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='billing_price_version_immutable';
CREATE TRIGGER `BillingPriceVersion_no_delete` BEFORE DELETE ON `BillingPriceVersion`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='billing_price_version_immutable';
CREATE TRIGGER `SpendGrant_no_delete` BEFORE DELETE ON `SpendGrant`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='spend_grant_retained';
-- A grant binds one price version for life (an upgrade needs a new grant); state moves mirror the service TRANSITIONS.
CREATE TRIGGER `SpendGrant_guard_update` BEFORE UPDATE ON `SpendGrant`
FOR EACH ROW BEGIN
 IF NOT (BINARY NEW.id <=> BINARY OLD.id) OR NOT (BINARY NEW.payerAccountId <=> BINARY OLD.payerAccountId)
 OR NOT (BINARY NEW.productId <=> BINARY OLD.productId) OR NOT (BINARY NEW.priceVersionId <=> BINARY OLD.priceVersionId)
 OR NOT (BINARY NEW.triggerKind <=> BINARY OLD.triggerKind) OR NOT (BINARY NEW.operationKey <=> BINARY OLD.operationKey)
 OR NOT (BINARY NEW.contentHash <=> BINARY OLD.contentHash) OR NOT (NEW.validFrom <=> OLD.validFrom) OR NOT (NEW.validUntil <=> OLD.validUntil)
 OR NOT (BINARY NEW.createdByUserId <=> BINARY OLD.createdByUserId) OR NOT (NEW.createdAt <=> OLD.createdAt)
 OR NOT (BINARY NEW.evidenceRef <=> BINARY OLD.evidenceRef) OR OLD.state IN ('revoked', 'expired') OR NEW.version <> OLD.version + 1
 OR NOT (NEW.state = OLD.state OR NEW.state = 'revoked' OR (NEW.state = 'active' AND OLD.state IN ('disabled', 'paused'))
   OR (NEW.state = 'paused' AND OLD.state = 'active')) THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='spend_grant_binding_immutable'; END IF;
END;
