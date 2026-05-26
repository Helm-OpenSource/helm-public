-- Memory fact payloads can exceed VARCHAR(191) during seed/extraction.
ALTER TABLE `MemoryFact`
  MODIFY COLUMN `content` LONGTEXT NOT NULL,
  MODIFY COLUMN `normalizedValue` LONGTEXT NULL;
