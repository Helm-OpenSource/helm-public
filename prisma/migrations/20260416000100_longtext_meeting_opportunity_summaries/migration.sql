-- Expand summary fields to LONGTEXT for multi-section runtime writebacks.
ALTER TABLE `Opportunity`
  MODIFY COLUMN `shadowBlockersSummary` LONGTEXT NULL,
  MODIFY COLUMN `nextStepSummary` LONGTEXT NULL;

ALTER TABLE `Meeting`
  MODIFY COLUMN `postMeetingSummary` LONGTEXT NULL;
