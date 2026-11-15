-- Rollback of 20261115120000_billing_inflow_repay for an unused migration only: stop the writers, drain, run this, then roll the
-- code back to C-OD. Refuses while a repayment row exists (fix forward) or a later billing migration is applied; must run before
-- the C-OD rollback, which refuses while this is applied. A code-only rollback keeping the schema is safe (raw-SQL reads, one more
-- trigger shape), but inflows then stop repaying. Shrinks the kind ENUM, drops the credit projection triggers, restores the
-- 20261110215000 update trigger, and removes the migration record last (it also unblocks the C-OD rollback).
-- Run it whole with a client that stops at the first error, `mysql --batch <database> < this-file` (non-zero exit = refused), never
-- in a continue-on-error mode such as `mysql --force`: the trigger statements after the CALL cannot live in a routine.
DROP PROCEDURE IF EXISTS `rollback_billing_inflow_repay`;
DELIMITER $$
CREATE PROCEDURE `rollback_billing_inflow_repay`()
BEGIN
  IF EXISTS (SELECT 1 FROM `_prisma_migrations` WHERE `migration_name` LIKE '%billing%'
     AND `migration_name` > '20261115120000_billing_inflow_repay') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: a later billing migration is applied; roll it back first';
  END IF;
  IF EXISTS (SELECT 1 FROM `FundsTransaction` WHERE `kind` IN ('overdraft_repay', 'credit_repay')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: repayment rows exist; fix forward';
  END IF;
  ALTER TABLE `FundsTransaction` MODIFY `kind` ENUM('topup', 'correction', 'bank_topup', 'charge', 'credit_draw', 'overdraft_draw') NOT NULL;
END$$
DELIMITER ;
CALL `rollback_billing_inflow_repay`();
DROP PROCEDURE `rollback_billing_inflow_repay`;
-- Kept outside the routine like the overdraft rollback; a refused CALL stops the mysql client before this point.
DROP TRIGGER IF EXISTS `FundsAccountProjection_credit_insert`;
DROP TRIGGER IF EXISTS `FundsAccountProjection_credit_update`;
-- Restore the 20261110215000_billing_credit_facilities update trigger (without the repayment shape).
DROP TRIGGER `CreditFacility_guard_update`;
DELIMITER $$
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
   OR (NEW.version = OLD.version + 1 AND NEW.usedFen = OLD.usedFen AND OLD.state NOT IN ('expired', 'revoked')
     AND (NEW.limitFen = OLD.limitFen OR (NEW.state = 'reduced' AND NEW.limitFen < OLD.limitFen))
     AND (NEW.lastReducedAt <=> OLD.lastReducedAt OR NEW.state = 'reduced')
     AND ((OLD.state = 'draft' AND NEW.state = 'approved') OR (OLD.state = 'approved' AND NEW.state = 'active')
       OR (OLD.state IN ('active', 'reduced') AND NEW.state IN ('reduced', 'expired')) OR NEW.state = 'revoked'))) THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='credit_facility_guard'; END IF;
END$$
DELIMITER ;
-- Last: the completion mark, and only where no repayment exists (a refusal leaves it in place even if a client went on).
DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261115120000_billing_inflow_repay'
  AND NOT EXISTS (SELECT 1 FROM `FundsTransaction` WHERE `kind` IN ('overdraft_repay', 'credit_repay'));
