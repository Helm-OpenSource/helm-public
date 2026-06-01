-- Helm v2.1 runtime hardening substrate

CREATE TABLE "RuntimeSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "runtimeEventId" TEXT,
  "meetingId" TEXT,
  "opportunityId" TEXT,
  "companyId" TEXT,
  "sessionKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "currentStage" TEXT NOT NULL,
  "sourcePage" TEXT,
  "boundaryNote" TEXT NOT NULL,
  "budgetTokenLimit" INTEGER NOT NULL DEFAULT 6000,
  "budgetTokenUsed" INTEGER NOT NULL DEFAULT 0,
  "loadedTokenCount" INTEGER NOT NULL DEFAULT 0,
  "prunedTokenCount" INTEGER NOT NULL DEFAULT 0,
  "replayableEventLog" TEXT,
  "resumedFromKey" TEXT,
  "closedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RuntimeSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RuntimeSession_sessionKey_key" ON "RuntimeSession"("sessionKey");
CREATE INDEX "RuntimeSession_workspaceId_meetingId_createdAt_idx" ON "RuntimeSession"("workspaceId", "meetingId", "createdAt");
CREATE INDEX "RuntimeSession_workspaceId_runtimeEventId_createdAt_idx" ON "RuntimeSession"("workspaceId", "runtimeEventId", "createdAt");
CREATE INDEX "RuntimeSession_workspaceId_status_createdAt_idx" ON "RuntimeSession"("workspaceId", "status", "createdAt");

CREATE TABLE "PersistedPayload" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "runtimeSessionId" TEXT NOT NULL,
  "runtimeEventId" TEXT,
  "meetingId" TEXT,
  "opportunityId" TEXT,
  "companyId" TEXT,
  "payloadKey" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "loadPolicy" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "preview" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "payloadText" TEXT,
  "byteSize" INTEGER NOT NULL,
  "estimatedTokens" INTEGER NOT NULL,
  "loadedByDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PersistedPayload_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PersistedPayload_runtimeSessionId_fkey" FOREIGN KEY ("runtimeSessionId") REFERENCES "RuntimeSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PersistedPayload_payloadKey_key" ON "PersistedPayload"("payloadKey");
CREATE INDEX "PersistedPayload_workspaceId_runtimeSessionId_createdAt_idx" ON "PersistedPayload"("workspaceId", "runtimeSessionId", "createdAt");
CREATE INDEX "PersistedPayload_workspaceId_meetingId_createdAt_idx" ON "PersistedPayload"("workspaceId", "meetingId", "createdAt");

CREATE TABLE "ContextEditEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "runtimeSessionId" TEXT NOT NULL,
  "editKey" TEXT NOT NULL,
  "strategy" TEXT NOT NULL,
  "beforeTokenCount" INTEGER NOT NULL,
  "afterTokenCount" INTEGER NOT NULL,
  "removedHandles" TEXT,
  "removedSummary" TEXT,
  "boundaryNote" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContextEditEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ContextEditEvent_runtimeSessionId_fkey" FOREIGN KEY ("runtimeSessionId") REFERENCES "RuntimeSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ContextEditEvent_editKey_key" ON "ContextEditEvent"("editKey");
CREATE INDEX "ContextEditEvent_workspaceId_runtimeSessionId_createdAt_idx" ON "ContextEditEvent"("workspaceId", "runtimeSessionId", "createdAt");

CREATE TABLE "SessionNotebook" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "runtimeSessionId" TEXT NOT NULL,
  "sessionSummary" TEXT NOT NULL,
  "decisionSummary" TEXT,
  "blockerSummary" TEXT,
  "pendingQuestions" TEXT,
  "openLoopSummary" TEXT,
  "boundaryNote" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionNotebook_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SessionNotebook_runtimeSessionId_fkey" FOREIGN KEY ("runtimeSessionId") REFERENCES "RuntimeSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SessionNotebook_runtimeSessionId_key" ON "SessionNotebook"("runtimeSessionId");
CREATE INDEX "SessionNotebook_workspaceId_createdAt_idx" ON "SessionNotebook"("workspaceId", "createdAt");

CREATE TABLE "SessionCheckpoint" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "runtimeSessionId" TEXT NOT NULL,
  "checkpointKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'READY',
  "summary" TEXT NOT NULL,
  "snapshotJson" TEXT NOT NULL,
  "tokenCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionCheckpoint_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SessionCheckpoint_runtimeSessionId_fkey" FOREIGN KEY ("runtimeSessionId") REFERENCES "RuntimeSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SessionCheckpoint_checkpointKey_key" ON "SessionCheckpoint"("checkpointKey");
CREATE INDEX "SessionCheckpoint_workspaceId_runtimeSessionId_createdAt_idx" ON "SessionCheckpoint"("workspaceId", "runtimeSessionId", "createdAt");

CREATE TABLE "MemoryCandidate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "runtimeSessionId" TEXT NOT NULL,
  "runtimeEventId" TEXT,
  "meetingId" TEXT,
  "memoryItemId" TEXT,
  "artifactBundleId" TEXT,
  "candidateKey" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "sourceVerification" TEXT NOT NULL,
  "sourceStatus" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "reviewerNote" TEXT,
  "evidenceRefs" TEXT,
  "confidence" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemoryCandidate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MemoryCandidate_runtimeSessionId_fkey" FOREIGN KEY ("runtimeSessionId") REFERENCES "RuntimeSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MemoryCandidate_candidateKey_key" ON "MemoryCandidate"("candidateKey");
CREATE INDEX "MemoryCandidate_workspaceId_runtimeSessionId_createdAt_idx" ON "MemoryCandidate"("workspaceId", "runtimeSessionId", "createdAt");
CREATE INDEX "MemoryCandidate_workspaceId_meetingId_createdAt_idx" ON "MemoryCandidate"("workspaceId", "meetingId", "createdAt");

CREATE TABLE "MemoryPromotion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "runtimeSessionId" TEXT NOT NULL,
  "memoryCandidateId" TEXT,
  "memoryItemId" TEXT,
  "promotionKey" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "rationale" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemoryPromotion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MemoryPromotion_runtimeSessionId_fkey" FOREIGN KEY ("runtimeSessionId") REFERENCES "RuntimeSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MemoryPromotion_promotionKey_key" ON "MemoryPromotion"("promotionKey");
CREATE INDEX "MemoryPromotion_workspaceId_runtimeSessionId_createdAt_idx" ON "MemoryPromotion"("workspaceId", "runtimeSessionId", "createdAt");

CREATE TABLE "VerificationReport" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "runtimeSessionId" TEXT NOT NULL,
  "runtimeEventId" TEXT,
  "artifactBundleId" TEXT,
  "reportKey" TEXT NOT NULL,
  "reportType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
  "truthScore" INTEGER NOT NULL DEFAULT 0,
  "summary" TEXT NOT NULL,
  "blockedReasons" TEXT,
  "boundaryNotes" TEXT,
  "evidenceRefs" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificationReport_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "VerificationReport_runtimeSessionId_fkey" FOREIGN KEY ("runtimeSessionId") REFERENCES "RuntimeSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "VerificationReport_reportKey_key" ON "VerificationReport"("reportKey");
CREATE INDEX "VerificationReport_workspaceId_runtimeSessionId_createdAt_idx" ON "VerificationReport"("workspaceId", "runtimeSessionId", "createdAt");
CREATE INDEX "VerificationReport_workspaceId_runtimeEventId_createdAt_idx" ON "VerificationReport"("workspaceId", "runtimeEventId", "createdAt");

CREATE TABLE "SignalEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "runtimeSessionId" TEXT NOT NULL,
  "meetingId" TEXT,
  "opportunityId" TEXT,
  "companyId" TEXT,
  "signalKey" TEXT NOT NULL,
  "signalType" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "signalSummary" TEXT NOT NULL,
  "normalizedPayload" TEXT,
  "truthWeight" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SignalEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SignalEvent_runtimeSessionId_fkey" FOREIGN KEY ("runtimeSessionId") REFERENCES "RuntimeSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SignalEvent_signalKey_key" ON "SignalEvent"("signalKey");
CREATE INDEX "SignalEvent_workspaceId_runtimeSessionId_createdAt_idx" ON "SignalEvent"("workspaceId", "runtimeSessionId", "createdAt");
CREATE INDEX "SignalEvent_workspaceId_meetingId_createdAt_idx" ON "SignalEvent"("workspaceId", "meetingId", "createdAt");

CREATE TABLE "TruthConflict" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "runtimeSessionId" TEXT NOT NULL,
  "conflictKey" TEXT NOT NULL,
  "subjectKey" TEXT NOT NULL,
  "preferredSource" TEXT NOT NULL,
  "conflictingSource" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "resolutionNote" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TruthConflict_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TruthConflict_runtimeSessionId_fkey" FOREIGN KEY ("runtimeSessionId") REFERENCES "RuntimeSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TruthConflict_conflictKey_key" ON "TruthConflict"("conflictKey");
CREATE INDEX "TruthConflict_workspaceId_runtimeSessionId_createdAt_idx" ON "TruthConflict"("workspaceId", "runtimeSessionId", "createdAt");

CREATE TABLE "WorldModelSnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "runtimeSessionId" TEXT NOT NULL,
  "meetingId" TEXT,
  "opportunityId" TEXT,
  "companyId" TEXT,
  "snapshotKey" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "snapshotJson" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorldModelSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorldModelSnapshot_runtimeSessionId_fkey" FOREIGN KEY ("runtimeSessionId") REFERENCES "RuntimeSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WorldModelSnapshot_snapshotKey_key" ON "WorldModelSnapshot"("snapshotKey");
CREATE INDEX "WorldModelSnapshot_workspaceId_runtimeSessionId_createdAt_idx" ON "WorldModelSnapshot"("workspaceId", "runtimeSessionId", "createdAt");
CREATE INDEX "WorldModelSnapshot_workspaceId_meetingId_createdAt_idx" ON "WorldModelSnapshot"("workspaceId", "meetingId", "createdAt");

CREATE TABLE "ProblemSpace" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "runtimeSessionId" TEXT NOT NULL,
  "meetingId" TEXT,
  "opportunityId" TEXT,
  "companyId" TEXT,
  "sourceWorldModelKey" TEXT,
  "problemKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "nextStep" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "evidenceRefs" TEXT,
  "ownerHint" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProblemSpace_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProblemSpace_runtimeSessionId_fkey" FOREIGN KEY ("runtimeSessionId") REFERENCES "RuntimeSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProblemSpace_problemKey_key" ON "ProblemSpace"("problemKey");
CREATE INDEX "ProblemSpace_workspaceId_runtimeSessionId_createdAt_idx" ON "ProblemSpace"("workspaceId", "runtimeSessionId", "createdAt");
CREATE INDEX "ProblemSpace_workspaceId_meetingId_createdAt_idx" ON "ProblemSpace"("workspaceId", "meetingId", "createdAt");
CREATE INDEX "ProblemSpace_workspaceId_status_createdAt_idx" ON "ProblemSpace"("workspaceId", "status", "createdAt");

CREATE TABLE "DriAssignment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "problemSpaceId" TEXT NOT NULL,
  "assignmentKey" TEXT NOT NULL,
  "assignedUserId" TEXT,
  "assignedUserName" TEXT,
  "assignedByUserId" TEXT,
  "assignedByName" TEXT,
  "note" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriAssignment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DriAssignment_problemSpaceId_fkey" FOREIGN KEY ("problemSpaceId") REFERENCES "ProblemSpace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DriAssignment_assignmentKey_key" ON "DriAssignment"("assignmentKey");
CREATE INDEX "DriAssignment_workspaceId_problemSpaceId_createdAt_idx" ON "DriAssignment"("workspaceId", "problemSpaceId", "createdAt");

CREATE TABLE "EdgeBrief" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "runtimeSessionId" TEXT NOT NULL,
  "problemSpaceId" TEXT,
  "briefKey" TEXT NOT NULL,
  "audience" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "markdown" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EdgeBrief_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EdgeBrief_runtimeSessionId_fkey" FOREIGN KEY ("runtimeSessionId") REFERENCES "RuntimeSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EdgeBrief_problemSpaceId_fkey" FOREIGN KEY ("problemSpaceId") REFERENCES "ProblemSpace" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EdgeBrief_briefKey_key" ON "EdgeBrief"("briefKey");
CREATE INDEX "EdgeBrief_workspaceId_runtimeSessionId_createdAt_idx" ON "EdgeBrief"("workspaceId", "runtimeSessionId", "createdAt");
CREATE INDEX "EdgeBrief_workspaceId_audience_createdAt_idx" ON "EdgeBrief"("workspaceId", "audience", "createdAt");

CREATE TABLE "CompositionFailure" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "runtimeSessionId" TEXT NOT NULL,
  "meetingId" TEXT,
  "problemSpaceId" TEXT,
  "failureKey" TEXT NOT NULL,
  "failureClass" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "detailsJson" TEXT,
  "resolved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompositionFailure_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompositionFailure_runtimeSessionId_fkey" FOREIGN KEY ("runtimeSessionId") REFERENCES "RuntimeSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompositionFailure_problemSpaceId_fkey" FOREIGN KEY ("problemSpaceId") REFERENCES "ProblemSpace" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CompositionFailure_failureKey_key" ON "CompositionFailure"("failureKey");
CREATE INDEX "CompositionFailure_workspaceId_runtimeSessionId_createdAt_idx" ON "CompositionFailure"("workspaceId", "runtimeSessionId", "createdAt");
CREATE INDEX "CompositionFailure_workspaceId_failureClass_createdAt_idx" ON "CompositionFailure"("workspaceId", "failureClass", "createdAt");

CREATE TABLE "CapabilityCatalogEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "capabilityKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "loadPolicy" TEXT NOT NULL,
  "reviewRequired" BOOLEAN NOT NULL DEFAULT true,
  "boundaryNote" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CapabilityCatalogEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CapabilityCatalogEntry_capabilityKey_key" ON "CapabilityCatalogEntry"("capabilityKey");
CREATE INDEX "CapabilityCatalogEntry_workspaceId_stage_createdAt_idx" ON "CapabilityCatalogEntry"("workspaceId", "stage", "createdAt");

CREATE TABLE "PromptCacheTelemetry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "runtimeSessionId" TEXT,
  "cacheKey" TEXT NOT NULL,
  "promptLabel" TEXT NOT NULL,
  "cacheStatus" TEXT NOT NULL,
  "tokensBefore" INTEGER NOT NULL,
  "tokensAfter" INTEGER NOT NULL,
  "tokensSaved" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromptCacheTelemetry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PromptCacheTelemetry_runtimeSessionId_fkey" FOREIGN KEY ("runtimeSessionId") REFERENCES "RuntimeSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PromptCacheTelemetry_cacheKey_key" ON "PromptCacheTelemetry"("cacheKey");
CREATE INDEX "PromptCacheTelemetry_workspaceId_createdAt_idx" ON "PromptCacheTelemetry"("workspaceId", "createdAt");
CREATE INDEX "PromptCacheTelemetry_workspaceId_runtimeSessionId_createdAt_idx" ON "PromptCacheTelemetry"("workspaceId", "runtimeSessionId", "createdAt");

CREATE TABLE "ArtifactVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "artifactBundleId" TEXT NOT NULL,
  "versionKey" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "artifactType" TEXT NOT NULL,
  "reviewPosture" TEXT,
  "snapshotJson" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArtifactVersion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ArtifactVersion_versionKey_key" ON "ArtifactVersion"("versionKey");
CREATE UNIQUE INDEX "ArtifactVersion_artifactBundleId_versionNumber_key" ON "ArtifactVersion"("artifactBundleId", "versionNumber");
CREATE INDEX "ArtifactVersion_workspaceId_artifactBundleId_createdAt_idx" ON "ArtifactVersion"("workspaceId", "artifactBundleId", "createdAt");

CREATE TABLE "ConsolidationJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "runtimeSessionId" TEXT,
  "jobKey" TEXT NOT NULL,
  "jobType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "inputSummary" TEXT NOT NULL,
  "outputSummary" TEXT,
  "reviewPosture" TEXT NOT NULL,
  "startedAt" DATETIME,
  "pausedAt" DATETIME,
  "completedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsolidationJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ConsolidationJob_runtimeSessionId_fkey" FOREIGN KEY ("runtimeSessionId") REFERENCES "RuntimeSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ConsolidationJob_jobKey_key" ON "ConsolidationJob"("jobKey");
CREATE INDEX "ConsolidationJob_workspaceId_status_createdAt_idx" ON "ConsolidationJob"("workspaceId", "status", "createdAt");

CREATE TABLE "HandoffPacket" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "runtimeSessionId" TEXT NOT NULL,
  "problemSpaceId" TEXT,
  "packetKey" TEXT NOT NULL,
  "fromAgent" TEXT NOT NULL,
  "toAgent" TEXT NOT NULL,
  "goal" TEXT NOT NULL,
  "constraintsJson" TEXT,
  "trustedRefs" TEXT,
  "untrustedRefs" TEXT,
  "requiredOutputs" TEXT,
  "evidenceRefs" TEXT,
  "notebookRef" TEXT,
  "checkpointRef" TEXT,
  "approvalTier" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HandoffPacket_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "HandoffPacket_runtimeSessionId_fkey" FOREIGN KEY ("runtimeSessionId") REFERENCES "RuntimeSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "HandoffPacket_problemSpaceId_fkey" FOREIGN KEY ("problemSpaceId") REFERENCES "ProblemSpace" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "HandoffPacket_packetKey_key" ON "HandoffPacket"("packetKey");
CREATE INDEX "HandoffPacket_workspaceId_runtimeSessionId_createdAt_idx" ON "HandoffPacket"("workspaceId", "runtimeSessionId", "createdAt");
CREATE INDEX "HandoffPacket_workspaceId_problemSpaceId_createdAt_idx" ON "HandoffPacket"("workspaceId", "problemSpaceId", "createdAt");

CREATE TABLE "InitiativeRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "runtimeSessionId" TEXT NOT NULL,
  "problemSpaceId" TEXT,
  "initiativeKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DETECTED',
  "targetOutcome" TEXT NOT NULL,
  "nextReviewAt" DATETIME,
  "boundaryNote" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InitiativeRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InitiativeRun_runtimeSessionId_fkey" FOREIGN KEY ("runtimeSessionId") REFERENCES "RuntimeSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InitiativeRun_problemSpaceId_fkey" FOREIGN KEY ("problemSpaceId") REFERENCES "ProblemSpace" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "InitiativeRun_initiativeKey_key" ON "InitiativeRun"("initiativeKey");
CREATE INDEX "InitiativeRun_workspaceId_runtimeSessionId_createdAt_idx" ON "InitiativeRun"("workspaceId", "runtimeSessionId", "createdAt");
CREATE INDEX "InitiativeRun_workspaceId_status_createdAt_idx" ON "InitiativeRun"("workspaceId", "status", "createdAt");
CREATE INDEX "InitiativeRun_workspaceId_problemSpaceId_createdAt_idx" ON "InitiativeRun"("workspaceId", "problemSpaceId", "createdAt");

CREATE TABLE "CoordinationMetricsDaily" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "metricDate" DATETIME NOT NULL,
  "activeSessions" INTEGER NOT NULL DEFAULT 0,
  "actionReadyCount" INTEGER NOT NULL DEFAULT 0,
  "reviewNeededCount" INTEGER NOT NULL DEFAULT 0,
  "waitingOnSignalCount" INTEGER NOT NULL DEFAULT 0,
  "waitingOnAuthorityCount" INTEGER NOT NULL DEFAULT 0,
  "capabilityGapCount" INTEGER NOT NULL DEFAULT 0,
  "openProblemSpaces" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoordinationMetricsDaily_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CoordinationMetricsDaily_workspaceId_metricDate_key" ON "CoordinationMetricsDaily"("workspaceId", "metricDate");
CREATE INDEX "CoordinationMetricsDaily_workspaceId_metricDate_idx" ON "CoordinationMetricsDaily"("workspaceId", "metricDate");
