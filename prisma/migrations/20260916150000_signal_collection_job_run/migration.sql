-- Signal-collection run ledger (CAIO P1-1, default off via HELM_SIGNAL_COLLECTION_RUN_LEDGER_ENABLED).
-- Additive: one new table, no change to existing tables. Rows hold closed-set outcomes, error codes
-- and counts only; job and target messages are never persisted. The CHECK constraints are
-- hand-authored and invisible to check:migration-drift's datamodel comparison.
CREATE TABLE `SignalCollectionJobRun` (
    `id` VARCHAR(191) NOT NULL,
    `jobKey` VARCHAR(191) NOT NULL,
    `tenantKey` VARCHAR(64) NOT NULL,
    `extensionKey` VARCHAR(191) NOT NULL,
    `source` VARCHAR(32) NOT NULL,
    `outcome` VARCHAR(16) NOT NULL,
    `errorCode` VARCHAR(64) NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `finishedAt` DATETIME(3) NOT NULL,
    `durationMs` INTEGER NOT NULL,
    `targetCount` INTEGER NOT NULL,
    `successCount` INTEGER NOT NULL,
    `failureCount` INTEGER NOT NULL,
    `skippedCount` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `SignalCollectionJobRun_tenantKey_jobKey_finishedAt_idx`(`tenantKey`, `jobKey`, `finishedAt`),
    INDEX `SignalCollectionJobRun_finishedAt_idx`(`finishedAt`),
    CONSTRAINT `SignalCollectionJobRun_outcome_check`
      CHECK (`outcome` IN ('succeeded', 'failed', 'crashed', 'skipped')),
    CONSTRAINT `SignalCollectionJobRun_counts_check`
      CHECK (`durationMs` >= 0 AND `targetCount` >= 0 AND `successCount` >= 0
        AND `failureCount` >= 0 AND `skippedCount` >= 0),
    CONSTRAINT `SignalCollectionJobRun_window_check`
      CHECK (`finishedAt` >= `startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
