-- Rollback of 20261118100000_caio_goal_ledger. Run as the migration identity. Refuses while either table holds any
-- row: ledger entries are the workspace owner's goal record, not a cache, so a used ledger only fixes forward. The
-- final DELETE lets `prisma migrate deploy` re-apply the migration afterwards.
-- 需要 CREATE ROUTINE + DROP 权限；不走 release-window 链，属于 owner 专项授权的人工动作。
DROP PROCEDURE IF EXISTS `rollback_empty_caio_goal_ledger`;

DELIMITER $$

CREATE PROCEDURE `rollback_empty_caio_goal_ledger`()
BEGIN
  IF (SELECT COUNT(*) FROM `CaioGoalLedgerEntry`) + (SELECT COUNT(*) FROM `CaioGoalLedgerHead`) > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: CAIO goal ledger is not empty';
  END IF;

  DROP TABLE `CaioGoalLedgerHead`;
  DROP TABLE `CaioGoalLedgerEntry`;
  DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261118100000_caio_goal_ledger';
END$$

DELIMITER ;

CALL `rollback_empty_caio_goal_ledger`();
DROP PROCEDURE `rollback_empty_caio_goal_ledger`;
