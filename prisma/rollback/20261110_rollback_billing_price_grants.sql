-- Rollback of 20261110180000_billing_price_grants, only for an unused migration (application rollback: stop calling the
-- service; grants stay disabled). Refuses while any product, price version or grant row exists; stop all writers first.
-- DROP TABLE removes the triggers; the final DELETE lets `prisma migrate deploy` re-apply the migration.
DROP PROCEDURE IF EXISTS `rollback_empty_billing_price_grants`;
DELIMITER $$
CREATE PROCEDURE `rollback_empty_billing_price_grants`()
BEGIN
  IF EXISTS (SELECT 1 FROM `SpendGrant`) OR EXISTS (SELECT 1 FROM `BillingPriceVersion`)
     OR EXISTS (SELECT 1 FROM `BillingProduct`) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: product, price version or spend grant rows exist';
  END IF;
  DROP TABLE `SpendGrant`;
  DROP TABLE `BillingPriceVersion`;
  DROP TABLE `BillingProduct`;
  DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261110180000_billing_price_grants';
END$$
DELIMITER ;
CALL `rollback_empty_billing_price_grants`();
DROP PROCEDURE `rollback_empty_billing_price_grants`;
