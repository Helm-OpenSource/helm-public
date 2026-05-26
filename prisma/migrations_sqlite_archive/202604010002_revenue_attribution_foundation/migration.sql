CREATE TABLE "WorkerPublisherProfile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "publisherKey" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "contactEmail" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkerPublisherProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WorkerPublisherProfile_workspaceId_publisherKey_key" ON "WorkerPublisherProfile"("workspaceId", "publisherKey");
CREATE INDEX "WorkerPublisherProfile_workspaceId_status_idx" ON "WorkerPublisherProfile"("workspaceId", "status");

CREATE TABLE "SalesReferral" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "referralKey" TEXT NOT NULL,
  "beneficiaryLabel" TEXT NOT NULL,
  "beneficiaryContact" TEXT,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "effectiveFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesReferral_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SalesReferral_workspaceId_referralKey_key" ON "SalesReferral"("workspaceId", "referralKey");
CREATE INDEX "SalesReferral_workspaceId_status_idx" ON "SalesReferral"("workspaceId", "status");

CREATE TABLE "CustomEngagement" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "engagementKey" TEXT NOT NULL,
  "engagementType" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "beneficiaryLabel" TEXT NOT NULL,
  "contractValueCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'CNY',
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "effectiveFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomEngagement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CustomEngagement_workspaceId_engagementKey_key" ON "CustomEngagement"("workspaceId", "engagementKey");
CREATE INDEX "CustomEngagement_workspaceId_engagementType_status_idx" ON "CustomEngagement"("workspaceId", "engagementType", "status");

CREATE TABLE "RevenueRule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "ruleKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "beneficiaryType" TEXT NOT NULL,
  "beneficiaryLabel" TEXT NOT NULL,
  "cadence" TEXT NOT NULL,
  "valueType" TEXT NOT NULL,
  "percentBps" INTEGER,
  "fixedAmountCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'CNY',
  "reverseOnCancel" BOOLEAN NOT NULL DEFAULT true,
  "workerKey" TEXT,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "effectiveFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" DATETIME,
  "workerPublisherProfileId" TEXT,
  "salesReferralId" TEXT,
  "customEngagementId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RevenueRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RevenueRule_workerPublisherProfileId_fkey" FOREIGN KEY ("workerPublisherProfileId") REFERENCES "WorkerPublisherProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "RevenueRule_salesReferralId_fkey" FOREIGN KEY ("salesReferralId") REFERENCES "SalesReferral" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "RevenueRule_customEngagementId_fkey" FOREIGN KEY ("customEngagementId") REFERENCES "CustomEngagement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RevenueRule_workspaceId_ruleKey_key" ON "RevenueRule"("workspaceId", "ruleKey");
CREATE INDEX "RevenueRule_workspaceId_sourceType_status_idx" ON "RevenueRule"("workspaceId", "sourceType", "status");

CREATE TABLE "RevenueAttributionLedger" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "revenueRuleId" TEXT,
  "sourceType" TEXT NOT NULL,
  "beneficiaryType" TEXT NOT NULL,
  "sourceLabel" TEXT NOT NULL,
  "sourceReference" TEXT,
  "beneficiaryLabel" TEXT NOT NULL,
  "grossAmountCents" INTEGER NOT NULL,
  "attributedAmountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CNY',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "recognizedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reversalOfId" TEXT,
  "reversalReason" TEXT,
  "metadata" TEXT,
  "workerPublisherProfileId" TEXT,
  "salesReferralId" TEXT,
  "customEngagementId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RevenueAttributionLedger_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RevenueAttributionLedger_revenueRuleId_fkey" FOREIGN KEY ("revenueRuleId") REFERENCES "RevenueRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "RevenueAttributionLedger_workerPublisherProfileId_fkey" FOREIGN KEY ("workerPublisherProfileId") REFERENCES "WorkerPublisherProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "RevenueAttributionLedger_salesReferralId_fkey" FOREIGN KEY ("salesReferralId") REFERENCES "SalesReferral" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "RevenueAttributionLedger_customEngagementId_fkey" FOREIGN KEY ("customEngagementId") REFERENCES "CustomEngagement" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "RevenueAttributionLedger_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "RevenueAttributionLedger" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "RevenueAttributionLedger_workspaceId_status_recognizedAt_idx" ON "RevenueAttributionLedger"("workspaceId", "status", "recognizedAt");
CREATE INDEX "RevenueAttributionLedger_workspaceId_sourceType_recognizedAt_idx" ON "RevenueAttributionLedger"("workspaceId", "sourceType", "recognizedAt");

CREATE TABLE "PayoutLedger" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "revenueAttributionLedgerId" TEXT NOT NULL,
  "beneficiaryType" TEXT NOT NULL,
  "beneficiaryLabel" TEXT NOT NULL,
  "payableAmountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CNY',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "payableAfter" DATETIME,
  "approvedAt" DATETIME,
  "paidAt" DATETIME,
  "reversedAt" DATETIME,
  "notes" TEXT,
  "workerPublisherProfileId" TEXT,
  "salesReferralId" TEXT,
  "customEngagementId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayoutLedger_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PayoutLedger_revenueAttributionLedgerId_fkey" FOREIGN KEY ("revenueAttributionLedgerId") REFERENCES "RevenueAttributionLedger" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PayoutLedger_workerPublisherProfileId_fkey" FOREIGN KEY ("workerPublisherProfileId") REFERENCES "WorkerPublisherProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PayoutLedger_salesReferralId_fkey" FOREIGN KEY ("salesReferralId") REFERENCES "SalesReferral" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PayoutLedger_customEngagementId_fkey" FOREIGN KEY ("customEngagementId") REFERENCES "CustomEngagement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PayoutLedger_revenueAttributionLedgerId_key" ON "PayoutLedger"("revenueAttributionLedgerId");
CREATE INDEX "PayoutLedger_workspaceId_status_createdAt_idx" ON "PayoutLedger"("workspaceId", "status", "createdAt");
