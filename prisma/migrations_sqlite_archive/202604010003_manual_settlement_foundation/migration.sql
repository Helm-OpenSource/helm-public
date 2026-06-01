-- CreateTable
CREATE TABLE "BeneficiaryPayoutProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "beneficiaryType" TEXT NOT NULL,
    "beneficiaryReference" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "legalName" TEXT,
    "contact" TEXT,
    "payoutMethodLabel" TEXT NOT NULL,
    "payoutDetailsReference" TEXT,
    "invoiceRequired" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "workerPublisherProfileId" TEXT,
    "salesReferralId" TEXT,
    "customEngagementId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BeneficiaryPayoutProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BeneficiaryPayoutProfile_workerPublisherProfileId_fkey" FOREIGN KEY ("workerPublisherProfileId") REFERENCES "WorkerPublisherProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BeneficiaryPayoutProfile_salesReferralId_fkey" FOREIGN KEY ("salesReferralId") REFERENCES "SalesReferral" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BeneficiaryPayoutProfile_customEngagementId_fkey" FOREIGN KEY ("customEngagementId") REFERENCES "CustomEngagement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SettlementBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "batchKey" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "approvedAt" DATETIME,
    "exportedAt" DATETIME,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SettlementBatch_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SettlementBatchLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "settlementBatchId" TEXT NOT NULL,
    "payoutLedgerId" TEXT NOT NULL,
    "beneficiaryPayoutProfileId" TEXT,
    "beneficiaryType" TEXT NOT NULL,
    "beneficiaryLabel" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "reference" TEXT,
    "approvedAt" DATETIME,
    "exportedAt" DATETIME,
    "paidAt" DATETIME,
    "reversedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SettlementBatchLine_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SettlementBatchLine_settlementBatchId_fkey" FOREIGN KEY ("settlementBatchId") REFERENCES "SettlementBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SettlementBatchLine_payoutLedgerId_fkey" FOREIGN KEY ("payoutLedgerId") REFERENCES "PayoutLedger" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SettlementBatchLine_beneficiaryPayoutProfileId_fkey" FOREIGN KEY ("beneficiaryPayoutProfileId") REFERENCES "BeneficiaryPayoutProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CustomEngagement" (
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomEngagement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CustomEngagement" ("beneficiaryLabel", "contractValueCents", "createdAt", "currency", "effectiveFrom", "effectiveTo", "engagementKey", "engagementType", "id", "label", "notes", "status", "updatedAt", "workspaceId") SELECT "beneficiaryLabel", "contractValueCents", "createdAt", "currency", "effectiveFrom", "effectiveTo", "engagementKey", "engagementType", "id", "label", "notes", "status", "updatedAt", "workspaceId" FROM "CustomEngagement";
DROP TABLE "CustomEngagement";
ALTER TABLE "new_CustomEngagement" RENAME TO "CustomEngagement";
CREATE INDEX "CustomEngagement_workspaceId_engagementType_status_idx" ON "CustomEngagement"("workspaceId", "engagementType", "status");
CREATE UNIQUE INDEX "CustomEngagement_workspaceId_engagementKey_key" ON "CustomEngagement"("workspaceId", "engagementKey");
CREATE TABLE "new_PayoutLedger" (
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PayoutLedger_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PayoutLedger_revenueAttributionLedgerId_fkey" FOREIGN KEY ("revenueAttributionLedgerId") REFERENCES "RevenueAttributionLedger" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PayoutLedger_workerPublisherProfileId_fkey" FOREIGN KEY ("workerPublisherProfileId") REFERENCES "WorkerPublisherProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PayoutLedger_salesReferralId_fkey" FOREIGN KEY ("salesReferralId") REFERENCES "SalesReferral" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PayoutLedger_customEngagementId_fkey" FOREIGN KEY ("customEngagementId") REFERENCES "CustomEngagement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PayoutLedger" ("approvedAt", "beneficiaryLabel", "beneficiaryType", "createdAt", "currency", "customEngagementId", "id", "notes", "paidAt", "payableAfter", "payableAmountCents", "revenueAttributionLedgerId", "reversedAt", "salesReferralId", "status", "updatedAt", "workerPublisherProfileId", "workspaceId") SELECT "approvedAt", "beneficiaryLabel", "beneficiaryType", "createdAt", "currency", "customEngagementId", "id", "notes", "paidAt", "payableAfter", "payableAmountCents", "revenueAttributionLedgerId", "reversedAt", "salesReferralId", "status", "updatedAt", "workerPublisherProfileId", "workspaceId" FROM "PayoutLedger";
DROP TABLE "PayoutLedger";
ALTER TABLE "new_PayoutLedger" RENAME TO "PayoutLedger";
CREATE UNIQUE INDEX "PayoutLedger_revenueAttributionLedgerId_key" ON "PayoutLedger"("revenueAttributionLedgerId");
CREATE INDEX "PayoutLedger_workspaceId_status_createdAt_idx" ON "PayoutLedger"("workspaceId", "status", "createdAt");
CREATE TABLE "new_RevenueAttributionLedger" (
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RevenueAttributionLedger_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RevenueAttributionLedger_revenueRuleId_fkey" FOREIGN KEY ("revenueRuleId") REFERENCES "RevenueRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RevenueAttributionLedger_workerPublisherProfileId_fkey" FOREIGN KEY ("workerPublisherProfileId") REFERENCES "WorkerPublisherProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RevenueAttributionLedger_salesReferralId_fkey" FOREIGN KEY ("salesReferralId") REFERENCES "SalesReferral" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RevenueAttributionLedger_customEngagementId_fkey" FOREIGN KEY ("customEngagementId") REFERENCES "CustomEngagement" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RevenueAttributionLedger_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "RevenueAttributionLedger" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RevenueAttributionLedger" ("attributedAmountCents", "beneficiaryLabel", "beneficiaryType", "createdAt", "currency", "customEngagementId", "grossAmountCents", "id", "metadata", "recognizedAt", "revenueRuleId", "reversalOfId", "reversalReason", "salesReferralId", "sourceLabel", "sourceReference", "sourceType", "status", "updatedAt", "workerPublisherProfileId", "workspaceId") SELECT "attributedAmountCents", "beneficiaryLabel", "beneficiaryType", "createdAt", "currency", "customEngagementId", "grossAmountCents", "id", "metadata", "recognizedAt", "revenueRuleId", "reversalOfId", "reversalReason", "salesReferralId", "sourceLabel", "sourceReference", "sourceType", "status", "updatedAt", "workerPublisherProfileId", "workspaceId" FROM "RevenueAttributionLedger";
DROP TABLE "RevenueAttributionLedger";
ALTER TABLE "new_RevenueAttributionLedger" RENAME TO "RevenueAttributionLedger";
CREATE INDEX "RevenueAttributionLedger_workspaceId_status_recognizedAt_idx" ON "RevenueAttributionLedger"("workspaceId", "status", "recognizedAt");
CREATE INDEX "RevenueAttributionLedger_workspaceId_sourceType_recognizedAt_idx" ON "RevenueAttributionLedger"("workspaceId", "sourceType", "recognizedAt");
CREATE TABLE "new_RevenueRule" (
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RevenueRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RevenueRule_workerPublisherProfileId_fkey" FOREIGN KEY ("workerPublisherProfileId") REFERENCES "WorkerPublisherProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RevenueRule_salesReferralId_fkey" FOREIGN KEY ("salesReferralId") REFERENCES "SalesReferral" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RevenueRule_customEngagementId_fkey" FOREIGN KEY ("customEngagementId") REFERENCES "CustomEngagement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RevenueRule" ("beneficiaryLabel", "beneficiaryType", "cadence", "createdAt", "currency", "customEngagementId", "effectiveFrom", "effectiveTo", "fixedAmountCents", "id", "name", "notes", "percentBps", "reverseOnCancel", "ruleKey", "salesReferralId", "sourceType", "status", "updatedAt", "valueType", "workerKey", "workerPublisherProfileId", "workspaceId") SELECT "beneficiaryLabel", "beneficiaryType", "cadence", "createdAt", "currency", "customEngagementId", "effectiveFrom", "effectiveTo", "fixedAmountCents", "id", "name", "notes", "percentBps", "reverseOnCancel", "ruleKey", "salesReferralId", "sourceType", "status", "updatedAt", "valueType", "workerKey", "workerPublisherProfileId", "workspaceId" FROM "RevenueRule";
DROP TABLE "RevenueRule";
ALTER TABLE "new_RevenueRule" RENAME TO "RevenueRule";
CREATE INDEX "RevenueRule_workspaceId_sourceType_status_idx" ON "RevenueRule"("workspaceId", "sourceType", "status");
CREATE UNIQUE INDEX "RevenueRule_workspaceId_ruleKey_key" ON "RevenueRule"("workspaceId", "ruleKey");
CREATE TABLE "new_SalesReferral" (
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalesReferral_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SalesReferral" ("beneficiaryContact", "beneficiaryLabel", "createdAt", "effectiveFrom", "effectiveTo", "id", "notes", "referralKey", "status", "updatedAt", "workspaceId") SELECT "beneficiaryContact", "beneficiaryLabel", "createdAt", "effectiveFrom", "effectiveTo", "id", "notes", "referralKey", "status", "updatedAt", "workspaceId" FROM "SalesReferral";
DROP TABLE "SalesReferral";
ALTER TABLE "new_SalesReferral" RENAME TO "SalesReferral";
CREATE INDEX "SalesReferral_workspaceId_status_idx" ON "SalesReferral"("workspaceId", "status");
CREATE UNIQUE INDEX "SalesReferral_workspaceId_referralKey_key" ON "SalesReferral"("workspaceId", "referralKey");
CREATE TABLE "new_WorkerPublisherProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "publisherKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "contactEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkerPublisherProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WorkerPublisherProfile" ("contactEmail", "createdAt", "displayName", "id", "notes", "publisherKey", "status", "updatedAt", "workspaceId") SELECT "contactEmail", "createdAt", "displayName", "id", "notes", "publisherKey", "status", "updatedAt", "workspaceId" FROM "WorkerPublisherProfile";
DROP TABLE "WorkerPublisherProfile";
ALTER TABLE "new_WorkerPublisherProfile" RENAME TO "WorkerPublisherProfile";
CREATE INDEX "WorkerPublisherProfile_workspaceId_status_idx" ON "WorkerPublisherProfile"("workspaceId", "status");
CREATE UNIQUE INDEX "WorkerPublisherProfile_workspaceId_publisherKey_key" ON "WorkerPublisherProfile"("workspaceId", "publisherKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "BeneficiaryPayoutProfile_workspaceId_status_beneficiaryType_idx" ON "BeneficiaryPayoutProfile"("workspaceId", "status", "beneficiaryType");

-- CreateIndex
CREATE UNIQUE INDEX "BeneficiaryPayoutProfile_workspaceId_beneficiaryType_beneficiaryReference_key" ON "BeneficiaryPayoutProfile"("workspaceId", "beneficiaryType", "beneficiaryReference");

-- CreateIndex
CREATE INDEX "SettlementBatch_workspaceId_status_periodStart_idx" ON "SettlementBatch"("workspaceId", "status", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementBatch_workspaceId_batchKey_key" ON "SettlementBatch"("workspaceId", "batchKey");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementBatchLine_payoutLedgerId_key" ON "SettlementBatchLine"("payoutLedgerId");

-- CreateIndex
CREATE INDEX "SettlementBatchLine_workspaceId_status_createdAt_idx" ON "SettlementBatchLine"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SettlementBatchLine_settlementBatchId_status_idx" ON "SettlementBatchLine"("settlementBatchId", "status");

