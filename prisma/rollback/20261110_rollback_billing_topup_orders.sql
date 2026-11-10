-- Rollback of 20261110160000_billing_topup_orders, only for an unused migration; refuses while any row exists (stop all writers
-- first). DROP TABLE removes the triggers; the DELETE lets `prisma migrate deploy` re-apply. Roll back before the funds journal.
DROP PROCEDURE IF EXISTS `rollback_empty_billing_topup_orders`;

DELIMITER $$

CREATE PROCEDURE `rollback_empty_billing_topup_orders`()
BEGIN
  IF EXISTS (SELECT 1 FROM `VerifiedPayment`) OR EXISTS (SELECT 1 FROM `PaymentOrder`) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: payment order or verified payment rows exist';
  END IF;

  DROP TABLE `VerifiedPayment`;
  DROP TABLE `PaymentOrder`;
  DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261110160000_billing_topup_orders';
END$$

DELIMITER ;

CALL `rollback_empty_billing_topup_orders`();
DROP PROCEDURE `rollback_empty_billing_topup_orders`;
