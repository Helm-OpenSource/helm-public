ALTER TABLE "Membership" ADD COLUMN "rolePresetKey" TEXT;
ALTER TABLE "Membership" ADD COLUMN "definitionDraftJson" TEXT;
ALTER TABLE "Membership" ADD COLUMN "definitionAcceptedJson" TEXT;
ALTER TABLE "Membership" ADD COLUMN "definitionAcceptedAt" DATETIME;

ALTER TABLE "Company" ADD COLUMN "definitionSuggestionJson" TEXT;
ALTER TABLE "Company" ADD COLUMN "definitionSuggestedAt" DATETIME;
ALTER TABLE "Company" ADD COLUMN "definitionAcceptedJson" TEXT;
ALTER TABLE "Company" ADD COLUMN "definitionAcceptedAt" DATETIME;
