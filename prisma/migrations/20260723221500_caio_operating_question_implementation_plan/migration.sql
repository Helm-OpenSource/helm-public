-- Materialize the canonical P1C implementation-planning draft for each
-- selected operating question. The plan grants no authority, creates no Work
-- Packet, and keeps missing implementation details as explicit gap codes.

CREATE UNIQUE INDEX `COQDecisionBinding_id_workspace_key`
  ON `CaioOperatingQuestionDecisionBinding`(`id`, `workspaceId`);

CREATE TABLE `CaioOperatingQuestionImplementationPlan` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `selectionReceiptId` VARCHAR(191) NOT NULL,
  `portfolioId` VARCHAR(191) NOT NULL,
  `questionId` VARCHAR(191) NOT NULL,
  `candidateHash` VARCHAR(191) NOT NULL,
  `decisionBindingId` VARCHAR(191) NOT NULL,
  `decisionRecordId` VARCHAR(191) NOT NULL,
  `planJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL,
  `implementationReadiness` VARCHAR(191) NOT NULL,
  `gapCodes` LONGTEXT NOT NULL,
  `authorityEffect` VARCHAR(191) NOT NULL,
  `workPacketEffect` VARCHAR(191) NOT NULL,
  `actorUserId` VARCHAR(191) NOT NULL,
  `plannedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `CaioOperatingQuestionImplementationPlan_decisionBindingId_key` (`decisionBindingId`),
  UNIQUE INDEX `CaioOperatingQuestionImplementationPlan_decisionRecordId_key` (`decisionRecordId`),
  UNIQUE INDEX `COQPlan_binding_workspace_key` (`decisionBindingId`, `workspaceId`),
  UNIQUE INDEX `COQPlan_decision_workspace_key` (`decisionRecordId`, `workspaceId`),
  UNIQUE INDEX `COQPlan_workspace_selection_question_key` (`workspaceId`, `selectionReceiptId`, `questionId`),
  INDEX `COQPlan_workspace_status_time_idx` (`workspaceId`, `status`, `plannedAt`),
  INDEX `COQPlan_workspace_portfolio_idx` (`workspaceId`, `portfolioId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CaioOperatingQuestionImplementationPlan`
  ADD CONSTRAINT `COQPlan_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioOperatingQuestionImplementationPlan`
  ADD CONSTRAINT `COQPlan_selection_workspace_portfolio_fkey`
  FOREIGN KEY (`selectionReceiptId`, `workspaceId`, `portfolioId`)
  REFERENCES `CaioQuestionSelectionReceipt`(`id`, `workspaceId`, `portfolioId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioOperatingQuestionImplementationPlan`
  ADD CONSTRAINT `COQPlan_portfolio_workspace_fkey`
  FOREIGN KEY (`portfolioId`, `workspaceId`)
  REFERENCES `CaioOperatingQuestionPortfolio`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioOperatingQuestionImplementationPlan`
  ADD CONSTRAINT `COQPlan_binding_workspace_fkey`
  FOREIGN KEY (`decisionBindingId`, `workspaceId`)
  REFERENCES `CaioOperatingQuestionDecisionBinding`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioOperatingQuestionImplementationPlan`
  ADD CONSTRAINT `COQPlan_decision_workspace_fkey`
  FOREIGN KEY (`decisionRecordId`, `workspaceId`)
  REFERENCES `DecisionRecord`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
