CREATE TABLE "DeltaEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT,
  "eventType" TEXT NOT NULL,
  "objectType" TEXT NOT NULL,
  "objectId" TEXT NOT NULL,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "payload" TEXT,
  "importance" INTEGER NOT NULL DEFAULT 50,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeltaEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PatternFact" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL,
  "scopeId" TEXT,
  "patternType" TEXT NOT NULL,
  "patternKey" TEXT NOT NULL,
  "patternValue" TEXT NOT NULL,
  "confidence" INTEGER NOT NULL DEFAULT 50,
  "evidenceCount" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "title" TEXT,
  "summary" TEXT,
  "evidenceSnapshot" TEXT,
  "firstDetectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastDetectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PatternFact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "StrategySuggestion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "suggestionType" TEXT NOT NULL,
  "targetPolicyKey" TEXT NOT NULL,
  "currentValue" TEXT,
  "suggestedValue" TEXT,
  "title" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "confidence" INTEGER NOT NULL DEFAULT 50,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "evidenceSnapshot" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "confirmedByUserId" TEXT,
  "confirmedAt" DATETIME,
  CONSTRAINT "StrategySuggestion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PatternFact_fingerprint_key" ON "PatternFact"("fingerprint");
CREATE UNIQUE INDEX "StrategySuggestion_fingerprint_key" ON "StrategySuggestion"("fingerprint");
CREATE INDEX "DeltaEvent_workspaceId_eventType_createdAt_idx" ON "DeltaEvent"("workspaceId", "eventType", "createdAt");
CREATE INDEX "DeltaEvent_workspaceId_objectType_objectId_idx" ON "DeltaEvent"("workspaceId", "objectType", "objectId");
CREATE INDEX "DeltaEvent_workspaceId_createdAt_idx" ON "DeltaEvent"("workspaceId", "createdAt");
CREATE INDEX "PatternFact_workspaceId_scopeType_scopeId_idx" ON "PatternFact"("workspaceId", "scopeType", "scopeId");
CREATE INDEX "PatternFact_workspaceId_patternType_patternKey_idx" ON "PatternFact"("workspaceId", "patternType", "patternKey");
CREATE INDEX "PatternFact_workspaceId_status_lastDetectedAt_idx" ON "PatternFact"("workspaceId", "status", "lastDetectedAt");
CREATE INDEX "StrategySuggestion_workspaceId_status_createdAt_idx" ON "StrategySuggestion"("workspaceId", "status", "createdAt");
CREATE INDEX "StrategySuggestion_workspaceId_targetPolicyKey_idx" ON "StrategySuggestion"("workspaceId", "targetPolicyKey");
