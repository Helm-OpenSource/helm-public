-- Empty registry. No production roots, keys or approved invoices are installed.
CREATE TABLE `LLMUsageAttestorGrant` (
 `id` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
 `workspaceId` VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
 `envelopeJson` TEXT NOT NULL, `contentHash` VARCHAR(71) COLLATE utf8mb4_bin NOT NULL,
 `revokedAt` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY `LLMUsageAttestorGrant_scope_key` (`workspaceId`,`id`),
 CONSTRAINT `LLMUsageAttestorGrant_workspace_fk` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`),
 CONSTRAINT `LLMUsageAttestorGrant_json` CHECK (JSON_VALID(`envelopeJson`) AND OCTET_LENGTH(`envelopeJson`) <= 16384)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
CREATE TABLE `LLMTrustedUsageEvidence` (
 `id` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
 `workspaceId` VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
 `decisionId` VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
 `providerIdempotencyKey` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
 `grantId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
 `envelopeJson` TEXT NOT NULL, `contentHash` VARCHAR(71) COLLATE utf8mb4_bin NOT NULL,
 `signatureBase64` VARCHAR(88) COLLATE utf8mb4_bin NOT NULL,
 `promptTokens` BIGINT NOT NULL, `completionTokens` BIGINT NOT NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY `LLMTrustedUsageEvidence_attempt_key` (`workspaceId`,`providerIdempotencyKey`),
 UNIQUE KEY `LLMTrustedUsageEvidence_decision_key` (`workspaceId`,`decisionId`),
 CONSTRAINT `LLMTrustedUsageEvidence_workspace_fk` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`),
 CONSTRAINT `LLMTrustedUsageEvidence_decision_fk` FOREIGN KEY (`decisionId`,`workspaceId`) REFERENCES `ModelRouteDecision`(`id`,`workspaceId`),
 CONSTRAINT `LLMTrustedUsageEvidence_grant_fk` FOREIGN KEY (`workspaceId`,`grantId`) REFERENCES `LLMUsageAttestorGrant`(`workspaceId`,`id`),
 CONSTRAINT `LLMTrustedUsageEvidence_units` CHECK (`promptTokens` >= 0 AND `promptTokens` <= 2147483647 AND `completionTokens` >= 0 AND `completionTokens` <= 2147483647),
 CONSTRAINT `LLMTrustedUsageEvidence_units_json` CHECK (
   COALESCE(JSON_TYPE(JSON_EXTRACT(`envelopeJson`,'$.promptTokens'))='INTEGER',FALSE)
   AND COALESCE(JSON_TYPE(JSON_EXTRACT(`envelopeJson`,'$.completionTokens'))='INTEGER',FALSE)
   AND CAST(JSON_UNQUOTE(JSON_EXTRACT(`envelopeJson`,'$.promptTokens')) AS DECIMAL(65,0))=`promptTokens`
   AND CAST(JSON_UNQUOTE(JSON_EXTRACT(`envelopeJson`,'$.completionTokens')) AS DECIMAL(65,0))=`completionTokens`),
 CONSTRAINT `LLMTrustedUsageEvidence_json` CHECK (JSON_VALID(`envelopeJson`) AND OCTET_LENGTH(`envelopeJson`) <= 16384)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
CREATE TRIGGER `LLMUsageAttestorGrant_immutable` BEFORE UPDATE ON `LLMUsageAttestorGrant`
FOR EACH ROW BEGIN
 IF NOT (BINARY NEW.id <=> BINARY OLD.id) OR NOT (BINARY NEW.workspaceId <=> BINARY OLD.workspaceId)
 OR NOT (BINARY NEW.envelopeJson <=> BINARY OLD.envelopeJson) OR NOT (BINARY NEW.contentHash <=> BINARY OLD.contentHash)
 OR NOT (NEW.createdAt <=> OLD.createdAt) OR (OLD.revokedAt IS NOT NULL AND NOT (NEW.revokedAt <=> OLD.revokedAt)) THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='usage_grant_immutable'; END IF;
END;
CREATE TRIGGER `LLMUsageAttestorGrant_no_delete` BEFORE DELETE ON `LLMUsageAttestorGrant`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='usage_grant_no_delete';
CREATE TRIGGER `LLMTrustedUsageEvidence_immutable` BEFORE UPDATE ON `LLMTrustedUsageEvidence`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='usage_evidence_immutable';
CREATE TRIGGER `LLMTrustedUsageEvidence_no_delete` BEFORE DELETE ON `LLMTrustedUsageEvidence`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='usage_evidence_no_delete';
