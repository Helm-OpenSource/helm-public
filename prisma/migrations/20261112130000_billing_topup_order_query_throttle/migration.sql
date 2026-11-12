-- Billing V1 S2-d2b (2026-11-12): throttle for the session-triggered provider query (contract S2D §1.6: an order is queried at most
-- once per 10 s and 30 times per hour). Three columns on PaymentOrder (new in 20261110160000; production assumed empty, not
-- verified); existing rows get NULL / 0. ADD COLUMN (last, nullable or constant default) is ALGORITHM=INSTANT on 8.0.29+: no
-- rebuild, no lock beyond the metadata lock, no backfill, no index. Rollback: prisma/rollback/20261112_rollback_billing_topup_order_query_throttle.sql.

ALTER TABLE `PaymentOrder` ADD COLUMN `lastQueriedAt` DATETIME(3) NULL,
  ADD COLUMN `queryWindowStartedAt` DATETIME(3) NULL,
  ADD COLUMN `queryCount` INTEGER NOT NULL DEFAULT 0;
