-- Billing V1 C-OD (2026-11-15): overdraft for the settle shortfall left after wallet and credit (S3 protocol v3.10 clause 4).
-- 1. Funds ENUMs: the FULL union (protocol v3.6) plus `overdraft_draw` / `overdraft_receivable`, appended last (metadata-only).
-- 2. PayerAccount.overdraftLimitFen: the per-payer overdraft SOFT limit (design Q9), 0 unless platform finance sets it by
--    maker/checker; no default allowance. It only feeds headroom and the overLimit flag: settle never refuses delivered usage over
--    it, so it is deliberately not compared in any CHECK or trigger. ADD COLUMN is INSTANT; the non-negative ADD CHECK forces
--    ALGORITHM=COPY (writes to the small PayerAccount table wait for the copy). Existing rows get 0, which passes the CHECK.
-- 3. FundsAccountProjection triggers (new; the table had none): the overdraft projection starts at 0 and never goes negative.
-- 4. BillingReservation.admission ENUM('standard','post_delivery') DEFAULT 'standard' (INSTANT; existing rows standard): only a
--    post_delivery reservation (delivered work, reserved without the funds check) may overdraw at settle. The update trigger is
--    dropped and recreated with `admission` frozen; MySQL has no CREATE OR REPLACE TRIGGER, so between those two statements the
--    table has no update guard: run with the internal billing routes off (their default), so no reservation writer is active.
-- No existing row changes, no money moves.
-- Rollback: prisma/rollback/20261115_rollback_billing_overdraft.sql (refuses while any overdraft row, non-zero limit or post_delivery reservation exists).
ALTER TABLE `FundsTransaction` MODIFY `kind` ENUM('topup', 'correction', 'bank_topup', 'charge', 'credit_draw', 'overdraft_draw') NOT NULL;
ALTER TABLE `FundsJournalEntry` MODIFY `account` ENUM('customer_wallet_available', 'topup_clearing', 'correction_suspense', 'bank_clearing', 'charge_revenue', 'credit_receivable', 'overdraft_receivable') NOT NULL;
ALTER TABLE `FundsAccountProjection` MODIFY `account` ENUM('customer_wallet_available', 'topup_clearing', 'correction_suspense', 'bank_clearing', 'charge_revenue', 'credit_receivable', 'overdraft_receivable') NOT NULL;

ALTER TABLE `PayerAccount` ADD COLUMN `overdraftLimitFen` BIGINT NOT NULL DEFAULT 0,
  ADD CONSTRAINT `PayerAccount_overdraft_limit_check` CHECK (`overdraftLimitFen` >= 0 AND `overdraftLimitFen` <= 9007199254740991);

CREATE TRIGGER `FundsAccountProjection_overdraft_insert` BEFORE INSERT ON `FundsAccountProjection`
FOR EACH ROW BEGIN
 IF NEW.account = 'overdraft_receivable' AND NEW.balanceFen <> 0 THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='funds_overdraft_projection_invalid'; END IF;
END;
CREATE TRIGGER `FundsAccountProjection_overdraft_update` BEFORE UPDATE ON `FundsAccountProjection`
FOR EACH ROW BEGIN
 IF NEW.account = 'overdraft_receivable' AND NEW.balanceFen < 0 THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='funds_overdraft_projection_invalid'; END IF;
END;

ALTER TABLE `BillingReservation` ADD COLUMN `admission` ENUM('standard', 'post_delivery') NOT NULL DEFAULT 'standard';

DROP TRIGGER `BillingReservation_guard_update`;
-- As 20261112100000_billing_reservation_payer_binding, plus the admission column frozen.
CREATE TRIGGER `BillingReservation_guard_update` BEFORE UPDATE ON `BillingReservation`
FOR EACH ROW BEGIN
 IF NOT (BINARY NEW.id <=> BINARY OLD.id) OR NOT (BINARY NEW.payerAccountId <=> BINARY OLD.payerAccountId)
 OR NOT (BINARY NEW.idempotencyKey <=> BINARY OLD.idempotencyKey) OR NOT (BINARY NEW.operationRef <=> BINARY OLD.operationRef)
 OR NOT (BINARY NEW.contentHash <=> BINARY OLD.contentHash)
 OR NOT (BINARY NEW.grantId <=> BINARY OLD.grantId) OR NOT (NEW.grantVersion <=> OLD.grantVersion)
 OR NOT (BINARY NEW.productId <=> BINARY OLD.productId) OR NOT (BINARY NEW.priceVersionId <=> BINARY OLD.priceVersionId)
 OR NOT (BINARY NEW.priceContentHash <=> BINARY OLD.priceContentHash) OR NOT (BINARY NEW.billingEventRef <=> BINARY OLD.billingEventRef)
 OR NOT (BINARY NEW.meterUnit <=> BINARY OLD.meterUnit) OR NOT (NEW.quantity <=> OLD.quantity) OR NOT (NEW.chargeFen <=> OLD.chargeFen)
 OR NOT (NEW.billingMode <=> OLD.billingMode) OR NOT (NEW.reservedAt <=> OLD.reservedAt)
 OR NOT (BINARY NEW.dayKey <=> BINARY OLD.dayKey) OR NOT (BINARY NEW.monthKey <=> BINARY OLD.monthKey)
 OR NOT (BINARY NEW.createdBy <=> BINARY OLD.createdBy) OR NOT (NEW.createdAt <=> OLD.createdAt)
 OR NOT (BINARY NEW.subjectWorkspaceId <=> BINARY OLD.subjectWorkspaceId)
 OR NOT (BINARY NEW.payerBindingId <=> BINARY OLD.payerBindingId) OR NOT (NEW.payerBindingVersion <=> OLD.payerBindingVersion)
 OR NOT (NEW.admission <=> OLD.admission)
 OR (OLD.unknownAt IS NOT NULL AND (NOT (BINARY NEW.unknownEvidenceRef <=> BINARY OLD.unknownEvidenceRef)
   OR NOT (BINARY NEW.unknownKey <=> BINARY OLD.unknownKey)
   OR NOT (NEW.unknownAt <=> OLD.unknownAt)))
 OR OLD.state IN ('settled', 'released') OR NEW.version <> OLD.version + 1
 OR NOT ((NEW.state = 'unknown' AND OLD.state = 'held') OR (NEW.state IN ('settled', 'released') AND OLD.state IN ('held', 'unknown')))
 OR (NEW.state = 'released' AND ((OLD.state = 'unknown') <> (NEW.releaseReason <=> 'unknown_released'))) THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='billing_reservation_snapshot_immutable'; END IF;
END;
