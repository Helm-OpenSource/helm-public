-- Durable AgentRunStore schema (Tier 1.1). Tenant prefix defaults to `helm`
-- (AGENT_RUN_STORE_TABLE_TENANT_KEY). Apply as a migration before binding MysqlAgentRunStore.
-- Reference-only columns: ids / enums / reference tokens — never inline content / PII.

CREATE TABLE IF NOT EXISTS `helm_agent_runs` (
  `seq`           BIGINT       NOT NULL AUTO_INCREMENT,
  `workspace_id`  VARCHAR(191) NOT NULL,
  `agent_run_id`  VARCHAR(191) NOT NULL,
  `lifecycle`     VARCHAR(32)  NOT NULL,
  PRIMARY KEY (`seq`),
  UNIQUE KEY `uq_agent_runs_ws_run` (`workspace_id`, `agent_run_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `helm_agent_run_steps` (
  `seq`             BIGINT       NOT NULL AUTO_INCREMENT,
  `workspace_id`    VARCHAR(191) NOT NULL,
  `agent_run_id`    VARCHAR(191) NOT NULL,
  `step_id`         VARCHAR(191) NOT NULL,
  `step_index`      INT          NOT NULL,
  `decision_kind`   VARCHAR(32)  NOT NULL,
  `tool_name`       VARCHAR(191) NULL,
  `decision_ref`    VARCHAR(191) NULL,
  `tool_status`     VARCHAR(16)  NULL,
  `observation_ref` VARCHAR(191) NULL,
  `error_code`      VARCHAR(64)  NULL,
  `state`           VARCHAR(32)  NOT NULL,
  PRIMARY KEY (`seq`),
  UNIQUE KEY `uq_agent_run_steps_ws_step` (`workspace_id`, `step_id`),
  KEY `idx_agent_run_steps_ws_run` (`workspace_id`, `agent_run_id`, `step_index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
