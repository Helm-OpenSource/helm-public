ALTER TABLE "Contact" ADD COLUMN "relationshipStage" TEXT;
ALTER TABLE "Contact" ADD COLUMN "relationshipTemperature" INTEGER NOT NULL DEFAULT 50;

ALTER TABLE "Company" ADD COLUMN "lastInteractionAt" DATETIME;

ALTER TABLE "Opportunity" ADD COLUMN "lastProgressAt" DATETIME;
ALTER TABLE "Opportunity" ADD COLUMN "nextStepSummary" TEXT;

ALTER TABLE "Meeting" ADD COLUMN "briefingSnapshotId" TEXT;
ALTER TABLE "Meeting" ADD COLUMN "postMeetingSummary" TEXT;

ALTER TABLE "ActionItem" ADD COLUMN "sourceType" TEXT;
ALTER TABLE "ActionItem" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "ActionItem" ADD COLUMN "executionStatus" TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE "AuditLog" ADD COLUMN "sourcePage" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "relatedObjectType" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "relatedObjectId" TEXT;

CREATE TABLE "MemoryFact" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "objectType" TEXT NOT NULL,
  "objectId" TEXT NOT NULL,
  "factType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "normalizedValue" TEXT,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "confidence" INTEGER NOT NULL DEFAULT 50,
  "importance" INTEGER NOT NULL DEFAULT 50,
  "freshnessScore" INTEGER NOT NULL DEFAULT 50,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "confirmedByUser" BOOLEAN NOT NULL DEFAULT false,
  "createdBySystem" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemoryFact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MemoryFact_workspaceId_objectType_objectId_idx" ON "MemoryFact"("workspaceId", "objectType", "objectId");
CREATE INDEX "MemoryFact_workspaceId_factType_idx" ON "MemoryFact"("workspaceId", "factType");
CREATE INDEX "MemoryFact_workspaceId_sourceType_sourceId_idx" ON "MemoryFact"("workspaceId", "sourceType", "sourceId");
CREATE INDEX "MemoryFact_workspaceId_status_idx" ON "MemoryFact"("workspaceId", "status");

CREATE TABLE "MemoryLink" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "fromFactId" TEXT NOT NULL,
  "toFactId" TEXT NOT NULL,
  "relationType" TEXT NOT NULL,
  "weight" INTEGER NOT NULL DEFAULT 50,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemoryLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MemoryLink_fromFactId_fkey" FOREIGN KEY ("fromFactId") REFERENCES "MemoryFact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MemoryLink_toFactId_fkey" FOREIGN KEY ("toFactId") REFERENCES "MemoryFact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MemoryLink_workspaceId_fromFactId_idx" ON "MemoryLink"("workspaceId", "fromFactId");
CREATE INDEX "MemoryLink_workspaceId_toFactId_idx" ON "MemoryLink"("workspaceId", "toFactId");

CREATE TABLE "MemoryCorrection" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "memoryFactId" TEXT NOT NULL,
  "correctionType" TEXT NOT NULL,
  "beforeValue" TEXT,
  "afterValue" TEXT,
  "correctedByUserId" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemoryCorrection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MemoryCorrection_memoryFactId_fkey" FOREIGN KEY ("memoryFactId") REFERENCES "MemoryFact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MemoryCorrection_correctedByUserId_fkey" FOREIGN KEY ("correctedByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MemoryCorrection_workspaceId_memoryFactId_idx" ON "MemoryCorrection"("workspaceId", "memoryFactId");

CREATE TABLE "Commitment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "commitmentText" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "relatedContactId" TEXT,
  "relatedCompanyId" TEXT,
  "relatedOpportunityId" TEXT,
  "relatedMeetingId" TEXT,
  "ownerUserId" TEXT,
  "dueDate" DATETIME,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "priority" INTEGER NOT NULL DEFAULT 50,
  "overdueFlag" BOOLEAN NOT NULL DEFAULT false,
  "fulfilledAt" DATETIME,
  "confidence" INTEGER NOT NULL DEFAULT 60,
  "statusNote" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Commitment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Commitment_relatedContactId_fkey" FOREIGN KEY ("relatedContactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Commitment_relatedCompanyId_fkey" FOREIGN KEY ("relatedCompanyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Commitment_relatedOpportunityId_fkey" FOREIGN KEY ("relatedOpportunityId") REFERENCES "Opportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Commitment_relatedMeetingId_fkey" FOREIGN KEY ("relatedMeetingId") REFERENCES "Meeting" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Commitment_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Commitment_workspaceId_status_idx" ON "Commitment"("workspaceId", "status");
CREATE INDEX "Commitment_workspaceId_relatedOpportunityId_idx" ON "Commitment"("workspaceId", "relatedOpportunityId");
CREATE INDEX "Commitment_workspaceId_dueDate_idx" ON "Commitment"("workspaceId", "dueDate");
CREATE INDEX "Commitment_workspaceId_ownerUserId_idx" ON "Commitment"("workspaceId", "ownerUserId");

CREATE TABLE "Blocker" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "blockerType" TEXT NOT NULL,
  "blockerText" TEXT NOT NULL,
  "severity" INTEGER NOT NULL DEFAULT 50,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "relatedContactId" TEXT,
  "relatedCompanyId" TEXT,
  "relatedOpportunityId" TEXT,
  "relatedMeetingId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "resolutionNote" TEXT,
  "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Blocker_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Blocker_relatedContactId_fkey" FOREIGN KEY ("relatedContactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Blocker_relatedCompanyId_fkey" FOREIGN KEY ("relatedCompanyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Blocker_relatedOpportunityId_fkey" FOREIGN KEY ("relatedOpportunityId") REFERENCES "Opportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Blocker_relatedMeetingId_fkey" FOREIGN KEY ("relatedMeetingId") REFERENCES "Meeting" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Blocker_workspaceId_status_idx" ON "Blocker"("workspaceId", "status");
CREATE INDEX "Blocker_workspaceId_relatedOpportunityId_idx" ON "Blocker"("workspaceId", "relatedOpportunityId");
CREATE INDEX "Blocker_workspaceId_severity_idx" ON "Blocker"("workspaceId", "severity");

CREATE TABLE "BriefingSnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "objectType" TEXT NOT NULL,
  "objectId" TEXT NOT NULL,
  "snapshotType" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "sourceFactIds" TEXT,
  "sourceCommitmentIds" TEXT,
  "sourceBlockerIds" TEXT,
  "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" DATETIME,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "BriefingSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "BriefingSnapshot_workspaceId_objectType_objectId_snapshotType_idx" ON "BriefingSnapshot"("workspaceId", "objectType", "objectId", "snapshotType");
