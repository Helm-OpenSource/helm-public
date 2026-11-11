-- Rollback of 20261111100000_seat_device_authorization. Run as the migration identity. Refuses while either table
-- holds a row: a device row may be a live credential and the token history is what detects a replayed token, so
-- neither is a cache. Revoke and drain through the device service first. The final DELETE lets
-- `prisma migrate deploy` re-apply the migration afterwards.
-- 需要 CREATE ROUTINE + DROP 权限；不走 release-window 链，属于 owner 专项授权的人工动作。
DROP PROCEDURE IF EXISTS `rollback_empty_seat_device_authorization`;

DELIMITER $$

CREATE PROCEDURE `rollback_empty_seat_device_authorization`()
BEGIN
  IF (SELECT COUNT(*) FROM `SeatDeviceAuthorization`) + (SELECT COUNT(*) FROM `SeatDeviceTokenHistory`) > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: seat device authorization tables are not empty';
  END IF;

  DROP TABLE `SeatDeviceTokenHistory`;
  DROP TABLE `SeatDeviceAuthorization`;
  DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261111100000_seat_device_authorization';
END$$

DELIMITER ;

CALL `rollback_empty_seat_device_authorization`();
DROP PROCEDURE `rollback_empty_seat_device_authorization`;
