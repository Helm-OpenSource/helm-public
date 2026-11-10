-- Rollback of 20261110120000_billing_payer_accounts. Application rollback needs no DDL: keep billingMode 'off' and
-- stop new bindings. This schema rollback is only for an unused migration; it refuses while any payer or binding row
-- exists, because bindings are frozen payer history. The final DELETE lets `prisma migrate deploy` re-apply it.
DROP PROCEDURE IF EXISTS `rollback_empty_billing_payer_accounts`;

DELIMITER $$

CREATE PROCEDURE `rollback_empty_billing_payer_accounts`()
BEGIN
  IF EXISTS (SELECT 1 FROM `PayerScopeBinding`) OR EXISTS (SELECT 1 FROM `PayerAccount`) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: payer accounts or bindings exist';
  END IF;

  DROP TABLE `PayerScopeBinding`;
  DROP TABLE `PayerAccount`;
  DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261110120000_billing_payer_accounts';
END$$

DELIMITER ;

CALL `rollback_empty_billing_payer_accounts`();
DROP PROCEDURE `rollback_empty_billing_payer_accounts`;
