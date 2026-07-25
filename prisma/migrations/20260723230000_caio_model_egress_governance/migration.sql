-- CAIO Pro P1D tenant model admission and data-egress governance.
-- This migration is additive only. Existing workspace LLM settings are not
-- imported, activated, or treated as model-egress authority.

CREATE TABLE `ProviderAdapterReadinessReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `provider` VARCHAR(191) NOT NULL,
  `modelId` VARCHAR(191) NOT NULL,
  `modelVersion` VARCHAR(191) NOT NULL,
  `adapterKey` VARCHAR(191) NOT NULL,
  `adapterVersion` VARCHAR(191) NOT NULL,
  `adapterRegistrationRef` VARCHAR(191) NOT NULL,
  `adapterRegistrationHash` VARCHAR(191) NOT NULL,
  `deploymentForm` VARCHAR(191) NOT NULL,
  `jurisdiction` VARCHAR(191) NOT NULL,
  `region` VARCHAR(191) NOT NULL,
  `endpointFingerprint` VARCHAR(191) NOT NULL,
  `credentialRef` VARCHAR(191) NOT NULL,
  `adapterRegistered` BOOLEAN NOT NULL,
  `credentialConfigured` BOOLEAN NOT NULL,
  `modelProbeStatus` VARCHAR(191) NOT NULL,
  `capabilityRefs` LONGTEXT NOT NULL,
  `checkedAt` DATETIME(3) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `evidenceRefs` LONGTEXT NOT NULL,
  `rawCredentialIncluded` BOOLEAN NOT NULL DEFAULT false,
  `receiptJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `ProviderAdapterReadinessReceipt_id_workspaceId_key` (`id`, `workspaceId`),
  UNIQUE INDEX `ProviderReadiness_workspace_idem_key` (`workspaceId`, `idempotencyKey`),
  UNIQUE INDEX `ProviderReadiness_workspace_hash_key` (`workspaceId`, `contentHash`),
  INDEX `ProviderReadiness_workspace_model_expiry_idx` (`workspaceId`, `provider`, `modelId`, `expiresAt`),
  CONSTRAINT `ProviderReadiness_no_raw_credential_chk`
    CHECK (`rawCredentialIncluded` = false),
  CONSTRAINT `ProviderReadiness_state_chk`
    CHECK (
      `deploymentForm` IN ('LOCAL', 'PRIVATE_DEPLOYMENT', 'DOMESTIC_CLOUD', 'FOREIGN_CLOUD')
      AND `jurisdiction` IN ('CUSTOMER_PREMISES', 'DOMESTIC', 'FOREIGN')
      AND `modelProbeStatus` IN ('READY', 'NOT_READY')
      AND `expiresAt` > `checkedAt`
    ),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TenantModelRoutePolicy` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `policyKey` VARCHAR(191) NOT NULL,
  `revision` INTEGER NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
  `validFrom` DATETIME(3) NOT NULL,
  `validUntil` DATETIME(3) NOT NULL,
  `approvalRef` VARCHAR(191) NOT NULL,
  `approvedByRef` VARCHAR(191) NOT NULL,
  `createdByUserId` VARCHAR(191) NOT NULL,
  `policyJson` LONGTEXT NOT NULL,
  `policyHash` VARCHAR(191) NOT NULL,
  `activatedAt` DATETIME(3) NULL,
  `supersededAt` DATETIME(3) NULL,
  `revokedAt` DATETIME(3) NULL,
  `revokedByRef` VARCHAR(191) NULL,
  `revocationReason` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `TenantModelRoutePolicy_id_workspaceId_key` (`id`, `workspaceId`),
  UNIQUE INDEX `TenantModelPolicy_workspace_key_revision_key` (`workspaceId`, `policyKey`, `revision`),
  UNIQUE INDEX `TenantModelPolicy_workspace_hash_key` (`workspaceId`, `policyHash`),
  INDEX `TenantModelPolicy_workspace_status_expiry_idx` (`workspaceId`, `policyKey`, `status`, `validUntil`),
  CONSTRAINT `TenantModelPolicy_state_chk`
    CHECK (
      `revision` > 0
      AND `status` IN ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'REVOKED', 'EXPIRED')
      AND `validUntil` > `validFrom`
    ),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ModelRoutePolicyApprovalReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `policyId` VARCHAR(191) NOT NULL,
  `policyHash` VARCHAR(191) NOT NULL,
  `policyKey` VARCHAR(191) NOT NULL,
  `policyRevision` INTEGER NOT NULL,
  `approvedByUserId` VARCHAR(191) NOT NULL,
  `expectedHeadVersion` INTEGER NULL,
  `approvedAt` DATETIME(3) NOT NULL,
  `receiptJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `ModelRoutePolicyApprovalReceipt_policyId_key` (`policyId`),
  UNIQUE INDEX `ModelRoutePolicyApprovalReceipt_id_workspaceId_key` (`id`, `workspaceId`),
  UNIQUE INDEX `ModelPolicyApproval_policy_workspace_key` (`policyId`, `workspaceId`),
  INDEX `ModelPolicyApproval_workspace_key_time_idx` (`workspaceId`, `policyKey`, `approvedAt`),
  CONSTRAINT `ModelPolicyApproval_state_chk`
    CHECK (
      `policyRevision` > 0
      AND (`expectedHeadVersion` IS NULL OR `expectedHeadVersion` >= 0)
    ),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TenantModelRoutePolicyHead` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `policyKey` VARCHAR(191) NOT NULL,
  `activePolicyId` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `revocationEpoch` INTEGER NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `TenantModelRoutePolicyHead_activePolicyId_key` (`activePolicyId`),
  UNIQUE INDEX `TenantModelPolicyHead_workspace_key` (`workspaceId`, `policyKey`),
  UNIQUE INDEX `TenantModelPolicyHead_policy_workspace_key` (`activePolicyId`, `workspaceId`),
  INDEX `TenantModelPolicyHead_workspace_epoch_idx` (`workspaceId`, `version`, `revocationEpoch`),
  CONSTRAINT `TenantModelPolicyHead_version_chk`
    CHECK (`version` > 0 AND `revocationEpoch` >= 0),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GovernedModelProjectionReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `sourceAssetRefs` LONGTEXT NOT NULL,
  `sourceAssetBindingsJson` LONGTEXT NOT NULL,
  `candidateEvidenceRefs` LONGTEXT NOT NULL,
  `selectedEvidenceRefs` LONGTEXT NOT NULL,
  `droppedEvidenceRefs` LONGTEXT NOT NULL,
  `projectedPayloadHash` VARCHAR(191) NOT NULL,
  `projectedPayloadBytes` INTEGER NOT NULL,
  `maxInputTokens` INTEGER NOT NULL,
  `maxOutputTokens` INTEGER NOT NULL,
  `remoteSafe` BOOLEAN NOT NULL,
  `redactionStatus` VARCHAR(191) NOT NULL,
  `promptInjectionScanStatus` VARCHAR(191) NOT NULL,
  `projectorRegistrationRef` VARCHAR(191) NOT NULL,
  `projectorRegistrationHash` VARCHAR(191) NOT NULL,
  `projectorVersion` VARCHAR(191) NOT NULL,
  `scannerRegistrationRef` VARCHAR(191) NOT NULL,
  `scannerRegistrationHash` VARCHAR(191) NOT NULL,
  `scannerVersion` VARCHAR(191) NOT NULL,
  `validUntil` DATETIME(3) NOT NULL,
  `receiptJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `GovernedModelProjectionReceipt_id_workspaceId_key` (`id`, `workspaceId`),
  UNIQUE INDEX `ModelProjection_workspace_idem_key` (`workspaceId`, `idempotencyKey`),
  UNIQUE INDEX `ModelProjection_workspace_hash_key` (`workspaceId`, `contentHash`),
  INDEX `ModelProjection_workspace_expiry_idx` (`workspaceId`, `validUntil`),
  CONSTRAINT `ModelProjection_no_raw_content_chk`
    CHECK (
      `projectedPayloadBytes` > 0
      AND `maxInputTokens` > 0
      AND `maxOutputTokens` > 0
      AND `redactionStatus` IN ('SYNTHETIC', 'REDACTED', 'ALIAS_ONLY')
      AND `promptInjectionScanStatus` IN ('PASSED', 'FAILED', 'NOT_RUN')
      AND `validUntil` > `createdAt`
    ),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ModelRouteDecision` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `policyId` VARCHAR(191) NULL,
  `readinessReceiptId` VARCHAR(191) NULL,
  `parentDecisionId` VARCHAR(191) NULL,
  `requestKey` VARCHAR(191) NOT NULL,
  `requestHash` VARCHAR(191) NOT NULL,
  `attemptOrdinal` INTEGER NOT NULL DEFAULT 0,
  `policyKey` VARCHAR(191) NOT NULL,
  `policyHeadVersion` INTEGER NOT NULL,
  `policyRevocationEpoch` INTEGER NOT NULL,
  `taskClass` VARCHAR(191) NOT NULL,
  `taskRef` VARCHAR(191) NOT NULL,
  `requestedMaxOutputTokens` INTEGER NOT NULL,
  `allowFallback` BOOLEAN NOT NULL,
  `sensitivity` VARCHAR(191) NOT NULL,
  `processingDisposition` VARCHAR(191) NOT NULL,
  `sourceAssetRefs` LONGTEXT NOT NULL,
  `sourceAssetBindingsJson` LONGTEXT NOT NULL,
  `candidateEvidenceRefs` LONGTEXT NOT NULL,
  `selectedEvidenceRefs` LONGTEXT NOT NULL,
  `droppedEvidenceRefs` LONGTEXT NOT NULL,
  `projectionReceiptRef` VARCHAR(191) NULL,
  `projectionReceiptHash` VARCHAR(191) NULL,
  `projectedPayloadHash` VARCHAR(191) NOT NULL,
  `promptInjectionScanStatus` VARCHAR(191) NOT NULL,
  `routeRef` VARCHAR(191) NULL,
  `routeSnapshotJson` LONGTEXT NULL,
  `adapterReadinessState` VARCHAR(191) NOT NULL,
  `catalogVisibilityState` VARCHAR(191) NOT NULL,
  `decision` VARCHAR(191) NOT NULL,
  `reasonCodes` LONGTEXT NOT NULL,
  `requestedFallbackRouteRef` VARCHAR(191) NULL,
  `fallbackFromRouteRef` VARCHAR(191) NULL,
  `fallbackReason` VARCHAR(191) NULL,
  `dispatchClaimedAt` DATETIME(3) NULL,
  `dispatchGatewayRef` VARCHAR(191) NULL,
  `dispatchRuntimeJson` LONGTEXT NULL,
  `dispatchRuntimeHash` VARCHAR(191) NULL,
  `dispatchClaimHash` VARCHAR(191) NULL,
  `dispatchProviderIdempotencyKey` VARCHAR(191) NULL,
  `dispatchLeaseExpiresAt` DATETIME(3) NULL,
  `validUntil` DATETIME(3) NOT NULL,
  `decisionJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `ModelRouteDecision_id_workspaceId_key` (`id`, `workspaceId`),
  UNIQUE INDEX `ModelRouteDecision_workspace_request_key` (`workspaceId`, `requestKey`),
  UNIQUE INDEX `ModelRouteDecision_workspace_hash_key` (`workspaceId`, `contentHash`),
  UNIQUE INDEX `ModelRouteDecision_parent_attempt_workspace_key` (`parentDecisionId`, `attemptOrdinal`, `workspaceId`),
  UNIQUE INDEX `ModelRouteDecision_workspace_provider_idem_key` (`workspaceId`, `dispatchProviderIdempotencyKey`),
  INDEX `ModelRouteDecision_workspace_task_decision_idx` (`workspaceId`, `taskClass`, `decision`, `createdAt`),
  INDEX `ModelRouteDecision_workspace_route_claim_idx` (`workspaceId`, `routeRef`, `dispatchClaimedAt`),
  INDEX `ModelRouteDecision_workspace_lease_idx` (`workspaceId`, `dispatchLeaseExpiresAt`),
  INDEX `ModelRouteDecision_policy_workspace_idx` (`policyId`, `workspaceId`),
  INDEX `ModelRouteDecision_readiness_workspace_idx` (`readinessReceiptId`, `workspaceId`),
  CONSTRAINT `ModelRouteDecision_claim_shape_chk`
    CHECK (
      (
        `dispatchClaimedAt` IS NULL
        AND `dispatchGatewayRef` IS NULL
        AND `dispatchRuntimeJson` IS NULL
        AND `dispatchRuntimeHash` IS NULL
        AND `dispatchClaimHash` IS NULL
        AND `dispatchProviderIdempotencyKey` IS NULL
        AND `dispatchLeaseExpiresAt` IS NULL
      )
      OR
      (
        `dispatchClaimedAt` IS NOT NULL
        AND `dispatchGatewayRef` IS NOT NULL
        AND `dispatchRuntimeJson` IS NOT NULL
        AND `dispatchRuntimeHash` IS NOT NULL
        AND `dispatchClaimHash` IS NOT NULL
        AND `dispatchProviderIdempotencyKey` IS NOT NULL
        AND `dispatchLeaseExpiresAt` IS NOT NULL
        AND `dispatchLeaseExpiresAt` > `dispatchClaimedAt`
      )
    ),
  CONSTRAINT `ModelRouteDecision_allowed_shape_chk`
    CHECK (
      `decision` <> 'ALLOWED'
      OR (
        `policyId` IS NOT NULL
        AND `readinessReceiptId` IS NOT NULL
        AND `routeRef` IS NOT NULL
        AND `routeSnapshotJson` IS NOT NULL
        AND `adapterReadinessState` = 'READY'
        AND `promptInjectionScanStatus` = 'PASSED'
      )
    ),
  CONSTRAINT `ModelRouteDecision_state_chk`
    CHECK (
      `attemptOrdinal` >= 0
      AND `policyHeadVersion` >= 0
      AND `policyRevocationEpoch` >= 0
      AND `requestedMaxOutputTokens` > 0
      AND `sensitivity` IN ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED')
      AND `processingDisposition` IN ('PROHIBITED', 'LOCAL_ONLY', 'REMOTE_PROJECTED')
      AND `promptInjectionScanStatus` IN ('PASSED', 'FAILED', 'NOT_RUN')
      AND `adapterReadinessState` IN ('READY', 'NOT_READY', 'UNKNOWN')
      AND `catalogVisibilityState` IN ('VISIBLE', 'HIDDEN', 'UNKNOWN')
      AND `decision` IN ('ALLOWED', 'BLOCKED')
      AND `validUntil` > `createdAt`
    ),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ModelEgressReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `decisionId` VARCHAR(191) NOT NULL,
  `previousReceiptId` VARCHAR(191) NULL,
  `previousReceiptHash` VARCHAR(191) NULL,
  `sequence` INTEGER NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `phase` VARCHAR(191) NOT NULL,
  `outcome` VARCHAR(191) NOT NULL,
  `resolutionSource` VARCHAR(191) NOT NULL,
  `provider` VARCHAR(191) NOT NULL,
  `modelId` VARCHAR(191) NOT NULL,
  `modelVersion` VARCHAR(191) NOT NULL,
  `deploymentForm` VARCHAR(191) NOT NULL,
  `jurisdiction` VARCHAR(191) NOT NULL,
  `region` VARCHAR(191) NOT NULL,
  `policyHash` VARCHAR(191) NOT NULL,
  `readinessReceiptHash` VARCHAR(191) NOT NULL,
  `projectedPayloadHash` VARCHAR(191) NOT NULL,
  `selectedEvidenceRefs` LONGTEXT NOT NULL,
  `droppedEvidenceRefs` LONGTEXT NOT NULL,
  `projectionReceiptRef` VARCHAR(191) NULL,
  `projectionReceiptHash` VARCHAR(191) NULL,
  `rawContentIncluded` BOOLEAN NOT NULL DEFAULT false,
  `dispatchGatewayRef` VARCHAR(191) NULL,
  `dispatchRuntimeHash` VARCHAR(191) NULL,
  `dispatchClaimHash` VARCHAR(191) NULL,
  `requestDisposition` VARCHAR(191) NOT NULL,
  `providerRequestRefHash` VARCHAR(191) NULL,
  `startedAt` DATETIME(3) NOT NULL,
  `finishedAt` DATETIME(3) NULL,
  `latencyMs` INTEGER NULL,
  `promptTokens` INTEGER NULL,
  `completionTokens` INTEGER NULL,
  `actualCostUsdMicros` INTEGER NULL,
  `costCurrency` VARCHAR(191) NULL,
  `pricingVersion` VARCHAR(191) NULL,
  `costBand` VARCHAR(191) NOT NULL,
  `errorCode` VARCHAR(191) NULL,
  `fallbackTargetRouteRef` VARCHAR(191) NULL,
  `fallbackReason` VARCHAR(191) NULL,
  `auditRef` VARCHAR(191) NOT NULL,
  `receiptJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `recordedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `ModelEgressReceipt_id_workspaceId_key` (`id`, `workspaceId`),
  UNIQUE INDEX `ModelEgressReceipt_id_decision_workspace_key` (`id`, `decisionId`, `workspaceId`),
  UNIQUE INDEX `ModelEgressReceipt_decision_sequence_key` (`decisionId`, `sequence`),
  UNIQUE INDEX `ModelEgressReceipt_workspace_idem_key` (`workspaceId`, `idempotencyKey`),
  UNIQUE INDEX `ModelEgressReceipt_workspace_hash_key` (`workspaceId`, `contentHash`),
  UNIQUE INDEX `ModelEgressReceipt_previous_decision_workspace_key` (`previousReceiptId`, `decisionId`, `workspaceId`),
  INDEX `ModelEgressReceipt_workspace_outcome_time_idx` (`workspaceId`, `outcome`, `recordedAt`),
  INDEX `ModelEgressReceipt_decision_workspace_idx` (`decisionId`, `workspaceId`),
  CONSTRAINT `ModelEgressReceipt_no_raw_content_chk`
    CHECK (`rawContentIncluded` = false),
  CONSTRAINT `ModelEgressReceipt_state_chk`
    CHECK (
      `sequence` IN (1, 2)
      AND `phase` IN ('DISPATCH_STARTED', 'TERMINAL')
      AND `outcome` IN ('UNKNOWN', 'SUCCESS', 'FAILURE', 'PARTIAL')
      AND `resolutionSource` IN ('NONE', 'INVOKE', 'RECONCILE')
      AND `requestDisposition` IN ('NOT_ACCEPTED', 'ACCEPTED', 'UNKNOWN')
      AND `deploymentForm` IN ('LOCAL', 'PRIVATE_DEPLOYMENT', 'DOMESTIC_CLOUD', 'FOREIGN_CLOUD')
      AND `jurisdiction` IN ('CUSTOMER_PREMISES', 'DOMESTIC', 'FOREIGN')
      AND `costBand` IN ('UNKNOWN', 'ZERO', 'LOW', 'MEDIUM', 'HIGH')
      AND (`latencyMs` IS NULL OR `latencyMs` >= 0)
      AND (`promptTokens` IS NULL OR `promptTokens` >= 0)
      AND (`completionTokens` IS NULL OR `completionTokens` >= 0)
      AND (`actualCostUsdMicros` IS NULL OR `actualCostUsdMicros` >= 0)
      AND (`costCurrency` IS NULL OR `costCurrency` = 'USD')
      AND (`finishedAt` IS NULL OR `finishedAt` >= `startedAt`)
      AND `recordedAt` >= `startedAt`
    ),
  CONSTRAINT `ModelEgressReceipt_phase_shape_chk`
    CHECK (
      (
        `sequence` = 1
        AND `phase` = 'DISPATCH_STARTED'
        AND `outcome` = 'UNKNOWN'
        AND `previousReceiptId` IS NULL
        AND `previousReceiptHash` IS NULL
        AND `dispatchGatewayRef` IS NULL
        AND `dispatchRuntimeHash` IS NULL
        AND `dispatchClaimHash` IS NULL
        AND `resolutionSource` = 'NONE'
        AND `requestDisposition` = 'UNKNOWN'
        AND `providerRequestRefHash` IS NULL
        AND `finishedAt` IS NULL
        AND `latencyMs` IS NULL
        AND `promptTokens` IS NULL
        AND `completionTokens` IS NULL
        AND `actualCostUsdMicros` IS NULL
        AND `costCurrency` IS NULL
        AND `pricingVersion` IS NULL
        AND `costBand` = 'UNKNOWN'
        AND `errorCode` IS NULL
        AND `fallbackTargetRouteRef` IS NULL
        AND `fallbackReason` IS NULL
      )
      OR
      (
        `sequence` = 2
        AND `phase` = 'TERMINAL'
        AND `outcome` IN ('SUCCESS', 'FAILURE', 'PARTIAL')
        AND `previousReceiptId` IS NOT NULL
        AND `previousReceiptHash` IS NOT NULL
        AND `dispatchGatewayRef` IS NOT NULL
        AND `dispatchRuntimeHash` IS NOT NULL
        AND `dispatchClaimHash` IS NOT NULL
        AND `resolutionSource` IN ('INVOKE', 'RECONCILE')
        AND `requestDisposition` IN ('ACCEPTED', 'NOT_ACCEPTED')
        AND `finishedAt` IS NOT NULL
        AND `actualCostUsdMicros` IS NOT NULL
        AND `costCurrency` = 'USD'
        AND `pricingVersion` IS NOT NULL
      )
    ),
  CONSTRAINT `ModelEgressReceipt_failure_shape_chk`
    CHECK (`outcome` <> 'FAILURE' OR `errorCode` IS NOT NULL),
  CONSTRAINT `ModelEgressReceipt_success_shape_chk`
    CHECK (
      `outcome` NOT IN ('SUCCESS', 'PARTIAL')
      OR (
        `requestDisposition` = 'ACCEPTED'
        AND `providerRequestRefHash` IS NOT NULL
      )
    ),
  CONSTRAINT `ModelEgressReceipt_success_no_error_chk`
    CHECK (`outcome` <> 'SUCCESS' OR `errorCode` IS NULL),
  CONSTRAINT `ModelEgressReceipt_not_accepted_cost_chk`
    CHECK (
      `requestDisposition` <> 'NOT_ACCEPTED'
      OR `actualCostUsdMicros` = 0
    ),
  CONSTRAINT `ModelEgressReceipt_request_ref_disposition_chk`
    CHECK (
      (`requestDisposition` = 'ACCEPTED' AND `providerRequestRefHash` IS NOT NULL)
      OR
      (`requestDisposition` = 'NOT_ACCEPTED' AND `providerRequestRefHash` IS NULL)
      OR
      `requestDisposition` = 'UNKNOWN'
    ),
  CONSTRAINT `ModelEgressReceipt_fallback_pair_chk`
    CHECK (
      (`fallbackTargetRouteRef` IS NULL AND `fallbackReason` IS NULL)
      OR
      (
        `outcome` = 'FAILURE'
        AND `requestDisposition` = 'NOT_ACCEPTED'
        AND `fallbackTargetRouteRef` IS NOT NULL
        AND `fallbackReason` IS NOT NULL
        AND `fallbackReason` = `errorCode`
      )
    ),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TRIGGER `ModelEgressReceipt_append_only_update`
BEFORE UPDATE ON `ModelEgressReceipt`
FOR EACH ROW
SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'ModelEgressReceipt is append-only';

CREATE TRIGGER `ModelEgressReceipt_append_only_delete`
BEFORE DELETE ON `ModelEgressReceipt`
FOR EACH ROW
SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'ModelEgressReceipt is append-only';

-- This branch intentionally follows the current Prisma `relationMode =
-- "prisma"` truth and therefore does not hand-author database foreign keys.
-- The separate G6 migration removes relationMode and owns FK reconciliation;
-- the integration branch must generate the P1D FK follow-up after G6 lands.
