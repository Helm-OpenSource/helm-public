-- Billing V1 C-REPAY part 1 (2026-11-15): repayment from inflows (S3 protocol v3.10 clause 5). After a topup / bank_topup the
-- wallet repays the overdraft, then credit (lib/billing/credit/inflow-repay.ts; the two inflow entry points call it in part 2).
-- 1. FundsTransaction.kind: the FULL union (protocol v3.6) plus `overdraft_repay` / `credit_repay`, appended last (metadata-only).
--    No new account: the two receivables exist (S3-e, C-OD).
-- 2. FundsAccountProjection triggers (new, alongside C-OD's overdraft pair): the credit_receivable projection never goes negative.
--    credit_repay is the first posting that lowers it.
-- 3. CreditFacility_guard_update is dropped and recreated with a third update shape, a repayment: version unchanged, usedFen falls
--    and stays >= 0, on an activated facility in any state (expired and revoked included), every other column unchanged. MySQL
--    has no CREATE OR REPLACE TRIGGER, so between those two statements the table has no update guard: run with the writers stopped.
--    The table CHECKs are unchanged (CreditFacility_amount_check already holds usedFen >= 0).
-- No existing row changes, no money moves; algorithms and locks are expected MySQL 8.0 / 8.4 behaviour, not measured. Run order,
-- writer stop, privileges and the by-hand finish after a partial failure (not idempotent): the upgrade note of this migration.
-- Rollback: prisma/rollback/20261115_rollback_billing_inflow_repay.sql (refuses once any repayment row exists). While this
-- migration is applied, 20261115100000_billing_overdraft cannot be rolled back (its guard refuses a later billing migration).
ALTER TABLE `FundsTransaction` MODIFY `kind` ENUM('topup', 'correction', 'bank_topup', 'charge', 'credit_draw', 'overdraft_draw', 'overdraft_repay', 'credit_repay') NOT NULL;

CREATE TRIGGER `FundsAccountProjection_credit_insert` BEFORE INSERT ON `FundsAccountProjection`
FOR EACH ROW BEGIN
 IF NEW.account = 'credit_receivable' AND NEW.balanceFen < 0 THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='funds_credit_projection_invalid'; END IF;
END;
CREATE TRIGGER `FundsAccountProjection_credit_update` BEFORE UPDATE ON `FundsAccountProjection`
FOR EACH ROW BEGIN
 IF NEW.account = 'credit_receivable' AND NEW.balanceFen < 0 THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='funds_credit_projection_invalid'; END IF;
END;

DROP TRIGGER `CreditFacility_guard_update`;
-- As 20261110215000_billing_credit_facilities, plus the repayment shape (third alternative).
CREATE TRIGGER `CreditFacility_guard_update` BEFORE UPDATE ON `CreditFacility`
FOR EACH ROW BEGIN
 IF NOT (BINARY NEW.id <=> BINARY OLD.id) OR NOT (BINARY NEW.payerAccountId <=> BINARY OLD.payerAccountId)
 OR NOT (BINARY NEW.operationKey <=> BINARY OLD.operationKey) OR NOT (BINARY NEW.contentHash <=> BINARY OLD.contentHash)
 OR NOT (BINARY NEW.proposedByUserId <=> BINARY OLD.proposedByUserId) OR NOT (BINARY NEW.evidenceRef <=> BINARY OLD.evidenceRef)
 OR NOT (NEW.validUntil <=> OLD.validUntil) OR NOT (NEW.createdAt <=> OLD.createdAt)
 OR (OLD.approvedByUserId IS NOT NULL AND (NOT (BINARY NEW.approvedByUserId <=> BINARY OLD.approvedByUserId)
   OR NOT (BINARY NEW.approvalRef <=> BINARY OLD.approvalRef) OR NOT (NEW.approvedAt <=> OLD.approvedAt)
   OR NOT (NEW.approvedLimitFen <=> OLD.approvedLimitFen)))
 OR (OLD.approvedByUserId IS NULL AND NEW.approvedByUserId IS NOT NULL AND NOT (NEW.approvedLimitFen <=> OLD.limitFen))
 OR (OLD.activatedAt IS NOT NULL AND NOT (NEW.activatedAt <=> OLD.activatedAt))
 OR NOT (
   (NEW.version = OLD.version AND NEW.usedFen > OLD.usedFen AND OLD.activatedAt IS NOT NULL AND NEW.usedFen <= OLD.approvedLimitFen
     AND NEW.state = OLD.state AND NEW.limitFen = OLD.limitFen AND BINARY NEW.activePayerAccountId <=> BINARY OLD.activePayerAccountId
     AND NEW.closedAt <=> OLD.closedAt AND NEW.lastReducedAt <=> OLD.lastReducedAt)
   OR (NEW.version = OLD.version AND NEW.usedFen < OLD.usedFen AND NEW.usedFen >= 0 AND OLD.activatedAt IS NOT NULL
     AND NEW.state = OLD.state AND NEW.limitFen = OLD.limitFen AND BINARY NEW.activePayerAccountId <=> BINARY OLD.activePayerAccountId
     AND NEW.closedAt <=> OLD.closedAt AND NEW.lastReducedAt <=> OLD.lastReducedAt)
   OR (NEW.version = OLD.version + 1 AND NEW.usedFen = OLD.usedFen AND OLD.state NOT IN ('expired', 'revoked')
     AND (NEW.limitFen = OLD.limitFen OR (NEW.state = 'reduced' AND NEW.limitFen < OLD.limitFen))
     AND (NEW.lastReducedAt <=> OLD.lastReducedAt OR NEW.state = 'reduced')
     AND ((OLD.state = 'draft' AND NEW.state = 'approved') OR (OLD.state = 'approved' AND NEW.state = 'active')
       OR (OLD.state IN ('active', 'reduced') AND NEW.state IN ('reduced', 'expired')) OR NEW.state = 'revoked'))) THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='credit_facility_guard'; END IF;
END;
