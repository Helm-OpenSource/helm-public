CREATE TABLE "SkillSuggestion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "suggestionType" TEXT NOT NULL DEFAULT 'NEW_SKILL_CANDIDATE',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "candidateSkillKey" TEXT NOT NULL,
  "candidateSkillName" TEXT NOT NULL,
  "candidateCategory" TEXT NOT NULL,
  "candidateBoundary" TEXT NOT NULL,
  "candidateEffectMode" TEXT NOT NULL,
  "candidateDefaultSurface" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "confidence" INTEGER NOT NULL DEFAULT 50,
  "candidateSpecJson" TEXT NOT NULL,
  "evidenceSnapshot" TEXT,
  "sourcePatternFactIds" TEXT,
  "sourceRecommendationIds" TEXT,
  "nonCommitmentNote" TEXT NOT NULL,
  "confirmedByUserId" TEXT,
  "confirmedAt" DATETIME,
  "appliedTargetType" TEXT,
  "appliedTargetId" TEXT,
  "appliedEffectSummary" TEXT,
  "appliedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SkillSuggestion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SkillSuggestion_fingerprint_key" ON "SkillSuggestion"("fingerprint");
CREATE INDEX "SkillSuggestion_workspaceId_status_createdAt_idx" ON "SkillSuggestion"("workspaceId", "status", "createdAt");
CREATE INDEX "SkillSuggestion_workspaceId_candidateSkillKey_idx" ON "SkillSuggestion"("workspaceId", "candidateSkillKey");
