-- Additive observation contract; no historical backfill and no invoice/payment effect.
ALTER TABLE UsageLedger
  ADD COLUMN operationKey VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ADD COLUMN contentHash VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ADD COLUMN reversalOfId VARCHAR(191) COLLATE utf8mb4_bin NULL,
  ADD UNIQUE INDEX UsageLedger_workspaceId_operationKey_key (workspaceId, operationKey),
  ADD UNIQUE INDEX UsageLedger_reversalOfId_key (reversalOfId),
  ADD CONSTRAINT UsageLedger_observation_shape CHECK (
    (operationKey IS NULL AND contentHash IS NULL AND reversalOfId IS NULL)
    OR (operationKey IS NOT NULL AND contentHash IS NOT NULL
      AND CHAR_LENGTH(operationKey) > 0 AND REGEXP_LIKE(contentHash, '^[0-9a-f]{64}$', 'c')
      AND ((reversalOfId IS NULL AND quantity > 0) OR (reversalOfId IS NOT NULL AND quantity < 0)))
  );
