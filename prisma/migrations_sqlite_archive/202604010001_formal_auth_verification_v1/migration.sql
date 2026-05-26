-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordSetAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "phoneVerifiedAt" DATETIME;

-- CreateTable
CREATE TABLE "AuthEnrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'zh-CN',
    "passwordHash" TEXT NOT NULL,
    "emailVerifiedAt" DATETIME,
    "phoneVerifiedAt" DATETIME,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuthVerificationCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purpose" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enrollmentId" TEXT,
    "userId" TEXT,
    CONSTRAINT "AuthVerificationCode_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "AuthEnrollment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuthVerificationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TrialState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "trialStartedAt" DATETIME NOT NULL,
    "trialEndsAt" DATETIME NOT NULL,
    "graceEndsAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TRIALING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrialState_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TrialState" ("createdAt", "graceEndsAt", "id", "status", "trialEndsAt", "trialStartedAt", "updatedAt", "workspaceId") SELECT "createdAt", "graceEndsAt", "id", "status", "trialEndsAt", "trialStartedAt", "updatedAt", "workspaceId" FROM "TrialState";
DROP TABLE "TrialState";
ALTER TABLE "new_TrialState" RENAME TO "TrialState";
CREATE UNIQUE INDEX "TrialState_workspaceId_key" ON "TrialState"("workspaceId");
CREATE TABLE "new_WorkerEntitlement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "workerKey" TEXT NOT NULL,
    "entitlementType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "internalLimit" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkerEntitlement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WorkerEntitlement" ("createdAt", "effectiveFrom", "effectiveTo", "entitlementType", "id", "internalLimit", "status", "updatedAt", "workerKey", "workspaceId") SELECT "createdAt", "effectiveFrom", "effectiveTo", "entitlementType", "id", "internalLimit", "status", "updatedAt", "workerKey", "workspaceId" FROM "WorkerEntitlement";
DROP TABLE "WorkerEntitlement";
ALTER TABLE "new_WorkerEntitlement" RENAME TO "WorkerEntitlement";
CREATE INDEX "WorkerEntitlement_workspaceId_status_idx" ON "WorkerEntitlement"("workspaceId", "status");
CREATE UNIQUE INDEX "WorkerEntitlement_workspaceId_workerKey_key" ON "WorkerEntitlement"("workspaceId", "workerKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AuthEnrollment_email_key" ON "AuthEnrollment"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AuthEnrollment_phone_key" ON "AuthEnrollment"("phone");

-- CreateIndex
CREATE INDEX "AuthEnrollment_expiresAt_idx" ON "AuthEnrollment"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthVerificationCode_purpose_target_expiresAt_idx" ON "AuthVerificationCode"("purpose", "target", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthVerificationCode_enrollmentId_idx" ON "AuthVerificationCode"("enrollmentId");

-- CreateIndex
CREATE INDEX "AuthVerificationCode_userId_idx" ON "AuthVerificationCode"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
