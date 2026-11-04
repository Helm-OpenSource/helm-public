-- Rollback of 20261104120000_caio_attention_control_plane. Run as the migration identity, after the case tables
-- (20261104120100_caio_attention_cases) have been rolled back. Refuses while the control plane has ever been used:
-- any readiness proof, pause request or heartbeat, or a Control row that left its seeded PAUSED / epoch 0 state.
-- Also refused once the Control row was ever written by anyone but the migration (rowVersion, updatedByRef) or
-- received expected nodes. The final DELETE lets `prisma migrate deploy` re-apply the migration afterwards.
-- 需要 CREATE ROUTINE + DROP 权限；不走 release-window 链，属于 owner 专项授权的人工动作。
DROP PROCEDURE IF EXISTS `rollback_unused_caio_attention_control_plane`;

DELIMITER $$

CREATE PROCEDURE `rollback_unused_caio_attention_control_plane`()
BEGIN
  IF (SELECT COUNT(*) FROM `CaioAttentionNodeReadiness`) + (SELECT COUNT(*) FROM `CaioAttentionPauseRequest`)
     + (SELECT COUNT(*) FROM `CaioAttentionRuntimeNode`)
     + (SELECT COUNT(*) FROM `CaioAttentionControl`
        WHERE `intakeState` <> 'PAUSED' OR `epoch` <> 0 OR `openEpoch` <> 0
          OR `rowVersion` <> 0 OR `updatedByRef` NOT LIKE 'migration:%' OR `expectedNodesJson` <> '[]') > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: CAIO attention control plane has been used';
  END IF;

  DROP TABLE `CaioAttentionPauseRequest`;
  DROP TABLE `CaioAttentionNodeReadiness`;
  DROP TABLE `CaioAttentionRuntimeNode`;
  DROP TABLE `CaioAttentionControl`;
  DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261104120000_caio_attention_control_plane';
END$$

DELIMITER ;

CALL `rollback_unused_caio_attention_control_plane`();
DROP PROCEDURE `rollback_unused_caio_attention_control_plane`;
