ALTER TABLE `DeltaEvent`
  MODIFY `payload` LONGTEXT NULL;

ALTER TABLE `ImportSource`
  MODIFY `configJson` LONGTEXT NULL;

ALTER TABLE `ImportJob`
  MODIFY `errorSummary` LONGTEXT NULL,
  MODIFY `summaryJson` LONGTEXT NULL;

ALTER TABLE `ImportItem`
  MODIFY `payload` LONGTEXT NULL,
  MODIFY `normalizedPayload` LONGTEXT NULL,
  MODIFY `errorMessage` LONGTEXT NULL,
  MODIFY `warningMessage` LONGTEXT NULL;
