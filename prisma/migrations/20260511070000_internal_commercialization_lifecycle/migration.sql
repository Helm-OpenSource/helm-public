-- Internal commercialization lifecycle read model.
-- Narrow, alias-only table for Helm reserved workspace commercialization
-- management. It intentionally stores no Contact/Company/Opportunity foreign
-- keys and grants no external side-effect authority.

CREATE TABLE `InternalCommercializationRun` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `lifecycleRunId` VARCHAR(191) NOT NULL,
  `providerAliasId` VARCHAR(191) NOT NULL,
  `providerType` ENUM('AI_SERVICE_PROVIDER', 'AI_CONSULTING_TRAINING', 'AGENT_DELIVERY_PROVIDER', 'CONTENT_ONLY_KOL', 'PLATFORM_BUILDER_REQUESTER') NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `sourceFixtureId` VARCHAR(191) NULL,
  `currentState` ENUM('CANDIDATE_POOL', 'DAILY_TOP3_SELECTED', 'DIAGNOSIS_PACKET_PREPARED', 'DIAGNOSIS_REVIEWED', 'TRIAL_SCOPE_PREPARED', 'TRIAL_RUNNING', 'TRIAL_CLOSEOUT_READY', 'PILOT_SCOPE_PREPARED', 'PILOT_RUNNING', 'PILOT_CLOSEOUT_READY', 'CLOSEOUT_REPORT_PREPARED', 'CHANNEL_GATE_ASSESSED', 'NEXT_CYCLE_SELECTED', 'DATA_BOUNDARY_REVIEW_REQUIRED', 'PAUSED') NOT NULL,
  `nextState` ENUM('CANDIDATE_POOL', 'DAILY_TOP3_SELECTED', 'DIAGNOSIS_PACKET_PREPARED', 'DIAGNOSIS_REVIEWED', 'TRIAL_SCOPE_PREPARED', 'TRIAL_RUNNING', 'TRIAL_CLOSEOUT_READY', 'PILOT_SCOPE_PREPARED', 'PILOT_RUNNING', 'PILOT_CLOSEOUT_READY', 'CLOSEOUT_REPORT_PREPARED', 'CHANNEL_GATE_ASSESSED', 'NEXT_CYCLE_SELECTED', 'DATA_BOUNDARY_REVIEW_REQUIRED', 'PAUSED') NULL,
  `decision` ENUM('PREPARE_DIAGNOSIS', 'PREPARE_TRIAL', 'PREPARE_PILOT', 'PREPARE_CLOSEOUT', 'NO_GO', 'WATCH_ONLY') NOT NULL,
  `expectedOfferStage` ENUM('DIAGNOSIS_1H', 'TRIAL_7D', 'PILOT_4W', 'CLOSEOUT_REPORT') NULL,
  `nextAction` ENUM('PREPARE_DIAGNOSIS_BRIEF_FOR_REVIEW', 'PREPARE_TRIAL_SCOPE_DRAFT_FOR_REVIEW', 'PREPARE_PILOT_SCOPE_PACKET_FOR_REVIEW', 'PREPARE_CLOSEOUT_REPORT_CANDIDATE_FOR_REVIEW', 'DOWNGRADE_OR_PAUSE') NOT NULL,
  `ownerAlias` VARCHAR(191) NOT NULL,
  `reviewerAlias` VARCHAR(191) NULL,
  `customerOpportunityAliasIds` LONGTEXT NOT NULL,
  `evidenceRefs` LONGTEXT NOT NULL,
  `requiredEvidenceKinds` LONGTEXT NOT NULL,
  `riskTags` LONGTEXT NOT NULL,
  `commercialSignalsJson` LONGTEXT NOT NULL,
  `channelGateLevel` ENUM('L0', 'L1', 'L2', 'L3') NOT NULL DEFAULT 'L0',
  `managingThroughServiceProvider` BOOLEAN NOT NULL DEFAULT true,
  `serviceProviderCustomerFacingOwner` BOOLEAN NOT NULL DEFAULT true,
  `helmDirectCustomerContactAllowed` BOOLEAN NOT NULL DEFAULT false,
  `stageReviewPacketRequired` BOOLEAN NOT NULL DEFAULT true,
  `reviewStaleHours` INTEGER NOT NULL DEFAULT 72,
  `outcomeWindowHours` INTEGER NOT NULL DEFAULT 72,
  `safeSampleAvailable` BOOLEAN NOT NULL DEFAULT false,
  `acceptedReviewFirst` BOOLEAN NOT NULL DEFAULT false,
  `requiresReview` BOOLEAN NOT NULL DEFAULT true,
  `channelAssessmentRequired` BOOLEAN NOT NULL DEFAULT false,
  `externalSideEffectAllowed` BOOLEAN NOT NULL DEFAULT false,
  `officialCommitmentAllowed` BOOLEAN NOT NULL DEFAULT false,
  `publicClaimAllowed` BOOLEAN NOT NULL DEFAULT false,
  `customerVisibleWithoutReview` BOOLEAN NOT NULL DEFAULT false,
  `rawPiiIncluded` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `InternalCommercializationRun_workspaceId_lifecycleRunId_key`
  ON `InternalCommercializationRun` (`workspaceId`, `lifecycleRunId`);

CREATE INDEX `ICR_workspace_state_updated_idx`
  ON `InternalCommercializationRun` (`workspaceId`, `currentState`, `updatedAt`);

CREATE INDEX `InternalCommercializationRun_workspaceId_providerAliasId_idx`
  ON `InternalCommercializationRun` (`workspaceId`, `providerAliasId`);

CREATE INDEX `InternalCommercializationRun_workspaceId_channelGateLevel_idx`
  ON `InternalCommercializationRun` (`workspaceId`, `channelGateLevel`);

CREATE INDEX `InternalCommercializationRun_workspaceId_decision_idx`
  ON `InternalCommercializationRun` (`workspaceId`, `decision`);

ALTER TABLE `InternalCommercializationRun`
  ADD CONSTRAINT `InternalCommercializationRun_workspaceId_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
