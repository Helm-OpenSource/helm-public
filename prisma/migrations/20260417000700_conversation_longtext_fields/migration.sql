ALTER TABLE `ConversationTranscript`
  MODIFY `fullText` LONGTEXT NOT NULL,
  MODIFY `segments` LONGTEXT NULL;

ALTER TABLE `ConversationInsight`
  MODIFY `content` LONGTEXT NOT NULL,
  MODIFY `sourceSegmentRefs` LONGTEXT NULL;
