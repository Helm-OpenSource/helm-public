ALTER TABLE `PatternFact`
  MODIFY `summary` LONGTEXT NULL,
  MODIFY `evidenceSnapshot` LONGTEXT NULL;

ALTER TABLE `StrategySuggestion`
  MODIFY `reason` LONGTEXT NOT NULL,
  MODIFY `evidenceSnapshot` LONGTEXT NULL;

ALTER TABLE `SkillSuggestion`
  MODIFY `reason` LONGTEXT NOT NULL,
  MODIFY `candidateSpecJson` LONGTEXT NOT NULL,
  MODIFY `evidenceSnapshot` LONGTEXT NULL,
  MODIFY `sourcePatternFactIds` LONGTEXT NULL,
  MODIFY `sourceRecommendationIds` LONGTEXT NULL;

ALTER TABLE `BriefingSnapshot`
  MODIFY `content` LONGTEXT NOT NULL,
  MODIFY `sourceFactIds` LONGTEXT NULL,
  MODIFY `sourceCommitmentIds` LONGTEXT NULL,
  MODIFY `sourceBlockerIds` LONGTEXT NULL;
