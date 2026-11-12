-- Rollback of 20261112130000_billing_topup_order_query_throttle (application rollback first: the S2-d2b verify route writes these
-- columns). Refuses while a later billing migration is applied; only throttle state is dropped. Run it before
-- 20261112_rollback_billing_topup_order_idempotency.sql.
DROP PROCEDURE IF EXISTS `rollback_billing_topup_order_query_throttle`;
DELIMITER $$
CREATE PROCEDURE `rollback_billing_topup_order_query_throttle`()
BEGIN
  IF EXISTS (SELECT 1 FROM `_prisma_migrations` WHERE `migration_name` LIKE '%billing%'
     AND `migration_name` > '20261112130000_billing_topup_order_query_throttle') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: a later billing migration is applied; roll it back first';
  END IF;
  ALTER TABLE `PaymentOrder` DROP COLUMN `queryCount`, DROP COLUMN `queryWindowStartedAt`, DROP COLUMN `lastQueriedAt`;
  DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261112130000_billing_topup_order_query_throttle';
END$$
DELIMITER ;
CALL `rollback_billing_topup_order_query_throttle`();
DROP PROCEDURE `rollback_billing_topup_order_query_throttle`;
