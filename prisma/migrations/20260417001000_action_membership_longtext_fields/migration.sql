-- Widen high-variance JSON snapshot fields used in e2e/demo flows.

SET @stmt = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'Membership'
        AND column_name = 'definitionDraftJson'
    ),
    'ALTER TABLE `Membership` MODIFY COLUMN `definitionDraftJson` LONGTEXT NULL',
    'SELECT 1'
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
        AND table_name = 'ActionItem'
        AND column_name = 'policySnapshot'
    ),
    'ALTER TABLE `ActionItem` MODIFY COLUMN `policySnapshot` LONGTEXT NULL',
    'SELECT 1'
  )
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
