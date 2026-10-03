-- C2 additive upgrade for the existing LLM spend ledger/counter candidate.
--
-- This migration records maximum-charge and provenance facts. It does not make
-- those references authoritative, connect a provider, or activate enforcement.
-- The historical 20260917200000 migration remains byte-identical.

ALTER TABLE `Workspace`
  ADD COLUMN `llmBudgetCurrency` VARCHAR(3) NULL,
  ADD COLUMN `llmBudgetPriceBookRef` VARCHAR(191) NULL,
  ADD COLUMN `llmBudgetFxPolicyRef` VARCHAR(191) NULL;

ALTER TABLE `Workspace`
  ADD CONSTRAINT `Workspace_llm_budget_currency_check`
    CHECK (`llmBudgetCurrency` IS NULL OR BINARY `llmBudgetCurrency` = BINARY 'USD');

ALTER TABLE `LLMSpendLedgerEntry`
  ADD COLUMN `contractVersion` INTEGER NULL DEFAULT 1,
  ADD COLUMN `operationRef` VARCHAR(191) NULL,
  ADD COLUMN `maximumChargeMicros` BIGINT NULL,
  ADD COLUMN `observedActualMicros` BIGINT NULL,
  ADD COLUMN `budgetCurrency` VARCHAR(3) NULL,
  ADD COLUMN `providerCurrency` VARCHAR(3) NULL,
  ADD COLUMN `budgetConfigVersion` INTEGER NULL,
  ADD COLUMN `budgetMode` VARCHAR(16) NULL,
  ADD COLUMN `budgetLimitMicros` BIGINT NULL,
  ADD COLUMN `quoteRef` VARCHAR(191) NULL,
  ADD COLUMN `quoteHash` VARCHAR(71) NULL,
  ADD COLUMN `priceBookRef` VARCHAR(191) NULL,
  ADD COLUMN `priceBookVersion` VARCHAR(64) NULL,
  ADD COLUMN `priceBookHash` VARCHAR(71) NULL,
  ADD COLUMN `fxSnapshotRef` VARCHAR(191) NULL,
  ADD COLUMN `fxSnapshotHash` VARCHAR(71) NULL,
  ADD COLUMN `policyApprovalRef` VARCHAR(191) NULL,
  ADD COLUMN `provenanceState` VARCHAR(32) NULL DEFAULT 'legacy_unknown',
  ADD COLUMN `invariantBreachReason` VARCHAR(64) NULL;

ALTER TABLE `LLMSpendPeriodCounter`
  ADD COLUMN `contractVersion` INTEGER NULL DEFAULT 1,
  ADD COLUMN `budgetConfigVersion` INTEGER NULL,
  ADD COLUMN `budgetMode` VARCHAR(16) NULL,
  ADD COLUMN `budgetLimitMicros` BIGINT NULL,
  ADD COLUMN `policyApprovalRef` VARCHAR(191) NULL,
  ADD COLUMN `admissionState` VARCHAR(32) NOT NULL DEFAULT 'legacy_unknown',
  ADD COLUMN `invariantBreachBoundMicros` BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN `invariantBreachCalls` INTEGER NOT NULL DEFAULT 0;

-- Rows written by the v1 candidate did not snapshot currency, quote, price,
-- FX or policy config. Do not invent those facts. Quarantine the rows and their
-- period counters as legacy unknown so v2 cannot use them for admission.
UPDATE `LLMSpendLedgerEntry`
SET `contractVersion` = 1,
    `provenanceState` = 'legacy_unknown'
WHERE `contractVersion` IS NULL;

UPDATE `LLMSpendPeriodCounter`
SET `contractVersion` = 1,
    `admissionState` = 'legacy_unknown'
WHERE `contractVersion` IS NULL;

-- Defaults preserve a safe, explicit legacy meaning if application code is
-- rolled back after this additive schema migration. Direct NULL writes are not
-- accepted, so a caller cannot bypass the quarantine by omitting provenance.
ALTER TABLE `LLMSpendLedgerEntry`
  MODIFY COLUMN `contractVersion` INTEGER NOT NULL DEFAULT 1,
  MODIFY COLUMN `provenanceState` VARCHAR(32) NOT NULL DEFAULT 'legacy_unknown';

ALTER TABLE `LLMSpendPeriodCounter`
  MODIFY COLUMN `contractVersion` INTEGER NOT NULL DEFAULT 1;

ALTER TABLE `LLMSpendLedgerEntry`
  DROP CHECK `LLMSpendLedgerEntry_state_check`,
  ADD CONSTRAINT `LLMSpendLedgerEntry_state_check`
    CHECK (BINARY `state` IN
      (BINARY 'reserved', BINARY 'settled', BINARY 'released', BINARY 'unknown', BINARY 'invariant_breach')),
  ADD CONSTRAINT `LLMSpendLedgerEntry_contract_version_check`
    CHECK (`contractVersion` IN (1, 2)),
  ADD CONSTRAINT `LLMSpendLedgerEntry_provenance_state_check`
    CHECK (BINARY `provenanceState` IN (BINARY 'legacy_unknown', BINARY 'complete')),
  ADD CONSTRAINT `LLMSpendLedgerEntry_maximum_charge_check`
    CHECK (`maximumChargeMicros` IS NULL OR `maximumChargeMicros` >= 0),
  ADD CONSTRAINT `LLMSpendLedgerEntry_observed_actual_check`
    CHECK (`observedActualMicros` IS NULL OR `observedActualMicros` >= 0),
  ADD CONSTRAINT `LLMSpendLedgerEntry_v2_shape_check`
    CHECK (`contractVersion` <> 2 OR (
      `operationRef` IS NOT NULL AND
      `maximumChargeMicros` IS NOT NULL AND
      `maximumChargeMicros` = `reservedMicros` AND
      BINARY `state` IN
        (BINARY 'reserved', BINARY 'settled', BINARY 'released', BINARY 'unknown', BINARY 'invariant_breach') AND
      (`usageState` IS NULL OR BINARY `usageState` IN
        (BINARY 'known', BINARY 'unknown', BINARY 'not_consumed')) AND
      `budgetCurrency` IS NOT NULL AND BINARY `budgetCurrency` = BINARY 'USD' AND
      `providerCurrency` IS NOT NULL AND
        BINARY `providerCurrency` IN (BINARY 'USD', BINARY 'CNY') AND
      `budgetConfigVersion` IS NOT NULL AND `budgetConfigVersion` > 0 AND
      `budgetMode` IS NOT NULL AND BINARY `budgetMode` IN (BINARY 'limited', BINARY 'unlimited') AND
      ((BINARY `budgetMode` = BINARY 'limited' AND `budgetLimitMicros` IS NOT NULL AND `budgetLimitMicros` >= 0) OR
       (BINARY `budgetMode` = BINARY 'unlimited' AND `budgetLimitMicros` IS NULL)) AND
      `quoteRef` IS NOT NULL AND `quoteHash` IS NOT NULL AND
      REGEXP_LIKE(`quoteHash`, '^sha256:[0-9a-f]{64}$', 'c') AND
      `priceBookRef` IS NOT NULL AND `priceBookVersion` IS NOT NULL AND
      `priceBookHash` IS NOT NULL AND REGEXP_LIKE(`priceBookHash`, '^sha256:[0-9a-f]{64}$', 'c') AND
      `policyApprovalRef` IS NOT NULL AND
      `provenanceState` IS NOT NULL AND BINARY `provenanceState` = BINARY 'complete' AND
      ((BINARY `providerCurrency` = BINARY 'USD' AND `fxSnapshotRef` IS NULL AND `fxSnapshotHash` IS NULL) OR
       (BINARY `providerCurrency` = BINARY 'CNY' AND `fxSnapshotRef` IS NOT NULL AND
        `fxSnapshotHash` IS NOT NULL AND REGEXP_LIKE(`fxSnapshotHash`, '^sha256:[0-9a-f]{64}$', 'c'))) AND
      ((BINARY `state` = BINARY 'reserved' AND `usageState` IS NULL AND
          `settledMicros` IS NULL AND `observedActualMicros` IS NULL AND `settledAt` IS NULL AND
          `invariantBreachReason` IS NULL) OR
       (BINARY `state` = BINARY 'settled' AND `usageState` IS NOT NULL AND
          BINARY `usageState` = BINARY 'known' AND
          `settledMicros` IS NOT NULL AND `observedActualMicros` IS NOT NULL AND
          `settledMicros` = `observedActualMicros` AND `settledMicros` <= `maximumChargeMicros` AND
          `settledAt` IS NOT NULL AND `invariantBreachReason` IS NULL) OR
       (BINARY `state` = BINARY 'released' AND `usageState` IS NOT NULL AND
          BINARY `usageState` = BINARY 'not_consumed' AND
          `settledMicros` IS NULL AND `observedActualMicros` IS NULL AND `settledAt` IS NULL AND
          `invariantBreachReason` IS NULL) OR
       (BINARY `state` = BINARY 'unknown' AND `usageState` IS NOT NULL AND
          BINARY `usageState` = BINARY 'unknown' AND
          `settledMicros` IS NULL AND `observedActualMicros` IS NULL AND `settledAt` IS NULL AND
          `invariantBreachReason` IS NULL) OR
       (BINARY `state` = BINARY 'invariant_breach' AND `usageState` IS NOT NULL AND
          BINARY `usageState` = BINARY 'known' AND
          `settledMicros` IS NULL AND `observedActualMicros` IS NOT NULL AND
          `observedActualMicros` > `maximumChargeMicros` AND `settledAt` IS NOT NULL AND
          BINARY `invariantBreachReason` = BINARY 'actual_exceeds_maximum'))
    )),
  ADD CONSTRAINT `LLMSpendLedgerEntry_breach_shape_check`
    CHECK (BINARY `state` <> BINARY 'invariant_breach' OR (
      `contractVersion` = 2 AND `usageState` IS NOT NULL AND BINARY `usageState` = BINARY 'known' AND
      `settledMicros` IS NULL AND `observedActualMicros` IS NOT NULL AND
      `observedActualMicros` > `maximumChargeMicros` AND `settledAt` IS NOT NULL AND
      `invariantBreachReason` IS NOT NULL AND
        BINARY `invariantBreachReason` = BINARY 'actual_exceeds_maximum'
    ));

ALTER TABLE `LLMSpendPeriodCounter`
  ADD CONSTRAINT `LLMSpendPeriodCounter_contract_version_check`
    CHECK (`contractVersion` IN (1, 2)),
  ADD CONSTRAINT `LLMSpendPeriodCounter_budget_config_version_check`
    CHECK (`budgetConfigVersion` IS NULL OR `budgetConfigVersion` > 0),
  ADD CONSTRAINT `LLMSpendPeriodCounter_admission_state_check`
    CHECK (BINARY `admissionState` IN
      (BINARY 'open', BINARY 'legacy_unknown', BINARY 'invariant_breach')),
  ADD CONSTRAINT `LLMSpendPeriodCounter_invariant_bound_check`
    CHECK (`invariantBreachBoundMicros` >= 0),
  ADD CONSTRAINT `LLMSpendPeriodCounter_invariant_calls_check`
    CHECK (`invariantBreachCalls` >= 0),
  ADD CONSTRAINT `LLMSpendPeriodCounter_v2_shape_check`
    CHECK (`contractVersion` <> 2 OR (
      `budgetConfigVersion` IS NOT NULL AND `budgetConfigVersion` > 0 AND
      `admissionState` IS NOT NULL AND BINARY `admissionState` <> BINARY 'legacy_unknown' AND
      `budgetMode` IS NOT NULL AND BINARY `budgetMode` IN (BINARY 'limited', BINARY 'unlimited') AND
      `policyApprovalRef` IS NOT NULL AND
      ((BINARY `budgetMode` = BINARY 'limited' AND `budgetLimitMicros` IS NOT NULL AND `budgetLimitMicros` >= 0) OR
       (BINARY `budgetMode` = BINARY 'unlimited' AND `budgetLimitMicros` IS NULL))
    ));

CREATE INDEX `LLMSpendLedgerEntry_workspace_period_contract_provenance_idx`
  ON `LLMSpendLedgerEntry`(`workspaceId`, `periodKey`, `contractVersion`, `provenanceState`);

CREATE INDEX `LLMSpendPeriodCounter_workspace_period_admission_idx`
  ON `LLMSpendPeriodCounter`(`workspaceId`, `periodKey`, `admissionState`);

-- One authoritative compatibility fence per billing period. This is not a
-- second money ledger: it carries no amount. Both v2 admission and the legacy
-- insert trigger lock the same unique row before touching the aggregate counter,
-- which gives mixed-version writers a single database serialization point.
-- The key uses the same unicode_ci collation as the existing ledger/counter
-- unique keys. That is deliberate: a rolled-back v1 writer may use a
-- case/accent alias that the old tables map to the same period, and its trigger
-- must therefore quarantine the same fence. The v2 store separately performs
-- a byte-exact locking read and refuses an aliased caller identity.
CREATE TABLE `LLMSpendPeriodCompatibility` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `periodKey` VARCHAR(32) NOT NULL,
  `state` VARCHAR(32) NOT NULL DEFAULT 'legacy_unknown',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `LLMSpendPeriodCompatibility_workspaceId_periodKey_key`(`workspaceId`, `periodKey`),
  INDEX `LLMSpendPeriodCompatibility_workspace_period_state_idx`(`workspaceId`, `periodKey`, `state`),
  CONSTRAINT `LLMSpendPeriodCompatibility_state_check`
    CHECK (BINARY `state` IN (BINARY 'open', BINARY 'legacy_unknown'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Every pre-upgrade period is conservatively legacy. There cannot be a trusted
-- v2 period before this migration exists.
INSERT INTO `LLMSpendPeriodCompatibility`
  (`id`, `workspaceId`, `periodKey`, `state`, `createdAt`, `updatedAt`)
SELECT UUID(), `workspaceId`, `periodKey`, 'legacy_unknown', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `LLMSpendPeriodCounter`;

-- A rolled-back v1 writer knows nothing about the fence, but it must insert its
-- ledger row before advancing the counter. The trigger marks that period in the
-- same transaction. For a v2 row the SELECT is empty, so it does not contend on
-- the compatibility table. Existing reservations remain terminally settleable;
-- only new v2 admission is blocked.
CREATE TRIGGER `LLMSpendLedgerEntry_quarantine_legacy_period_after_insert`
AFTER INSERT ON `LLMSpendLedgerEntry`
FOR EACH ROW
INSERT INTO `LLMSpendPeriodCompatibility`
  (`id`, `workspaceId`, `periodKey`, `state`, `createdAt`, `updatedAt`)
SELECT UUID(), NEW.`workspaceId`, NEW.`periodKey`, 'legacy_unknown', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM DUAL
WHERE NEW.`contractVersion` = 1 OR NEW.`provenanceState` = 'legacy_unknown'
ON DUPLICATE KEY UPDATE
  `state` = 'legacy_unknown', `updatedAt` = CURRENT_TIMESTAMP(3);
