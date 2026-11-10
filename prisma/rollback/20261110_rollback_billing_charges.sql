-- Rollback of 20261110210000_billing_charges, only for an unused migration (application rollback: stop calling settle;
-- reservations stay held). Refuses while any charge row, `charge` funds transaction or `charge_revenue` line/projection exists;
-- stop all writers first. Removes only `charge` / `charge_revenue` from the CURRENT ENUMs (other slices' values, e.g. S3-e's
-- credit_*, stay); the final DELETE lets `prisma migrate deploy` re-apply the migration.
DROP PROCEDURE IF EXISTS `rollback_empty_billing_charges`;
DELIMITER $$
CREATE PROCEDURE `rollback_empty_billing_charges`()
BEGIN
  DECLARE t VARCHAR(64); DECLARE c VARCHAR(64); DECLARE v VARCHAR(64); DECLARE i INT DEFAULT 0;
  IF EXISTS (SELECT 1 FROM `BillingCharge`) OR EXISTS (SELECT 1 FROM `FundsTransaction` WHERE `kind` = 'charge')
     OR EXISTS (SELECT 1 FROM `FundsJournalEntry` WHERE `account` = 'charge_revenue')
     OR EXISTS (SELECT 1 FROM `FundsAccountProjection` WHERE `account` = 'charge_revenue') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback refused: charge rows or charge postings exist';
  END IF;
  DROP TABLE `BillingCharge`;
  WHILE i < 3 DO
    SET t = ELT(i + 1, 'FundsAccountProjection', 'FundsJournalEntry', 'FundsTransaction');
    SET c = IF(i < 2, 'account', 'kind'); SET v = IF(i < 2, 'charge_revenue', 'charge');
    SELECT CONCAT('ALTER TABLE `', t, '` MODIFY `', c, '` ', REPLACE(COLUMN_TYPE, CONCAT(',''', v, ''''), ''), ' NOT NULL')
      INTO @rollback_ddl FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = t AND COLUMN_NAME = c;
    PREPARE stmt FROM @rollback_ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    SET i = i + 1;
  END WHILE;
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME IN ('FundsAccountProjection', 'FundsJournalEntry', 'FundsTransaction') AND COLUMN_NAME IN ('account', 'kind')
     AND (COLUMN_TYPE LIKE '%''charge''%' OR COLUMN_TYPE LIKE '%''charge\_revenue''%')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback incomplete: charge ENUM values still present';
  END IF;
  DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261110210000_billing_charges';
END$$
DELIMITER ;
CALL `rollback_empty_billing_charges`();
DROP PROCEDURE `rollback_empty_billing_charges`;
