-- Helm CAIO P1C operating-question portfolio and CEO selection ledger.
-- These records are evidence and review artifacts only. They grant no
-- authority, dispatch no Work Packet, and activate no external side effect.

CREATE UNIQUE INDEX `DecisionRecord_id_workspaceId_key`
  ON `DecisionRecord`(`id`, `workspaceId`);

CREATE TABLE `CaioOperatingQuestionPortfolio` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `initializationGateReceiptId` VARCHAR(191) NOT NULL,
  `initializationAssessmentId` VARCHAR(191) NOT NULL,
  `previousPortfolioId` VARCHAR(191) NULL,
  `sequence` INTEGER NOT NULL,
  `generationKey` VARCHAR(191) NOT NULL,
  `generationInputHash` VARCHAR(191) NOT NULL,
  `generatorRevision` VARCHAR(191) NOT NULL,
  `generatorRef` VARCHAR(191) NOT NULL,
  `modelRef` VARCHAR(191) NOT NULL,
  `policyRef` VARCHAR(191) NOT NULL,
  `policyHash` VARCHAR(191) NOT NULL,
  `g0ContextHash` VARCHAR(191) NOT NULL,
  `evidenceUniverseHash` VARCHAR(191) NOT NULL,
  `evidenceRefs` LONGTEXT NOT NULL,
  `auditRefs` LONGTEXT NOT NULL,
  `portfolioJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `authorityEffect` VARCHAR(191) NOT NULL,
  `generatedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `CaioOperatingQuestionPortfolio_id_workspaceId_key` (`id`, `workspaceId`),
  UNIQUE INDEX `COQPortfolio_id_workspace_gate_key` (`id`, `workspaceId`, `initializationGateReceiptId`),
  UNIQUE INDEX `COQPortfolio_workspace_gate_sequence_key` (`workspaceId`, `initializationGateReceiptId`, `sequence`),
  UNIQUE INDEX `COQPortfolio_previous_workspace_key` (`previousPortfolioId`, `workspaceId`),
  INDEX `COQPortfolio_workspace_gate_time_idx` (`workspaceId`, `initializationGateReceiptId`, `generatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CaioOperatingQuestionGenerationReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `initializationGateReceiptId` VARCHAR(191) NOT NULL,
  `initializationAssessmentId` VARCHAR(191) NOT NULL,
  `portfolioId` VARCHAR(191) NULL,
  `previousReceiptId` VARCHAR(191) NULL,
  `previousReceiptHash` VARCHAR(191) NULL,
  `sequence` INTEGER NOT NULL,
  `generationKey` VARCHAR(191) NOT NULL,
  `requestHash` VARCHAR(191) NOT NULL,
  `generationInputHash` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL,
  `evidenceRefs` LONGTEXT NOT NULL,
  `gapCodes` LONGTEXT NOT NULL,
  `generatorRevision` VARCHAR(191) NOT NULL,
  `policyRef` VARCHAR(191) NOT NULL,
  `policyHash` VARCHAR(191) NOT NULL,
  `receiptJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `authorityEffect` VARCHAR(191) NOT NULL,
  `recordedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `CaioOperatingQuestionGenerationReceipt_id_workspaceId_key` (`id`, `workspaceId`),
  UNIQUE INDEX `COQReceipt_id_workspace_gate_key` (`id`, `workspaceId`, `initializationGateReceiptId`),
  UNIQUE INDEX `COQReceipt_workspace_gate_sequence_key` (`workspaceId`, `initializationGateReceiptId`, `sequence`),
  UNIQUE INDEX `COQReceipt_workspace_gate_generation_key` (`workspaceId`, `initializationGateReceiptId`, `generationKey`),
  UNIQUE INDEX `COQReceipt_portfolio_workspace_gate_key` (`portfolioId`, `workspaceId`, `initializationGateReceiptId`),
  UNIQUE INDEX `COQReceipt_previous_workspace_gate_key` (`previousReceiptId`, `workspaceId`, `initializationGateReceiptId`),
  INDEX `COQReceipt_workspace_status_time_idx` (`workspaceId`, `status`, `recordedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CaioOperatingQuestionPortfolioHead` (
  `workspaceId` VARCHAR(191) NOT NULL,
  `initializationGateReceiptId` VARCHAR(191) NOT NULL,
  `initializationAssessmentId` VARCHAR(191) NOT NULL,
  `currentGenerationReceiptId` VARCHAR(191) NOT NULL,
  `currentPortfolioId` VARCHAR(191) NULL,
  `generationSequence` INTEGER NOT NULL,
  `portfolioSequence` INTEGER NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `COQHead_current_receipt_key` (`currentGenerationReceiptId`),
  UNIQUE INDEX `COQHead_receipt_workspace_gate_key` (`currentGenerationReceiptId`, `workspaceId`, `initializationGateReceiptId`),
  UNIQUE INDEX `COQHead_portfolio_workspace_gate_key` (`currentPortfolioId`, `workspaceId`, `initializationGateReceiptId`),
  PRIMARY KEY (`workspaceId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CaioQuestionSelectionReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `portfolioId` VARCHAR(191) NOT NULL,
  `initializationGateReceiptId` VARCHAR(191) NOT NULL,
  `ceoPrincipalBindingId` VARCHAR(191) NOT NULL,
  `previousReceiptId` VARCHAR(191) NULL,
  `previousReceiptHash` VARCHAR(191) NULL,
  `sequence` INTEGER NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `requestHash` VARCHAR(191) NOT NULL,
  `actorType` ENUM('USER', 'SYSTEM', 'AI') NOT NULL,
  `actorUserId` VARCHAR(191) NOT NULL,
  `ceoPrincipalRef` VARCHAR(191) NOT NULL,
  `selectionsJson` LONGTEXT NOT NULL,
  `selectedQuestionIds` LONGTEXT NOT NULL,
  `reasonCodes` LONGTEXT NOT NULL,
  `evidenceRefs` LONGTEXT NOT NULL,
  `receiptJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `authorityEffect` VARCHAR(191) NOT NULL,
  `workPacketEffect` VARCHAR(191) NOT NULL,
  `selectedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `CaioQuestionSelectionReceipt_id_workspaceId_key` (`id`, `workspaceId`),
  UNIQUE INDEX `CQSelection_id_workspace_portfolio_key` (`id`, `workspaceId`, `portfolioId`),
  UNIQUE INDEX `CQSelection_workspace_portfolio_sequence_key` (`workspaceId`, `portfolioId`, `sequence`),
  UNIQUE INDEX `CQSelection_workspace_portfolio_idem_key` (`workspaceId`, `portfolioId`, `idempotencyKey`),
  UNIQUE INDEX `CQSelection_previous_workspace_portfolio_key` (`previousReceiptId`, `workspaceId`, `portfolioId`),
  INDEX `CQSelection_workspace_time_idx` (`workspaceId`, `selectedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CaioQuestionSelectionHead` (
  `workspaceId` VARCHAR(191) NOT NULL,
  `currentPortfolioId` VARCHAR(191) NOT NULL,
  `currentGateReceiptId` VARCHAR(191) NOT NULL,
  `currentReceiptId` VARCHAR(191) NOT NULL,
  `sequence` INTEGER NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `CaioQuestionSelectionHead_currentReceiptId_key` (`currentReceiptId`),
  UNIQUE INDEX `CQSelectionHead_receipt_workspace_portfolio_key` (`currentReceiptId`, `workspaceId`, `currentPortfolioId`),
  UNIQUE INDEX `CQSelectionHead_portfolio_workspace_gate_key` (`currentPortfolioId`, `workspaceId`, `currentGateReceiptId`),
  PRIMARY KEY (`workspaceId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CaioOperatingQuestionDecisionBinding` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `selectionReceiptId` VARCHAR(191) NOT NULL,
  `portfolioId` VARCHAR(191) NOT NULL,
  `questionId` VARCHAR(191) NOT NULL,
  `candidateHash` VARCHAR(191) NOT NULL,
  `decisionRecordId` VARCHAR(191) NOT NULL,
  `actorUserId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `CaioOperatingQuestionDecisionBinding_decisionRecordId_key` (`decisionRecordId`),
  UNIQUE INDEX `COQDecisionBinding_workspace_selection_question_key` (`workspaceId`, `selectionReceiptId`, `questionId`),
  INDEX `COQDecisionBinding_workspace_portfolio_idx` (`workspaceId`, `portfolioId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CaioOperatingQuestionPortfolio`
  ADD CONSTRAINT `COQPortfolio_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioOperatingQuestionPortfolio`
  ADD CONSTRAINT `COQPortfolio_gate_workspace_fkey`
  FOREIGN KEY (`initializationGateReceiptId`, `workspaceId`)
  REFERENCES `CaioInitializationGateReceipt`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioOperatingQuestionPortfolio`
  ADD CONSTRAINT `COQPortfolio_assessment_workspace_fkey`
  FOREIGN KEY (`initializationAssessmentId`, `workspaceId`)
  REFERENCES `CaioInitializationAssessment`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioOperatingQuestionPortfolio`
  ADD CONSTRAINT `COQPortfolio_previous_workspace_fkey`
  FOREIGN KEY (`previousPortfolioId`, `workspaceId`)
  REFERENCES `CaioOperatingQuestionPortfolio`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `CaioOperatingQuestionGenerationReceipt`
  ADD CONSTRAINT `COQReceipt_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioOperatingQuestionGenerationReceipt`
  ADD CONSTRAINT `COQReceipt_gate_workspace_fkey`
  FOREIGN KEY (`initializationGateReceiptId`, `workspaceId`)
  REFERENCES `CaioInitializationGateReceipt`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioOperatingQuestionGenerationReceipt`
  ADD CONSTRAINT `COQReceipt_assessment_workspace_fkey`
  FOREIGN KEY (`initializationAssessmentId`, `workspaceId`)
  REFERENCES `CaioInitializationAssessment`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioOperatingQuestionGenerationReceipt`
  ADD CONSTRAINT `COQReceipt_portfolio_workspace_gate_fkey`
  FOREIGN KEY (`portfolioId`, `workspaceId`, `initializationGateReceiptId`)
  REFERENCES `CaioOperatingQuestionPortfolio`(`id`, `workspaceId`, `initializationGateReceiptId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioOperatingQuestionGenerationReceipt`
  ADD CONSTRAINT `COQReceipt_previous_workspace_gate_fkey`
  FOREIGN KEY (`previousReceiptId`, `workspaceId`, `initializationGateReceiptId`)
  REFERENCES `CaioOperatingQuestionGenerationReceipt`(`id`, `workspaceId`, `initializationGateReceiptId`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `CaioOperatingQuestionPortfolioHead`
  ADD CONSTRAINT `COQHead_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioOperatingQuestionPortfolioHead`
  ADD CONSTRAINT `COQHead_gate_workspace_fkey`
  FOREIGN KEY (`initializationGateReceiptId`, `workspaceId`)
  REFERENCES `CaioInitializationGateReceipt`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioOperatingQuestionPortfolioHead`
  ADD CONSTRAINT `COQHead_assessment_workspace_fkey`
  FOREIGN KEY (`initializationAssessmentId`, `workspaceId`)
  REFERENCES `CaioInitializationAssessment`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioOperatingQuestionPortfolioHead`
  ADD CONSTRAINT `COQHead_receipt_workspace_gate_fkey`
  FOREIGN KEY (`currentGenerationReceiptId`, `workspaceId`, `initializationGateReceiptId`)
  REFERENCES `CaioOperatingQuestionGenerationReceipt`(`id`, `workspaceId`, `initializationGateReceiptId`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `CaioOperatingQuestionPortfolioHead`
  ADD CONSTRAINT `COQHead_portfolio_workspace_gate_fkey`
  FOREIGN KEY (`currentPortfolioId`, `workspaceId`, `initializationGateReceiptId`)
  REFERENCES `CaioOperatingQuestionPortfolio`(`id`, `workspaceId`, `initializationGateReceiptId`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `CaioQuestionSelectionReceipt`
  ADD CONSTRAINT `CQSelection_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioQuestionSelectionReceipt`
  ADD CONSTRAINT `CQSelection_portfolio_workspace_gate_fkey`
  FOREIGN KEY (`portfolioId`, `workspaceId`, `initializationGateReceiptId`)
  REFERENCES `CaioOperatingQuestionPortfolio`(`id`, `workspaceId`, `initializationGateReceiptId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioQuestionSelectionReceipt`
  ADD CONSTRAINT `CQSelection_gate_workspace_fkey`
  FOREIGN KEY (`initializationGateReceiptId`, `workspaceId`)
  REFERENCES `CaioInitializationGateReceipt`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioQuestionSelectionReceipt`
  ADD CONSTRAINT `CQSelection_binding_workspace_fkey`
  FOREIGN KEY (`ceoPrincipalBindingId`, `workspaceId`)
  REFERENCES `CaioPrincipalBinding`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioQuestionSelectionReceipt`
  ADD CONSTRAINT `CQSelection_previous_workspace_portfolio_fkey`
  FOREIGN KEY (`previousReceiptId`, `workspaceId`, `portfolioId`)
  REFERENCES `CaioQuestionSelectionReceipt`(`id`, `workspaceId`, `portfolioId`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `CaioQuestionSelectionHead`
  ADD CONSTRAINT `CQSelectionHead_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioQuestionSelectionHead`
  ADD CONSTRAINT `CQSelectionHead_portfolio_workspace_gate_fkey`
  FOREIGN KEY (`currentPortfolioId`, `workspaceId`, `currentGateReceiptId`)
  REFERENCES `CaioOperatingQuestionPortfolio`(`id`, `workspaceId`, `initializationGateReceiptId`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `CaioQuestionSelectionHead`
  ADD CONSTRAINT `CQSelectionHead_receipt_workspace_portfolio_fkey`
  FOREIGN KEY (`currentReceiptId`, `workspaceId`, `currentPortfolioId`)
  REFERENCES `CaioQuestionSelectionReceipt`(`id`, `workspaceId`, `portfolioId`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `CaioOperatingQuestionDecisionBinding`
  ADD CONSTRAINT `COQDecisionBinding_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioOperatingQuestionDecisionBinding`
  ADD CONSTRAINT `COQDecisionBinding_selection_workspace_portfolio_fkey`
  FOREIGN KEY (`selectionReceiptId`, `workspaceId`, `portfolioId`)
  REFERENCES `CaioQuestionSelectionReceipt`(`id`, `workspaceId`, `portfolioId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioOperatingQuestionDecisionBinding`
  ADD CONSTRAINT `COQDecisionBinding_portfolio_workspace_fkey`
  FOREIGN KEY (`portfolioId`, `workspaceId`)
  REFERENCES `CaioOperatingQuestionPortfolio`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioOperatingQuestionDecisionBinding`
  ADD CONSTRAINT `COQDecisionBinding_decision_workspace_fkey`
  FOREIGN KEY (`decisionRecordId`, `workspaceId`)
  REFERENCES `DecisionRecord`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
