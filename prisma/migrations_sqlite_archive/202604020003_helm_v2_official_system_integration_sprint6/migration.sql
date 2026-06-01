-- CreateTable
CREATE TABLE "OfficialWriteIntent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "runtimeEventId" TEXT,
    "meetingId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "companyId" TEXT,
    "sourceArtifactBundleId" TEXT,
    "sourceHumanActionExecutionId" TEXT,
    "sourceKey" TEXT NOT NULL,
    "officialSystemType" TEXT NOT NULL,
    "officialObjectRef" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceTitle" TEXT NOT NULL,
    "sourceSummary" TEXT NOT NULL,
    "writeActionType" TEXT NOT NULL,
    "writePayloadDraft" TEXT NOT NULL,
    "writeBoundary" TEXT NOT NULL,
    "writeApprovalTier" TEXT NOT NULL,
    "writeApprovalStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "writeExecutionStatus" TEXT NOT NULL DEFAULT 'REQUESTED',
    "writeAcknowledgementStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "sourceShadowRef" TEXT,
    "sourceExecutionProofRef" TEXT,
    "approvalRequirements" TEXT,
    "riskReviewSummary" TEXT,
    "evidenceRefs" TEXT,
    "sourceProvenance" TEXT,
    "boundaryTrace" TEXT,
    "confidence" INTEGER,
    "openQuestions" TEXT,
    "whatThisChanges" TEXT,
    "whatThisDoesNotMean" TEXT,
    "reviewNotes" TEXT,
    "approvedByUserId" TEXT,
    "approvedByName" TEXT,
    "approvedAt" DATETIME,
    "rejectedByUserId" TEXT,
    "rejectedByName" TEXT,
    "rejectedAt" DATETIME,
    "attemptedByUserId" TEXT,
    "attemptedByName" TEXT,
    "attemptedAt" DATETIME,
    "acknowledgedByUserId" TEXT,
    "acknowledgedByName" TEXT,
    "acknowledgedAt" DATETIME,
    "writeAcknowledgementPayload" TEXT,
    "writeFailureReason" TEXT,
    "manualReconciliationNote" TEXT,
    "deferredRetryNote" TEXT,
    "externalSystemReference" TEXT,
    "writeAuditRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OfficialWriteIntent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OfficialWriteIntent_runtimeEventId_fkey" FOREIGN KEY ("runtimeEventId") REFERENCES "RuntimeEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OfficialWriteIntent_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OfficialWriteIntent_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OfficialWriteIntent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OfficialWriteIntent_sourceArtifactBundleId_fkey" FOREIGN KEY ("sourceArtifactBundleId") REFERENCES "ArtifactBundle" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OfficialWriteIntent_sourceHumanActionExecutionId_fkey" FOREIGN KEY ("sourceHumanActionExecutionId") REFERENCES "HumanActionExecution" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "OfficialWriteIntent_workspaceId_sourceKey_key" ON "OfficialWriteIntent"("workspaceId", "sourceKey");

-- CreateIndex
CREATE INDEX "OfficialWriteIntent_workspaceId_writeApprovalStatus_createdAt_idx" ON "OfficialWriteIntent"("workspaceId", "writeApprovalStatus", "createdAt");

-- CreateIndex
CREATE INDEX "OfficialWriteIntent_meetingId_writeApprovalStatus_createdAt_idx" ON "OfficialWriteIntent"("meetingId", "writeApprovalStatus", "createdAt");

-- CreateIndex
CREATE INDEX "OfficialWriteIntent_opportunityId_writeApprovalStatus_createdAt_idx" ON "OfficialWriteIntent"("opportunityId", "writeApprovalStatus", "createdAt");
