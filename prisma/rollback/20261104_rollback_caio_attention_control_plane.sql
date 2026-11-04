-- Rollback of 20261104120000_caio_attention_control_plane. Run as the migration identity, after the case tables
-- (20261104120100_caio_attention_cases) have been rolled back. Refuses while the control plane has ever been used:
-- any readiness proof, pause request or heartbeat, or a Control row that left its seeded PAUSED / epoch 0 state.
-- The final DELETE lets `prisma migrate deploy` re-apply the migration afterwards.
DROP PROCEDURE IF EXISTS `rollback_unused_caio_attention_control_plane`;

DELIMITER $$

CREATE PROCEDURE `rollback_unused_caio_attention_control_plane`()
BEGIN
  IF (SELECT COUNT(*) FROM `CaioAttentionNodeReadiness`) + (SELECT COUNT(*) FROM `CaioAttentionPauseRequest`)
     + (SELECT COUNT(*) FROM `CaioAttentionRuntimeNode`)
     + (SELECT COUNT(*) FROM `CaioAttentionControl`
        WHERE `intakeState` <> 'PAUSED' OR `epoch` <> 0 OR `openEpoch` <> 0) > 0 THEN
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
