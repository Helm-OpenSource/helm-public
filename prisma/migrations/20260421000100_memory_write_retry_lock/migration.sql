-- Memory write retry DB-level idempotency guard

CREATE TABLE `MemoryWriteRetryLock` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `idempotencyLockKey` VARCHAR(191) NOT NULL,
  `retryContractItemId` VARCHAR(191) NOT NULL,
  `queueItemId` VARCHAR(191) NOT NULL,
  `sourceAuditId` VARCHAR(191) NOT NULL,
  `receiptAuditId` VARCHAR(191) NULL,
  `attemptAuditId` VARCHAR(191) NULL,
  `targetType` VARCHAR(191) NOT NULL,
  `targetId` VARCHAR(191) NOT NULL,
  `objectType` VARCHAR(191) NULL,
  `objectId` VARCHAR(191) NULL,
  `factType` VARCHAR(191) NULL,
  `sourceType` VARCHAR(191) NULL,
  `sourceId` VARCHAR(191) NULL,
  `writeKeyHash` VARCHAR(191) NULL,
  `conflictKeyHash` VARCHAR(191) NULL,
  `titleHash` VARCHAR(191) NULL,
  `contentHash` VARCHAR(191) NULL,
  `normalizedValueHash` VARCHAR(191) NULL,
  `lockStatus` VARCHAR(191) NOT NULL DEFAULT 'reserved',
  `sourceProofStatus` VARCHAR(191) NULL,
  `executorStatus` VARCHAR(191) NULL,
  `attemptCount` INTEGER NOT NULL DEFAULT 0,
  `attemptLimit` INTEGER NOT NULL DEFAULT 3,
  `nextRetryAfter` DATETIME(3) NULL,
  `sourceUpdatedAt` DATETIME(3) NULL,
  `proofGeneratedAt` DATETIME(3) NULL,
  `memoryFactId` VARCHAR(191) NULL,
  `committedAt` DATETIME(3) NULL,
  `releasedAt` DATETIME(3) NULL,
  `lockPayload` LONGTEXT NULL,
  `sourceProofPayload` LONGTEXT NULL,
  `executorPayload` LONGTEXT NULL,
  `lastError` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `MemoryWriteRetryLock_workspace_lock_key`(`workspaceId`, `idempotencyLockKey`),
  UNIQUE INDEX `MemoryWriteRetryLock_workspace_write_hash_key`(`workspaceId`, `writeKeyHash`),
  INDEX `MemoryWriteRetryLock_workspace_conflict_hash_idx`(`workspaceId`, `conflictKeyHash`),
  INDEX `MemoryWriteRetryLock_workspace_status_updated_idx`(`workspaceId`, `lockStatus`, `updatedAt`),
  INDEX `MemoryWriteRetryLock_workspace_source_idx`(`workspaceId`, `sourceType`, `sourceId`),
  INDEX `MemoryWriteRetryLock_workspace_target_idx`(`workspaceId`, `targetType`, `targetId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MemoryWriteRetryLock`
  ADD CONSTRAINT `MemoryWriteRetryLock_workspaceId_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
