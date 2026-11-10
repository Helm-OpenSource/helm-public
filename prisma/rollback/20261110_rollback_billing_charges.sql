-- Rollback of 20261110210000_billing_charges, only for an unused migration (application rollback: stop calling settle;
-- reservations stay held). Refuses while any charge row, `charge` funds transaction or `charge_revenue` line/projection exists;
-- stop all writers first. Restores the S2-a ENUMs; the final DELETE lets `prisma migrate deploy` re-apply the migration.
DROP PROCEDURE IF EXISTS `rollback_empty_billing_charges`;
DELIMITER $$
CREATE PROCEDURE `rollback_empty_billing_charges`()
BEGIN
  IF EXISTS (SELECT 1 FROM `BillingCharge`) OR EXISTS (SELECT 1 FROM `FundsTransaction` WHERE `kind` = 'charge')
     OR EXISTS (SELECT 1 FROM `FundsJournalEntry` WHERE `account` = 'charge_revenue')
     OR EXISTS (SELECT 1 FROM `FundsAccountProjection` WHERE `account` = 'charge_revenue') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: charge rows or charge postings exist';
  END IF;
  DROP TABLE `BillingCharge`;
  ALTER TABLE `FundsAccountProjection` MODIFY `account` ENUM('customer_wallet_available', 'topup_clearing', 'correction_suspense') NOT NULL;
  ALTER TABLE `FundsJournalEntry` MODIFY `account` ENUM('customer_wallet_available', 'topup_clearing', 'correction_suspense') NOT NULL;
  ALTER TABLE `FundsTransaction` MODIFY `kind` ENUM('topup', 'correction') NOT NULL;
  DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261110210000_billing_charges';
END$$
DELIMITER ;
CALL `rollback_empty_billing_charges`();
DROP PROCEDURE `rollback_empty_billing_charges`;
