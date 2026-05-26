ALTER TABLE "Workspace" ADD COLUMN "defaultLocale" TEXT NOT NULL DEFAULT 'zh-CN';
ALTER TABLE "Workspace" ADD COLUMN "pilotMode" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Workspace" ADD COLUMN "featureFlagsJson" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "dataRetentionDays" INTEGER NOT NULL DEFAULT 90;
ALTER TABLE "Workspace" ADD COLUMN "captureConsentRequired" BOOLEAN NOT NULL DEFAULT true;
