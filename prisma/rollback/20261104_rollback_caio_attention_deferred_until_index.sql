-- Rollback of 20261104180000_caio_attention_deferred_until_index. Run as the migration identity, before the
-- reminder-due-indexes rollback. Drops only the deferredUntil scanner index; no data is touched. The final DELETE
-- lets `prisma migrate deploy` re-apply the migration afterwards.
DROP INDEX `CaioAttentionCase_status_deferredUntil_idx` ON `CaioAttentionCase`;
DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261104180000_caio_attention_deferred_until_index';
