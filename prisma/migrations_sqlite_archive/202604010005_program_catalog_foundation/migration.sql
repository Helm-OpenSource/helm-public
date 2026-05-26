-- CreateTable
CREATE TABLE "PartnerProgram" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "programKey" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "programType" TEXT NOT NULL,
    "beneficiaryType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "audienceSummary" TEXT NOT NULL,
    "contributionSummary" TEXT NOT NULL,
    "revenueSummary" TEXT NOT NULL,
    "settlementSummary" TEXT NOT NULL,
    "boundarySummary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PartnerProgram_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProgramTermsVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "partnerProgramId" TEXT NOT NULL,
    "versionKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "revenueDefinition" TEXT NOT NULL,
    "splitLogicSummary" TEXT NOT NULL,
    "reversalRuleSummary" TEXT NOT NULL,
    "reviewBoundarySummary" TEXT NOT NULL,
    "payoutBoundarySummary" TEXT NOT NULL,
    "platformRightsSummary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProgramTermsVersion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProgramTermsVersion_partnerProgramId_fkey" FOREIGN KEY ("partnerProgramId") REFERENCES "PartnerProgram" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProgramApplication" (
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
    "reviewedAt" DATETIME,
    "invitedAt" DATETIME,
    "reviewedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProgramApplication_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProgramApplication_partnerProgramId_fkey" FOREIGN KEY ("partnerProgramId") REFERENCES "PartnerProgram" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProgramApplication_programTermsVersionId_fkey" FOREIGN KEY ("programTermsVersionId") REFERENCES "ProgramTermsVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProgramApplication_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PartnerProgram_workspaceId_status_programType_idx" ON "PartnerProgram"("workspaceId", "status", "programType");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerProgram_workspaceId_programKey_key" ON "PartnerProgram"("workspaceId", "programKey");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerProgram_workspaceId_slug_key" ON "PartnerProgram"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX "ProgramTermsVersion_workspaceId_status_effectiveFrom_idx" ON "ProgramTermsVersion"("workspaceId", "status", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramTermsVersion_partnerProgramId_versionKey_key" ON "ProgramTermsVersion"("partnerProgramId", "versionKey");

-- CreateIndex
CREATE INDEX "ProgramApplication_workspaceId_status_createdAt_idx" ON "ProgramApplication"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProgramApplication_partnerProgramId_status_createdAt_idx" ON "ProgramApplication"("partnerProgramId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProgramApplication_applicantEmail_status_createdAt_idx" ON "ProgramApplication"("applicantEmail", "status", "createdAt");

