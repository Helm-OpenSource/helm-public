-- CreateTable
CREATE TABLE "LimitedAutoIntent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "runtimeEventId" TEXT,
    "meetingId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "companyId" TEXT,
    "sourceWriteIntentId" TEXT NOT NULL,
    "officialSystemType" TEXT NOT NULL,
    "officialObjectRef" TEXT NOT NULL,
    "limitedAutoActionType" TEXT NOT NULL,
    "limitedAutoEligibilityStatus" TEXT NOT NULL,
    "limitedAutoEligibilityReason" TEXT NOT NULL,
    "limitedAutoApprovalRequired" BOOLEAN NOT NULL DEFAULT true,
    "limitedAutoApprovalStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "limitedAutoExecutionStatus" TEXT NOT NULL DEFAULT 'REQUESTED',
    "limitedAutoAckStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "limitedAutoFailureStatus" TEXT NOT NULL DEFAULT 'NONE',
    "limitedAutoRollbackStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "approvalRequirements" TEXT,
    "proposedWritePayload" TEXT NOT NULL,
    "riskReviewSummary" TEXT,
    "evidenceRefs" TEXT,
    "sourceProvenance" TEXT,
    "boundaryTrace" TEXT,
    "confidence" INTEGER,
    "openQuestions" TEXT,
    "whatAutoPathWillDo" TEXT,
    "whatAutoPathWillNotDo" TEXT,
    "manualOnlyReason" TEXT,
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
    "limitedAutoAckPayload" TEXT,
    "limitedAutoFailureReason" TEXT,
    "manualReconciliationNote" TEXT,
    "deferredRetryNote" TEXT,
    "rollbackNote" TEXT,
    "externalSystemReference" TEXT,
    "limitedAutoAuditRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LimitedAutoIntent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LimitedAutoIntent_runtimeEventId_fkey" FOREIGN KEY ("runtimeEventId") REFERENCES "RuntimeEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LimitedAutoIntent_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LimitedAutoIntent_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LimitedAutoIntent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LimitedAutoIntent_sourceWriteIntentId_fkey" FOREIGN KEY ("sourceWriteIntentId") REFERENCES "OfficialWriteIntent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LimitedAutoIntent_sourceWriteIntentId_key" ON "LimitedAutoIntent"("sourceWriteIntentId");

-- CreateIndex
CREATE INDEX "LimitedAutoIntent_workspaceId_limitedAutoEligibilityStatus_createdAt_idx" ON "LimitedAutoIntent"("workspaceId", "limitedAutoEligibilityStatus", "createdAt");

-- CreateIndex
CREATE INDEX "LimitedAutoIntent_workspaceId_limitedAutoApprovalStatus_createdAt_idx" ON "LimitedAutoIntent"("workspaceId", "limitedAutoApprovalStatus", "createdAt");

-- CreateIndex
CREATE INDEX "LimitedAutoIntent_meetingId_limitedAutoApprovalStatus_createdAt_idx" ON "LimitedAutoIntent"("meetingId", "limitedAutoApprovalStatus", "createdAt");

-- CreateIndex
CREATE INDEX "LimitedAutoIntent_opportunityId_limitedAutoApprovalStatus_createdAt_idx" ON "LimitedAutoIntent"("opportunityId", "limitedAutoApprovalStatus", "createdAt");
