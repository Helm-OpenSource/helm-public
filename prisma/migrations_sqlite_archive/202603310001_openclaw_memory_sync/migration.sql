CREATE TABLE "ExternalMemorySyncState" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "lastSyncedAt" DATETIME,
  "lastCursor" TEXT,
  "lastRunStatus" TEXT NOT NULL DEFAULT 'IDLE',
  "lastError" TEXT,
  "isRunning" BOOLEAN NOT NULL DEFAULT false,
  "runStartedAt" DATETIME,
  "runFinishedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ExternalMemorySyncState_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ExternalMemoryRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "importance" INTEGER,
  "occurredAt" DATETIME NOT NULL,
  "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rawMetadata" TEXT,
  "text" TEXT NOT NULL,
  "sourceFile" TEXT,
  "sourceLine" INTEGER,
  "checksum" TEXT,
  "memoryEntryId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ExternalMemoryRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExternalMemoryRecord_memoryEntryId_fkey" FOREIGN KEY ("memoryEntryId") REFERENCES "MemoryEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ExternalMemorySyncState_workspaceId_provider_key" ON "ExternalMemorySyncState"("workspaceId", "provider");
CREATE INDEX "ExternalMemorySyncState_workspaceId_lastRunStatus_idx" ON "ExternalMemorySyncState"("workspaceId", "lastRunStatus");

CREATE UNIQUE INDEX "ExternalMemoryRecord_memoryEntryId_key" ON "ExternalMemoryRecord"("memoryEntryId");
CREATE UNIQUE INDEX "ExternalMemoryRecord_workspaceId_provider_externalId_key" ON "ExternalMemoryRecord"("workspaceId", "provider", "externalId");
CREATE INDEX "ExternalMemoryRecord_workspaceId_provider_occurredAt_idx" ON "ExternalMemoryRecord"("workspaceId", "provider", "occurredAt");
CREATE INDEX "ExternalMemoryRecord_workspaceId_scope_category_idx" ON "ExternalMemoryRecord"("workspaceId", "scope", "category");
