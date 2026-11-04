-- CAIO attention control-plane audit (2026-11-04): one append-only row per operator / deploy-host operation on the
-- control plane, written in the same transaction as the operation (design v6 §1.6 resume audit, §2.4
-- GUARD_DOWNGRADED record). Control.updatedByRef only keeps the last writer; this table keeps every one.
-- New table only; no existing table is touched. Not AuditLog: that table is workspace-scoped (workspaceId NOT NULL),
-- while the control plane is one global row.
--
-- Write model (enforced by grants, see lib/caio-attention/least-privilege-fixture.ts; no triggers): the controlled
-- operator identity holds SELECT/INSERT only, so a row can never be changed or removed; no other identity holds any
-- privilege. `op` is the CLI op name. epoch / openEpoch are the Control values after the operation; the
-- workspace-scoped route-config ops carry none. payloadJson holds the operation's details (never a lease token).
--
-- No database foreign keys (relationMode = "prisma"). Replay-safe (IF NOT EXISTS). Requires
-- 20261104120000_caio_attention_control_plane. Rollback: prisma/rollback/20261104_rollback_caio_attention_control_events.sql
-- (before the control-plane rollback).

CREATE TABLE IF NOT EXISTS `CaioAttentionControlEvent` (
    `id` VARCHAR(191) NOT NULL,
    `op` VARCHAR(191) NOT NULL,
    `actorRef` VARCHAR(191) NOT NULL,
    `epoch` INTEGER NULL,
    `openEpoch` INTEGER NULL,
    `payloadJson` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CaioAttentionControlEvent_createdAt_idx`(`createdAt`),
    INDEX `CaioAttentionControlEvent_op_createdAt_idx`(`op`, `createdAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `CaioAttentionControlEvent_op_check` CHECK (`op` IN ('pause', 'resume', 'expected-nodes', 'deploy-begin',
      'attest-node', 'deploy-end', 'deploy-recover', 'guard-downgrade', 'routes-publish', 'routes-activate')),
    -- Control ops always record the epochs they leave behind; route-config ops are workspace-scoped and record none.
    CONSTRAINT `CaioAttentionControlEvent_epoch_check` CHECK (
      (`op` IN ('routes-publish', 'routes-activate') AND `epoch` IS NULL AND `openEpoch` IS NULL)
      OR (`op` NOT IN ('routes-publish', 'routes-activate') AND `epoch` IS NOT NULL AND `openEpoch` IS NOT NULL
        AND `epoch` >= 0 AND `openEpoch` >= 0)),
    CONSTRAINT `CaioAttentionControlEvent_payload_check` CHECK (JSON_VALID(`payloadJson`))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
