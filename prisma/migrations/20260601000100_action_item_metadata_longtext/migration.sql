-- Expand ActionItem metadata storage to avoid JSON truncation.
--
-- Historical deployments may use either:
-- - `ActionItem` (Prisma default table name), or
-- - `action_item` (legacy / view-backed base table).
--
-- Pick whichever exists in the current schema and apply the alteration.
SET @helm_action_item_table := (
  SELECT t.TABLE_NAME
  FROM INFORMATION_SCHEMA.TABLES t
  WHERE t.TABLE_SCHEMA = DATABASE()
    AND t.TABLE_NAME IN ('ActionItem', 'action_item')
  ORDER BY FIELD(t.TABLE_NAME, 'ActionItem', 'action_item')
  LIMIT 1
);

SET @helm_action_item_sql := IF(
  @helm_action_item_table IS NULL,
  'SELECT 1',
  CONCAT(
    'ALTER TABLE `',
    @helm_action_item_table,
    '` MODIFY COLUMN `metadata` LONGTEXT NULL'
  )
);

PREPARE helm_stmt FROM @helm_action_item_sql;
EXECUTE helm_stmt;
DEALLOCATE PREPARE helm_stmt;
