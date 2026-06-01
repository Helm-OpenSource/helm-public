CREATE TABLE "EngineeringDeliveryReviewSnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "snapshotDate" DATETIME NOT NULL,
  "windowDays" INTEGER NOT NULL DEFAULT 28,
  "payloadJson" TEXT NOT NULL,
  "sourceRevision" TEXT,
  "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EngineeringDeliveryReviewSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EngineeringDeliveryReviewSnapshot_workspaceId_snapshotDate_windowDays_key"
ON "EngineeringDeliveryReviewSnapshot"("workspaceId", "snapshotDate", "windowDays");

CREATE INDEX "EngineeringDeliveryReviewSnapshot_workspaceId_generatedAt_idx"
ON "EngineeringDeliveryReviewSnapshot"("workspaceId", "generatedAt");

CREATE TABLE "EngineeringDeliveryReviewRefreshRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "snapshotId" TEXT,
  "snapshotDate" DATETIME NOT NULL,
  "windowDays" INTEGER NOT NULL DEFAULT 28,
  "status" TEXT NOT NULL,
  "sourceRevision" TEXT,
  "errorMessage" TEXT,
  "trigger" TEXT NOT NULL DEFAULT 'cron',
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EngineeringDeliveryReviewRefreshRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EngineeringDeliveryReviewRefreshRun_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "EngineeringDeliveryReviewSnapshot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "EngineeringDeliveryReviewRefreshRun_workspaceId_status_startedAt_idx"
ON "EngineeringDeliveryReviewRefreshRun"("workspaceId", "status", "startedAt");

CREATE INDEX "EngineeringDeliveryReviewRefreshRun_workspaceId_snapshotDate_windowDays_startedAt_idx"
ON "EngineeringDeliveryReviewRefreshRun"("workspaceId", "snapshotDate", "windowDays", "startedAt");

CREATE INDEX "EngineeringDeliveryReviewRefreshRun_snapshotId_idx"
ON "EngineeringDeliveryReviewRefreshRun"("snapshotId");
