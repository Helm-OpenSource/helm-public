-- Rollback of 20261110200000_billing_reservations for an unused migration only (app rollback: stop calling the service). Refuses
-- while any bucket or reservation row exists; stop writers first. DROP TABLE removes triggers; DELETE allows re-apply.
DROP PROCEDURE IF EXISTS `rollback_empty_billing_reservations`;
DELIMITER $$
CREATE PROCEDURE `rollback_empty_billing_reservations`()
BEGIN
  IF EXISTS (SELECT 1 FROM `BillingReservation`) OR EXISTS (SELECT 1 FROM `BudgetBucket`) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: budget bucket or reservation rows exist';
  END IF;
  DROP TABLE `BillingReservation`;
  DROP TABLE `BudgetBucket`;
  DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261110200000_billing_reservations';
END$$
DELIMITER ;
CALL `rollback_empty_billing_reservations`();
DROP PROCEDURE `rollback_empty_billing_reservations`;
