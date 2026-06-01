CREATE TABLE "BiReportSubscription" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "name" TEXT NOT NULL,
  "skillKey" TEXT NOT NULL,
  "skillVersion" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "scheduleCron" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  "sqlParamsJson" TEXT,
  "analysisOverridesJson" TEXT,
  "deliveryTargetsJson" TEXT NOT NULL,
  "silencePolicyJson" TEXT,
  "dedupeWindowMinutes" INTEGER NOT NULL DEFAULT 90,
  "lastPlannedAt" DATETIME,
  "lastSucceededAt" DATETIME,
  "lastFailedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BiReportSubscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BiReportSubscription_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "BiReportSubscription_workspaceId_enabled_updatedAt_idx"
ON "BiReportSubscription"("workspaceId", "enabled", "updatedAt");

CREATE INDEX "BiReportSubscription_workspaceId_skillKey_enabled_idx"
ON "BiReportSubscription"("workspaceId", "skillKey", "enabled");

CREATE TABLE "BiReportRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "subscriptionId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "scheduledFor" DATETIME NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "severity" TEXT,
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "querySummaryJson" TEXT,
  "metricsJson" TEXT,
  "criteriaResultJson" TEXT,
  "deterministicSummaryJson" TEXT,
  "analysisJson" TEXT,
  "llmMetaJson" TEXT,
  "errorSummary" TEXT,
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BiReportRun_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "BiReportSubscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BiReportRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BiReportRun_dedupeKey_key" ON "BiReportRun"("dedupeKey");
CREATE INDEX "BiReportRun_workspaceId_scheduledFor_idx" ON "BiReportRun"("workspaceId", "scheduledFor");
CREATE INDEX "BiReportRun_subscriptionId_scheduledFor_idx" ON "BiReportRun"("subscriptionId", "scheduledFor");
CREATE INDEX "BiReportRun_workspaceId_status_startedAt_idx" ON "BiReportRun"("workspaceId", "status", "startedAt");

CREATE TABLE "BiReportDelivery" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "runId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "providerMessageId" TEXT,
  "requestBody" TEXT,
  "responseBody" TEXT,
  "sentAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BiReportDelivery_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BiReportRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BiReportDelivery_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "BiReportDelivery_runId_status_idx" ON "BiReportDelivery"("runId", "status");
CREATE INDEX "BiReportDelivery_workspaceId_channel_createdAt_idx" ON "BiReportDelivery"("workspaceId", "channel", "createdAt");
