-- Member Gateway M2b: work-signal persistence layer (spec §5/§6.2).
--
-- `MemberWorkSignalChallenge` rows are one-time-use: challenge consumption
-- (setting `consumedAt` / `consumptionReceiptRef`) is the only permitted
-- mutation, enforced by the store service's CAS `updateMany` guard, not by a
-- trigger. `MemberWorkSignalReceipt` rows are strictly append-only: UPDATE
-- and DELETE are blocked at the database level by the triggers below, so
-- correcting a bad receipt requires writing a new superseding receipt
-- instead of mutating history.
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
CREATE TABLE `MemberWorkSignalChallenge` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `memberRef` VARCHAR(191) NOT NULL,
  `deviceRegistrationRef` VARCHAR(191) NOT NULL,
  `clientId` VARCHAR(191) NOT NULL,
  `objectRef` VARCHAR(191) NOT NULL,
  `objectVersion` INTEGER NOT NULL,
  `payloadHash` VARCHAR(191) NOT NULL,
  `issuedAt` DATETIME(3) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `consumedAt` DATETIME(3) NULL,
  `consumptionReceiptRef` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `MWSignalChallenge_id_workspace_key` (`id`, `workspaceId`),
  INDEX `MWSignalChallenge_workspace_member_idx` (`workspaceId`, `memberRef`),
  CONSTRAINT `MWSignalChallenge_payload_hash_check`
    CHECK (CHAR_LENGTH(`payloadHash`) = 71 AND `payloadHash` LIKE 'sha256:%'),
  CONSTRAINT `MWSignalChallenge_window_check` CHECK (`expiresAt` > `issuedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MemberWorkSignalReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `memberRef` VARCHAR(191) NOT NULL,
  `deviceRegistrationRef` VARCHAR(191) NOT NULL,
  `clientId` VARCHAR(191) NOT NULL,
  `objectRef` VARCHAR(191) NOT NULL,
  `objectVersion` INTEGER NOT NULL,
  `kind` VARCHAR(191) NOT NULL,
  `payloadJson` LONGTEXT NOT NULL,
  `payloadHash` VARCHAR(191) NOT NULL,
  `policyRef` VARCHAR(191) NOT NULL,
  `policyVersion` INTEGER NOT NULL,
  `submittedAt` DATETIME(3) NOT NULL,
  `candidate` BOOLEAN NOT NULL,
  `taint` VARCHAR(191) NOT NULL,
  `challengeRef` VARCHAR(191) NOT NULL,
  `supersedesReceiptRef` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `MWSignalReceipt_id_workspace_key` (`id`, `workspaceId`),
  UNIQUE INDEX `MWSignalReceipt_workspace_challenge_key` (`workspaceId`, `challengeRef`),
  UNIQUE INDEX `MWSignalReceipt_workspace_supersedes_key` (`workspaceId`, `supersedesReceiptRef`),
  INDEX `MWSignalReceipt_workspace_object_idx` (`workspaceId`, `objectRef`),
  CONSTRAINT `MWSignalReceipt_kind_check`
    CHECK (`kind` IN ('progress', 'blocker', 'customer_signal')),
  CONSTRAINT `MWSignalReceipt_candidate_check` CHECK (`candidate` = TRUE),
  CONSTRAINT `MWSignalReceipt_taint_check` CHECK (`taint` = 'untrusted'),
  CONSTRAINT `MWSignalReceipt_payload_hash_check`
    CHECK (CHAR_LENGTH(`payloadHash`) = 71 AND `payloadHash` LIKE 'sha256:%'),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TRIGGER `MemberWorkSignalReceipt_append_only_update`
BEFORE UPDATE ON `MemberWorkSignalReceipt`
FOR EACH ROW
SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'MemberWorkSignalReceipt is append-only';

CREATE TRIGGER `MemberWorkSignalReceipt_append_only_delete`
BEFORE DELETE ON `MemberWorkSignalReceipt`
FOR EACH ROW
SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'MemberWorkSignalReceipt is append-only';
