-- AlterTable
ALTER TABLE "Connector" ADD COLUMN "imapHost" TEXT;
ALTER TABLE "Connector" ADD COLUMN "imapPort" INTEGER;
ALTER TABLE "Connector" ADD COLUMN "imapSecure" BOOLEAN;
ALTER TABLE "Connector" ADD COLUMN "smtpHost" TEXT;
ALTER TABLE "Connector" ADD COLUMN "smtpPort" INTEGER;
ALTER TABLE "Connector" ADD COLUMN "smtpSecure" BOOLEAN;
ALTER TABLE "Connector" ADD COLUMN "smtpUsername" TEXT;
ALTER TABLE "Connector" ADD COLUMN "smtpPassword" TEXT;
ALTER TABLE "Connector" ADD COLUMN "manualSendEnabled" BOOLEAN NOT NULL DEFAULT false;
