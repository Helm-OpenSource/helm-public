-- CAIO Pro P1E: Context Agent consent / revocation / deletion chain.
-- Review-first governance records for employee-consented context collection.
-- Public core only records these receipts: no collection runtime and no
-- deletion executor lives here, and participation state must never feed
-- performance input. Additive only; every receipt foreign key is
-- ON DELETE RESTRICT so consent evidence cannot be silently dropped.

CREATE TABLE `ContextAgentInvitation` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `memberUserId` VARCHAR(191) NOT NULL,
  `invitedByUserId` VARCHAR(191) NOT NULL,
  `scopeJson` LONGTEXT NOT NULL,
  `scopeHash` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `evidenceRefs` LONGTEXT NOT NULL,
  `invitationJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `recordedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `ContextAgentInvitation_id_workspaceId_key` (`id`, `workspaceId`),
  UNIQUE INDEX `CtxAgentInvitation_workspace_idem_key` (`workspaceId`, `idempotencyKey`),
  INDEX `CtxAgentInvitation_workspace_member_time_idx` (`workspaceId`, `memberUserId`, `recordedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ContextAgentConsentReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `invitationId` VARCHAR(191) NOT NULL,
  `memberUserId` VARCHAR(191) NOT NULL,
  `actorUserId` VARCHAR(191) NOT NULL,
  `consentVersion` INTEGER NOT NULL,
  `previousConsentId` VARCHAR(191) NULL,
  `scopeJson` LONGTEXT NOT NULL,
  `scopeHash` VARCHAR(191) NOT NULL,
  `effectiveScopeJson` LONGTEXT NOT NULL,
  `effectiveScopeHash` VARCHAR(191) NOT NULL,
  `participationStatus` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
  `stateVersion` INTEGER NOT NULL DEFAULT 1,
  `performanceInputProhibited` BOOLEAN NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `evidenceRefs` LONGTEXT NOT NULL,
  `receiptJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `recordedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `ContextAgentConsentReceipt_id_workspaceId_key` (`id`, `workspaceId`),
  UNIQUE INDEX `CtxAgentConsent_invitation_workspace_key` (`invitationId`, `workspaceId`),
  UNIQUE INDEX `CtxAgentConsent_workspace_member_version_key` (`workspaceId`, `memberUserId`, `consentVersion`),
  UNIQUE INDEX `CtxAgentConsent_workspace_idem_key` (`workspaceId`, `idempotencyKey`),
  UNIQUE INDEX `CtxAgentConsent_previous_workspace_key` (`previousConsentId`, `workspaceId`),
  INDEX `CtxAgentConsent_workspace_member_status_idx` (`workspaceId`, `memberUserId`, `participationStatus`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ContextAgentScopeRevision` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `consentReceiptId` VARCHAR(191) NOT NULL,
  `memberUserId` VARCHAR(191) NOT NULL,
  `actorUserId` VARCHAR(191) NOT NULL,
  `sequence` INTEGER NOT NULL,
  `revisionKind` VARCHAR(191) NOT NULL,
  `previousScopeJson` LONGTEXT NOT NULL,
  `previousScopeHash` VARCHAR(191) NOT NULL,
  `newScopeJson` LONGTEXT NOT NULL,
  `newScopeHash` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `revisionJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `recordedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `ContextAgentScopeRevision_id_workspaceId_key` (`id`, `workspaceId`),
  UNIQUE INDEX `CtxAgentScopeRev_consent_workspace_seq_key` (`consentReceiptId`, `workspaceId`, `sequence`),
  UNIQUE INDEX `CtxAgentScopeRev_workspace_idem_key` (`workspaceId`, `idempotencyKey`),
  INDEX `CtxAgentScopeRev_workspace_member_time_idx` (`workspaceId`, `memberUserId`, `recordedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ContextAgentCollectionReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `consentReceiptId` VARCHAR(191) NOT NULL,
  `memberUserId` VARCHAR(191) NOT NULL,
  `collectionKind` VARCHAR(191) NOT NULL,
  `consentScopeHash` VARCHAR(191) NOT NULL,
  `itemCount` INTEGER NOT NULL,
  `digestHashes` LONGTEXT NOT NULL,
  `evidenceRefs` LONGTEXT NOT NULL,
  `performanceInputProhibited` BOOLEAN NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `receiptJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `collectedAt` DATETIME(3) NOT NULL,
  `recordedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `ContextAgentCollectionReceipt_id_workspaceId_key` (`id`, `workspaceId`),
  UNIQUE INDEX `CtxAgentCollection_workspace_idem_key` (`workspaceId`, `idempotencyKey`),
  INDEX `CtxAgentCollection_workspace_member_time_idx` (`workspaceId`, `memberUserId`, `recordedAt`),
  INDEX `CtxAgentCollection_consent_workspace_time_idx` (`consentReceiptId`, `workspaceId`, `recordedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ContextAgentPauseReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `consentReceiptId` VARCHAR(191) NOT NULL,
  `memberUserId` VARCHAR(191) NOT NULL,
  `actorUserId` VARCHAR(191) NOT NULL,
  `action` VARCHAR(191) NOT NULL,
  `resultingStatus` VARCHAR(191) NOT NULL,
  `sequence` INTEGER NOT NULL,
  `reasonCodes` LONGTEXT NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `receiptJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `recordedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `ContextAgentPauseReceipt_id_workspaceId_key` (`id`, `workspaceId`),
  UNIQUE INDEX `CtxAgentPause_consent_workspace_seq_key` (`consentReceiptId`, `workspaceId`, `sequence`),
  UNIQUE INDEX `CtxAgentPause_workspace_idem_key` (`workspaceId`, `idempotencyKey`),
  INDEX `CtxAgentPause_workspace_member_time_idx` (`workspaceId`, `memberUserId`, `recordedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ContextAgentRevocationReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `consentReceiptId` VARCHAR(191) NOT NULL,
  `memberUserId` VARCHAR(191) NOT NULL,
  `actorUserId` VARCHAR(191) NOT NULL,
  `consentScopeHash` VARCHAR(191) NOT NULL,
  `deletionWorkItemRef` VARCHAR(191) NOT NULL,
  `reasonCodes` LONGTEXT NOT NULL,
  `evidenceRefs` LONGTEXT NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `receiptJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `recordedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `ContextAgentRevocationReceipt_id_workspaceId_key` (`id`, `workspaceId`),
  UNIQUE INDEX `CtxAgentRevocation_consent_workspace_key` (`consentReceiptId`, `workspaceId`),
  UNIQUE INDEX `CtxAgentRevocation_workspace_idem_key` (`workspaceId`, `idempotencyKey`),
  UNIQUE INDEX `CtxAgentRevocation_workspace_work_item_key` (`workspaceId`, `deletionWorkItemRef`),
  INDEX `CtxAgentRevocation_workspace_member_time_idx` (`workspaceId`, `memberUserId`, `recordedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ContextAgentDeletionReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `revocationReceiptId` VARCHAR(191) NOT NULL,
  `consentReceiptId` VARCHAR(191) NOT NULL,
  `memberUserId` VARCHAR(191) NOT NULL,
  `actorUserId` VARCHAR(191) NOT NULL,
  `deletionWorkItemRef` VARCHAR(191) NOT NULL,
  `attempt` INTEGER NOT NULL,
  `outcome` VARCHAR(191) NOT NULL,
  `indicesDeleted` INTEGER NOT NULL,
  `cachesDeleted` INTEGER NOT NULL,
  `derivedVectorsDeleted` INTEGER NOT NULL,
  `memoryCandidatesDeleted` INTEGER NOT NULL,
  `observedFactsDeleted` INTEGER NOT NULL,
  `observedFactsEvidenceInvalidated` INTEGER NOT NULL,
  `multiSourceRecomputed` INTEGER NOT NULL,
  `failureCodes` LONGTEXT NOT NULL,
  `evidenceRefs` LONGTEXT NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `receiptJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `recordedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `ContextAgentDeletionReceipt_id_workspaceId_key` (`id`, `workspaceId`),
  UNIQUE INDEX `CtxAgentDeletion_revocation_workspace_attempt_key` (`revocationReceiptId`, `workspaceId`, `attempt`),
  UNIQUE INDEX `CtxAgentDeletion_workspace_idem_key` (`workspaceId`, `idempotencyKey`),
  INDEX `CtxAgentDeletion_workspace_outcome_time_idx` (`workspaceId`, `outcome`, `recordedAt`),
  INDEX `CtxAgentDeletion_workspace_member_time_idx` (`workspaceId`, `memberUserId`, `recordedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ContextAgentInvitation`
  ADD CONSTRAINT `CtxAgentInvitation_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ContextAgentConsentReceipt`
  ADD CONSTRAINT `CtxAgentConsent_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ContextAgentConsentReceipt`
  ADD CONSTRAINT `CtxAgentConsent_invitation_workspace_fkey`
  FOREIGN KEY (`invitationId`, `workspaceId`)
  REFERENCES `ContextAgentInvitation`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ContextAgentConsentReceipt`
  ADD CONSTRAINT `CtxAgentConsent_previous_workspace_fkey`
  FOREIGN KEY (`previousConsentId`, `workspaceId`)
  REFERENCES `ContextAgentConsentReceipt`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `ContextAgentScopeRevision`
  ADD CONSTRAINT `CtxAgentScopeRev_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ContextAgentScopeRevision`
  ADD CONSTRAINT `CtxAgentScopeRev_consent_workspace_fkey`
  FOREIGN KEY (`consentReceiptId`, `workspaceId`)
  REFERENCES `ContextAgentConsentReceipt`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ContextAgentCollectionReceipt`
  ADD CONSTRAINT `CtxAgentCollection_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ContextAgentCollectionReceipt`
  ADD CONSTRAINT `CtxAgentCollection_consent_workspace_fkey`
  FOREIGN KEY (`consentReceiptId`, `workspaceId`)
  REFERENCES `ContextAgentConsentReceipt`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ContextAgentPauseReceipt`
  ADD CONSTRAINT `CtxAgentPause_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ContextAgentPauseReceipt`
  ADD CONSTRAINT `CtxAgentPause_consent_workspace_fkey`
  FOREIGN KEY (`consentReceiptId`, `workspaceId`)
  REFERENCES `ContextAgentConsentReceipt`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ContextAgentRevocationReceipt`
  ADD CONSTRAINT `CtxAgentRevocation_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ContextAgentRevocationReceipt`
  ADD CONSTRAINT `CtxAgentRevocation_consent_workspace_fkey`
  FOREIGN KEY (`consentReceiptId`, `workspaceId`)
  REFERENCES `ContextAgentConsentReceipt`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ContextAgentDeletionReceipt`
  ADD CONSTRAINT `CtxAgentDeletion_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ContextAgentDeletionReceipt`
  ADD CONSTRAINT `CtxAgentDeletion_revocation_workspace_fkey`
  FOREIGN KEY (`revocationReceiptId`, `workspaceId`)
  REFERENCES `ContextAgentRevocationReceipt`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ContextAgentDeletionReceipt`
  ADD CONSTRAINT `CtxAgentDeletion_consent_workspace_fkey`
  FOREIGN KEY (`consentReceiptId`, `workspaceId`)
  REFERENCES `ContextAgentConsentReceipt`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
