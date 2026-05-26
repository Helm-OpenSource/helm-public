-- CreateTable
CREATE TABLE "RuntimeEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "meetingId" TEXT,
    "opportunityId" TEXT,
    "companyId" TEXT,
    "relatedObjectType" TEXT,
    "relatedObjectId" TEXT,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "trustedContext" TEXT,
    "untrustedContext" TEXT,
    "payload" TEXT,
    "sourceProvenance" TEXT,
    "triggeredBy" TEXT NOT NULL,
    "errorMessage" TEXT,
    "queuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "failedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RuntimeEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RuntimeEvent_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RuntimeEvent_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RuntimeEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkerRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "runtimeEventId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "inputSummary" TEXT,
    "outputSummary" TEXT,
    "evidenceRefs" TEXT,
    "sourceProvenance" TEXT,
    "confidence" INTEGER,
    "openQuestions" TEXT,
    "errorMessage" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "failedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "companyId" TEXT,
    "opportunityId" TEXT,
    "meetingId" TEXT,
    CONSTRAINT "WorkerRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkerRun_runtimeEventId_fkey" FOREIGN KEY ("runtimeEventId") REFERENCES "RuntimeEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkerRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkerRun_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkerRun_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArtifactBundle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "runtimeEventId" TEXT,
    "workerRunId" TEXT,
    "meetingId" TEXT,
    "opportunityId" TEXT,
    "companyId" TEXT,
    "artifactType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvalTier" TEXT,
    "systemOfRecordWrite" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT,
    "artifactsJson" TEXT NOT NULL,
    "evidenceRefs" TEXT,
    "sourceProvenance" TEXT,
    "confidence" INTEGER,
    "openQuestions" TEXT,
    "reviewPosture" TEXT,
    "reviewedAt" DATETIME,
    "confirmedAt" DATETIME,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ArtifactBundle_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ArtifactBundle_runtimeEventId_fkey" FOREIGN KEY ("runtimeEventId") REFERENCES "RuntimeEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ArtifactBundle_workerRunId_fkey" FOREIGN KEY ("workerRunId") REFERENCES "WorkerRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ArtifactBundle_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ArtifactBundle_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ArtifactBundle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MemoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "runtimeEventId" TEXT,
    "workerRunId" TEXT,
    "artifactBundleId" TEXT,
    "meetingId" TEXT,
    "opportunityId" TEXT,
    "companyId" TEXT,
    "objectType" TEXT,
    "objectId" TEXT,
    "kind" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "verification" TEXT NOT NULL DEFAULT 'DRAFT',
    "sensitivity" TEXT NOT NULL DEFAULT 'INTERNAL',
    "retention" TEXT NOT NULL DEFAULT 'UNTIL_VERIFIED',
    "promotionRule" TEXT NOT NULL DEFAULT 'NONE',
    "writer" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "sourceProvenance" TEXT,
    "evidenceRefs" TEXT,
    "confidence" INTEGER,
    "lastValidatedAt" DATETIME,
    "confirmedAt" DATETIME,
    "promotedAt" DATETIME,
    "deprecatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MemoryItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemoryItem_runtimeEventId_fkey" FOREIGN KEY ("runtimeEventId") REFERENCES "RuntimeEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MemoryItem_workerRunId_fkey" FOREIGN KEY ("workerRunId") REFERENCES "WorkerRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MemoryItem_artifactBundleId_fkey" FOREIGN KEY ("artifactBundleId") REFERENCES "ArtifactBundle" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MemoryItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MemoryItem_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MemoryItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "runtimeEventId" TEXT,
    "workerRunId" TEXT,
    "artifactBundleId" TEXT NOT NULL,
    "requestedAction" TEXT NOT NULL,
    "approvalTier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT NOT NULL,
    "requestedReason" TEXT,
    "resolvedByUserId" TEXT,
    "resolutionNotes" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApprovalRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRequest_runtimeEventId_fkey" FOREIGN KEY ("runtimeEventId") REFERENCES "RuntimeEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRequest_workerRunId_fkey" FOREIGN KEY ("workerRunId") REFERENCES "WorkerRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRequest_artifactBundleId_fkey" FOREIGN KEY ("artifactBundleId") REFERENCES "ArtifactBundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArtifactReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "runtimeEventId" TEXT,
    "artifactBundleId" TEXT NOT NULL,
    "approvalRequestId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewNotes" TEXT,
    "editedPayload" TEXT,
    "decisionSummary" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ArtifactReview_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ArtifactReview_runtimeEventId_fkey" FOREIGN KEY ("runtimeEventId") REFERENCES "RuntimeEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ArtifactReview_artifactBundleId_fkey" FOREIGN KEY ("artifactBundleId") REFERENCES "ArtifactBundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ArtifactReview_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "ApprovalRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Opportunity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "companyId" TEXT,
    "ownerId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "nextAction" TEXT,
    "shadowStage" TEXT,
    "shadowRiskLevel" TEXT,
    "shadowNextAction" TEXT,
    "shadowBlockersSummary" TEXT,
    "shadowManagerAttentionFlag" BOOLEAN NOT NULL DEFAULT false,
    "shadowStageConfidence" INTEGER,
    "shadowUpdatedAt" DATETIME,
    "externalSource" TEXT,
    "externalObjectType" TEXT,
    "externalObjectId" TEXT,
    "externalOwnerId" TEXT,
    "externalSyncedAt" DATETIME,
    "dueDate" DATETIME,
    "priorityScore" INTEGER NOT NULL DEFAULT 50,
    "lossReason" TEXT,
    "lastProgressAt" DATETIME,
    "nextStepSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Opportunity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Opportunity" ("companyId", "createdAt", "description", "dueDate", "externalObjectId", "externalObjectType", "externalOwnerId", "externalSource", "externalSyncedAt", "id", "lastProgressAt", "lossReason", "nextAction", "nextStepSummary", "ownerId", "priorityScore", "riskLevel", "stage", "title", "type", "updatedAt", "workspaceId") SELECT "companyId", "createdAt", "description", "dueDate", "externalObjectId", "externalObjectType", "externalOwnerId", "externalSource", "externalSyncedAt", "id", "lastProgressAt", "lossReason", "nextAction", "nextStepSummary", "ownerId", "priorityScore", "riskLevel", "stage", "title", "type", "updatedAt", "workspaceId" FROM "Opportunity";
DROP TABLE "Opportunity";
ALTER TABLE "new_Opportunity" RENAME TO "Opportunity";
CREATE UNIQUE INDEX "Opportunity_workspaceId_externalSource_externalObjectId_key" ON "Opportunity"("workspaceId", "externalSource", "externalObjectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "RuntimeEvent_workspaceId_eventType_createdAt_idx" ON "RuntimeEvent"("workspaceId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "RuntimeEvent_workspaceId_status_createdAt_idx" ON "RuntimeEvent"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "RuntimeEvent_meetingId_createdAt_idx" ON "RuntimeEvent"("meetingId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkerRun_workspaceId_agentId_createdAt_idx" ON "WorkerRun"("workspaceId", "agentId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkerRun_runtimeEventId_status_idx" ON "WorkerRun"("runtimeEventId", "status");

-- CreateIndex
CREATE INDEX "ArtifactBundle_workspaceId_artifactType_createdAt_idx" ON "ArtifactBundle"("workspaceId", "artifactType", "createdAt");

-- CreateIndex
CREATE INDEX "ArtifactBundle_meetingId_createdAt_idx" ON "ArtifactBundle"("meetingId", "createdAt");

-- CreateIndex
CREATE INDEX "ArtifactBundle_opportunityId_createdAt_idx" ON "ArtifactBundle"("opportunityId", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryItem_workspaceId_status_createdAt_idx" ON "MemoryItem"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryItem_workspaceId_kind_status_idx" ON "MemoryItem"("workspaceId", "kind", "status");

-- CreateIndex
CREATE INDEX "MemoryItem_meetingId_status_idx" ON "MemoryItem"("meetingId", "status");

-- CreateIndex
CREATE INDEX "MemoryItem_opportunityId_status_idx" ON "MemoryItem"("opportunityId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRequest_artifactBundleId_key" ON "ApprovalRequest"("artifactBundleId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_workspaceId_status_createdAt_idx" ON "ApprovalRequest"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArtifactReview_artifactBundleId_key" ON "ArtifactReview"("artifactBundleId");

-- CreateIndex
CREATE UNIQUE INDEX "ArtifactReview_approvalRequestId_key" ON "ArtifactReview"("approvalRequestId");

-- CreateIndex
CREATE INDEX "ArtifactReview_workspaceId_status_createdAt_idx" ON "ArtifactReview"("workspaceId", "status", "createdAt");
