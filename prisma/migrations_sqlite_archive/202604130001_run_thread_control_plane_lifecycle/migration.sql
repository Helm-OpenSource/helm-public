-- AlterTable
ALTER TABLE "RuntimeSession"
ADD COLUMN "controlPlaneLifecycleJson" TEXT;

ALTER TABLE "RuntimeSession"
ADD COLUMN "controlPlaneLifecycleUpdatedAt" DATETIME;
