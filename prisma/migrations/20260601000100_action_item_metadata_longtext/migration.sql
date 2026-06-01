-- NOTE: In this database `ActionItem` is a VIEW (see `SHOW FULL TABLES ...`),
-- and the underlying base table is `action_item`.
ALTER TABLE `action_item`
  MODIFY COLUMN `metadata` LONGTEXT NULL;

