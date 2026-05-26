ALTER TABLE "ActionItem" ADD COLUMN "statusReason" TEXT;
ALTER TABLE "ActionItem" ADD COLUMN "policyName" TEXT;
ALTER TABLE "ActionItem" ADD COLUMN "policySnapshot" TEXT;
ALTER TABLE "ActionItem" ADD COLUMN "executedAt" DATETIME;

ALTER TABLE "ApprovalTask" ADD COLUMN "decisionReason" TEXT;

ALTER TABLE "EmailThread" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'DEMO';
ALTER TABLE "EmailThread" ADD COLUMN "externalThreadId" TEXT;

ALTER TABLE "EmailMessage" ADD COLUMN "snippet" TEXT;
ALTER TABLE "EmailMessage" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'DEMO';
ALTER TABLE "EmailMessage" ADD COLUMN "externalMessageId" TEXT;

CREATE TABLE "EventLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT,
  "eventName" TEXT NOT NULL,
  "eventCategory" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "metadata" TEXT,
  "sessionId" TEXT,
  "sourcePage" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EventLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "EventLog_workspaceId_createdAt_idx" ON "EventLog"("workspaceId", "createdAt");
CREATE INDEX "EventLog_workspaceId_eventName_createdAt_idx" ON "EventLog"("workspaceId", "eventName", "createdAt");
CREATE INDEX "EventLog_userId_createdAt_idx" ON "EventLog"("userId", "createdAt");

CREATE TABLE "DailyUsageSnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" DATETIME NOT NULL,
  "loginCount" INTEGER NOT NULL DEFAULT 0,
  "dashboardViewCount" INTEGER NOT NULL DEFAULT 0,
  "meetingViewCount" INTEGER NOT NULL DEFAULT 0,
  "actionItemsGenerated" INTEGER NOT NULL DEFAULT 0,
  "approvalsSubmitted" INTEGER NOT NULL DEFAULT 0,
  "approvalsApproved" INTEGER NOT NULL DEFAULT 0,
  "approvalsRejected" INTEGER NOT NULL DEFAULT 0,
  "opportunityStageChanges" INTEGER NOT NULL DEFAULT 0,
  "followupDraftsGenerated" INTEGER NOT NULL DEFAULT 0,
  "policyChanges" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyUsageSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DailyUsageSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DailyUsageSnapshot_workspaceId_userId_date_key" ON "DailyUsageSnapshot"("workspaceId", "userId", "date");
CREATE INDEX "DailyUsageSnapshot_workspaceId_date_idx" ON "DailyUsageSnapshot"("workspaceId", "date");

CREATE TABLE "Connector" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "externalAccountEmail" TEXT,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "tokenExpiresAt" DATETIME,
  "lastSyncedAt" DATETIME,
  "lastSyncStatus" TEXT,
  "lastSyncMessage" TEXT,
  "metadata" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Connector_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Connector_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Connector_workspaceId_userId_provider_key" ON "Connector"("workspaceId", "userId", "provider");
CREATE INDEX "Connector_workspaceId_provider_idx" ON "Connector"("workspaceId", "provider");

CREATE TABLE "WeeklyReport" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "weekStart" DATETIME NOT NULL,
  "weekEnd" DATETIME NOT NULL,
  "summaryText" TEXT NOT NULL,
  "opportunitiesAdvancedCount" INTEGER NOT NULL DEFAULT 0,
  "overdueFollowupsCount" INTEGER NOT NULL DEFAULT 0,
  "aiSuggestionsCount" INTEGER NOT NULL DEFAULT 0,
  "approvalsApprovedCount" INTEGER NOT NULL DEFAULT 0,
  "openHighRiskCount" INTEGER NOT NULL DEFAULT 0,
  "payload" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeeklyReport_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WeeklyReport_workspaceId_weekStart_key" ON "WeeklyReport"("workspaceId", "weekStart");
CREATE INDEX "WeeklyReport_workspaceId_weekStart_idx" ON "WeeklyReport"("workspaceId", "weekStart");

CREATE UNIQUE INDEX "EmailThread_workspaceId_externalThreadId_key" ON "EmailThread"("workspaceId", "externalThreadId");
CREATE UNIQUE INDEX "EmailMessage_threadId_externalMessageId_key" ON "EmailMessage"("threadId", "externalMessageId");
