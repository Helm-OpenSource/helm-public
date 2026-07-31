-- CAIO Pro: record the deployment posture a dispatch receipt was written under.
--
-- The minimal audit receipt has SEVEN fields and posture is the seventh; it is
-- already part of the receipt digest, so two dispatches that differ only in
-- posture are different dispatches. Until now the Prisma store had no column
-- for it and therefore could not compare it, so a duplicate
-- [workspaceId, requestId] arriving from a differently-postured deployment
-- that shared the workspace resolved as an idempotent REPLAY instead of a
-- CONFLICT.
--
-- NOT NULL with NO DEFAULT, deliberately. A default would assign a posture to
-- rows whose posture is genuinely unknown, which is the same class of error
-- this column exists to prevent. This migration is written for a table that
-- has never been written to: the gateway ships default-off and has never been
-- installed, activated, or deployed. If it fails because rows exist, that
-- failure is CORRECT — those rows' posture cannot be recovered from the row
-- itself, and choosing one is an owner decision, not a migration's.
ALTER TABLE `CaioAuditDispatchReceipt`
  ADD COLUMN `posture` VARCHAR(191) NOT NULL;
