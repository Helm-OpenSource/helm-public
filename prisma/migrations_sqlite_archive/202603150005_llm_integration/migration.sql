ALTER TABLE "Workspace" ADD COLUMN "defaultLLMProvider" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "defaultLLMModel" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "extractionModel" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "briefingModel" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "reasoningModel" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "llmBudgetTier" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "llmEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "LLMCallLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "taskType" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "inputSummary" TEXT,
  "outputSummary" TEXT,
  "tokenUsagePrompt" INTEGER,
  "tokenUsageCompletion" INTEGER,
  "latencyMs" INTEGER,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "errorMessage" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LLMCallLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LLMCallLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "LLMCallLog_workspaceId_taskType_idx" ON "LLMCallLog"("workspaceId", "taskType");
CREATE INDEX "LLMCallLog_workspaceId_provider_model_idx" ON "LLMCallLog"("workspaceId", "provider", "model");
CREATE INDEX "LLMCallLog_workspaceId_createdAt_idx" ON "LLMCallLog"("workspaceId", "createdAt");
