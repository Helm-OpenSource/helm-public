-- Rollback of 20261104120100_caio_attention_cases. Run as the migration identity, before the control-plane rollback.
-- Refuses while any case-side table holds a row: cases and their append-only history are audit records, not
-- caches. The final DELETE lets `prisma migrate deploy` re-apply the migration afterwards.
DROP PROCEDURE IF EXISTS `rollback_empty_caio_attention_cases`;

DELIMITER $$

CREATE PROCEDURE `rollback_empty_caio_attention_cases`()
BEGIN
  IF (SELECT COUNT(*) FROM `CaioAttentionCase`) + (SELECT COUNT(*) FROM `CaioAttentionCaseEvent`)
     + (SELECT COUNT(*) FROM `CaioAttentionDisposition`) + (SELECT COUNT(*) FROM `CaioAttentionReview`)
     + (SELECT COUNT(*) FROM `CaioAttentionRouteConfig`) + (SELECT COUNT(*) FROM `CaioAttentionRouteConfigHead`)
     + (SELECT COUNT(*) FROM `CaioDetectorEvaluation`) > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: CAIO attention case tables are not empty';
  END IF;

  DROP TABLE `CaioDetectorEvaluation`;
  DROP TABLE `CaioAttentionRouteConfigHead`;
  DROP TABLE `CaioAttentionRouteConfig`;
  DROP TABLE `CaioAttentionReview`;
  DROP TABLE `CaioAttentionDisposition`;
  DROP TABLE `CaioAttentionCaseEvent`;
  DROP TABLE `CaioAttentionCase`;
  DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261104120100_caio_attention_cases';
END$$

DELIMITER ;

CALL `rollback_empty_caio_attention_cases`();
DROP PROCEDURE `rollback_empty_caio_attention_cases`;
