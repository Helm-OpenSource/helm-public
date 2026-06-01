-- DropIndex
DROP INDEX "AuditLog_userId_idx";

-- DropIndex
DROP INDEX "AuditLog_workspaceId_idx";

-- DropIndex
DROP INDEX "EmailMessage_threadId_idx";

-- DropIndex
DROP INDEX "Notification_userId_idx";

-- DropIndex
DROP INDEX "Notification_workspaceId_idx";

-- CreateTable
CREATE TABLE "ImportSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "authMode" TEXT,
    "externalAccountId" TEXT,
    "externalAccountLabel" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" DATETIME,
    "lastSyncedAt" DATETIME,
    "configJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImportSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "successRecords" INTEGER NOT NULL DEFAULT 0,
    "failedRecords" INTEGER NOT NULL DEFAULT 0,
    "warningRecords" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "errorSummary" TEXT,
    "summaryJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImportJob_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ImportSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImportJob_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "externalType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "mappedObjectType" TEXT,
    "mappedObjectId" TEXT,
    "matchStatus" TEXT NOT NULL DEFAULT 'CREATED',
    "conflictStatus" TEXT NOT NULL DEFAULT 'NONE',
    "payload" TEXT,
    "normalizedPayload" TEXT,
    "errorMessage" TEXT,
    "warningMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImportItem_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IdentityMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "sourceId" TEXT,
    "importItemId" TEXT,
    "externalType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "internalObjectType" TEXT,
    "internalObjectId" TEXT,
    "matchScore" INTEGER NOT NULL DEFAULT 0,
    "matchReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IdentityMatch_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IdentityMatch_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ImportSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ActionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "meetingId" TEXT,
    "opportunityId" TEXT,
    "contactId" TEXT,
    "ownerId" TEXT,
    "actionType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "aiReason" TEXT,
    "draftContent" TEXT,
    "metadata" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "suggestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suggestedExecutionAt" DATETIME,
    "dueDate" DATETIME,
    "executionMode" TEXT NOT NULL DEFAULT 'REQUIRES_APPROVAL',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "executionStatus" TEXT NOT NULL DEFAULT 'pending',
    "statusReason" TEXT,
    "policyName" TEXT,
    "policySnapshot" TEXT,
    "recommendationLogId" TEXT,
    "executedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActionItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActionItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ActionItem_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ActionItem_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ActionItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ActionItem_recommendationLogId_fkey" FOREIGN KEY ("recommendationLogId") REFERENCES "RecommendationLog" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ActionItem" ("actionType", "aiReason", "contactId", "createdAt", "description", "draftContent", "dueDate", "executedAt", "executionMode", "executionStatus", "id", "meetingId", "metadata", "opportunityId", "ownerId", "policyName", "policySnapshot", "recommendationLogId", "requiresApproval", "riskLevel", "sourceId", "sourceType", "status", "statusReason", "suggestedAt", "suggestedExecutionAt", "title", "updatedAt", "workspaceId") SELECT "actionType", "aiReason", "contactId", "createdAt", "description", "draftContent", "dueDate", "executedAt", "executionMode", "executionStatus", "id", "meetingId", "metadata", "opportunityId", "ownerId", "policyName", "policySnapshot", "recommendationLogId", "requiresApproval", "riskLevel", "sourceId", "sourceType", "status", "statusReason", "suggestedAt", "suggestedExecutionAt", "title", "updatedAt", "workspaceId" FROM "ActionItem";
DROP TABLE "ActionItem";
ALTER TABLE "new_ActionItem" RENAME TO "ActionItem";
CREATE TABLE "new_ApprovalTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "actionItemId" TEXT NOT NULL,
    "approverId" TEXT,
    "reviewedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "channel" TEXT,
    "isHighRisk" BOOLEAN NOT NULL DEFAULT false,
    "autoExecute" BOOLEAN NOT NULL DEFAULT false,
    "contextSnapshot" TEXT,
    "reasoning" TEXT,
    "editableContent" TEXT,
    "resultPreview" TEXT,
    "decisionReason" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApprovalTask_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApprovalTask_actionItemId_fkey" FOREIGN KEY ("actionItemId") REFERENCES "ActionItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApprovalTask_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ApprovalTask_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ApprovalTask" ("actionItemId", "approverId", "autoExecute", "channel", "contextSnapshot", "createdAt", "decisionReason", "editableContent", "id", "isHighRisk", "reasoning", "resultPreview", "reviewedAt", "reviewedById", "status", "updatedAt", "workspaceId") SELECT "actionItemId", "approverId", "autoExecute", "channel", "contextSnapshot", "createdAt", "decisionReason", "editableContent", "id", "isHighRisk", "reasoning", "resultPreview", "reviewedAt", "reviewedById", "status", "updatedAt", "workspaceId" FROM "ApprovalTask";
DROP TABLE "ApprovalTask";
ALTER TABLE "new_ApprovalTask" RENAME TO "ApprovalTask";
CREATE UNIQUE INDEX "ApprovalTask_actionItemId_key" ON "ApprovalTask"("actionItemId");
CREATE TABLE "new_Blocker" (
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Blocker_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Blocker_relatedContactId_fkey" FOREIGN KEY ("relatedContactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Blocker_relatedCompanyId_fkey" FOREIGN KEY ("relatedCompanyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Blocker_relatedOpportunityId_fkey" FOREIGN KEY ("relatedOpportunityId") REFERENCES "Opportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Blocker_relatedMeetingId_fkey" FOREIGN KEY ("relatedMeetingId") REFERENCES "Meeting" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Blocker" ("blockerText", "blockerType", "createdAt", "firstSeenAt", "id", "relatedCompanyId", "relatedContactId", "relatedMeetingId", "relatedOpportunityId", "resolutionNote", "resolvedAt", "severity", "sourceId", "sourceType", "status", "title", "updatedAt", "workspaceId") SELECT "blockerText", "blockerType", "createdAt", "firstSeenAt", "id", "relatedCompanyId", "relatedContactId", "relatedMeetingId", "relatedOpportunityId", "resolutionNote", "resolvedAt", "severity", "sourceId", "sourceType", "status", "title", "updatedAt", "workspaceId" FROM "Blocker";
DROP TABLE "Blocker";
ALTER TABLE "new_Blocker" RENAME TO "Blocker";
CREATE INDEX "Blocker_workspaceId_status_idx" ON "Blocker"("workspaceId", "status");
CREATE INDEX "Blocker_workspaceId_relatedOpportunityId_idx" ON "Blocker"("workspaceId", "relatedOpportunityId");
CREATE INDEX "Blocker_workspaceId_severity_idx" ON "Blocker"("workspaceId", "severity");
CREATE TABLE "new_BudgetRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "monthlyLimit" INTEGER NOT NULL,
    "spent" INTEGER NOT NULL DEFAULT 0,
    "warningThreshold" INTEGER NOT NULL DEFAULT 80,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BudgetRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BudgetRule" ("createdAt", "id", "monthlyLimit", "name", "scope", "spent", "updatedAt", "warningThreshold", "workspaceId") SELECT "createdAt", "id", "monthlyLimit", "name", "scope", "spent", "updatedAt", "warningThreshold", "workspaceId" FROM "BudgetRule";
DROP TABLE "BudgetRule";
ALTER TABLE "new_BudgetRule" RENAME TO "BudgetRule";
CREATE TABLE "new_Commitment" (
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Commitment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Commitment_relatedContactId_fkey" FOREIGN KEY ("relatedContactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Commitment_relatedCompanyId_fkey" FOREIGN KEY ("relatedCompanyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Commitment_relatedOpportunityId_fkey" FOREIGN KEY ("relatedOpportunityId") REFERENCES "Opportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Commitment_relatedMeetingId_fkey" FOREIGN KEY ("relatedMeetingId") REFERENCES "Meeting" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Commitment_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Commitment" ("commitmentText", "confidence", "createdAt", "dueDate", "fulfilledAt", "id", "overdueFlag", "ownerUserId", "priority", "relatedCompanyId", "relatedContactId", "relatedMeetingId", "relatedOpportunityId", "sourceId", "sourceType", "status", "statusNote", "title", "updatedAt", "workspaceId") SELECT "commitmentText", "confidence", "createdAt", "dueDate", "fulfilledAt", "id", "overdueFlag", "ownerUserId", "priority", "relatedCompanyId", "relatedContactId", "relatedMeetingId", "relatedOpportunityId", "sourceId", "sourceType", "status", "statusNote", "title", "updatedAt", "workspaceId" FROM "Commitment";
DROP TABLE "Commitment";
ALTER TABLE "new_Commitment" RENAME TO "Commitment";
CREATE INDEX "Commitment_workspaceId_status_idx" ON "Commitment"("workspaceId", "status");
CREATE INDEX "Commitment_workspaceId_relatedOpportunityId_idx" ON "Commitment"("workspaceId", "relatedOpportunityId");
CREATE INDEX "Commitment_workspaceId_dueDate_idx" ON "Commitment"("workspaceId", "dueDate");
CREATE INDEX "Commitment_workspaceId_ownerUserId_idx" ON "Commitment"("workspaceId", "ownerUserId");
CREATE TABLE "new_Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "website" TEXT,
    "description" TEXT,
    "maturityScore" INTEGER NOT NULL DEFAULT 0,
    "cooperationMaturity" TEXT,
    "recommendedPath" TEXT,
    "tags" TEXT,
    "externalSource" TEXT,
    "externalObjectType" TEXT,
    "externalObjectId" TEXT,
    "externalOwnerId" TEXT,
    "externalSyncedAt" DATETIME,
    "lastInteractionAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Company_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Company" ("cooperationMaturity", "createdAt", "description", "id", "industry", "lastInteractionAt", "maturityScore", "name", "recommendedPath", "tags", "updatedAt", "website", "workspaceId") SELECT "cooperationMaturity", "createdAt", "description", "id", "industry", "lastInteractionAt", "maturityScore", "name", "recommendedPath", "tags", "updatedAt", "website", "workspaceId" FROM "Company";
DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";
CREATE UNIQUE INDEX "Company_workspaceId_externalSource_externalObjectId_key" ON "Company"("workspaceId", "externalSource", "externalObjectId");
CREATE TABLE "new_Connector" (
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Connector_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Connector_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Connector" ("accessToken", "createdAt", "externalAccountEmail", "id", "lastSyncMessage", "lastSyncStatus", "lastSyncedAt", "metadata", "provider", "refreshToken", "status", "tokenExpiresAt", "updatedAt", "userId", "workspaceId") SELECT "accessToken", "createdAt", "externalAccountEmail", "id", "lastSyncMessage", "lastSyncStatus", "lastSyncedAt", "metadata", "provider", "refreshToken", "status", "tokenExpiresAt", "updatedAt", "userId", "workspaceId" FROM "Connector";
DROP TABLE "Connector";
ALTER TABLE "new_Connector" RENAME TO "Connector";
CREATE INDEX "Connector_workspaceId_provider_idx" ON "Connector"("workspaceId", "provider");
CREATE UNIQUE INDEX "Connector_workspaceId_userId_provider_key" ON "Connector"("workspaceId", "userId", "provider");
CREATE TABLE "new_Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "companyId" TEXT,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "channel" TEXT,
    "tags" TEXT,
    "notes" TEXT,
    "externalSource" TEXT,
    "externalObjectType" TEXT,
    "externalObjectId" TEXT,
    "externalOwnerId" TEXT,
    "externalSyncedAt" DATETIME,
    "relationshipStage" TEXT,
    "relationshipTemperature" INTEGER NOT NULL DEFAULT 50,
    "relationshipWarmth" TEXT NOT NULL DEFAULT 'WARM',
    "lastInteractionAt" DATETIME,
    "archivedAt" DATETIME,
    "mergedIntoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Contact" ("archivedAt", "channel", "companyId", "createdAt", "email", "id", "lastInteractionAt", "mergedIntoId", "name", "notes", "ownerId", "phone", "relationshipStage", "relationshipTemperature", "relationshipWarmth", "tags", "title", "updatedAt", "workspaceId") SELECT "archivedAt", "channel", "companyId", "createdAt", "email", "id", "lastInteractionAt", "mergedIntoId", "name", "notes", "ownerId", "phone", "relationshipStage", "relationshipTemperature", "relationshipWarmth", "tags", "title", "updatedAt", "workspaceId" FROM "Contact";
DROP TABLE "Contact";
ALTER TABLE "new_Contact" RENAME TO "Contact";
CREATE UNIQUE INDEX "Contact_workspaceId_externalSource_externalObjectId_key" ON "Contact"("workspaceId", "externalSource", "externalObjectId");
CREATE TABLE "new_DailyUsageSnapshot" (
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyUsageSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DailyUsageSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DailyUsageSnapshot" ("actionItemsGenerated", "approvalsApproved", "approvalsRejected", "approvalsSubmitted", "createdAt", "dashboardViewCount", "date", "followupDraftsGenerated", "id", "loginCount", "meetingViewCount", "opportunityStageChanges", "policyChanges", "updatedAt", "userId", "workspaceId") SELECT "actionItemsGenerated", "approvalsApproved", "approvalsRejected", "approvalsSubmitted", "createdAt", "dashboardViewCount", "date", "followupDraftsGenerated", "id", "loginCount", "meetingViewCount", "opportunityStageChanges", "policyChanges", "updatedAt", "userId", "workspaceId" FROM "DailyUsageSnapshot";
DROP TABLE "DailyUsageSnapshot";
ALTER TABLE "new_DailyUsageSnapshot" RENAME TO "DailyUsageSnapshot";
CREATE INDEX "DailyUsageSnapshot_workspaceId_date_idx" ON "DailyUsageSnapshot"("workspaceId", "date");
CREATE UNIQUE INDEX "DailyUsageSnapshot_workspaceId_userId_date_key" ON "DailyUsageSnapshot"("workspaceId", "userId", "date");
CREATE TABLE "new_EmailThread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT,
    "companyId" TEXT,
    "opportunityId" TEXT,
    "subject" TEXT NOT NULL,
    "counterpart" TEXT NOT NULL,
    "summary" TEXT,
    "participants" TEXT,
    "source" TEXT NOT NULL DEFAULT 'DEMO',
    "externalThreadId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "waitingOn" TEXT,
    "shouldReply" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailThread_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmailThread_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EmailThread_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EmailThread_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EmailThread" ("companyId", "contactId", "counterpart", "createdAt", "externalThreadId", "id", "opportunityId", "participants", "shouldReply", "source", "status", "subject", "summary", "updatedAt", "waitingOn", "workspaceId") SELECT "companyId", "contactId", "counterpart", "createdAt", "externalThreadId", "id", "opportunityId", "participants", "shouldReply", "source", "status", "subject", "summary", "updatedAt", "waitingOn", "workspaceId" FROM "EmailThread";
DROP TABLE "EmailThread";
ALTER TABLE "new_EmailThread" RENAME TO "EmailThread";
CREATE UNIQUE INDEX "EmailThread_workspaceId_externalThreadId_key" ON "EmailThread"("workspaceId", "externalThreadId");
CREATE TABLE "new_Meeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "companyId" TEXT,
    "opportunityId" TEXT,
    "ownerId" TEXT,
    "title" TEXT NOT NULL,
    "agenda" TEXT,
    "location" TEXT,
    "externalSource" TEXT,
    "externalObjectType" TEXT,
    "externalObjectId" TEXT,
    "externalOwnerId" TEXT,
    "externalSyncedAt" DATETIME,
    "briefingSnapshotId" TEXT,
    "postMeetingSummary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Meeting_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Meeting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Meeting_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Meeting_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Meeting" ("agenda", "briefingSnapshotId", "companyId", "createdAt", "endsAt", "id", "location", "opportunityId", "ownerId", "postMeetingSummary", "startsAt", "status", "title", "updatedAt", "workspaceId") SELECT "agenda", "briefingSnapshotId", "companyId", "createdAt", "endsAt", "id", "location", "opportunityId", "ownerId", "postMeetingSummary", "startsAt", "status", "title", "updatedAt", "workspaceId" FROM "Meeting";
DROP TABLE "Meeting";
ALTER TABLE "new_Meeting" RENAME TO "Meeting";
CREATE UNIQUE INDEX "Meeting_workspaceId_externalSource_externalObjectId_key" ON "Meeting"("workspaceId", "externalSource", "externalObjectId");
CREATE TABLE "new_MeetingNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "noteKind" TEXT NOT NULL DEFAULT 'SUMMARY',
    "attendeesSummary" TEXT,
    "relationshipSummary" TEXT,
    "previousConclusion" TEXT,
    "meetingGoal" TEXT,
    "recommendedQuestions" TEXT,
    "riskAlerts" TEXT,
    "liveTranscript" TEXT,
    "summary" TEXT,
    "keyDecisions" TEXT,
    "confirmations" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MeetingNote_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MeetingNote_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MeetingNote" ("attendeesSummary", "confirmations", "createdAt", "id", "keyDecisions", "liveTranscript", "meetingGoal", "meetingId", "noteKind", "previousConclusion", "recommendedQuestions", "relationshipSummary", "riskAlerts", "summary", "updatedAt", "workspaceId") SELECT "attendeesSummary", "confirmations", "createdAt", "id", "keyDecisions", "liveTranscript", "meetingGoal", "meetingId", "noteKind", "previousConclusion", "recommendedQuestions", "relationshipSummary", "riskAlerts", "summary", "updatedAt", "workspaceId" FROM "MeetingNote";
DROP TABLE "MeetingNote";
ALTER TABLE "new_MeetingNote" RENAME TO "MeetingNote";
CREATE UNIQUE INDEX "MeetingNote_meetingId_key" ON "MeetingNote"("meetingId");
CREATE TABLE "new_Membership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "title" TEXT,
    "persona" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Membership" ("createdAt", "id", "persona", "role", "title", "updatedAt", "userId", "workspaceId") SELECT "createdAt", "id", "persona", "role", "title", "updatedAt", "userId", "workspaceId" FROM "Membership";
DROP TABLE "Membership";
ALTER TABLE "new_Membership" RENAME TO "Membership";
CREATE UNIQUE INDEX "Membership_workspaceId_userId_key" ON "Membership"("workspaceId", "userId");
CREATE TABLE "new_MemoryEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT,
    "companyId" TEXT,
    "opportunityId" TEXT,
    "meetingId" TEXT,
    "entityType" TEXT NOT NULL,
    "memoryType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT,
    "correctedAt" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MemoryEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemoryEntry_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MemoryEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MemoryEntry_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MemoryEntry_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MemoryEntry" ("companyId", "contactId", "content", "correctedAt", "createdAt", "deletedAt", "entityType", "id", "meetingId", "memoryType", "opportunityId", "source", "title", "updatedAt", "workspaceId") SELECT "companyId", "contactId", "content", "correctedAt", "createdAt", "deletedAt", "entityType", "id", "meetingId", "memoryType", "opportunityId", "source", "title", "updatedAt", "workspaceId" FROM "MemoryEntry";
DROP TABLE "MemoryEntry";
ALTER TABLE "new_MemoryEntry" RENAME TO "MemoryEntry";
CREATE TABLE "new_MemoryFact" (
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MemoryFact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MemoryFact" ("confidence", "confirmedByUser", "content", "createdAt", "createdBySystem", "factType", "freshnessScore", "id", "importance", "normalizedValue", "objectId", "objectType", "sourceId", "sourceType", "status", "title", "updatedAt", "workspaceId") SELECT "confidence", "confirmedByUser", "content", "createdAt", "createdBySystem", "factType", "freshnessScore", "id", "importance", "normalizedValue", "objectId", "objectType", "sourceId", "sourceType", "status", "title", "updatedAt", "workspaceId" FROM "MemoryFact";
DROP TABLE "MemoryFact";
ALTER TABLE "new_MemoryFact" RENAME TO "MemoryFact";
CREATE INDEX "MemoryFact_workspaceId_objectType_objectId_idx" ON "MemoryFact"("workspaceId", "objectType", "objectId");
CREATE INDEX "MemoryFact_workspaceId_factType_idx" ON "MemoryFact"("workspaceId", "factType");
CREATE INDEX "MemoryFact_workspaceId_sourceType_sourceId_idx" ON "MemoryFact"("workspaceId", "sourceType", "sourceId");
CREATE INDEX "MemoryFact_workspaceId_status_idx" ON "MemoryFact"("workspaceId", "status");
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
INSERT INTO "new_Opportunity" ("companyId", "createdAt", "description", "dueDate", "id", "lastProgressAt", "lossReason", "nextAction", "nextStepSummary", "ownerId", "priorityScore", "riskLevel", "stage", "title", "type", "updatedAt", "workspaceId") SELECT "companyId", "createdAt", "description", "dueDate", "id", "lastProgressAt", "lossReason", "nextAction", "nextStepSummary", "ownerId", "priorityScore", "riskLevel", "stage", "title", "type", "updatedAt", "workspaceId" FROM "Opportunity";
DROP TABLE "Opportunity";
ALTER TABLE "new_Opportunity" RENAME TO "Opportunity";
CREATE UNIQUE INDEX "Opportunity_workspaceId_externalSource_externalObjectId_key" ON "Opportunity"("workspaceId", "externalSource", "externalObjectId");
CREATE TABLE "new_PolicyRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "riskThreshold" TEXT NOT NULL DEFAULT 'MEDIUM',
    "appliesTo" TEXT,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PolicyRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PolicyRule" ("actionType", "appliesTo", "createdAt", "description", "enabled", "id", "mode", "name", "riskThreshold", "updatedAt", "workspaceId") SELECT "actionType", "appliesTo", "createdAt", "description", "enabled", "id", "mode", "name", "riskThreshold", "updatedAt", "workspaceId" FROM "PolicyRule";
DROP TABLE "PolicyRule";
ALTER TABLE "new_PolicyRule" RENAME TO "PolicyRule";
CREATE TABLE "new_PreferenceSignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "signalType" TEXT NOT NULL,
    "signalKey" TEXT NOT NULL,
    "signalValue" TEXT NOT NULL,
    "sourceActionId" TEXT,
    "sourceRecommendationId" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 50,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PreferenceSignal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PreferenceSignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PreferenceSignal" ("createdAt", "id", "signalKey", "signalType", "signalValue", "sourceActionId", "sourceRecommendationId", "updatedAt", "userId", "weight", "workspaceId") SELECT "createdAt", "id", "signalKey", "signalType", "signalValue", "sourceActionId", "sourceRecommendationId", "updatedAt", "userId", "weight", "workspaceId" FROM "PreferenceSignal";
DROP TABLE "PreferenceSignal";
ALTER TABLE "new_PreferenceSignal" RENAME TO "PreferenceSignal";
CREATE INDEX "PreferenceSignal_workspaceId_userId_signalType_idx" ON "PreferenceSignal"("workspaceId", "userId", "signalType");
CREATE INDEX "PreferenceSignal_workspaceId_signalKey_idx" ON "PreferenceSignal"("workspaceId", "signalKey");
CREATE TABLE "new_RecommendationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recommendationPayload" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "urgencyScore" INTEGER NOT NULL DEFAULT 0,
    "impactScore" INTEGER NOT NULL DEFAULT 0,
    "confidenceScore" INTEGER NOT NULL DEFAULT 0,
    "personalizationScore" INTEGER NOT NULL DEFAULT 0,
    "policyFitScore" INTEGER NOT NULL DEFAULT 0,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "policyResult" TEXT NOT NULL,
    "supportingFactIds" TEXT,
    "blockerIds" TEXT,
    "commitmentIds" TEXT,
    "explanation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecommendationLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecommendationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RecommendationLog" ("actionType", "blockerIds", "commitmentIds", "confidenceScore", "createdAt", "description", "explanation", "id", "impactScore", "objectId", "objectType", "personalizationScore", "policyFitScore", "policyResult", "recommendationPayload", "riskScore", "score", "status", "supportingFactIds", "title", "updatedAt", "urgencyScore", "userId", "workspaceId") SELECT "actionType", "blockerIds", "commitmentIds", "confidenceScore", "createdAt", "description", "explanation", "id", "impactScore", "objectId", "objectType", "personalizationScore", "policyFitScore", "policyResult", "recommendationPayload", "riskScore", "score", "status", "supportingFactIds", "title", "updatedAt", "urgencyScore", "userId", "workspaceId" FROM "RecommendationLog";
DROP TABLE "RecommendationLog";
ALTER TABLE "new_RecommendationLog" RENAME TO "RecommendationLog";
CREATE INDEX "RecommendationLog_workspaceId_objectType_objectId_idx" ON "RecommendationLog"("workspaceId", "objectType", "objectId");
CREATE INDEX "RecommendationLog_workspaceId_userId_idx" ON "RecommendationLog"("workspaceId", "userId");
CREATE INDEX "RecommendationLog_workspaceId_status_idx" ON "RecommendationLog"("workspaceId", "status");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "avatar" TEXT,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("avatar", "createdAt", "email", "id", "lastLoginAt", "name", "title", "updatedAt") SELECT "avatar", "createdAt", "email", "id", "lastLoginAt", "name", "title", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE TABLE "new_Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "profileType" TEXT,
    "connectedSources" TEXT,
    "focusAreas" TEXT,
    "defaultStrategies" TEXT,
    "configuration" TEXT,
    "defaultLLMProvider" TEXT,
    "defaultLLMModel" TEXT,
    "extractionModel" TEXT,
    "briefingModel" TEXT,
    "reasoningModel" TEXT,
    "llmBudgetTier" TEXT,
    "llmEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Workspace" ("briefingModel", "configuration", "connectedSources", "createdAt", "defaultLLMModel", "defaultLLMProvider", "defaultStrategies", "description", "extractionModel", "focusAreas", "id", "llmBudgetTier", "llmEnabled", "name", "profileType", "reasoningModel", "slug", "updatedAt") SELECT "briefingModel", "configuration", "connectedSources", "createdAt", "defaultLLMModel", "defaultLLMProvider", "defaultStrategies", "description", "extractionModel", "focusAreas", "id", "llmBudgetTier", "llmEnabled", "name", "profileType", "reasoningModel", "slug", "updatedAt" FROM "Workspace";
DROP TABLE "Workspace";
ALTER TABLE "new_Workspace" RENAME TO "Workspace";
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ImportSource_workspaceId_sourceType_status_idx" ON "ImportSource"("workspaceId", "sourceType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ImportSource_workspaceId_sourceType_externalAccountId_key" ON "ImportSource"("workspaceId", "sourceType", "externalAccountId");

-- CreateIndex
CREATE INDEX "ImportJob_workspaceId_status_startedAt_idx" ON "ImportJob"("workspaceId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "ImportJob_sourceId_jobType_startedAt_idx" ON "ImportJob"("sourceId", "jobType", "startedAt");

-- CreateIndex
CREATE INDEX "ImportItem_workspaceId_conflictStatus_createdAt_idx" ON "ImportItem"("workspaceId", "conflictStatus", "createdAt");

-- CreateIndex
CREATE INDEX "ImportItem_workspaceId_mappedObjectType_mappedObjectId_idx" ON "ImportItem"("workspaceId", "mappedObjectType", "mappedObjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportItem_importJobId_externalType_externalId_key" ON "ImportItem"("importJobId", "externalType", "externalId");

-- CreateIndex
CREATE INDEX "IdentityMatch_workspaceId_status_createdAt_idx" ON "IdentityMatch"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "IdentityMatch_workspaceId_externalType_externalId_idx" ON "IdentityMatch"("workspaceId", "externalType", "externalId");

