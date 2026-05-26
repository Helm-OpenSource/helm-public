ALTER TABLE "LLMCallLog" ADD COLUMN "modelVersion" TEXT;
ALTER TABLE "LLMCallLog" ADD COLUMN "modelRole" TEXT;
ALTER TABLE "LLMCallLog" ADD COLUMN "promptKey" TEXT;
ALTER TABLE "LLMCallLog" ADD COLUMN "budgetTier" TEXT;
ALTER TABLE "LLMCallLog" ADD COLUMN "outputMode" TEXT;
ALTER TABLE "LLMCallLog" ADD COLUMN "fallbackReason" TEXT;

CREATE INDEX "LLMCallLog_workspaceId_promptKey_promptVersion_idx"
ON "LLMCallLog"("workspaceId", "promptKey", "promptVersion");

CREATE INDEX "LLMCallLog_workspaceId_modelRole_idx"
ON "LLMCallLog"("workspaceId", "modelRole");
