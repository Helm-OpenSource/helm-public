-- Add per-member goal profile fields for settings/team management.

SET @stmt = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'Membership'
        AND column_name = 'goalTitle'
    ),
    'SELECT 1',
    'ALTER TABLE `Membership` ADD COLUMN `goalTitle` VARCHAR(191) NULL'
  )
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'Membership'
        AND column_name = 'goalDescription'
    ),
    'SELECT 1',
    'ALTER TABLE `Membership` ADD COLUMN `goalDescription` LONGTEXT NULL'
  )
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'Membership'
        AND column_name = 'goalItemsJson'
    ),
    'SELECT 1',
    'ALTER TABLE `Membership` ADD COLUMN `goalItemsJson` LONGTEXT NULL'
  )
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'Membership'
        AND column_name = 'jobResponsibilities'
    ),
    'SELECT 1',
    'ALTER TABLE `Membership` ADD COLUMN `jobResponsibilities` LONGTEXT NULL'
  )
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
