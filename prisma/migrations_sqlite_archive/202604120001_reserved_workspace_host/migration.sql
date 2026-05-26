ALTER TABLE "Workspace" ADD COLUMN "workspaceClass" TEXT NOT NULL DEFAULT 'CUSTOMER';
ALTER TABLE "Workspace" ADD COLUMN "systemKey" TEXT;

CREATE UNIQUE INDEX "Workspace_systemKey_key" ON "Workspace"("systemKey");
