-- Billing V1 S2-d2 (2026-11-12): order creation replays an Idempotency-Key per (workspace, creator). Two nullable columns and one
-- UNIQUE index on PaymentOrder (new in 20261110160000; no route created rows before S2-d2, production assumed empty, not verified).
-- Existing rows keep NULL keys, which MySQL UNIQUE allows any number of. ADD COLUMN (nullable, last) is ALGORITHM=INSTANT on 8.0.29+;
-- ADD UNIQUE INDEX is INPLACE with LOCK=NONE (concurrent reads and writes continue); no table rebuild, no trigger, no backfill.
-- Rollback: prisma/rollback/20261112_rollback_billing_topup_order_idempotency.sql (application rollback first).

ALTER TABLE `PaymentOrder` ADD COLUMN `idempotencyKey` VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ADD COLUMN `requestHash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL;
ALTER TABLE `PaymentOrder` ADD UNIQUE INDEX `PaymentOrder_creator_idempotency_key`(`workspaceId`, `createdBy`, `idempotencyKey`),
  ALGORITHM=INPLACE, LOCK=NONE;
