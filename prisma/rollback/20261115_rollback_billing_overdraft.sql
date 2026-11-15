-- Rollback of 20261115100000_billing_overdraft for an unused migration only (app rollback first: the previous code neither reads
-- the limit nor posts overdraft). Refuses while any `overdraft_draw` / `overdraft_receivable` row or non-zero limit exists, or a
-- later billing migration is applied; stop writers first. Shrinks the funds ENUMs to the union minus this slice's two values
-- (protocol v3.6), drops the column (ALGORITHM=COPY for the CHECK), then the triggers, and lets `prisma migrate deploy` re-apply.
DROP PROCEDURE IF EXISTS `rollback_billing_overdraft`;
DELIMITER $$
CREATE PROCEDURE `rollback_billing_overdraft`()
BEGIN
  IF EXISTS (SELECT 1 FROM `_prisma_migrations` WHERE `migration_name` LIKE '%billing%'
     AND `migration_name` > '20261115100000_billing_overdraft') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: a later billing migration is applied; roll it back first';
  END IF;
  IF EXISTS (SELECT 1 FROM `FundsTransaction` WHERE `kind` = 'overdraft_draw')
     OR EXISTS (SELECT 1 FROM `FundsJournalEntry` WHERE `account` = 'overdraft_receivable')
     OR EXISTS (SELECT 1 FROM `FundsAccountProjection` WHERE `account` = 'overdraft_receivable')
     OR EXISTS (SELECT 1 FROM `PayerAccount` WHERE `overdraftLimitFen` <> 0) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: overdraft rows or a non-zero overdraft limit exist';
  END IF;
  ALTER TABLE `PayerAccount` DROP CHECK `PayerAccount_overdraft_limit_check`, DROP COLUMN `overdraftLimitFen`;
  ALTER TABLE `FundsAccountProjection` MODIFY `account` ENUM('customer_wallet_available', 'topup_clearing', 'correction_suspense', 'bank_clearing', 'charge_revenue', 'credit_receivable') NOT NULL;
  ALTER TABLE `FundsJournalEntry` MODIFY `account` ENUM('customer_wallet_available', 'topup_clearing', 'correction_suspense', 'bank_clearing', 'charge_revenue', 'credit_receivable') NOT NULL;
  ALTER TABLE `FundsTransaction` MODIFY `kind` ENUM('topup', 'correction', 'bank_topup', 'charge', 'credit_draw') NOT NULL;
  DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261115100000_billing_overdraft';
END$$
DELIMITER ;
CALL `rollback_billing_overdraft`();
DROP PROCEDURE `rollback_billing_overdraft`;
-- Kept outside the routine like the reservation-binding rollback; a refused CALL stops the mysql client before this point.
DROP TRIGGER IF EXISTS `FundsAccountProjection_overdraft_insert`;
DROP TRIGGER IF EXISTS `FundsAccountProjection_overdraft_update`;
