-- CreateTable
CREATE TABLE "HumanActionExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "companyId" TEXT,
    "sourceArtifactBundleId" TEXT,
    "sourceArtifactType" TEXT NOT NULL,
    "sourceArtifactTitle" TEXT NOT NULL,
    "sourceArtifactSummary" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "executionOwnerId" TEXT,
    "executionOwnerName" TEXT,
    "executionIntent" TEXT NOT NULL,
    "executionBoundary" TEXT NOT NULL,
    "executionPrerequisite" TEXT,
    "executionDependency" TEXT,
    "executionRiskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "approvalContext" TEXT NOT NULL,
    "riskReviewSummary" TEXT,
    "acknowledgementStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "status" TEXT NOT NULL DEFAULT 'READY',
    "executionProofType" TEXT,
    "executionProofPayload" TEXT,
    "proofNote" TEXT,
    "externalReference" TEXT,
    "executedByUserId" TEXT,
    "executedByName" TEXT,
    "executedAt" DATETIME,
    "whatWasNotDone" TEXT,
    "followThroughStatus" TEXT,
    "executionWritebackTarget" TEXT NOT NULL,
    "writebackSummary" TEXT,
    "auditLoggedAt" DATETIME,
    "checkpointWrittenAt" DATETIME,
    "summaryWrittenAt" DATETIME,
    "evidenceRefs" TEXT,
    "sourceProvenance" TEXT,
    "boundaryTrace" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HumanActionExecution_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HumanActionExecution_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HumanActionExecution_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "HumanActionExecution_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "HumanActionExecution_sourceArtifactBundleId_fkey" FOREIGN KEY ("sourceArtifactBundleId") REFERENCES "ArtifactBundle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "HumanActionExecution_workspaceId_meetingId_actionType_key" ON "HumanActionExecution"("workspaceId", "meetingId", "actionType");

-- CreateIndex
CREATE INDEX "HumanActionExecution_workspaceId_status_createdAt_idx" ON "HumanActionExecution"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "HumanActionExecution_meetingId_status_createdAt_idx" ON "HumanActionExecution"("meetingId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "HumanActionExecution_opportunityId_status_createdAt_idx" ON "HumanActionExecution"("opportunityId", "status", "createdAt");
