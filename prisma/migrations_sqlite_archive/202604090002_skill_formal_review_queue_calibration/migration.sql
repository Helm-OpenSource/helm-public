ALTER TABLE "SkillSuggestion" ADD COLUMN "formalReviewStatus" TEXT NOT NULL DEFAULT 'NOT_READY';
ALTER TABLE "SkillSuggestion" ADD COLUMN "formalReviewQueuedByUserId" TEXT;
ALTER TABLE "SkillSuggestion" ADD COLUMN "formalReviewQueuedAt" DATETIME;
ALTER TABLE "SkillSuggestion" ADD COLUMN "formalReviewSummary" TEXT;
