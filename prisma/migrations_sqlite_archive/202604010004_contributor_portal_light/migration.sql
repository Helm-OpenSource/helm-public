-- CreateTable
CREATE TABLE "ParticipantPortalAccess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "beneficiaryType" TEXT NOT NULL,
    "beneficiaryReference" TEXT NOT NULL,
    "inviteEmail" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "contact" TEXT,
    "inviteTokenHash" TEXT NOT NULL,
    "termsAcceptedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "lastInviteIssuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" DATETIME,
    "suspendedAt" DATETIME,
    "archivedAt" DATETIME,
    "notes" TEXT,
    "workerPublisherProfileId" TEXT,
    "salesReferralId" TEXT,
    "customEngagementId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ParticipantPortalAccess_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ParticipantPortalAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ParticipantPortalAccess_workerPublisherProfileId_fkey" FOREIGN KEY ("workerPublisherProfileId") REFERENCES "WorkerPublisherProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ParticipantPortalAccess_salesReferralId_fkey" FOREIGN KEY ("salesReferralId") REFERENCES "SalesReferral" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ParticipantPortalAccess_customEngagementId_fkey" FOREIGN KEY ("customEngagementId") REFERENCES "CustomEngagement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantPortalAccess_inviteTokenHash_key" ON "ParticipantPortalAccess"("inviteTokenHash");

-- CreateIndex
CREATE INDEX "ParticipantPortalAccess_workspaceId_status_beneficiaryType_idx" ON "ParticipantPortalAccess"("workspaceId", "status", "beneficiaryType");

-- CreateIndex
CREATE INDEX "ParticipantPortalAccess_userId_status_idx" ON "ParticipantPortalAccess"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantPortalAccess_workspaceId_beneficiaryType_beneficiaryReference_key" ON "ParticipantPortalAccess"("workspaceId", "beneficiaryType", "beneficiaryReference");
