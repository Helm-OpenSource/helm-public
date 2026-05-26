-- Workspace seed payload fields can exceed VARCHAR(191) on MySQL.
-- Promote these JSON/text serialized fields to LONGTEXT.
ALTER TABLE `Workspace`
  MODIFY COLUMN `connectedSources` LONGTEXT NULL,
  MODIFY COLUMN `focusAreas` LONGTEXT NULL,
  MODIFY COLUMN `defaultStrategies` LONGTEXT NULL,
  MODIFY COLUMN `configuration` LONGTEXT NULL,
  MODIFY COLUMN `featureFlagsJson` LONGTEXT NULL;
