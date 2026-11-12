-- Rollback of 20261112110000_billing_bank_receipt_txn_key for an unused migration only (app rollback first: the previous code
-- writes the exact reference as the live key). Refuses while any receipt row exists (their normalized keys would fail the old
-- CHECK) or a later billing migration is applied; restores the S2-c CHECK and allows re-apply. Run it before
-- 20261110_rollback_billing_bank_receipts.sql.
DROP PROCEDURE IF EXISTS `rollback_billing_bank_receipt_txn_key`;
DELIMITER $$
CREATE PROCEDURE `rollback_billing_bank_receipt_txn_key`()
BEGIN
  IF EXISTS (SELECT 1 FROM `_prisma_migrations` WHERE `migration_name` LIKE '%billing%'
     AND `migration_name` > '20261112110000_billing_bank_receipt_txn_key') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: a later billing migration is applied; roll it back first';
  END IF;
  IF EXISTS (SELECT 1 FROM `BankReceipt`) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: bank receipt rows exist';
  END IF;
  ALTER TABLE `BankReceipt` DROP CHECK `BankReceipt_active_key_check`,
    ADD CONSTRAINT `BankReceipt_active_key_check` CHECK ((`state` = 'rejected' AND `activeBankTxnRef` IS NULL)
      OR (`state` <> 'rejected' AND `activeBankTxnRef` = `bankTxnRef`));
  DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261112110000_billing_bank_receipt_txn_key';
END$$
DELIMITER ;
CALL `rollback_billing_bank_receipt_txn_key`();
DROP PROCEDURE `rollback_billing_bank_receipt_txn_key`;
