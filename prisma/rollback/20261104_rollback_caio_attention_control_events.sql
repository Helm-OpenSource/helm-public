-- Rollback of 20261104170000_caio_attention_control_events. Run as the migration identity, first: before the case
-- and control-plane rollbacks (the control-plane rollback refuses while this table exists). Refuses while the table
-- holds any row: control events are the audit trail of the control plane, not a cache. The final DELETE lets
-- `prisma migrate deploy` re-apply the migration afterwards.
-- 需要 CREATE ROUTINE + DROP 权限；不走 release-window 链，属于 owner 专项授权的人工动作。
DROP PROCEDURE IF EXISTS `rollback_empty_caio_attention_control_events`;

DELIMITER $$

CREATE PROCEDURE `rollback_empty_caio_attention_control_events`()
BEGIN
  IF (SELECT COUNT(*) FROM `CaioAttentionControlEvent`) > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: CAIO attention control events exist';
  END IF;

  DROP TABLE `CaioAttentionControlEvent`;
  DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261104170000_caio_attention_control_events';
END$$

DELIMITER ;

CALL `rollback_empty_caio_attention_control_events`();
DROP PROCEDURE `rollback_empty_caio_attention_control_events`;
