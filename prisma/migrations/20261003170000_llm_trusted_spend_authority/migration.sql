-- Empty, protected registry: no bootstrap keys, approvals or issuer endpoint.
CREATE TABLE `LLMSpendIssuerGrant` (
 `id` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
 `workspaceId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
 `issuerUserId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
 `publicKeyPem` TEXT NOT NULL, `allowedKindsJson` TEXT NOT NULL,
 `sourceReceiptHash` VARCHAR(71) COLLATE utf8mb4_bin NOT NULL,
 `contentHash` VARCHAR(71) COLLATE utf8mb4_bin NOT NULL,
 `validFrom` DATETIME(3) NOT NULL, `validUntil` DATETIME(3) NOT NULL,
 `revokedAt` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX `LLMSpendIssuerGrant_workspaceId_issuerUserId_idx` (`workspaceId`,`issuerUserId`),
 CONSTRAINT `LLMSpendIssuerGrant_validity` CHECK (`validFrom` < `validUntil`),
 CONSTRAINT `LLMSpendIssuerGrant_kinds_json` CHECK (JSON_VALID(`allowedKindsJson`))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
CREATE TABLE `LLMSpendAuthorityRecord` (
 `id` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
 `workspaceId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
 `ref` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
 `kind` VARCHAR(16) COLLATE utf8mb4_bin NOT NULL,
 `version` VARCHAR(64) COLLATE utf8mb4_bin NOT NULL,
 `issuerGrantId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
 `envelopeJson` LONGTEXT NOT NULL, `signatureBase64` VARCHAR(88) COLLATE utf8mb4_bin NOT NULL,
 `contentHash` VARCHAR(71) COLLATE utf8mb4_bin NOT NULL, `revokedAt` DATETIME(3) NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE INDEX `LLMSpendAuthorityRecord_workspaceId_ref_key` (`workspaceId`,`ref`),
 INDEX `LLMSpendAuthorityRecord_issuerGrantId_idx` (`issuerGrantId`),
 CONSTRAINT `LLMSpendAuthorityRecord_json` CHECK (JSON_VALID(`envelopeJson`)),
 CONSTRAINT `LLMSpendAuthorityRecord_kind` CHECK (`kind` IN ('period','price','fx','budget'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;

CREATE TRIGGER `LLMSpendIssuerGrant_immutable` BEFORE UPDATE ON `LLMSpendIssuerGrant`
FOR EACH ROW BEGIN
 IF NOT (BINARY NEW.id <=> BINARY OLD.id) OR NOT (BINARY NEW.workspaceId <=> BINARY OLD.workspaceId)
 OR NOT (BINARY NEW.issuerUserId <=> BINARY OLD.issuerUserId) OR NOT (BINARY NEW.publicKeyPem <=> BINARY OLD.publicKeyPem)
 OR NOT (BINARY NEW.allowedKindsJson <=> BINARY OLD.allowedKindsJson) OR NOT (BINARY NEW.sourceReceiptHash <=> BINARY OLD.sourceReceiptHash)
 OR NOT (BINARY NEW.contentHash <=> BINARY OLD.contentHash) OR NOT (NEW.validFrom <=> OLD.validFrom)
 OR NOT (NEW.validUntil <=> OLD.validUntil) OR NOT (NEW.createdAt <=> OLD.createdAt)
 OR (OLD.revokedAt IS NOT NULL AND NOT (NEW.revokedAt <=> OLD.revokedAt)) THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='spend_issuer_immutable'; END IF;
END;
CREATE TRIGGER `LLMSpendAuthorityRecord_immutable` BEFORE UPDATE ON `LLMSpendAuthorityRecord`
FOR EACH ROW BEGIN
 IF NOT (BINARY NEW.id <=> BINARY OLD.id) OR NOT (BINARY NEW.workspaceId <=> BINARY OLD.workspaceId)
 OR NOT (BINARY NEW.ref <=> BINARY OLD.ref) OR NOT (BINARY NEW.kind <=> BINARY OLD.kind)
 OR NOT (BINARY NEW.version <=> BINARY OLD.version) OR NOT (BINARY NEW.issuerGrantId <=> BINARY OLD.issuerGrantId)
 OR NOT (BINARY NEW.envelopeJson <=> BINARY OLD.envelopeJson) OR NOT (BINARY NEW.signatureBase64 <=> BINARY OLD.signatureBase64)
 OR NOT (BINARY NEW.contentHash <=> BINARY OLD.contentHash) OR NOT (NEW.createdAt <=> OLD.createdAt)
 OR (OLD.revokedAt IS NOT NULL AND NOT (NEW.revokedAt <=> OLD.revokedAt)) THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='spend_authority_immutable'; END IF;
END;
CREATE TRIGGER `LLMSpendIssuerGrant_no_delete` BEFORE DELETE ON `LLMSpendIssuerGrant`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='spend_issuer_no_delete';
CREATE TRIGGER `LLMSpendAuthorityRecord_no_delete` BEFORE DELETE ON `LLMSpendAuthorityRecord`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='spend_authority_no_delete';
