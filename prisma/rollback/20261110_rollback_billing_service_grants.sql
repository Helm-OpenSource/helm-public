-- Rollback of 20261110230000_billing_service_grants for an unused migration only (app rollback: unset
-- HELM_BILLING_INTERNAL_ROUTES_ENABLED first). Refuses while any grant or nonce row exists: a grant is audit history and
-- cannot be deleted. Independent of the other billing migrations (no FKs, no shared ENUMs). DROP TABLE removes triggers.
DROP PROCEDURE IF EXISTS `rollback_empty_billing_service_grants`;
DELIMITER $$
CREATE PROCEDURE `rollback_empty_billing_service_grants`()
BEGIN
  IF EXISTS (SELECT 1 FROM `BillingServiceGrant`) OR EXISTS (SELECT 1 FROM `BillingServiceNonce`) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: billing service grant or nonce rows exist';
  END IF;
  DROP TABLE `BillingServiceNonce`;
  DROP TABLE `BillingServiceGrant`;
  DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261110230000_billing_service_grants';
END$$
DELIMITER ;
CALL `rollback_empty_billing_service_grants`();
DROP PROCEDURE `rollback_empty_billing_service_grants`;
