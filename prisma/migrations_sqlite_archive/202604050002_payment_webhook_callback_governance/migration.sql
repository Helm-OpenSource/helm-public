-- CreateTable
CREATE TABLE "PaymentWebhookCallbackEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT,
    "provider" TEXT NOT NULL,
    "callbackMode" TEXT NOT NULL,
    "externalEventId" TEXT,
    "callbackFingerprint" TEXT NOT NULL,
    "governanceStatus" TEXT NOT NULL DEFAULT 'RECEIVED',
    "actionType" TEXT,
    "resolutionSource" TEXT,
    "failureReason" TEXT,
    "authoritativeSource" TEXT,
    "hintSource" TEXT,
    "hintWorkspaceId" TEXT,
    "summary" TEXT NOT NULL,
    "payloadJson" TEXT,
    "duplicateReceptionCount" INTEGER NOT NULL DEFAULT 0,
    "firstReceivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReceivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDuplicateAt" DATETIME,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentWebhookCallbackEvent_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookCallbackEvent_callbackFingerprint_key"
ON "PaymentWebhookCallbackEvent"("callbackFingerprint");

-- CreateIndex
CREATE INDEX "PaymentWebhookCallbackEvent_workspaceId_governanceStatus_createdAt_idx"
ON "PaymentWebhookCallbackEvent"("workspaceId", "governanceStatus", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentWebhookCallbackEvent_provider_governanceStatus_createdAt_idx"
ON "PaymentWebhookCallbackEvent"("provider", "governanceStatus", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentWebhookCallbackEvent_callbackMode_governanceStatus_createdAt_idx"
ON "PaymentWebhookCallbackEvent"("callbackMode", "governanceStatus", "createdAt");
