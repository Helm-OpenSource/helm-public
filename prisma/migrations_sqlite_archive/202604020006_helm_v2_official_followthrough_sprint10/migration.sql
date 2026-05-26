-- CreateTable
CREATE TABLE "OfficialFollowThrough" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "runtimeEventId" TEXT,
    "meetingId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "companyId" TEXT,
    "sourceWriteIntentId" TEXT,
    "sourceLimitedAutoIntentId" TEXT,
    "sourceAckId" TEXT,
    "sourceActionType" TEXT,
    "officialObjectRef" TEXT NOT NULL,
    "followThroughKey" TEXT NOT NULL,
    "followThroughType" TEXT NOT NULL,
    "exceptionClass" TEXT,
    "exceptionSeverity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "reconciliationStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "followThroughStatus" TEXT NOT NULL DEFAULT 'OPEN',
    "followThroughResolutionStatus" TEXT NOT NULL DEFAULT 'OPEN',
    "followThroughOwnerId" TEXT,
    "followThroughOwnerName" TEXT,
    "followThroughNextAction" TEXT,
    "followThroughDeadline" DATETIME,
    "followThroughBoundary" TEXT NOT NULL,
    "followThroughEvidenceRefs" TEXT,
    "followThroughWritebackTargets" TEXT NOT NULL,
    "followThroughSummary" TEXT,
    "resolutionNote" TEXT,
    "reconciliationNote" TEXT,
    "managerAttentionRequired" BOOLEAN NOT NULL DEFAULT false,
    "manualFallbackRequired" BOOLEAN NOT NULL DEFAULT false,
    "roleHandoffImpact" TEXT,
    "summaryWritebackImpact" TEXT,
    "blockerSummaryImpact" TEXT,
    "escalationReason" TEXT,
    "auditRef" TEXT,
    "resolvedByUserId" TEXT,
    "resolvedByName" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OfficialFollowThrough_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OfficialFollowThrough_runtimeEventId_fkey" FOREIGN KEY ("runtimeEventId") REFERENCES "RuntimeEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OfficialFollowThrough_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OfficialFollowThrough_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OfficialFollowThrough_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OfficialFollowThrough_sourceWriteIntentId_fkey" FOREIGN KEY ("sourceWriteIntentId") REFERENCES "OfficialWriteIntent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OfficialFollowThrough_sourceLimitedAutoIntentId_fkey" FOREIGN KEY ("sourceLimitedAutoIntentId") REFERENCES "LimitedAutoIntent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "OfficialFollowThrough_followThroughKey_key" ON "OfficialFollowThrough"("followThroughKey");

-- CreateIndex
CREATE INDEX "OfficialFollowThrough_workspaceId_followThroughStatus_createdAt_idx" ON "OfficialFollowThrough"("workspaceId", "followThroughStatus", "createdAt");

-- CreateIndex
CREATE INDEX "OfficialFollowThrough_workspaceId_reconciliationStatus_createdAt_idx" ON "OfficialFollowThrough"("workspaceId", "reconciliationStatus", "createdAt");

-- CreateIndex
CREATE INDEX "OfficialFollowThrough_meetingId_followThroughStatus_createdAt_idx" ON "OfficialFollowThrough"("meetingId", "followThroughStatus", "createdAt");

-- CreateIndex
CREATE INDEX "OfficialFollowThrough_opportunityId_followThroughStatus_createdAt_idx" ON "OfficialFollowThrough"("opportunityId", "followThroughStatus", "createdAt");
