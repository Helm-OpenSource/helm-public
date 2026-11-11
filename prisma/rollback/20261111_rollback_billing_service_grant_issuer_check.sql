-- Rollback of 20261111100000_billing_service_grant_issuer_check: restores the S3-b3 issuerRef CHECK (rows that pass the strict
-- CHECK also pass the original). Run before 20261110_rollback_billing_service_grants.sql, which refuses while this is applied.
DROP PROCEDURE IF EXISTS `rollback_billing_service_grant_issuer_check`;
DELIMITER $$
CREATE PROCEDURE `rollback_billing_service_grant_issuer_check`()
BEGIN
  IF EXISTS (SELECT 1 FROM `_prisma_migrations` WHERE `migration_name` LIKE '%billing%'
     AND `migration_name` > '20261111100000_billing_service_grant_issuer_check') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: a later billing migration is applied; roll it back first';
  END IF;
  ALTER TABLE `BillingServiceGrant` DROP CHECK `BillingServiceGrant_issuer`;
  ALTER TABLE `BillingServiceGrant` ADD CONSTRAINT `BillingServiceGrant_issuer` CHECK (`issuerRef` REGEXP '^[a-z0-9][a-z0-9._-]{0,63}$');
  DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261111100000_billing_service_grant_issuer_check';
END$$
DELIMITER ;
CALL `rollback_billing_service_grant_issuer_check`();
DROP PROCEDURE `rollback_billing_service_grant_issuer_check`;
