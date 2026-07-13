-- One-time upgrade for an existing Tier 1.1 AgentRunStore installation.
-- Apply under the same tenant prefix used by AGENT_RUN_STORE_TABLE_TENANT_KEY.
-- This public reference uses the default `helm` prefix; private composition owns
-- prefix substitution, migration execution, backup, and rollback receipts.

ALTER TABLE `helm_agent_runs`
  ADD COLUMN `lease_owner_ref` VARCHAR(191) NULL,
  ADD COLUMN `lease_acquired_at_ms` BIGINT NULL,
  ADD COLUMN `lease_heartbeat_at_ms` BIGINT NULL,
  ADD COLUMN `lease_expires_at_ms` BIGINT NULL,
  ADD COLUMN `fencing_epoch` BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN `cancel_requested_by_ref` VARCHAR(191) NULL,
  ADD COLUMN `cancel_reason_code` VARCHAR(191) NULL,
  ADD COLUMN `cancel_requested_at_ms` BIGINT NULL,
  ADD COLUMN `checkpoint_ref` VARCHAR(191) NULL,
  ADD COLUMN `checkpoint_next_step_index` INT NULL,
  ADD COLUMN `checkpoint_lifecycle` VARCHAR(32) NULL,
  ADD COLUMN `checkpoint_written_at_ms` BIGINT NULL,
  ADD COLUMN `checkpoint_fencing_epoch` BIGINT NULL;

ALTER TABLE `helm_agent_run_steps`
  ADD COLUMN `fencing_epoch` BIGINT NULL;

CREATE TABLE `helm_agent_run_attempts` (
  `seq`                 BIGINT       NOT NULL AUTO_INCREMENT,
  `workspace_id`        VARCHAR(191) NOT NULL,
  `agent_run_id`        VARCHAR(191) NOT NULL,
  `operation_ref`       VARCHAR(191) NOT NULL,
  `attempt_kind`        VARCHAR(32)  NOT NULL,
  `attempt_count`       INT          NOT NULL,
  `last_reserved_at_ms` BIGINT       NOT NULL,
  PRIMARY KEY (`seq`),
  UNIQUE KEY `uq_agent_run_attempts_ws_run_op`
    (`workspace_id`, `agent_run_id`, `operation_ref`),
  KEY `idx_agent_run_attempts_ws_run` (`workspace_id`, `agent_run_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
