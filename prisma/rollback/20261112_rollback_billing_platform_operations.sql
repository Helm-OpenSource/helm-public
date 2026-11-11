-- Rollback of 20261112120000_billing_platform_operations for an unused migration only; stop all writers first (deploy code without
-- the CLI). Refuses while any operation row exists: applied rows are the maker/checker record of payer and billingMode changes.
-- Payers, bindings and modes written through this table are not undone here (revoke a binding / switch the mode back instead).
DROP PROCEDURE IF EXISTS `rollback_empty_billing_platform_operations`;

DELIMITER $$

CREATE PROCEDURE `rollback_empty_billing_platform_operations`()
BEGIN
  IF EXISTS (SELECT 1 FROM `PlatformBillingOperation`) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: platform billing operation rows exist';
  END IF;
  DROP TABLE `PlatformBillingOperation`;
  DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261112120000_billing_platform_operations';
END$$

DELIMITER ;

CALL `rollback_empty_billing_platform_operations`();
DROP PROCEDURE `rollback_empty_billing_platform_operations`;
