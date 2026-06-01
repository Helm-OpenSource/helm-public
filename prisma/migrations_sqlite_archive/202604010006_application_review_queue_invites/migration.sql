-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProgramApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "partnerProgramId" TEXT NOT NULL,
    "programTermsVersionId" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "applicantEmail" TEXT NOT NULL,
    "applicantOrganization" TEXT,
    "roleTitle" TEXT,
    "website" TEXT,
    "regionLabel" TEXT,
    "background" TEXT,
    "contributionPlan" TEXT,
    "termsAcceptedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "internalNotes" TEXT,
    "recommendedBeneficiaryType" TEXT,
    "workerPublisherProfileId" TEXT,
    "salesReferralId" TEXT,
    "customEngagementId" TEXT,
    "participantPortalAccessId" TEXT,
    "reviewedAt" DATETIME,
    "invitedAt" DATETIME,
    "reviewedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProgramApplication_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProgramApplication_partnerProgramId_fkey" FOREIGN KEY ("partnerProgramId") REFERENCES "PartnerProgram" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProgramApplication_programTermsVersionId_fkey" FOREIGN KEY ("programTermsVersionId") REFERENCES "ProgramTermsVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProgramApplication_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProgramApplication_workerPublisherProfileId_fkey" FOREIGN KEY ("workerPublisherProfileId") REFERENCES "WorkerPublisherProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProgramApplication_salesReferralId_fkey" FOREIGN KEY ("salesReferralId") REFERENCES "SalesReferral" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProgramApplication_customEngagementId_fkey" FOREIGN KEY ("customEngagementId") REFERENCES "CustomEngagement" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProgramApplication_participantPortalAccessId_fkey" FOREIGN KEY ("participantPortalAccessId") REFERENCES "ParticipantPortalAccess" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProgramApplication" ("applicantEmail", "applicantName", "applicantOrganization", "background", "contributionPlan", "createdAt", "id", "internalNotes", "invitedAt", "partnerProgramId", "programTermsVersionId", "recommendedBeneficiaryType", "regionLabel", "reviewedAt", "reviewedByUserId", "roleTitle", "status", "termsAcceptedAt", "updatedAt", "website", "workspaceId")
SELECT "applicantEmail", "applicantName", "applicantOrganization", "background", "contributionPlan", "createdAt", "id", "internalNotes", "invitedAt", "partnerProgramId", "programTermsVersionId", "recommendedBeneficiaryType", "regionLabel", "reviewedAt", "reviewedByUserId", "roleTitle", "status", "termsAcceptedAt", "updatedAt", "website", "workspaceId"
FROM "ProgramApplication";
DROP TABLE "ProgramApplication";
ALTER TABLE "new_ProgramApplication" RENAME TO "ProgramApplication";
CREATE INDEX "ProgramApplication_workspaceId_status_createdAt_idx" ON "ProgramApplication"("workspaceId", "status", "createdAt");
CREATE INDEX "ProgramApplication_partnerProgramId_status_createdAt_idx" ON "ProgramApplication"("partnerProgramId", "status", "createdAt");
CREATE INDEX "ProgramApplication_applicantEmail_status_createdAt_idx" ON "ProgramApplication"("applicantEmail", "status", "createdAt");
CREATE INDEX "ProgramApplication_participantPortalAccessId_idx" ON "ProgramApplication"("participantPortalAccessId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
