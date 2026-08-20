-- Member Gateway M3b: member prompt queue persistence layer (spec §6.3).
--
-- `MemberPrompt` rows carry the queue state machine: `state` moves only
-- through CAS transitions guarded by the store service's `updateMany`
-- (state + version predicate), never by a trigger. `version` is the
-- optimistic-concurrency counter (expectedVersion seam) bumped by every
-- transition. `MemberPromptTransitionReceipt` rows are strictly
-- append-only: UPDATE and DELETE are blocked at the database level by the
-- triggers below, so correcting a bad receipt requires writing a new
-- receipt at the next version instead of mutating history.
-- `evaluationUseProhibited` is the frozen non-performance literal (spec
-- §12): a CHECK constraint pins it to TRUE so a transition-timing/content
-- receipt can never be persisted with the evaluation guard turned off.
--
-- CHECK constraints and the append-only triggers are hand-authored
-- enhancements layered on top of the Prisma-generated shape; they are
-- invisible to `check:migration-drift`'s datamodel comparison, which only
-- diffs column/index/relation shape against `schema.prisma`. This migration
-- follows the current Prisma `relationMode = "prisma"` truth and therefore
-- does not hand-author database foreign keys.
--
-- Local-apply note: this migration's CREATE TRIGGER statements require
-- log_bin_trust_function_creators=1 (or SUPER) when binary logging is
-- enabled. Local developer instances without that setting will fail with
-- MySQL 1419, exactly as the 20260723230000 egress migration does; the CI
-- MySQL container enables the flag and is the verification path.
CREATE TABLE `MemberPrompt` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `memberRef` VARCHAR(191) NOT NULL,
  `severity` VARCHAR(191) NOT NULL,
  `severityRuleRef` VARCHAR(191) NULL,
  `subjectObjectRef` VARCHAR(191) NOT NULL,
  `projectedSummary` LONGTEXT NOT NULL,
  `evidenceRefsJson` LONGTEXT NOT NULL,
  `state` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL,
  `snoozeUntil` DATETIME(3) NULL,
  `responseRef` VARCHAR(191) NULL,
  `issuedAt` DATETIME(3) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `MWPrompt_id_workspace_key` (`id`, `workspaceId`),
  INDEX `MWPrompt_workspace_member_state_idx` (`workspaceId`, `memberRef`, `state`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MemberPromptTransitionReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `promptRef` VARCHAR(191) NOT NULL,
  `fromState` VARCHAR(191) NOT NULL,
  `toState` VARCHAR(191) NOT NULL,
  `cause` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL,
  `deliverDecision` VARCHAR(191) NULL,
  `heldReason` VARCHAR(191) NULL,
  `responseRef` VARCHAR(191) NULL,
  `occurredAt` DATETIME(3) NOT NULL,
  `evaluationUseProhibited` BOOLEAN NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `MWPromptReceipt_id_workspace_key` (`id`, `workspaceId`),
  UNIQUE INDEX `MWPromptReceipt_prompt_version_key` (`workspaceId`, `promptRef`, `version`),
  INDEX `MWPromptReceipt_workspace_prompt_idx` (`workspaceId`, `promptRef`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MemberPrompt`
  ADD CONSTRAINT `MWPrompt_severity_check` CHECK (`severity` IN ('critical', 'normal')),
  ADD CONSTRAINT `MWPrompt_state_check`
    CHECK (`state` IN ('pending', 'delivered', 'snoozed', 'responded', 'withdrawn', 'expired', 'suppressed')),
  ADD CONSTRAINT `MWPrompt_version_check` CHECK (`version` >= 1),
  ADD CONSTRAINT `MWPrompt_window_check` CHECK (`expiresAt` > `issuedAt`);

ALTER TABLE `MemberPromptTransitionReceipt`
  ADD CONSTRAINT `MWPromptReceipt_cause_check`
    CHECK (`cause` IN ('deliver', 'snooze', 'unsnooze', 'respond', 'withdraw', 'expire', 'suppress')),
  ADD CONSTRAINT `MWPromptReceipt_states_check`
    CHECK (`fromState` IN ('pending', 'delivered', 'snoozed', 'responded', 'withdrawn', 'expired', 'suppressed')
      AND `toState` IN ('pending', 'delivered', 'snoozed', 'responded', 'withdrawn', 'expired', 'suppressed')),
  ADD CONSTRAINT `MWPromptReceipt_evaluation_check` CHECK (`evaluationUseProhibited` = TRUE),
  ADD CONSTRAINT `MWPromptReceipt_deliver_decision_check`
    CHECK (`deliverDecision` IS NULL OR `deliverDecision` IN ('deliver', 'held'));

CREATE TRIGGER `MemberPromptTransitionReceipt_append_only_update`
BEFORE UPDATE ON `MemberPromptTransitionReceipt`
FOR EACH ROW
SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'MemberPromptTransitionReceipt is append-only';

CREATE TRIGGER `MemberPromptTransitionReceipt_append_only_delete`
BEFORE DELETE ON `MemberPromptTransitionReceipt`
FOR EACH ROW
SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'MemberPromptTransitionReceipt is append-only';
