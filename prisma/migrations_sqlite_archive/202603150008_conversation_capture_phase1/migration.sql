CREATE TABLE "CaptureSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT,
  "linkedMeetingId" TEXT,
  "title" TEXT,
  "status" TEXT NOT NULL DEFAULT 'RECORDING',
  "sourceType" TEXT NOT NULL DEFAULT 'MANUAL_CAPTURE',
  "sourceId" TEXT,
  "objectType" TEXT,
  "objectId" TEXT,
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" DATETIME,
  "durationSeconds" INTEGER,
  "transcriptStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "processingStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "errorMessage" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CaptureSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CaptureSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CaptureSession_linkedMeetingId_fkey" FOREIGN KEY ("linkedMeetingId") REFERENCES "Meeting" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ConversationTranscript" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "captureSessionId" TEXT NOT NULL,
  "fullText" TEXT NOT NULL,
  "segments" TEXT,
  "speakerSeparated" BOOLEAN NOT NULL DEFAULT false,
  "language" TEXT NOT NULL DEFAULT 'zh-CN',
  "confidence" INTEGER NOT NULL DEFAULT 70,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationTranscript_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ConversationTranscript_captureSessionId_fkey" FOREIGN KEY ("captureSessionId") REFERENCES "CaptureSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ConversationInsight" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "captureSessionId" TEXT NOT NULL,
  "insightType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "confidence" INTEGER NOT NULL DEFAULT 70,
  "relatedContactId" TEXT,
  "relatedCompanyId" TEXT,
  "relatedOpportunityId" TEXT,
  "relatedMeetingId" TEXT,
  "sourceSegmentRefs" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationInsight_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ConversationInsight_captureSessionId_fkey" FOREIGN KEY ("captureSessionId") REFERENCES "CaptureSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ConversationInsight_relatedContactId_fkey" FOREIGN KEY ("relatedContactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ConversationInsight_relatedCompanyId_fkey" FOREIGN KEY ("relatedCompanyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ConversationInsight_relatedOpportunityId_fkey" FOREIGN KEY ("relatedOpportunityId") REFERENCES "Opportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ConversationInsight_relatedMeetingId_fkey" FOREIGN KEY ("relatedMeetingId") REFERENCES "Meeting" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ConversationTranscript_captureSessionId_key" ON "ConversationTranscript"("captureSessionId");
CREATE INDEX "CaptureSession_workspaceId_createdAt_idx" ON "CaptureSession"("workspaceId", "createdAt");
CREATE INDEX "CaptureSession_workspaceId_status_createdAt_idx" ON "CaptureSession"("workspaceId", "status", "createdAt");
CREATE INDEX "CaptureSession_workspaceId_objectType_objectId_idx" ON "CaptureSession"("workspaceId", "objectType", "objectId");
CREATE INDEX "ConversationTranscript_workspaceId_createdAt_idx" ON "ConversationTranscript"("workspaceId", "createdAt");
CREATE INDEX "ConversationInsight_workspaceId_captureSessionId_idx" ON "ConversationInsight"("workspaceId", "captureSessionId");
CREATE INDEX "ConversationInsight_workspaceId_insightType_createdAt_idx" ON "ConversationInsight"("workspaceId", "insightType", "createdAt");
CREATE INDEX "ConversationInsight_workspaceId_relatedOpportunityId_idx" ON "ConversationInsight"("workspaceId", "relatedOpportunityId");
CREATE INDEX "ConversationInsight_workspaceId_relatedContactId_idx" ON "ConversationInsight"("workspaceId", "relatedContactId");
