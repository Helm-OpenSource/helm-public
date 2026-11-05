-- CAIO attention control plane (2026-11-04): intake gate, deployment lease, node readiness proofs, runtime-node
-- heartbeats and append-only pause requests. New tables only; no existing table is touched.
--
-- Write model (enforced by grants, see lib/caio-attention/least-privilege-fixture.ts; no triggers):
--   * CaioAttentionControl: one row, id = 'global', seeded PAUSED below. Only the controlled operator identity may
--     UPDATE it. Generator and web identities hold SELECT only, which is enough for SELECT ... FOR SHARE.
--   * CaioAttentionPauseRequest: append-only. The web identity may INSERT but never UPDATE/DELETE, so it can close
--     the current open epoch and can never reopen intake. Writers take FOR SHARE on the Control row first, then
--     INSERT, which serialises a pause against resume's FOR UPDATE.
--   * CaioAttentionNodeReadiness: append-only except revokedAt/revokedByRef/revokedEpoch (operator only).
--     Epoch rule: a revocation records the epoch current at revocation time (E), deploy-begin then advances the
--     epoch to E+1, and the next proof is written at E+1. A proof is valid while unrevoked and its epoch is greater
--     than the node's highest revokedEpoch, hence revokedEpoch >= epoch on every revoked row.
--
-- No database foreign keys (relationMode = "prisma"). Every statement is replay-safe (IF NOT EXISTS / NOT EXISTS),
-- so a partially applied run can be resumed; lib/caio-attention/schema-readiness.ts reports a table whose columns
-- do not match. Rollback: prisma/rollback/20261104_rollback_caio_attention_control_plane.sql.

CREATE TABLE IF NOT EXISTS `CaioAttentionControl` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'global',
    `intakeState` VARCHAR(191) NOT NULL DEFAULT 'PAUSED',
    `epoch` INTEGER NOT NULL DEFAULT 0,
    `openEpoch` INTEGER NOT NULL DEFAULT 0,
    `leaseToken` VARCHAR(191) NULL,
    `leaseNodeId` VARCHAR(191) NULL,
    `leaseTargetDeploymentId` VARCHAR(191) NULL,
    `leaseAcquiredAt` DATETIME(3) NULL,
    `leaseExpiresAt` DATETIME(3) NULL,
    `requiredCloseCapability` INTEGER NOT NULL DEFAULT 1,
    `minGuardVersion` INTEGER NOT NULL DEFAULT 1,
    `expectedNodesJson` TEXT NOT NULL,
    `rowVersion` INTEGER NOT NULL DEFAULT 0,
    `updatedByRef` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    CONSTRAINT `CaioAttentionControl_singleton_check` CHECK (`id` = 'global'),
    CONSTRAINT `CaioAttentionControl_intake_check` CHECK (`intakeState` IN ('OPEN', 'PAUSED', 'DEPLOYING')),
    CONSTRAINT `CaioAttentionControl_epoch_check` CHECK (`epoch` >= 0 AND `openEpoch` >= 0),
    CONSTRAINT `CaioAttentionControl_floor_check` CHECK (`requiredCloseCapability` >= 1 AND `minGuardVersion` >= 1),
    -- A lease is all-or-nothing, and DEPLOYING holds exactly while a lease is present (expiry never reopens).
    CONSTRAINT `CaioAttentionControl_lease_check` CHECK (
      (`leaseToken` IS NULL AND `leaseNodeId` IS NULL AND `leaseTargetDeploymentId` IS NULL
        AND `leaseAcquiredAt` IS NULL AND `leaseExpiresAt` IS NULL)
      OR (`leaseToken` IS NOT NULL AND `leaseNodeId` IS NOT NULL AND `leaseTargetDeploymentId` IS NOT NULL
        AND `leaseAcquiredAt` IS NOT NULL AND `leaseExpiresAt` IS NOT NULL)),
    CONSTRAINT `CaioAttentionControl_deploying_check` CHECK ((`intakeState` = 'DEPLOYING') = (`leaseToken` IS NOT NULL))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CaioAttentionRuntimeNode` (
    `id` VARCHAR(191) NOT NULL,
    `nodeId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `deploymentId` VARCHAR(191) NOT NULL,
    `closeCapabilityVersion` INTEGER NOT NULL,
    `remindersEnabled` BOOLEAN NOT NULL DEFAULT false,
    `lastSeenAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CaioAttentionRuntimeNode_nodeId_key`(`nodeId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `CaioAttentionRuntimeNode_capability_check` CHECK (`closeCapabilityVersion` >= 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CaioAttentionNodeReadiness` (
    `id` VARCHAR(191) NOT NULL,
    `nodeId` VARCHAR(191) NOT NULL,
    `deploymentId` VARCHAR(191) NOT NULL,
    `closeCapabilityVersion` INTEGER NOT NULL,
    `guardVersion` INTEGER NOT NULL,
    `epoch` INTEGER NOT NULL,
    `verifiedAt` DATETIME(3) NOT NULL,
    `verifiedByRef` VARCHAR(191) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `revokedByRef` VARCHAR(191) NULL,
    `revokedEpoch` INTEGER NULL,

    INDEX `CaioAttentionNodeReadiness_nodeId_revokedAt_idx`(`nodeId`, `revokedAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `CaioAttentionNodeReadiness_version_check`
      CHECK (`closeCapabilityVersion` >= 0 AND `guardVersion` >= 1 AND `epoch` >= 0),
    CONSTRAINT `CaioAttentionNodeReadiness_revocation_check` CHECK (
      (`revokedAt` IS NULL AND `revokedByRef` IS NULL AND `revokedEpoch` IS NULL)
      OR (`revokedAt` IS NOT NULL AND `revokedByRef` IS NOT NULL AND `revokedEpoch` IS NOT NULL
        AND `revokedEpoch` >= `epoch`))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CaioAttentionPauseRequest` (
    `id` VARCHAR(191) NOT NULL,
    `openEpoch` INTEGER NOT NULL,
    `reasonCode` VARCHAR(191) NOT NULL,
    `requestedByRef` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CaioAttentionPauseRequest_openEpoch_idx`(`openEpoch`),
    UNIQUE INDEX `CaioAttentionPauseRequest_openEpoch_requestedByRef_key`(`openEpoch`, `requestedByRef`),
    PRIMARY KEY (`id`),
    CONSTRAINT `CaioAttentionPauseRequest_reason_check`
      CHECK (`reasonCode` IN ('node_heartbeat_stale', 'deployment_mismatch', 'watchdog', 'operator')),
    CONSTRAINT `CaioAttentionPauseRequest_epoch_check` CHECK (`openEpoch` >= 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Fail closed: intake starts PAUSED with no expected nodes, so nothing can open it before the operator flow runs.
INSERT INTO `CaioAttentionControl` (`id`, `intakeState`, `expectedNodesJson`, `updatedByRef`)
SELECT 'global', 'PAUSED', '[]', 'migration:20261104120000_caio_attention_control_plane'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `CaioAttentionControl` WHERE `id` = 'global');
