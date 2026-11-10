-- Rollback of 20261110170000_billing_bank_receipts for an unused migration only; stop all writers first. Refuses while any receipt,
-- grant, `bank_topup` or `bank_clearing` row exists; shrinks the ENUMs back; run before the S2-a funds journal rollback.
DROP PROCEDURE IF EXISTS `rollback_empty_billing_bank_receipts`;

DELIMITER $$

CREATE PROCEDURE `rollback_empty_billing_bank_receipts`()
BEGIN
  IF EXISTS (SELECT 1 FROM `BankReceipt`) OR EXISTS (SELECT 1 FROM `PlatformFinanceGrant`)
     OR EXISTS (SELECT 1 FROM `FundsTransaction` WHERE `kind` = 'bank_topup')
     OR EXISTS (SELECT 1 FROM `FundsJournalEntry` WHERE `account` = 'bank_clearing')
     OR EXISTS (SELECT 1 FROM `FundsAccountProjection` WHERE `account` = 'bank_clearing') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: bank receipt, finance grant or bank funds rows exist';
  END IF;

  DROP TABLE `BankReceipt`;
  DROP TABLE `PlatformFinanceGrant`;
  ALTER TABLE `FundsAccountProjection` MODIFY `account` ENUM('customer_wallet_available', 'topup_clearing', 'correction_suspense') NOT NULL;
  ALTER TABLE `FundsJournalEntry` MODIFY `account` ENUM('customer_wallet_available', 'topup_clearing', 'correction_suspense') NOT NULL;
  ALTER TABLE `FundsTransaction` MODIFY `kind` ENUM('topup', 'correction') NOT NULL;
  DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261110170000_billing_bank_receipts';
END$$

DELIMITER ;

CALL `rollback_empty_billing_bank_receipts`();
DROP PROCEDURE `rollback_empty_billing_bank_receipts`;
