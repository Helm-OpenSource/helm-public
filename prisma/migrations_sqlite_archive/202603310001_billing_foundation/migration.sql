ALTER TABLE "Workspace" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "Membership" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Membership" ADD COLUMN "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "BillingAccount" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "currentPlan" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CNY',
  "billingStatus" TEXT NOT NULL DEFAULT 'TRIALING',
  "baseFeeCents" INTEGER NOT NULL,
  "activeSeatPriceCents" INTEGER NOT NULL,
  "includedAdminSeats" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BillingAccount_workspaceId_key" ON "BillingAccount"("workspaceId");

CREATE TABLE "TrialState" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "trialStartedAt" DATETIME NOT NULL,
  "trialEndsAt" DATETIME NOT NULL,
  "graceEndsAt" DATETIME NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'TRIALING',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrialState_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TrialState_workspaceId_key" ON "TrialState"("workspaceId");

CREATE TABLE "WorkerEntitlement" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "workerKey" TEXT NOT NULL,
  "entitlementType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "effectiveFrom" DATETIME NOT NULL,
  "effectiveTo" DATETIME,
  "internalLimit" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkerEntitlement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WorkerEntitlement_workspaceId_workerKey_key" ON "WorkerEntitlement"("workspaceId", "workerKey");
CREATE INDEX "WorkerEntitlement_workspaceId_status_idx" ON "WorkerEntitlement"("workspaceId", "status");

CREATE TABLE "UsageLedger" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT,
  "usageType" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "metadata" TEXT,
  "sourcePage" TEXT,
  "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsageLedger_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UsageLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "UsageLedger_workspaceId_recordedAt_idx" ON "UsageLedger"("workspaceId", "recordedAt");
CREATE INDEX "UsageLedger_workspaceId_usageType_recordedAt_idx" ON "UsageLedger"("workspaceId", "usageType", "recordedAt");
