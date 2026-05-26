ALTER TABLE `EventLog`
  MODIFY `metadata` LONGTEXT NULL;

ALTER TABLE `RecommendationLog`
  MODIFY `description` LONGTEXT NOT NULL,
  MODIFY `recommendationPayload` LONGTEXT NULL,
  MODIFY `supportingFactIds` LONGTEXT NULL,
  MODIFY `blockerIds` LONGTEXT NULL,
  MODIFY `commitmentIds` LONGTEXT NULL,
  MODIFY `explanation` LONGTEXT NOT NULL;
