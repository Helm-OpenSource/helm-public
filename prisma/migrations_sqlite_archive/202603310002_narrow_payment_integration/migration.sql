-- CreateEnum
CREATE TABLE "new_BillingAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "currentPlan" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "billingStatus" TEXT NOT NULL DEFAULT 'TRIALING',
    "paymentProvider" TEXT,
    "paymentCustomerId" TEXT,
    "paymentSubscriptionId" TEXT,
    "paymentSubscriptionStatus" TEXT,
    "paymentCheckoutSessionId" TEXT,
    "paymentCheckoutCompletedAt" DATETIME,
    "billingPeriodStartsAt" DATETIME,
    "billingPeriodEndsAt" DATETIME,
    "lastPaymentSyncAt" DATETIME,
    "baseFeeCents" INTEGER NOT NULL,
    "activeSeatPriceCents" INTEGER NOT NULL,
    "includedAdminSeats" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BillingAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_BillingAccount" (
  "id",
  "workspaceId",
  "currentPlan",
  "currency",
  "billingStatus",
  "baseFeeCents",
  "activeSeatPriceCents",
  "includedAdminSeats",
  "createdAt",
  "updatedAt"
)
SELECT
  "id",
  "workspaceId",
  "currentPlan",
  "currency",
  "billingStatus",
  "baseFeeCents",
  "activeSeatPriceCents",
  "includedAdminSeats",
  "createdAt",
  "updatedAt"
FROM "BillingAccount";

DROP TABLE "BillingAccount";
ALTER TABLE "new_BillingAccount" RENAME TO "BillingAccount";

CREATE UNIQUE INDEX "BillingAccount_workspaceId_key" ON "BillingAccount"("workspaceId");
CREATE UNIQUE INDEX "BillingAccount_paymentCustomerId_key" ON "BillingAccount"("paymentCustomerId");
CREATE UNIQUE INDEX "BillingAccount_paymentSubscriptionId_key" ON "BillingAccount"("paymentSubscriptionId");
