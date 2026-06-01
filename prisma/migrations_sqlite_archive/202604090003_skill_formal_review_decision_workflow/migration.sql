ALTER TABLE "SkillSuggestion" ADD COLUMN "formalReviewDecision" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "SkillSuggestion" ADD COLUMN "formalReviewDecisionByUserId" TEXT;
ALTER TABLE "SkillSuggestion" ADD COLUMN "formalReviewDecisionByName" TEXT;
ALTER TABLE "SkillSuggestion" ADD COLUMN "formalReviewDecisionAt" DATETIME;
ALTER TABLE "SkillSuggestion" ADD COLUMN "formalReviewDecisionNote" TEXT;
ALTER TABLE "SkillSuggestion" ADD COLUMN "formalReviewChecklistJson" TEXT;
