-- Rollback of 20261112130000_billing_platform_emergency_rollbacks for an unused migration only; stop all writers first. Refuses while
-- any record exists (each is the trace of a single-person rollback). Payer modes changed through it are not undone here.
DROP PROCEDURE IF EXISTS `rollback_empty_billing_platform_emergency_rollbacks`;

DELIMITER $$

CREATE PROCEDURE `rollback_empty_billing_platform_emergency_rollbacks`()
BEGIN
  IF EXISTS (SELECT 1 FROM `PlatformEmergencyRollback`) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: platform emergency rollback rows exist';
  END IF;
  DROP TABLE `PlatformEmergencyRollback`;
  DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261112130000_billing_platform_emergency_rollbacks';
END$$

DELIMITER ;

CALL `rollback_empty_billing_platform_emergency_rollbacks`();
DROP PROCEDURE `rollback_empty_billing_platform_emergency_rollbacks`;
