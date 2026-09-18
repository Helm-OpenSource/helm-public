-- LLM spend ledger + workspace budget policy.
--
-- CANDIDATE. Not authorised for site execution: per the repair SRS §18.1 the DB owner and
-- OWNER must confirm backup, window, lock impact and recovery first, and the control-plane
-- BOM must declare this migration in `coreMigrations` before any cutover applies it.
--
-- Additive only: new nullable columns on an existing table plus one new table. No column is
-- dropped, no type narrowed, no default changed on existing data. Every added column is
-- nullable (or has a default), so existing rows remain valid and a rollback of the code does
-- not orphan them.
--
-- Amounts are integer micros (BIGINT), never floats: RF-01.3 forbids letting float error
-- admit a call at the threshold.
--
-- CHECK constraints are hand-authored and invisible to check:migration-drift's datamodel
-- comparison. The schema uses relationMode = "prisma", so no database foreign key is created
-- for workspaceId.

ALTER TABLE `Workspace`
  ADD COLUMN `llmBudgetMode` VARCHAR(191) NULL,
  ADD COLUMN `llmMonthlyBudgetMicros` BIGINT NULL,
  ADD COLUMN `llmBudgetEnforcementMode` VARCHAR(191) NULL,
  ADD COLUMN `llmBudgetPeriodPolicyVersion` VARCHAR(191) NULL,
  ADD COLUMN `llmBudgetConfigVersion` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `llmBudgetApprovalRef` VARCHAR(191) NULL,
  ADD COLUMN `llmBudgetUpdatedBy` VARCHAR(191) NULL,
  ADD COLUMN `llmBudgetUpdatedAt` DATETIME(3) NULL,
  ADD COLUMN `llmPromptVersionOverrides` LONGTEXT NULL;

-- `unconfigured` is an explicit state, not NULL. NULL used to be the only way to say
-- "no budget", which made "nobody configured this" indistinguishable from "deliberately
-- unlimited". Existing rows are NULL (= nothing declared yet) and must stay refused by the
-- enforcement path rather than defaulted to unlimited.
ALTER TABLE `Workspace`
  ADD CONSTRAINT `Workspace_llm_budget_mode_check`
    CHECK (`llmBudgetMode` IS NULL OR `llmBudgetMode` IN ('unconfigured', 'limited', 'unlimited')),
  ADD CONSTRAINT `Workspace_llm_budget_enforcement_check`
    CHECK (`llmBudgetEnforcementMode` IS NULL OR `llmBudgetEnforcementMode` IN ('shadow', 'enforce')),
  -- A limited budget must carry an amount, and the amount must be non-negative. 0 is a
  -- legitimate value meaning "block everything", which is why it is not excluded here.
  ADD CONSTRAINT `Workspace_llm_budget_amount_check`
    CHECK (`llmMonthlyBudgetMicros` IS NULL OR `llmMonthlyBudgetMicros` >= 0),
  ADD CONSTRAINT `Workspace_llm_budget_limited_requires_amount_check`
    CHECK (`llmBudgetMode` <> 'limited' OR `llmMonthlyBudgetMicros` IS NOT NULL),
  -- Enforcing without a declared mode is the shape that would refuse or admit calls with no
  -- stated policy behind it.
  ADD CONSTRAINT `Workspace_llm_budget_enforce_requires_mode_check`
    CHECK (`llmBudgetEnforcementMode` <> 'enforce' OR `llmBudgetMode` IN ('limited', 'unlimited')),
  ADD CONSTRAINT `Workspace_llm_budget_config_version_check`
    CHECK (`llmBudgetConfigVersion` >= 0);

CREATE TABLE `LLMSpendLedgerEntry` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `periodKey` VARCHAR(32) NOT NULL,
    `periodPolicyVersion` VARCHAR(64) NOT NULL,
    `attemptRef` VARCHAR(191) NOT NULL,
    `state` VARCHAR(16) NOT NULL,
    `reservedMicros` BIGINT NOT NULL,
    `settledMicros` BIGINT NULL,
    `usageState` VARCHAR(16) NULL,
    `provider` VARCHAR(64) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `reservedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `settledAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    -- Exactly once per call attempt: a retry of the same attempt must not reserve twice.
    UNIQUE INDEX `LLMSpendLedgerEntry_workspaceId_attemptRef_key`(`workspaceId`, `attemptRef`),
    -- The period total is read by workspace + period + state on every admission.
    INDEX `LLMSpendLedgerEntry_workspaceId_periodKey_state_idx`(`workspaceId`, `periodKey`, `state`),
    -- Recovery sweep: reservations whose call never reported back.
    INDEX `LLMSpendLedgerEntry_state_expiresAt_idx`(`state`, `expiresAt`),
    CONSTRAINT `LLMSpendLedgerEntry_state_check`
      CHECK (`state` IN ('reserved', 'settled', 'released', 'unknown')),
    CONSTRAINT `LLMSpendLedgerEntry_usage_state_check`
      CHECK (`usageState` IS NULL OR `usageState` IN ('known', 'unknown', 'not_consumed')),
    CONSTRAINT `LLMSpendLedgerEntry_reserved_micros_check` CHECK (`reservedMicros` >= 0),
    CONSTRAINT `LLMSpendLedgerEntry_settled_micros_check`
      CHECK (`settledMicros` IS NULL OR `settledMicros` >= 0),
    -- A settled row must carry both the amount and the time; a reserved row must carry neither.
    -- Without this, "settled" could be claimed with no amount behind it.
    CONSTRAINT `LLMSpendLedgerEntry_settled_shape_check`
      CHECK (`state` <> 'settled' OR (`settledMicros` IS NOT NULL AND `settledAt` IS NOT NULL)),
    CONSTRAINT `LLMSpendLedgerEntry_reserved_shape_check`
      CHECK (`state` <> 'reserved' OR (`settledMicros` IS NULL AND `settledAt` IS NULL)),
    -- An `unknown` row is one whose consumption could not be measured. It keeps its
    -- reservation as the conservative bound and must NOT claim a settled amount.
    CONSTRAINT `LLMSpendLedgerEntry_unknown_shape_check`
      CHECK (`state` <> 'unknown' OR `settledMicros` IS NULL),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Per-(workspace, period) counter. Admission is a single conditional UPDATE against this row
-- (see the model's doc comment for why this shape rather than SELECT ... FOR UPDATE): atomic on
-- any isolation level, so it does not depend on raising this server's default READ COMMITTED.
CREATE TABLE `LLMSpendPeriodCounter` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `periodKey` VARCHAR(32) NOT NULL,
    `periodPolicyVersion` VARCHAR(64) NOT NULL,
    `reservedMicros` BIGINT NOT NULL DEFAULT 0,
    `settledMicros` BIGINT NOT NULL DEFAULT 0,
    `unknownBoundMicros` BIGINT NOT NULL DEFAULT 0,
    `unknownCalls` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `LLMSpendPeriodCounter_workspaceId_periodKey_key`(`workspaceId`, `periodKey`),
    INDEX `LLMSpendPeriodCounter_periodKey_idx`(`periodKey`),
    -- Every counter is a non-negative total. A negative reserved total would mean more was
    -- released than reserved, which is a settlement bug rather than a state to tolerate.
    CONSTRAINT `LLMSpendPeriodCounter_reserved_check` CHECK (`reservedMicros` >= 0),
    CONSTRAINT `LLMSpendPeriodCounter_settled_check` CHECK (`settledMicros` >= 0),
    CONSTRAINT `LLMSpendPeriodCounter_unknown_bound_check` CHECK (`unknownBoundMicros` >= 0),
    CONSTRAINT `LLMSpendPeriodCounter_unknown_calls_check` CHECK (`unknownCalls` >= 0),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
