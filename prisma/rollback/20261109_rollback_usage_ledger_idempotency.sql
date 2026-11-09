-- Application rollback needs no destructive DDL: stop opt-in writers and retain evidence.
-- This guarded schema rollback is only for an unused migration, never for recorded observations.
DELIMITER $$
CREATE PROCEDURE rollback_usage_ledger_idempotency()
BEGIN
  IF EXISTS (SELECT 1 FROM UsageLedger WHERE operationKey IS NOT NULL OR contentHash IS NOT NULL OR reversalOfId IS NOT NULL) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'usage_observations_require_preservation';
  END IF;
  ALTER TABLE UsageLedger DROP CHECK UsageLedger_observation_shape,
    DROP INDEX UsageLedger_workspaceId_operationKey_key, DROP INDEX UsageLedger_reversalOfId_key,
    DROP COLUMN operationKey, DROP COLUMN contentHash, DROP COLUMN reversalOfId;
END$$
DELIMITER ;
CALL rollback_usage_ledger_idempotency();
DROP PROCEDURE rollback_usage_ledger_idempotency;
