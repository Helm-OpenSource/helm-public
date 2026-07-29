-- WorkBuddy CAIO LAN collaboration transport persistence.
--
-- These tables hold typed delivery envelopes/ledger entries, suppression
-- rules, one-time presence and mutation challenges, and immutable response
-- receipts. They do not create questions, advice, decisions, tasks,
-- permissions, mandates, credentials, or execution authority.

CREATE TABLE `WorkBuddyDeliveryEnvelope` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `deliveryKey` VARCHAR(191) NOT NULL,
  `deliveryVersion` INTEGER NOT NULL,
  `sourceObjectKind` VARCHAR(191) NOT NULL,
  `sourceObjectId` VARCHAR(191) NOT NULL,
  `sourceObjectVersion` INTEGER NOT NULL,
  `sourceObjectHash` VARCHAR(191) NOT NULL,
  `severity` VARCHAR(191) NOT NULL,
  `category` VARCHAR(191) NOT NULL,
  `triggerRuleRef` VARCHAR(191) NOT NULL,
  `triggerSnapshotHash` VARCHAR(191) NOT NULL,
  `validUntil` DATETIME(3) NOT NULL,
  `status` VARCHAR(191) NOT NULL,
  `snoozedUntil` DATETIME(3) NULL,
  `envelopeJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `WBDeliveryEnvelope_id_workspace_key` (`id`, `workspaceId`),
  UNIQUE INDEX `WBDeliveryEnvelope_claim_binding_key` (`id`, `workspaceId`, `deliveryKey`, `deliveryVersion`, `severity`),
  UNIQUE INDEX `WBDeliveryEnvelope_workspace_key_version_key` (`workspaceId`, `deliveryKey`, `deliveryVersion`),
  UNIQUE INDEX `WBDeliveryEnvelope_workspace_key_snapshot_key` (`workspaceId`, `deliveryKey`, `triggerSnapshotHash`),
  INDEX `WBDeliveryEnvelope_workspace_lane_status_idx` (`workspaceId`, `severity`, `status`, `createdAt`),
  INDEX `WBDeliveryEnvelope_workspace_source_idx` (`workspaceId`, `sourceObjectKind`, `sourceObjectId`, `sourceObjectVersion`),
  CONSTRAINT `WBDeliveryEnvelope_state_chk`
    CHECK (
      `deliveryVersion` > 0
      AND `sourceObjectVersion` > 0
      AND `sourceObjectKind` IN (
        'operating_question_candidate',
        'caio_advice',
        'decision_record',
        'supervision_signal'
      )
      AND `severity` IN ('critical', 'normal')
      AND `status` IN (
        'pending',
        'delivered',
        'opened',
        'answered',
        'snoozed',
        'declined',
        'withdrawn',
        'expired'
      )
      AND `validUntil` > `createdAt`
      AND `updatedAt` >= `createdAt`
      AND (
        (
          `status` = 'snoozed'
          AND `snoozedUntil` IS NOT NULL
          AND `snoozedUntil` > `updatedAt`
          AND `snoozedUntil` <= `validUntil`
        )
        OR
        (`status` <> 'snoozed' AND `snoozedUntil` IS NULL)
      )
      AND (
        (`status` = 'expired' AND `updatedAt` >= `validUntil`)
        OR
        (`status` <> 'expired' AND `updatedAt` < `validUntil`)
      )
    ),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WorkBuddyDeliveryClientBinding` (
  `workspaceId` VARCHAR(191) NOT NULL,
  `clientId` VARCHAR(191) NOT NULL,
  `registeredAt` DATETIME(3) NOT NULL,
  `lastSeenAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `WBDeliveryClient_workspace_client_key` (`workspaceId`, `clientId`),
  CONSTRAINT `WBDeliveryClient_time_chk`
    CHECK (`lastSeenAt` >= `registeredAt`),
  PRIMARY KEY (`workspaceId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WorkBuddyDeliveryLane` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `clientId` VARCHAR(191) NOT NULL,
  `severity` VARCHAR(191) NOT NULL,
  `sequence` INTEGER NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `WBDeliveryLane_workspace_client_severity_key` (`workspaceId`, `clientId`, `severity`),
  CONSTRAINT `WBDeliveryLane_state_chk`
    CHECK (
      `severity` IN ('critical', 'normal')
      AND `sequence` >= 0
    ),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WorkBuddyDeliveryClaim` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `clientId` VARCHAR(191) NOT NULL,
  `deliveryObjectId` VARCHAR(191) NOT NULL,
  `deliveryKey` VARCHAR(191) NOT NULL,
  `deliveryVersion` INTEGER NOT NULL,
  `severity` VARCHAR(191) NOT NULL,
  `claimJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `claimedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `WBDeliveryClaim_id_workspace_key` (`id`, `workspaceId`),
  UNIQUE INDEX `WBDeliveryClaim_receipt_binding_key` (`id`, `workspaceId`, `contentHash`),
  UNIQUE INDEX `WBDeliveryClaim_presentation_binding_key` (`id`, `workspaceId`, `clientId`, `severity`),
  UNIQUE INDEX `WBDeliveryClaim_workspace_key_version_client_key` (`workspaceId`, `deliveryKey`, `deliveryVersion`, `clientId`),
  INDEX `WBDeliveryClaim_envelope_binding_idx` (`deliveryObjectId`, `workspaceId`, `deliveryKey`, `deliveryVersion`, `severity`),
  CONSTRAINT `WBDeliveryClaim_state_chk`
    CHECK (
      `deliveryVersion` > 0
      AND `severity` IN ('critical', 'normal')
    ),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WorkBuddyDeliveryPresentation` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `deliveryClaimId` VARCHAR(191) NOT NULL,
  `clientId` VARCHAR(191) NOT NULL,
  `severity` VARCHAR(191) NOT NULL,
  `sequence` INTEGER NOT NULL,
  `cause` VARCHAR(191) NOT NULL,
  `presentationJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `presentedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `WBDeliveryPresentation_id_workspace_key` (`id`, `workspaceId`),
  UNIQUE INDEX `WBDeliveryPresentation_workspace_client_lane_seq_key` (`workspaceId`, `clientId`, `severity`, `sequence`),
  INDEX `WBDeliveryPresentation_claim_binding_idx` (`deliveryClaimId`, `workspaceId`, `clientId`, `severity`),
  CONSTRAINT `WBDeliveryPresentation_state_chk`
    CHECK (
      `severity` IN ('critical', 'normal')
      AND `sequence` > 0
      AND `cause` IN ('initial', 'snooze_elapsed')
    ),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WorkBuddyDeliverySuppression` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `category` VARCHAR(191) NOT NULL,
  `scopeKind` VARCHAR(191) NOT NULL,
  `objectKind` VARCHAR(191) NULL,
  `objectId` VARCHAR(191) NULL,
  `validFrom` DATETIME(3) NOT NULL,
  `validUntil` DATETIME(3) NOT NULL,
  `revokedAt` DATETIME(3) NULL,
  `suppressionJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `WBDeliverySuppression_id_workspace_key` (`id`, `workspaceId`),
  INDEX `WBDeliverySuppression_workspace_category_time_idx` (`workspaceId`, `category`, `validFrom`, `validUntil`),
  CONSTRAINT `WBDeliverySuppression_state_chk`
    CHECK (
      `scopeKind` IN ('workspace', 'object_kind', 'object')
      AND `validUntil` > `validFrom`
      AND (
        (
          `scopeKind` = 'workspace'
          AND `objectKind` IS NULL
          AND `objectId` IS NULL
        )
        OR
        (
          `scopeKind` = 'object_kind'
          AND `objectKind` IN (
            'operating_question_candidate',
            'caio_advice',
            'decision_record',
            'supervision_signal'
          )
          AND `objectId` IS NULL
        )
        OR
        (
          `scopeKind` = 'object'
          AND `objectKind` IN (
            'operating_question_candidate',
            'caio_advice',
            'decision_record',
            'supervision_signal'
          )
          AND `objectId` IS NOT NULL
        )
      )
    ),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WorkBuddyMutationChallenge` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `clientId` VARCHAR(191) NOT NULL,
  `actorUserId` VARCHAR(191) NOT NULL,
  `ceoBindingRef` VARCHAR(191) NOT NULL,
  `mandateRef` VARCHAR(191) NOT NULL,
  `ceoRef` VARCHAR(191) NOT NULL,
  `actionKind` VARCHAR(191) NOT NULL,
  `targetObjectKind` VARCHAR(191) NOT NULL,
  `targetObjectId` VARCHAR(191) NOT NULL,
  `expectedVersion` INTEGER NOT NULL,
  `summaryHash` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `nonceHash` VARCHAR(191) NOT NULL,
  `bindingHash` VARCHAR(191) NOT NULL,
  `issuedAt` DATETIME(3) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `consumedAt` DATETIME(3) NULL,
  `proofHash` VARCHAR(191) NULL,
  `challengeJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `WBMutationChallenge_id_workspace_key` (`id`, `workspaceId`),
  UNIQUE INDEX `WBMutationChallenge_receipt_binding_key` (`id`, `workspaceId`, `bindingHash`),
  UNIQUE INDEX `WBMutationChallenge_workspace_action_idem_key` (`workspaceId`, `actionKind`, `idempotencyKey`),
  UNIQUE INDEX `WBMutationChallenge_workspace_client_nonce_key` (`workspaceId`, `clientId`, `nonceHash`),
  INDEX `WBMutationChallenge_workspace_client_expiry_idx` (`workspaceId`, `clientId`, `expiresAt`),
  CONSTRAINT `WBMutationChallenge_state_chk`
    CHECK (
      `actionKind` IN (
        'prompt_response',
        'question_selection',
        'advice_decision'
      )
      AND `targetObjectKind` IN (
        'operating_question_candidate',
        'caio_advice',
        'decision_record',
        'supervision_signal',
        'operating_question_portfolio'
      )
      AND `expectedVersion` > 0
      AND CHAR_LENGTH(`bindingHash`) = 71
      AND `bindingHash` LIKE 'sha256:%'
      AND `expiresAt` > `issuedAt`
      AND (
        (`consumedAt` IS NULL AND `proofHash` IS NULL)
        OR
        (
          `consumedAt` IS NOT NULL
          AND `proofHash` IS NOT NULL
          AND `consumedAt` >= `issuedAt`
          AND `consumedAt` <= `expiresAt`
        )
      )
    ),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WorkBuddyMutationReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `challengeId` VARCHAR(191) NOT NULL,
  `actionKind` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `targetObjectKind` VARCHAR(191) NOT NULL,
  `targetObjectId` VARCHAR(191) NOT NULL,
  `expectedVersion` INTEGER NOT NULL,
  `summaryHash` VARCHAR(191) NOT NULL,
  `bindingHash` VARCHAR(191) NOT NULL,
  `canonicalReceiptRef` VARCHAR(191) NOT NULL,
  `receiptJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `authorityEffect` VARCHAR(191) NOT NULL,
  `recordedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `WBMutationReceipt_id_workspace_key` (`id`, `workspaceId`),
  UNIQUE INDEX `WBMutationReceipt_challenge_binding_key` (`challengeId`, `workspaceId`, `bindingHash`),
  UNIQUE INDEX `WBMutationReceipt_workspace_action_idem_key` (`workspaceId`, `actionKind`, `idempotencyKey`),
  INDEX `WBMutationReceipt_workspace_time_idx` (`workspaceId`, `recordedAt`),
  CONSTRAINT `WBMutationReceipt_state_chk`
    CHECK (
      `actionKind` IN (
        'prompt_response',
        'question_selection',
        'advice_decision'
      )
      AND `targetObjectKind` IN (
        'operating_question_candidate',
        'caio_advice',
        'decision_record',
        'supervision_signal',
        'operating_question_portfolio'
      )
      AND `expectedVersion` > 0
      AND CHAR_LENGTH(`bindingHash`) = 71
      AND `bindingHash` LIKE 'sha256:%'
      AND `authorityEffect` = 'none'
    ),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WorkBuddyPresenceChallenge` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `clientId` VARCHAR(191) NOT NULL,
  `actorUserId` VARCHAR(191) NOT NULL,
  `ceoBindingRef` VARCHAR(191) NOT NULL,
  `mandateRef` VARCHAR(191) NOT NULL,
  `ceoRef` VARCHAR(191) NOT NULL,
  `beginIdempotencyKey` VARCHAR(191) NOT NULL,
  `completionIdempotencyKey` VARCHAR(191) NULL,
  `issuedAt` DATETIME(3) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `consumedAt` DATETIME(3) NULL,
  `challengeJson` LONGTEXT NOT NULL,
  `challengeHash` VARCHAR(191) NOT NULL,
  `nonceHash` VARCHAR(191) NOT NULL,
  `proofHash` VARCHAR(191) NULL,
  `attestationJson` LONGTEXT NULL,
  `attestationHash` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `WBPresenceChallenge_id_workspace_key` (`id`, `workspaceId`),
  UNIQUE INDEX `WBPresenceChallenge_workspace_client_begin_key` (`workspaceId`, `clientId`, `beginIdempotencyKey`),
  UNIQUE INDEX `WBPresenceChallenge_workspace_client_complete_key` (`workspaceId`, `clientId`, `completionIdempotencyKey`),
  UNIQUE INDEX `WBPresenceChallenge_workspace_client_nonce_key` (`workspaceId`, `clientId`, `nonceHash`),
  INDEX `WBPresenceChallenge_workspace_client_expiry_idx` (`workspaceId`, `clientId`, `expiresAt`),
  CONSTRAINT `WBPresenceChallenge_state_chk`
    CHECK (
      `expiresAt` > `issuedAt`
      AND (
        (
          `completionIdempotencyKey` IS NULL
          AND `consumedAt` IS NULL
          AND `proofHash` IS NULL
          AND `attestationJson` IS NULL
          AND `attestationHash` IS NULL
        )
        OR
        (
          `completionIdempotencyKey` IS NOT NULL
          AND `consumedAt` IS NOT NULL
          AND `proofHash` IS NOT NULL
          AND `attestationJson` IS NOT NULL
          AND `attestationHash` IS NOT NULL
          AND `consumedAt` >= `issuedAt`
          AND `consumedAt` <= `expiresAt`
        )
      )
    ),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WorkBuddyPromptResponseReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `deliveryObjectId` VARCHAR(191) NOT NULL,
  `deliveryClaimId` VARCHAR(191) NOT NULL,
  `deliveryClaimHash` VARCHAR(191) NOT NULL,
  `clientId` VARCHAR(191) NOT NULL,
  `actorUserId` VARCHAR(191) NOT NULL,
  `ceoBindingRef` VARCHAR(191) NOT NULL,
  `mandateRef` VARCHAR(191) NOT NULL,
  `ceoRef` VARCHAR(191) NOT NULL,
  `sourceObjectKind` VARCHAR(191) NOT NULL,
  `sourceObjectId` VARCHAR(191) NOT NULL,
  `sourceObjectHash` VARCHAR(191) NOT NULL,
  `expectedVersion` INTEGER NOT NULL,
  `responseKind` VARCHAR(191) NOT NULL,
  `resultingStatus` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `requestHash` VARCHAR(191) NOT NULL,
  `responseJson` LONGTEXT NOT NULL,
  `receiptJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `authorityEffect` VARCHAR(191) NOT NULL,
  `recordedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `WBPromptResponse_id_workspace_key` (`id`, `workspaceId`),
  UNIQUE INDEX `WBPromptResponse_workspace_idem_key` (`workspaceId`, `idempotencyKey`),
  INDEX `WBPromptResponse_envelope_workspace_time_idx` (`deliveryObjectId`, `workspaceId`, `recordedAt`),
  INDEX `WBPromptResponse_claim_binding_idx` (`deliveryClaimId`, `workspaceId`, `deliveryClaimHash`),
  CONSTRAINT `WBPromptResponse_state_chk`
    CHECK (
      `sourceObjectKind` IN (
        'operating_question_candidate',
        'decision_record',
        'supervision_signal'
      )
      AND `expectedVersion` > 0
      AND CHAR_LENGTH(`deliveryClaimHash`) = 71
      AND `deliveryClaimHash` LIKE 'sha256:%'
      AND `responseKind` IN (
        'answer',
        'provide_evidence',
        'snooze',
        'decline'
      )
      AND `resultingStatus` IN (
        'answered',
        'snoozed',
        'declined'
      )
      AND (
        (
          `responseKind` IN ('answer', 'provide_evidence')
          AND `resultingStatus` = 'answered'
        )
        OR
        (
          `responseKind` = 'snooze'
          AND `resultingStatus` = 'snoozed'
        )
        OR
        (
          `responseKind` = 'decline'
          AND `resultingStatus` = 'declined'
        )
      )
      AND `authorityEffect` = 'none'
    ),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `WorkBuddyDeliveryEnvelope`
  ADD CONSTRAINT `WBDeliveryEnvelope_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `WorkBuddyDeliveryClientBinding`
  ADD CONSTRAINT `WBDeliveryClient_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `WorkBuddyDeliveryLane`
  ADD CONSTRAINT `WBDeliveryLane_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `WorkBuddyDeliveryLane`
  ADD CONSTRAINT `WBDeliveryLane_client_fkey`
  FOREIGN KEY (`workspaceId`, `clientId`)
  REFERENCES `WorkBuddyDeliveryClientBinding`(`workspaceId`, `clientId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `WorkBuddyDeliveryClaim`
  ADD CONSTRAINT `WBDeliveryClaim_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `WorkBuddyDeliveryClaim`
  ADD CONSTRAINT `WBDeliveryClaim_client_fkey`
  FOREIGN KEY (`workspaceId`, `clientId`)
  REFERENCES `WorkBuddyDeliveryClientBinding`(`workspaceId`, `clientId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `WorkBuddyDeliveryClaim`
  ADD CONSTRAINT `WBDeliveryClaim_envelope_binding_fkey`
  FOREIGN KEY (`deliveryObjectId`, `workspaceId`, `deliveryKey`, `deliveryVersion`, `severity`)
  REFERENCES `WorkBuddyDeliveryEnvelope`(`id`, `workspaceId`, `deliveryKey`, `deliveryVersion`, `severity`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `WorkBuddyDeliveryPresentation`
  ADD CONSTRAINT `WBDeliveryPresentation_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `WorkBuddyDeliveryPresentation`
  ADD CONSTRAINT `WBDeliveryPresentation_claim_binding_fkey`
  FOREIGN KEY (`deliveryClaimId`, `workspaceId`, `clientId`, `severity`)
  REFERENCES `WorkBuddyDeliveryClaim`(`id`, `workspaceId`, `clientId`, `severity`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `WorkBuddyDeliverySuppression`
  ADD CONSTRAINT `WBDeliverySuppression_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `WorkBuddyMutationChallenge`
  ADD CONSTRAINT `WBMutationChallenge_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `WorkBuddyMutationReceipt`
  ADD CONSTRAINT `WBMutationReceipt_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `WorkBuddyMutationReceipt`
  ADD CONSTRAINT `WBMutationReceipt_challenge_binding_fkey`
  FOREIGN KEY (`challengeId`, `workspaceId`, `bindingHash`)
  REFERENCES `WorkBuddyMutationChallenge`(`id`, `workspaceId`, `bindingHash`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `WorkBuddyPresenceChallenge`
  ADD CONSTRAINT `WBPresenceChallenge_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `WorkBuddyPromptResponseReceipt`
  ADD CONSTRAINT `WBPromptResponse_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `WorkBuddyPromptResponseReceipt`
  ADD CONSTRAINT `WBPromptResponse_envelope_workspace_fkey`
  FOREIGN KEY (`deliveryObjectId`, `workspaceId`)
  REFERENCES `WorkBuddyDeliveryEnvelope`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `WorkBuddyPromptResponseReceipt`
  ADD CONSTRAINT `WBPromptResponse_claim_binding_fkey`
  FOREIGN KEY (`deliveryClaimId`, `workspaceId`, `deliveryClaimHash`)
  REFERENCES `WorkBuddyDeliveryClaim`(`id`, `workspaceId`, `contentHash`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
