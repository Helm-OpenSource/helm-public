ALTER TABLE "ActionItem" ADD COLUMN "recommendationLogId" TEXT;

CREATE TABLE "RecommendationLog" (
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
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecommendationLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RecommendationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "RecommendationLog_workspaceId_objectType_objectId_idx" ON "RecommendationLog"("workspaceId", "objectType", "objectId");
CREATE INDEX "RecommendationLog_workspaceId_userId_idx" ON "RecommendationLog"("workspaceId", "userId");
CREATE INDEX "RecommendationLog_workspaceId_status_idx" ON "RecommendationLog"("workspaceId", "status");

CREATE TABLE "RecommendationFeedback" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "recommendationLogId" TEXT NOT NULL,
  "userId" TEXT,
  "feedbackType" TEXT NOT NULL,
  "edited" BOOLEAN NOT NULL DEFAULT false,
  "resultNote" TEXT,
  "actionItemId" TEXT,
  "approvalTaskId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecommendationFeedback_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RecommendationFeedback_recommendationLogId_fkey" FOREIGN KEY ("recommendationLogId") REFERENCES "RecommendationLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RecommendationFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "RecommendationFeedback_workspaceId_recommendationLogId_idx" ON "RecommendationFeedback"("workspaceId", "recommendationLogId");
CREATE INDEX "RecommendationFeedback_workspaceId_feedbackType_idx" ON "RecommendationFeedback"("workspaceId", "feedbackType");

CREATE TABLE "PreferenceSignal" (
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
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PreferenceSignal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PreferenceSignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "PreferenceSignal_workspaceId_userId_signalType_idx" ON "PreferenceSignal"("workspaceId", "userId", "signalType");
CREATE INDEX "PreferenceSignal_workspaceId_signalKey_idx" ON "PreferenceSignal"("workspaceId", "signalKey");
CREATE INDEX "ActionItem_recommendationLogId_idx" ON "ActionItem"("recommendationLogId");
