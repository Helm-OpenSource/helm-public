-- Billing V1 S1-c (2026-11-10): payer identity and versioned, revocable scope bindings. New tables only; no existing
-- table (BillingAccount, UsageLedger, subscriptions) is touched, nothing is backfilled and no money moves.
-- billingMode defaults to 'off' per account; no env switch is read or changed.
--
-- One ACTIVE binding per (scopeKind, scopeRef) is a database invariant, not an ORM convention: activeScopeRef equals
-- scopeRef while active and is NULL once revoked (CHECK below), and MySQL UNIQUE admits many NULLs. Scope refs are
-- byte-exact (utf8mb4_bin) so case variants never alias a workspace. Revoked rows are retained as payer history.
--
-- No database foreign keys (relationMode = "prisma").
-- Rollback: prisma/rollback/20261110_rollback_billing_payer_accounts.sql (refuses while any row exists).

CREATE TABLE `PayerAccount` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('consumer', 'enterprise_contract') NOT NULL,
    `governingWorkspaceId` VARCHAR(191) COLLATE utf8mb4_bin NULL,
    `contractSubjectRef` VARCHAR(191) NOT NULL,
    `collectionSubjectRef` VARCHAR(191) NULL,
    `currency` VARCHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'CNY',
    `billingMode` ENUM('off', 'shadow', 'enforce') NOT NULL DEFAULT 'off',
    `status` ENUM('active', 'suspended', 'closed') NOT NULL DEFAULT 'active',
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PayerAccount_kind_contractSubjectRef_idx`(`kind`, `contractSubjectRef`),
    INDEX `PayerAccount_governingWorkspaceId_idx`(`governingWorkspaceId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `PayerAccount_currency_check` CHECK (`currency` = 'CNY'),
    CONSTRAINT `PayerAccount_shape_check` CHECK (`version` >= 1 AND CHAR_LENGTH(`contractSubjectRef`) > 0
      AND (`kind` <> 'enterprise_contract' OR (`governingWorkspaceId` IS NOT NULL AND CHAR_LENGTH(`governingWorkspaceId`) > 0))
      AND (`collectionSubjectRef` IS NULL OR CHAR_LENGTH(`collectionSubjectRef`) > 0))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PayerScopeBinding` (
    `id` VARCHAR(191) NOT NULL,
    `payerAccountId` VARCHAR(191) NOT NULL,
    `scopeKind` ENUM('workspace', 'consumer_principal') NOT NULL,
    `scopeRef` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `state` ENUM('active', 'revoked') NOT NULL DEFAULT 'active',
    `activeScopeRef` VARCHAR(191) COLLATE utf8mb4_bin NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `authorizedByUserId` VARCHAR(191) NOT NULL,
    `evidenceRef` VARCHAR(191) NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,
    `revokedByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PayerScopeBinding_payerAccountId_state_idx`(`payerAccountId`, `state`),
    INDEX `PayerScopeBinding_scopeKind_scopeRef_idx`(`scopeKind`, `scopeRef`),
    UNIQUE INDEX `PayerScopeBinding_scopeKind_activeScopeRef_key`(`scopeKind`, `activeScopeRef`),
    PRIMARY KEY (`id`),
    CONSTRAINT `PayerScopeBinding_active_key_check` CHECK (
      (`state` = 'active' AND `activeScopeRef` IS NOT NULL AND `activeScopeRef` = `scopeRef`
        AND `revokedAt` IS NULL AND `revokedByUserId` IS NULL)
      OR (`state` = 'revoked' AND `activeScopeRef` IS NULL AND `revokedAt` IS NOT NULL AND `revokedByUserId` IS NOT NULL)),
    CONSTRAINT `PayerScopeBinding_shape_check` CHECK (`version` >= 1 AND CHAR_LENGTH(`scopeRef`) > 0
      AND CHAR_LENGTH(`evidenceRef`) > 0 AND CHAR_LENGTH(`authorizedByUserId`) > 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
