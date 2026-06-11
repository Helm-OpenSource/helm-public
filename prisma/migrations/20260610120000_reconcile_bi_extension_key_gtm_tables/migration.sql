-- Reconcile schema.prisma with the migration chain.
-- Adds BiReport extensionKey columns, CSV/TRANSCRIPT_INGEST import sources,
-- widens SeatProfileResult.metricsJson, and creates the GTM/diagnostic tables
-- that existed in schema.prisma without any corresponding migration.

-- AlterTable
ALTER TABLE `BiReportDelivery` ADD COLUMN `extensionKey` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `BiReportRun` ADD COLUMN `extensionKey` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `BiReportSubscription` ADD COLUMN `extensionKey` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Company` MODIFY `externalSource` ENUM('HUBSPOT', 'SALESFORCE', 'GMAIL', 'GOOGLE_CALENDAR', 'DINGTALK', 'WECOM', 'FEISHU', 'CSV', 'TRANSCRIPT_INGEST') NULL;

-- AlterTable
ALTER TABLE `Contact` MODIFY `externalSource` ENUM('HUBSPOT', 'SALESFORCE', 'GMAIL', 'GOOGLE_CALENDAR', 'DINGTALK', 'WECOM', 'FEISHU', 'CSV', 'TRANSCRIPT_INGEST') NULL;

-- AlterTable
ALTER TABLE `Meeting` MODIFY `externalSource` ENUM('HUBSPOT', 'SALESFORCE', 'GMAIL', 'GOOGLE_CALENDAR', 'DINGTALK', 'WECOM', 'FEISHU', 'CSV', 'TRANSCRIPT_INGEST') NULL;

-- AlterTable
ALTER TABLE `Opportunity` MODIFY `externalSource` ENUM('HUBSPOT', 'SALESFORCE', 'GMAIL', 'GOOGLE_CALENDAR', 'DINGTALK', 'WECOM', 'FEISHU', 'CSV', 'TRANSCRIPT_INGEST') NULL;

-- AlterTable
ALTER TABLE `ImportSource` MODIFY `sourceType` ENUM('HUBSPOT', 'SALESFORCE', 'GMAIL', 'GOOGLE_CALENDAR', 'DINGTALK', 'WECOM', 'FEISHU', 'CSV', 'TRANSCRIPT_INGEST') NOT NULL;

-- AlterTable
ALTER TABLE `SeatProfileResult` MODIFY `metricsJson` LONGTEXT NOT NULL;

-- CreateTable
CREATE TABLE `GtmLead` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `leadKey` VARCHAR(191) NOT NULL,
    `sourceType` ENUM('COLD_OUTREACH', 'INBOUND_FORM', 'REFERRAL', 'PARTNER', 'EVENT', 'COMMUNITY', 'CONTENT', 'OTHER') NOT NULL,
    `sourceRef` VARCHAR(191) NULL,
    `referrerMembershipId` VARCHAR(191) NULL,
    `companyName` VARCHAR(191) NOT NULL,
    `industry` VARCHAR(191) NULL,
    `icpFit` ENUM('STRONG', 'MEDIUM', 'WEAK', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `readinessStage` ENUM('UNKNOWN', 'EXPLORING', 'PILOT_READY', 'TRIAL_IN_PROGRESS', 'POST_TRIAL') NOT NULL DEFAULT 'UNKNOWN',
    `ownerMembershipId` VARCHAR(191) NULL,
    `stage` ENUM('CAPTURED', 'QUALIFIED', 'GUIDED_INTAKE', 'DEMAND_BRIEF_READY', 'CUSTOMER_CONFIRMATION_PENDING', 'TRIAL_INITIALIZATION_READY', 'FIRST_LOOP_PROPOSED', 'FIRST_LOOP_ACTIVE', 'PROOF_READY', 'CONVERTED', 'NURTURED', 'LOST', 'DISQUALIFIED') NOT NULL DEFAULT 'CAPTURED',
    `nextAction` VARCHAR(191) NULL,
    `blocker` VARCHAR(191) NULL,
    `evidenceRefsJson` LONGTEXT NULL,
    `internalNotes` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GtmLead_workspaceId_stage_idx`(`workspaceId`, `stage`),
    INDEX `GtmLead_workspaceId_ownerMembershipId_idx`(`workspaceId`, `ownerMembershipId`),
    UNIQUE INDEX `GtmLead_workspaceId_leadKey_key`(`workspaceId`, `leadKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerDemandBrief` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `briefKey` VARCHAR(191) NOT NULL,
    `entryMode` ENUM('SALES_LED', 'SELF_SERVE') NOT NULL,
    `prefillSource` VARCHAR(191) NULL,
    `customerSummary` LONGTEXT NOT NULL,
    `businessPressureTagsJson` LONGTEXT NOT NULL,
    `currentResourceTagsJson` LONGTEXT NOT NULL,
    `resourceEvidenceReadinessJson` LONGTEXT NOT NULL,
    `painToControlLineCandidatesJson` LONGTEXT NOT NULL,
    `roleMapJson` LONGTEXT NOT NULL,
    `firstLoopCandidatesJson` LONGTEXT NOT NULL,
    `successCriteria` LONGTEXT NOT NULL,
    `riskBoundaryTagsJson` LONGTEXT NOT NULL,
    `customerVisibleSummary` LONGTEXT NOT NULL,
    `internalSalesNotes` LONGTEXT NULL,
    `trialInitializationPayloadJson` LONGTEXT NULL,
    `sourceTraceJson` LONGTEXT NOT NULL,
    `reviewStatus` ENUM('DRAFT', 'REVIEW_REQUIRED', 'APPROVED_FOR_TRIAL_INIT', 'REJECTED', 'SUPERSEDED') NOT NULL DEFAULT 'DRAFT',
    `customerConfirmationStatus` ENUM('NOT_INVITED', 'PENDING_CUSTOMER', 'PARTIAL_CONFIRMED', 'FULLY_CONFIRMED', 'CHANGE_REQUESTED') NOT NULL DEFAULT 'NOT_INVITED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CustomerDemandBrief_workspaceId_leadId_idx`(`workspaceId`, `leadId`),
    INDEX `CustomerDemandBrief_workspaceId_reviewStatus_idx`(`workspaceId`, `reviewStatus`),
    UNIQUE INDEX `CustomerDemandBrief_workspaceId_briefKey_key`(`workspaceId`, `briefKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OperatingControlLineCandidate` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `briefId` VARCHAR(191) NOT NULL,
    `candidateKey` VARCHAR(191) NOT NULL,
    `painTag` VARCHAR(191) NOT NULL,
    `controlLineTemplate` ENUM('LEAD_FOLLOW_UP', 'CUSTOMER_REVIEW', 'DELIVERY_RISK', 'OPPORTUNITY_JUDGEMENT', 'RENEWAL_EXPANSION', 'OTHER') NOT NULL,
    `targetBusinessObject` VARCHAR(191) NOT NULL,
    `resourceInputsJson` LONGTEXT NOT NULL,
    `evidenceReadiness` ENUM('DECLARED', 'PARTIAL', 'READY', 'VERIFIED') NOT NULL DEFAULT 'DECLARED',
    `status` ENUM('DRAFT', 'EVIDENCE_NEEDED', 'REVIEW_REQUIRED', 'TRIAL_PREMISE', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `evidenceNotesJson` LONGTEXT NOT NULL,
    `reviewerNotes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OperatingControlLineCandidate_workspaceId_briefId_idx`(`workspaceId`, `briefId`),
    INDEX `OperatingControlLineCandidate_workspaceId_status_idx`(`workspaceId`, `status`),
    UNIQUE INDEX `OperatingControlLineCandidate_workspaceId_candidateKey_key`(`workspaceId`, `candidateKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerContextUpdateRequest` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `briefId` VARCHAR(191) NULL,
    `controlLineCandidateId` VARCHAR(191) NULL,
    `requestKey` VARCHAR(191) NOT NULL,
    `origin` ENUM('CUSTOMER', 'INTERNAL') NOT NULL,
    `scope` ENUM('ROLES', 'GOALS', 'RESOURCES', 'CONTROL_LINE', 'TRIAL_PAYLOAD', 'OTHER') NOT NULL,
    `proposedChangesJson` LONGTEXT NOT NULL,
    `materiality` ENUM('MINOR', 'MATERIAL') NOT NULL,
    `reviewStatus` ENUM('DIRECT_APPLY', 'REVIEW_REQUIRED', 'ACCEPTED', 'REJECTED', 'SUPERSEDED') NOT NULL DEFAULT 'REVIEW_REQUIRED',
    `reviewerActor` VARCHAR(191) NULL,
    `reviewerDecisionNote` VARCHAR(191) NULL,
    `appliedAt` DATETIME(3) NULL,
    `supersededByRequestId` VARCHAR(191) NULL,
    `sourceTraceJson` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CustomerContextUpdateRequest_workspaceId_briefId_idx`(`workspaceId`, `briefId`),
    INDEX `CustomerContextUpdateRequest_workspaceId_leadId_idx`(`workspaceId`, `leadId`),
    INDEX `CustomerContextUpdateRequest_workspaceId_reviewStatus_idx`(`workspaceId`, `reviewStatus`),
    UNIQUE INDEX `CustomerContextUpdateRequest_workspaceId_requestKey_key`(`workspaceId`, `requestKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiagnosticSession` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `briefId` VARCHAR(191) NULL,
    `controlLineCandidateId` VARCHAR(191) NULL,
    `diagnosticKey` VARCHAR(191) NOT NULL,
    `workspaceCandidate` VARCHAR(191) NULL,
    `businessGoal` VARCHAR(191) NOT NULL,
    `availableResourcesJson` LONGTEXT NOT NULL,
    `roleReadinessJson` LONGTEXT NOT NULL,
    `firstLoopCandidateType` ENUM('LEAD_FOLLOW_UP', 'CUSTOMER_REVIEW', 'DELIVERY_RISK', 'OPPORTUNITY_JUDGEMENT', 'RENEWAL_EXPANSION', 'OTHER') NULL,
    `firstLoopCandidateNote` VARCHAR(191) NULL,
    `riskNotesJson` LONGTEXT NOT NULL,
    `boundaryNotesJson` LONGTEXT NOT NULL,
    `status` ENUM('DRAFT', 'REVIEWED', 'FIRST_LOOP_SELECTED', 'BLOCKED', 'SUPERSEDED') NOT NULL DEFAULT 'DRAFT',
    `reviewerActor` VARCHAR(191) NULL,
    `reviewerDecisionNote` VARCHAR(191) NULL,
    `sourceTraceJson` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DiagnosticSession_workspaceId_leadId_idx`(`workspaceId`, `leadId`),
    INDEX `DiagnosticSession_workspaceId_status_idx`(`workspaceId`, `status`),
    UNIQUE INDEX `DiagnosticSession_workspaceId_diagnosticKey_key`(`workspaceId`, `diagnosticKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `BiReportDelivery_workspaceId_extensionKey_createdAt_idx` ON `BiReportDelivery`(`workspaceId`, `extensionKey`, `createdAt`);

-- CreateIndex
CREATE INDEX `BiReportRun_workspaceId_extensionKey_startedAt_idx` ON `BiReportRun`(`workspaceId`, `extensionKey`, `startedAt`);

-- CreateIndex
CREATE INDEX `BiReportSubscription_workspaceId_extensionKey_enabled_idx` ON `BiReportSubscription`(`workspaceId`, `extensionKey`, `enabled`);


-- AddForeignKey
ALTER TABLE `GtmLead` ADD CONSTRAINT `GtmLead_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerDemandBrief` ADD CONSTRAINT `CustomerDemandBrief_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OperatingControlLineCandidate` ADD CONSTRAINT `OperatingControlLineCandidate_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerContextUpdateRequest` ADD CONSTRAINT `CustomerContextUpdateRequest_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiagnosticSession` ADD CONSTRAINT `DiagnosticSession_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
