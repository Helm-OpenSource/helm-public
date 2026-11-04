-- CAIO attention cases (2026-11-04): the attention case, its append-only event / disposition / review history, the
-- versioned route configuration with its head, and the per-detector evaluation record of each quick-check tick.
-- New tables only; no existing table is touched and nothing here references the generic task tables.
--
-- Write model (enforced by grants, see lib/caio-attention/least-privilege-fixture.ts; no triggers):
--   * CaioAttentionCase: the generator identity INSERTs SUGGESTED cases; only the web identity's lifecycle service
--     UPDATEs them, always as a CAS on (id, status, commandVersion).
--   * CaseEvent, Disposition, Review, RouteConfig, DetectorEvaluation: append-only, SELECT/INSERT for every
--     identity that writes them. A superseded disposition is recorded as an event, never by changing the row.
--   * CaioAttentionRouteConfigHead: operator identity only, optimistic on rowVersion.
--
-- Uniqueness carries idempotency: one case per origin candidate, one live case per (workspaceId, activeKey), one
-- RECURRED event per candidate, one SEVERITY_RAISED event per severity (dedupeKey), one event per client request,
-- one review per disposition, one evaluation per (tick, detector). MySQL unique indexes admit repeated NULLs, so
-- terminal cases and events without a dedupe value never collide.
--
-- No database foreign keys (relationMode = "prisma"): append-only history must not be cascade-deleted, and a
-- parent-row lock per child insert would add lock edges the lifecycle lock order does not model. Every statement
-- is replay-safe. Requires 20261104120000_caio_attention_control_plane.
-- Rollback: prisma/rollback/20261104_rollback_caio_attention_cases.sql (before the control-plane rollback).

CREATE TABLE IF NOT EXISTS `CaioAttentionCase` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `shortNo` INTEGER NOT NULL,
    `detectorId` VARCHAR(191) NOT NULL,
    `mergeKey` VARCHAR(191) NOT NULL,
    `objectKey` VARCHAR(191) NOT NULL,
    `enterpriseSlug` VARCHAR(191) NULL,
    `category` VARCHAR(191) NOT NULL,
    `originCandidateId` VARCHAR(191) NOT NULL,
    `activeKey` VARCHAR(191) NULL,
    `previousCaseId` VARCHAR(191) NULL,
    `routeConfigVersion` INTEGER NULL,
    `routingBlocked` BOOLEAN NOT NULL DEFAULT false,
    `routingBlockedReasonsJson` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'SUGGESTED',
    `commandVersion` INTEGER NOT NULL DEFAULT 0,
    `ownerCommandJson` LONGTEXT NULL,
    `ownerCommandHash` VARCHAR(191) NULL,
    `primaryUserId` VARCHAR(191) NULL,
    `ccUserIdsJson` TEXT NOT NULL,
    `escalationUserId` VARCHAR(191) NULL,
    `reviewerSuggestedUserId` VARCHAR(191) NULL,
    `reviewerUserIdsJson` TEXT NOT NULL,
    `reviewerVersion` INTEGER NOT NULL DEFAULT 0,
    `confirmedByUserId` VARCHAR(191) NULL,
    `committedDueAt` DATETIME(3) NULL,
    `severityAtSuggest` VARCHAR(191) NOT NULL,
    `effectiveSeverity` VARCHAR(191) NOT NULL,
    `reminderPolicy` VARCHAR(191) NOT NULL,
    `dispatchedAt` DATETIME(3) NULL,
    `respondedAt` DATETIME(3) NULL,
    `deferredUntil` DATETIME(3) NULL,
    `r0aDueAt` DATETIME(3) NULL,
    `r0aSentAt` DATETIME(3) NULL,
    `r0bDueAt` DATETIME(3) NULL,
    `r0bSentAt` DATETIME(3) NULL,
    `noResponseDueAt` DATETIME(3) NULL,
    `r1FiredAt` DATETIME(3) NULL,
    `unresolvedEscalateAt` DATETIME(3) NULL,
    `r2FiredSeverity` VARCHAR(191) NULL,
    `nextPeriodicAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closedAt` DATETIME(3) NULL,

    UNIQUE INDEX `CaioAttentionCase_originCandidateId_key`(`originCandidateId`),
    INDEX `CaioAttentionCase_workspaceId_status_createdAt_idx`(`workspaceId`, `status`, `createdAt`),
    UNIQUE INDEX `CaioAttentionCase_workspaceId_activeKey_key`(`workspaceId`, `activeKey`),
    UNIQUE INDEX `CaioAttentionCase_workspaceId_shortNo_key`(`workspaceId`, `shortNo`),
    PRIMARY KEY (`id`),
    CONSTRAINT `CaioAttentionCase_status_check` CHECK (`status` IN
      ('SUGGESTED', 'DEFERRED', 'DISPATCHED', 'DISPOSITION_SUBMITTED', 'DISMISSED', 'CANCELLED', 'CLOSED')),
    -- activeKey is set exactly while the case is non-terminal, so (workspaceId, activeKey) admits one live case.
    CONSTRAINT `CaioAttentionCase_active_key_check`
      CHECK ((`status` IN ('DISMISSED', 'CANCELLED', 'CLOSED')) = (`activeKey` IS NULL)),
    CONSTRAINT `CaioAttentionCase_category_check` CHECK (`category` IN ('business', 'technical', 'compliance')),
    CONSTRAINT `CaioAttentionCase_severity_check` CHECK (`severityAtSuggest` IN ('critical', 'warning')
      AND `effectiveSeverity` IN ('critical', 'warning') AND `reminderPolicy` IN ('critical', 'warning')
      AND (`r2FiredSeverity` IS NULL OR `r2FiredSeverity` IN ('critical', 'warning'))),
    CONSTRAINT `CaioAttentionCase_version_check`
      CHECK (`shortNo` >= 1 AND `commandVersion` >= 0 AND `reviewerVersion` >= 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CaioAttentionCaseEvent` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `commandVersion` INTEGER NULL,
    `candidateId` VARCHAR(191) NULL,
    `dedupeKey` VARCHAR(191) NULL,
    `clientRequestId` VARCHAR(191) NULL,
    `actorUserId` VARCHAR(191) NULL,
    `payloadJson` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CaioAttentionCaseEvent_kind_createdAt_idx`(`kind`, `createdAt`),
    UNIQUE INDEX `CaioAttentionCaseEvent_caseId_kind_candidateId_key`(`caseId`, `kind`, `candidateId`),
    UNIQUE INDEX `CaioAttentionCaseEvent_caseId_kind_dedupeKey_key`(`caseId`, `kind`, `dedupeKey`),
    UNIQUE INDEX `CaioAttentionCaseEvent_caseId_clientRequestId_key`(`caseId`, `clientRequestId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `CaioAttentionCaseEvent_version_check` CHECK (`commandVersion` IS NULL OR `commandVersion` >= 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CaioAttentionDisposition` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `commandVersion` INTEGER NOT NULL,
    `sequence` INTEGER NOT NULL,
    `submittedByUserId` VARCHAR(191) NOT NULL,
    `disposedAt` DATETIME(3) NOT NULL,
    `outcome` VARCHAR(191) NOT NULL,
    `actionTaken` TEXT NOT NULL,
    `note` TEXT NULL,
    `evidenceRefsJson` LONGTEXT NOT NULL,
    `contentHash` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CaioAttentionDisposition_workspaceId_createdAt_idx`(`workspaceId`, `createdAt`),
    UNIQUE INDEX `CaioAttentionDisposition_caseId_sequence_key`(`caseId`, `sequence`),
    PRIMARY KEY (`id`),
    CONSTRAINT `CaioAttentionDisposition_sequence_check` CHECK (`sequence` >= 1 AND `commandVersion` >= 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CaioAttentionReview` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `dispositionId` VARCHAR(191) NOT NULL,
    `reviewerUserId` VARCHAR(191) NOT NULL,
    `reviewerVersion` INTEGER NOT NULL,
    `decision` VARCHAR(191) NOT NULL,
    `attestedExternalRefsJson` LONGTEXT NOT NULL,
    `note` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CaioAttentionReview_dispositionId_key`(`dispositionId`),
    INDEX `CaioAttentionReview_caseId_idx`(`caseId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `CaioAttentionReview_decision_check` CHECK (`decision` IN ('ACCEPT', 'RETURN') AND `reviewerVersion` >= 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CaioAttentionRouteConfig` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `schemaVersion` VARCHAR(191) NOT NULL,
    `configJson` LONGTEXT NOT NULL,
    `contentHash` VARCHAR(191) NOT NULL,
    `createdByRef` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CaioAttentionRouteConfig_workspaceId_version_key`(`workspaceId`, `version`),
    PRIMARY KEY (`id`),
    CONSTRAINT `CaioAttentionRouteConfig_version_check` CHECK (`version` >= 1)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CaioAttentionRouteConfigHead` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `activeVersion` INTEGER NOT NULL,
    `rowVersion` INTEGER NOT NULL DEFAULT 0,
    `updatedByRef` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CaioAttentionRouteConfigHead_workspaceId_key`(`workspaceId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `CaioAttentionRouteConfigHead_version_check` CHECK (`activeVersion` >= 1 AND `rowVersion` >= 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CaioDetectorEvaluation` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `tickId` VARCHAR(191) NOT NULL,
    `bucketStart` DATETIME(3) NOT NULL,
    `detectorId` VARCHAR(191) NOT NULL,
    `ruleVersion` VARCHAR(191) NOT NULL,
    `outcome` VARCHAR(191) NOT NULL,
    `hitMergeKeysJson` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CaioDetectorEvaluation_workspaceId_detectorId_bucketStart_idx`(`workspaceId`, `detectorId`, `bucketStart`),
    UNIQUE INDEX `CaioDetectorEvaluation_tickId_detectorId_key`(`tickId`, `detectorId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `CaioDetectorEvaluation_outcome_check` CHECK (`outcome` IN ('HIT', 'NO_HIT', 'SKIPPED', 'FAILED'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
