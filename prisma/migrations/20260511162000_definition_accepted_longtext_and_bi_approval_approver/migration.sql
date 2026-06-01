ALTER TABLE `Membership`
  MODIFY COLUMN `definitionAcceptedJson` LONGTEXT NULL;

ALTER TABLE `Company`
  MODIFY COLUMN `definitionSuggestionJson` LONGTEXT NULL,
  MODIFY COLUMN `definitionAcceptedJson` LONGTEXT NULL;
