-- CreateTable
CREATE TABLE "ConnectorIngestionRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "runtimeEventId" TEXT,
    "meetingId" TEXT,
    "opportunityId" TEXT,
    "companyId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceScope" TEXT NOT NULL,
    "trustLevel" TEXT NOT NULL,
    "trustPromotionStatus" TEXT NOT NULL,
    "sensitivity" TEXT NOT NULL,
    "normalizationStatus" TEXT NOT NULL,
    "promotionEligibility" TEXT NOT NULL,
    "objectRefs" TEXT NOT NULL,
    "evidenceRef" TEXT NOT NULL,
    "extractedFacts" TEXT,
    "draftPayload" TEXT,
    "sourceSummary" TEXT NOT NULL,
    "boundaryNote" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConnectorIngestionRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConnectorIngestionRecord_runtimeEventId_fkey" FOREIGN KEY ("runtimeEventId") REFERENCES "RuntimeEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ConnectorIngestionRecord_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ConnectorIngestionRecord_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ConnectorIngestionRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RetrievalTrace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "runtimeEventId" TEXT,
    "meetingId" TEXT,
    "opportunityId" TEXT,
    "companyId" TEXT,
    "runtimeLabel" TEXT NOT NULL,
    "workerId" TEXT,
    "triggerMode" TEXT NOT NULL,
    "triggerKey" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "loadedRefs" TEXT,
    "skippedRefs" TEXT,
    "evidenceRefs" TEXT,
    "sourceProvenance" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RetrievalTrace_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RetrievalTrace_runtimeEventId_fkey" FOREIGN KEY ("runtimeEventId") REFERENCES "RuntimeEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RetrievalTrace_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RetrievalTrace_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RetrievalTrace_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ConnectorIngestionRecord_workspaceId_sourceType_createdAt_idx" ON "ConnectorIngestionRecord"("workspaceId", "sourceType", "createdAt");

-- CreateIndex
CREATE INDEX "ConnectorIngestionRecord_meetingId_sourceType_createdAt_idx" ON "ConnectorIngestionRecord"("meetingId", "sourceType", "createdAt");

-- CreateIndex
CREATE INDEX "ConnectorIngestionRecord_runtimeEventId_createdAt_idx" ON "ConnectorIngestionRecord"("runtimeEventId", "createdAt");

-- CreateIndex
CREATE INDEX "RetrievalTrace_workspaceId_triggerMode_createdAt_idx" ON "RetrievalTrace"("workspaceId", "triggerMode", "createdAt");

-- CreateIndex
CREATE INDEX "RetrievalTrace_meetingId_triggerMode_createdAt_idx" ON "RetrievalTrace"("meetingId", "triggerMode", "createdAt");

-- CreateIndex
CREATE INDEX "RetrievalTrace_runtimeEventId_triggerMode_createdAt_idx" ON "RetrievalTrace"("runtimeEventId", "triggerMode", "createdAt");
