-- Rollback of 20261110220000_billing_credit_funds_enums and 20261110215000_billing_credit_facilities, unused migrations only;
-- stop all writers first. Refuses while any facility, `credit_draw` or `credit_receivable` row exists. Shrinks the funds ENUMs to
-- the current union minus this slice's two values (protocol v3.6). Order: this S3-e rollback first, then S3-b2 charges, then
-- reservations / S2-c. DROP TABLE removes the triggers; the final DELETE lets `prisma migrate deploy` re-apply both migrations.
DROP PROCEDURE IF EXISTS `rollback_empty_billing_credit_facilities`;

DELIMITER $$

CREATE PROCEDURE `rollback_empty_billing_credit_facilities`()
BEGIN
  IF EXISTS (SELECT 1 FROM `CreditFacility`)
     OR EXISTS (SELECT 1 FROM `FundsTransaction` WHERE `kind` = 'credit_draw')
     OR EXISTS (SELECT 1 FROM `FundsJournalEntry` WHERE `account` = 'credit_receivable')
     OR EXISTS (SELECT 1 FROM `FundsAccountProjection` WHERE `account` = 'credit_receivable') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: credit facility or credit funds rows exist';
  END IF;

  DROP TABLE `CreditFacility`;
  ALTER TABLE `FundsAccountProjection` MODIFY `account` ENUM('customer_wallet_available', 'topup_clearing', 'correction_suspense', 'bank_clearing', 'charge_revenue') NOT NULL;
  ALTER TABLE `FundsJournalEntry` MODIFY `account` ENUM('customer_wallet_available', 'topup_clearing', 'correction_suspense', 'bank_clearing', 'charge_revenue') NOT NULL;
  ALTER TABLE `FundsTransaction` MODIFY `kind` ENUM('topup', 'correction', 'bank_topup', 'charge') NOT NULL;
  DELETE FROM `_prisma_migrations` WHERE `migration_name` IN ('20261110220000_billing_credit_funds_enums',
    '20261110215000_billing_credit_facilities');
END$$

DELIMITER ;

CALL `rollback_empty_billing_credit_facilities`();
DROP PROCEDURE `rollback_empty_billing_credit_facilities`;
