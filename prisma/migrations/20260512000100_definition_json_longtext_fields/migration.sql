-- Widen definition JSON snapshots to avoid VARCHAR(191) truncation in production.

SET @stmt = (
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'Membership'
        AND column_name = 'definitionDraftJson'
    ) THEN
      'ALTER TABLE `Membership` MODIFY COLUMN `definitionDraftJson` LONGTEXT NULL'
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'membership'
        AND column_name = 'definitionDraftJson'
    ) THEN
      'ALTER TABLE `membership` MODIFY COLUMN `definitionDraftJson` LONGTEXT NULL'
    ELSE 'SELECT 1'
  END
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt = (
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'Membership'
        AND column_name = 'definitionAcceptedJson'
    ) THEN
      'ALTER TABLE `Membership` MODIFY COLUMN `definitionAcceptedJson` LONGTEXT NULL'
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'membership'
        AND column_name = 'definitionAcceptedJson'
    ) THEN
      'ALTER TABLE `membership` MODIFY COLUMN `definitionAcceptedJson` LONGTEXT NULL'
    ELSE 'SELECT 1'
  END
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt = (
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'Company'
        AND column_name = 'definitionAcceptedJson'
    ) THEN
      'ALTER TABLE `Company` MODIFY COLUMN `definitionAcceptedJson` LONGTEXT NULL'
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'company'
        AND column_name = 'definitionAcceptedJson'
    ) THEN
      'ALTER TABLE `company` MODIFY COLUMN `definitionAcceptedJson` LONGTEXT NULL'
    ELSE 'SELECT 1'
  END
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
