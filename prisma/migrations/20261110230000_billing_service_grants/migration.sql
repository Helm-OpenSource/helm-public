-- Billing V1 S3-b3 (2026-11-10): service identities for the internal billing routes, modeled on LLMSpendIssuerGrant. Empty,
-- protected registry: no bootstrap grant, no issuance API. The row holds only the caller's Ed25519 public key (and its SPKI
-- sha256 fingerprint); Core never holds a shared secret (protocol v3.7). A grant is trusted only while separately governed
-- config pins its `contentHash`; only one-way revocation is mutable, no delete.
-- `resolve-unknown` (reconciliation channel) is never combined with business scopes. Nonces are bounded replay state.
-- Rollback: prisma/rollback/20261110_rollback_billing_service_grants.sql (refuses while any grant or nonce row exists).

CREATE TABLE `BillingServiceGrant` (
    `id` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `issuerRef` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `scopesJson` VARCHAR(255) COLLATE utf8mb4_bin NOT NULL,
    `publicKeyPem` TEXT NOT NULL,
    `keyFingerprint` VARCHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `approvalRef` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `createdBy` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `contentHash` VARCHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `validFrom` DATETIME(3) NOT NULL,
    `validUntil` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `revokedBy` VARCHAR(191) COLLATE utf8mb4_bin NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE INDEX `BillingServiceGrant_keyFingerprint_key`(`keyFingerprint`),
    CONSTRAINT `BillingServiceGrant_validity` CHECK (`validFrom` < `validUntil`),
    CONSTRAINT `BillingServiceGrant_hash` CHECK (`contentHash` REGEXP '^sha256:[a-f0-9]{64}$'
      AND `keyFingerprint` REGEXP '^sha256:[a-f0-9]{64}$'),
    CONSTRAINT `BillingServiceGrant_issuer` CHECK (`issuerRef` REGEXP '^[a-z0-9][a-z0-9._-]{0,63}$'),
    CONSTRAINT `BillingServiceGrant_public_key` CHECK (`publicKeyPem` LIKE '-----BEGIN PUBLIC KEY-----%'
      AND `publicKeyPem` NOT LIKE '%PRIVATE KEY%'),
    CONSTRAINT `BillingServiceGrant_revocation` CHECK ((`revokedAt` IS NULL) = (`revokedBy` IS NULL)),
    CONSTRAINT `BillingServiceGrant_scopes` CHECK (JSON_VALID(`scopesJson`) AND JSON_TYPE(CAST(`scopesJson` AS JSON)) = 'ARRAY'
      AND JSON_LENGTH(CAST(`scopesJson` AS JSON)) > 0 AND (NOT JSON_CONTAINS(CAST(`scopesJson` AS JSON), '"resolve-unknown"')
      OR `scopesJson` = '["resolve-unknown"]'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BillingServiceNonce` (
    `grantId` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `nonce` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`grantId`, `nonce`),
    INDEX `BillingServiceNonce_expiresAt_idx`(`expiresAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TRIGGER `BillingServiceGrant_no_delete` BEFORE DELETE ON `BillingServiceGrant`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='billing_service_grant_retained';
CREATE TRIGGER `BillingServiceGrant_immutable` BEFORE UPDATE ON `BillingServiceGrant`
FOR EACH ROW BEGIN
 IF NOT (BINARY NEW.id <=> BINARY OLD.id) OR NOT (BINARY NEW.issuerRef <=> BINARY OLD.issuerRef)
 OR NOT (BINARY NEW.scopesJson <=> BINARY OLD.scopesJson) OR NOT (BINARY NEW.publicKeyPem <=> BINARY OLD.publicKeyPem)
 OR NOT (BINARY NEW.keyFingerprint <=> BINARY OLD.keyFingerprint)
 OR NOT (BINARY NEW.approvalRef <=> BINARY OLD.approvalRef) OR NOT (BINARY NEW.createdBy <=> BINARY OLD.createdBy)
 OR NOT (BINARY NEW.contentHash <=> BINARY OLD.contentHash) OR NOT (NEW.validFrom <=> OLD.validFrom)
 OR NOT (NEW.validUntil <=> OLD.validUntil) OR NOT (NEW.createdAt <=> OLD.createdAt)
 OR (OLD.revokedAt IS NOT NULL AND (NOT (NEW.revokedAt <=> OLD.revokedAt) OR NOT (BINARY NEW.revokedBy <=> BINARY OLD.revokedBy))) THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='billing_service_grant_immutable'; END IF;
END;
