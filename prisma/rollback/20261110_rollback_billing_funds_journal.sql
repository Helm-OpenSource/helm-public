-- Rollback of 20261110140000_billing_funds_journal, only for an unused migration (application rollback: stop calling the
-- service). Refuses while any journal, projection or outbox row exists; stop all writers first. DROP TABLE removes the
-- triggers; the final DELETE lets `prisma migrate deploy` re-apply the migration.
DROP PROCEDURE IF EXISTS `rollback_empty_billing_funds_journal`;

DELIMITER $$

CREATE PROCEDURE `rollback_empty_billing_funds_journal`()
BEGIN
  IF EXISTS (SELECT 1 FROM `FundsJournalEntry`) OR EXISTS (SELECT 1 FROM `FundsTransaction`)
     OR EXISTS (SELECT 1 FROM `FundsAccountProjection`) OR EXISTS (SELECT 1 FROM `BillingOutbox`) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: funds journal, projection or outbox rows exist';
  END IF;

  DROP TABLE `BillingOutbox`;
  DROP TABLE `FundsAccountProjection`;
  DROP TABLE `FundsJournalEntry`;
  DROP TABLE `FundsTransaction`;
  DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261110140000_billing_funds_journal';
END$$

DELIMITER ;

CALL `rollback_empty_billing_funds_journal`();
DROP PROCEDURE `rollback_empty_billing_funds_journal`;
