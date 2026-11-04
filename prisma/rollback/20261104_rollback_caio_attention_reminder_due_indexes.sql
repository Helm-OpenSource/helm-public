-- Rollback of 20261104160000_caio_attention_reminder_due_indexes. Run as the migration identity, before the cases
-- rollback. Drops only the five scanner indexes; no data is touched. The final DELETE lets `prisma migrate deploy`
-- re-apply the migration afterwards.
DROP INDEX `CaioAttentionCase_status_r0aDueAt_idx` ON `CaioAttentionCase`;
DROP INDEX `CaioAttentionCase_status_r0bDueAt_idx` ON `CaioAttentionCase`;
DROP INDEX `CaioAttentionCase_status_noResponseDueAt_idx` ON `CaioAttentionCase`;
DROP INDEX `CaioAttentionCase_status_unresolvedEscalateAt_idx` ON `CaioAttentionCase`;
DROP INDEX `CaioAttentionCase_status_nextPeriodicAt_idx` ON `CaioAttentionCase`;
DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261104160000_caio_attention_reminder_due_indexes';
