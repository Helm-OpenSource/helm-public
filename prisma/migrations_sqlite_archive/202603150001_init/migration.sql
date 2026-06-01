PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "title" TEXT,
  "avatar" TEXT,
  "lastLoginAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

CREATE TABLE IF NOT EXISTS "Workspace" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "profileType" TEXT,
  "connectedSources" TEXT,
  "focusAreas" TEXT,
  "defaultStrategies" TEXT,
  "configuration" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_slug_key" ON "Workspace"("slug");

CREATE TABLE IF NOT EXISTS "Membership" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "title" TEXT,
  "persona" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Membership_workspaceId_userId_key" ON "Membership"("workspaceId", "userId");
CREATE INDEX IF NOT EXISTS "Membership_userId_idx" ON "Membership"("userId");

CREATE TABLE IF NOT EXISTS "Company" (
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
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Company_workspaceId_idx" ON "Company"("workspaceId");

CREATE TABLE IF NOT EXISTS "Contact" (
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
  "relationshipWarmth" TEXT NOT NULL DEFAULT 'WARM',
  "lastInteractionAt" DATETIME,
  "archivedAt" DATETIME,
  "mergedIntoId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Contact_workspaceId_idx" ON "Contact"("workspaceId");
CREATE INDEX IF NOT EXISTS "Contact_companyId_idx" ON "Contact"("companyId");
CREATE INDEX IF NOT EXISTS "Contact_ownerId_idx" ON "Contact"("ownerId");

CREATE TABLE IF NOT EXISTS "Opportunity" (
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
  "dueDate" DATETIME,
  "priorityScore" INTEGER NOT NULL DEFAULT 50,
  "lossReason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Opportunity_workspaceId_idx" ON "Opportunity"("workspaceId");
CREATE INDEX IF NOT EXISTS "Opportunity_companyId_idx" ON "Opportunity"("companyId");
CREATE INDEX IF NOT EXISTS "Opportunity_ownerId_idx" ON "Opportunity"("ownerId");

CREATE TABLE IF NOT EXISTS "Meeting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "companyId" TEXT,
  "opportunityId" TEXT,
  "ownerId" TEXT,
  "title" TEXT NOT NULL,
  "agenda" TEXT,
  "location" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "startsAt" DATETIME NOT NULL,
  "endsAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Meeting_workspaceId_idx" ON "Meeting"("workspaceId");
CREATE INDEX IF NOT EXISTS "Meeting_companyId_idx" ON "Meeting"("companyId");
CREATE INDEX IF NOT EXISTS "Meeting_opportunityId_idx" ON "Meeting"("opportunityId");
CREATE INDEX IF NOT EXISTS "Meeting_ownerId_idx" ON "Meeting"("ownerId");

CREATE TABLE IF NOT EXISTS "MeetingNote" (
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
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "MeetingNote_meetingId_key" ON "MeetingNote"("meetingId");
CREATE INDEX IF NOT EXISTS "MeetingNote_workspaceId_idx" ON "MeetingNote"("workspaceId");

CREATE TABLE IF NOT EXISTS "ActionItem" (
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
  "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
  "suggestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "suggestedExecutionAt" DATETIME,
  "dueDate" DATETIME,
  "executionMode" TEXT NOT NULL DEFAULT 'REQUIRES_APPROVAL',
  "requiresApproval" BOOLEAN NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ActionItem_workspaceId_idx" ON "ActionItem"("workspaceId");
CREATE INDEX IF NOT EXISTS "ActionItem_meetingId_idx" ON "ActionItem"("meetingId");
CREATE INDEX IF NOT EXISTS "ActionItem_opportunityId_idx" ON "ActionItem"("opportunityId");
CREATE INDEX IF NOT EXISTS "ActionItem_contactId_idx" ON "ActionItem"("contactId");
CREATE INDEX IF NOT EXISTS "ActionItem_ownerId_idx" ON "ActionItem"("ownerId");

CREATE TABLE IF NOT EXISTS "ApprovalTask" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "actionItemId" TEXT NOT NULL,
  "approverId" TEXT,
  "reviewedById" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "channel" TEXT,
  "isHighRisk" BOOLEAN NOT NULL DEFAULT 0,
  "autoExecute" BOOLEAN NOT NULL DEFAULT 0,
  "contextSnapshot" TEXT,
  "reasoning" TEXT,
  "editableContent" TEXT,
  "resultPreview" TEXT,
  "reviewedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("actionItemId") REFERENCES "ActionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ApprovalTask_actionItemId_key" ON "ApprovalTask"("actionItemId");
CREATE INDEX IF NOT EXISTS "ApprovalTask_workspaceId_idx" ON "ApprovalTask"("workspaceId");
CREATE INDEX IF NOT EXISTS "ApprovalTask_approverId_idx" ON "ApprovalTask"("approverId");
CREATE INDEX IF NOT EXISTS "ApprovalTask_reviewedById_idx" ON "ApprovalTask"("reviewedById");

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT,
  "actor" TEXT NOT NULL,
  "actorType" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "payload" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AuditLog_workspaceId_idx" ON "AuditLog"("workspaceId");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");

CREATE TABLE IF NOT EXISTS "EmailThread" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "contactId" TEXT,
  "companyId" TEXT,
  "opportunityId" TEXT,
  "subject" TEXT NOT NULL,
  "counterpart" TEXT NOT NULL,
  "summary" TEXT,
  "participants" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "waitingOn" TEXT,
  "shouldReply" BOOLEAN NOT NULL DEFAULT 0,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "EmailThread_workspaceId_idx" ON "EmailThread"("workspaceId");
CREATE INDEX IF NOT EXISTS "EmailThread_contactId_idx" ON "EmailThread"("contactId");
CREATE INDEX IF NOT EXISTS "EmailThread_companyId_idx" ON "EmailThread"("companyId");
CREATE INDEX IF NOT EXISTS "EmailThread_opportunityId_idx" ON "EmailThread"("opportunityId");

CREATE TABLE IF NOT EXISTS "EmailMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "threadId" TEXT NOT NULL,
  "sender" TEXT NOT NULL,
  "senderEmail" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "isInbound" BOOLEAN NOT NULL,
  "sentAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("threadId") REFERENCES "EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "EmailMessage_threadId_idx" ON "EmailMessage"("threadId");

CREATE TABLE IF NOT EXISTS "MemoryEntry" (
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
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "MemoryEntry_workspaceId_idx" ON "MemoryEntry"("workspaceId");
CREATE INDEX IF NOT EXISTS "MemoryEntry_contactId_idx" ON "MemoryEntry"("contactId");
CREATE INDEX IF NOT EXISTS "MemoryEntry_companyId_idx" ON "MemoryEntry"("companyId");
CREATE INDEX IF NOT EXISTS "MemoryEntry_opportunityId_idx" ON "MemoryEntry"("opportunityId");
CREATE INDEX IF NOT EXISTS "MemoryEntry_meetingId_idx" ON "MemoryEntry"("meetingId");

CREATE TABLE IF NOT EXISTS "PolicyRule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "riskThreshold" TEXT NOT NULL DEFAULT 'MEDIUM',
  "appliesTo" TEXT,
  "description" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PolicyRule_workspaceId_idx" ON "PolicyRule"("workspaceId");

CREATE TABLE IF NOT EXISTS "BudgetRule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "monthlyLimit" INTEGER NOT NULL,
  "spent" INTEGER NOT NULL DEFAULT 0,
  "warningThreshold" INTEGER NOT NULL DEFAULT 80,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "BudgetRule_workspaceId_idx" ON "BudgetRule"("workspaceId");

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "url" TEXT,
  "readAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Notification_workspaceId_idx" ON "Notification"("workspaceId");
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");

CREATE TABLE IF NOT EXISTS "_ContactToMeeting" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL,
  FOREIGN KEY ("A") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("B") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "_ContactToMeeting_AB_unique" ON "_ContactToMeeting"("A", "B");
CREATE INDEX IF NOT EXISTS "_ContactToMeeting_B_index" ON "_ContactToMeeting"("B");

CREATE TABLE IF NOT EXISTS "_ContactToOpportunity" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL,
  FOREIGN KEY ("A") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("B") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "_ContactToOpportunity_AB_unique" ON "_ContactToOpportunity"("A", "B");
CREATE INDEX IF NOT EXISTS "_ContactToOpportunity_B_index" ON "_ContactToOpportunity"("B");

PRAGMA foreign_keys = ON;
