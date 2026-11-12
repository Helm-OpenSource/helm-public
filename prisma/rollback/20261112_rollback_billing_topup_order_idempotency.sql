-- Rollback of 20261112120000_billing_topup_order_idempotency (application rollback first: the S2-d2 route writes these columns).
-- Refuses while a later billing migration is applied. Rows keep their orders; only the replay keys are dropped, so a retried
-- request after rollback can create a second order. Run it before 20261110_rollback_billing_topup_orders.sql.
DROP PROCEDURE IF EXISTS `rollback_billing_topup_order_idempotency`;
DELIMITER $$
CREATE PROCEDURE `rollback_billing_topup_order_idempotency`()
BEGIN
  IF EXISTS (SELECT 1 FROM `_prisma_migrations` WHERE `migration_name` LIKE '%billing%'
     AND `migration_name` > '20261112120000_billing_topup_order_idempotency') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: a later billing migration is applied; roll it back first';
  END IF;
  ALTER TABLE `PaymentOrder` DROP INDEX `PaymentOrder_creator_idempotency_key`, DROP COLUMN `requestHash`, DROP COLUMN `idempotencyKey`;
  DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261112120000_billing_topup_order_idempotency';
END$$
DELIMITER ;
CALL `rollback_billing_topup_order_idempotency`();
DROP PROCEDURE `rollback_billing_topup_order_idempotency`;
