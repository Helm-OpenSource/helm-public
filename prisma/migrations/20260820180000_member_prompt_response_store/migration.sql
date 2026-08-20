-- Member Gateway M3c: prompt response persistence layer (spec §5/§6.3/§7).
--
-- `MemberPromptResponseReceipt` carries the four non-candidate response
-- write kinds (acknowledge / refuse / pause / appeal / commitment_confirm —
-- five literal values because refuse/pause/appeal are three distinct kinds
-- sharing one responseClass). candidate_write responses (progress_report /
-- free_text_answer) never land here: they reuse the M2 work-signal machine
-- (MemberWorkSignalReceipt), which is the frozen M3c Architecture #1
-- decision. The table is strictly append-only: UPDATE and DELETE are
-- blocked at the database level by the triggers below, matching
-- MemberPromptTransitionReceipt's pattern in the prior M3b migration.
--
-- Column layout is class-partitioned but NOT enforced pairwise at the
-- database layer: the protected_human_response columns
-- (governedResponseJson/governedResponseHash/governanceResponseId/
-- mandateRef/routePath) and the authority_bearing_action columns
-- (externalAuthorizationRef/authorizedMemberRef/authorizedObjectRef/
-- authorizedActionRef) are all nullable. The DB only locks the closed
-- enumerations (responseKind, responseClass, routePath) and the frozen
-- non-performance literal (evaluationUseProhibited = TRUE); the store
-- service (lib/member-gateway/prompt-response-store.service.ts) is the
-- sole authority on which columns a given responseKind/responseClass pair
-- must actually populate — spec §5's classifyMemberPromptResponse truth
-- lives in code, not in a CHECK.
--
-- One response per challenge: `@@unique([workspaceId, challengeRef])`
-- mirrors MemberWorkSignalReceipt's one-time-challenge invariant — a
-- consumed MemberWorkSignalChallenge row can produce at most one response
-- receipt (spec §6.2/§6.3; M3c Architecture #3, which deliberately reuses
-- MemberWorkSignalChallenge as the generic one-time member-write challenge
-- store rather than adding a parallel table).
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
-- MySQL 1419, exactly as the 20260723230000 egress migration and the
-- 20260820120000 prompt-store migration do; the CI MySQL container enables
-- the flag and is the verification path.
CREATE TABLE `MemberPromptResponseReceipt` (
  `id`                       VARCHAR(191) NOT NULL,
  `workspaceId`              VARCHAR(191) NOT NULL,
  `promptRef`                VARCHAR(191) NOT NULL,
  `memberRef`                VARCHAR(191) NOT NULL,
  `deviceRegistrationRef`    VARCHAR(191) NOT NULL,
  `clientId`                 VARCHAR(191) NOT NULL,
  `responseKind`             VARCHAR(191) NOT NULL,
  `responseClass`            VARCHAR(191) NOT NULL,
  `challengeRef`             VARCHAR(191) NOT NULL,
  `occurredAt`               DATETIME(3) NOT NULL,
  `evaluationUseProhibited`  BOOLEAN NOT NULL,
  `governedResponseJson`     LONGTEXT NULL,
  `governedResponseHash`     VARCHAR(191) NULL,
  `governanceResponseId`     VARCHAR(191) NULL,
  `mandateRef`               VARCHAR(191) NULL,
  `routePath`                VARCHAR(191) NULL,
  `externalAuthorizationRef` VARCHAR(191) NULL,
  `authorizedMemberRef`      VARCHAR(191) NULL,
  `authorizedObjectRef`      VARCHAR(191) NULL,
  `authorizedActionRef`      VARCHAR(191) NULL,
  `createdAt`                DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `MWPromptRespReceipt_id_workspace_key` (`id`, `workspaceId`),
  UNIQUE INDEX `MWPromptRespReceipt_workspace_challenge_key` (`workspaceId`, `challengeRef`),
  INDEX `MWPromptRespReceipt_workspace_prompt_idx` (`workspaceId`, `promptRef`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MemberPromptResponseReceipt`
  ADD CONSTRAINT `MWPromptRespReceipt_kind_check`
    CHECK (`responseKind` IN ('acknowledge', 'refuse', 'pause', 'appeal', 'commitment_confirm')),
  ADD CONSTRAINT `MWPromptRespReceipt_class_check`
    CHECK (`responseClass` IN ('interaction_receipt', 'protected_human_response', 'authority_bearing_action')),
  ADD CONSTRAINT `MWPromptRespReceipt_evaluation_check` CHECK (`evaluationUseProhibited` = TRUE),
  ADD CONSTRAINT `MWPromptRespReceipt_route_path_check`
    CHECK (`routePath` IS NULL OR `routePath` IN ('user_presence', 'local_fallback')),
  ADD CONSTRAINT `MWPromptRespReceipt_governed_hash_check`
    CHECK (`governedResponseHash` IS NULL
      OR (CHAR_LENGTH(`governedResponseHash`) = 71 AND `governedResponseHash` LIKE 'sha256:%'));

CREATE TRIGGER `MemberPromptResponseReceipt_append_only_update`
BEFORE UPDATE ON `MemberPromptResponseReceipt`
FOR EACH ROW
SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'MemberPromptResponseReceipt is append-only';

CREATE TRIGGER `MemberPromptResponseReceipt_append_only_delete`
BEFORE DELETE ON `MemberPromptResponseReceipt`
FOR EACH ROW
SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'MemberPromptResponseReceipt is append-only';
