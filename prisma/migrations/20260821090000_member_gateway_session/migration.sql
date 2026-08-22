-- Member Gateway M2d: session-anchor schema for stage-two fact promotion
-- (docs/superpowers/specs/2026-08-20-member-gateway-stage-two-fact-promotion-design.md
-- §2.1, Owner 裁定记录 #1). Introduces `MemberGatewaySession` — the
-- first-class, fixed-window session anchor opened per
-- (workspace, memberRef, deviceRegistrationRef, clientId) tuple on first
-- challenge issuance and reused within the window
-- (lib/member-gateway/gateway-session.ts) — and threads a nullable
-- `gatewaySessionRef` through the four existing challenge/receipt tables so
-- issuance-time session identity can be stamped onto every downstream
-- write. `MemoryCandidate` gets the alignment-A dual anchor: its existing
-- `runtimeSessionId` becomes nullable and a new nullable
-- `memberGatewaySessionRef` column is added, with a CHECK enforcing exactly
-- one anchor is set. Historical receipts predating this migration keep
-- `gatewaySessionRef = NULL` permanently (no backfill, no manual re-anchor
-- tool — Owner 裁定记录 #2): they remain eligible for stage-one task
-- promotion but can never feed stage-two memory-candidate promotion.
--
-- First-ever ALTER against tables carrying the append-only UPDATE/DELETE
-- triggers introduced by the 20260819120000 and 20260820120000/180000
-- member-gateway migrations (MemberWorkSignalReceipt,
-- MemberPromptTransitionReceipt, MemberPromptResponseReceipt): an
-- `ALTER TABLE ... ADD COLUMN` is DDL, which MySQL executes without firing
-- row-level BEFORE UPDATE/BEFORE DELETE triggers, so the append-only guards
-- on those tables are unaffected by adding the new nullable column here.
--
-- This migration defines no CREATE TRIGGER/CREATE FUNCTION statements of
-- its own, so — unlike the 20260723230000 egress migration and the
-- 20260819120000/20260820120000/20260820180000 member-gateway migrations —
-- it does NOT require log_bin_trust_function_creators=1 (or SUPER) to apply
-- locally; the MySQL 1419 failure mode those migrations document does not
-- apply here.
--
-- CHECK constraints are hand-authored enhancements layered on top of the
-- Prisma-generated shape; they are invisible to `check:migration-drift`'s
-- datamodel comparison, which only diffs column/index/relation shape
-- against `schema.prisma`. This migration follows the current Prisma
-- `relationMode = "prisma"` truth and therefore does not hand-author new
-- database foreign keys for `MemberGatewaySession.workspaceId` or for any
-- of the new `gatewaySessionRef` columns.
--
-- `MemoryCandidate.runtimeSessionId` is the one exception: the
-- 202604150001 baseline migration (pre-dating the `relationMode = "prisma"`
-- switch) hand-authored a REAL MySQL foreign key,
-- `MemoryCandidate_runtimeSessionId_fkey`, referencing
-- `RuntimeSession(id)` ON DELETE CASCADE ON UPDATE CASCADE. A plain
-- `MODIFY COLUMN ... NULL` alone would have been sufficient (InnoDB does
-- not enforce an FK against a NULL column value) — but MySQL additionally
-- rejects the `MemoryCandidate_anchor_check` CHECK constraint below with
-- error 3823 ("Column 'runtimeSessionId' cannot be used in a check
-- constraint ... needed in a foreign key constraint's referential action")
-- as long as that FK's CASCADE action is live: verified empirically against
-- the local dev database, not merely inferred from docs. So this migration
-- explicitly DROPs `MemoryCandidate_runtimeSessionId_fkey` (and the
-- FK-support index MySQL auto-created for it, which carries the same name)
-- before adding the CHECK. This brings `MemoryCandidate` in line with every
-- other member-gateway-era table: no hand-authored database FK, matching
-- the current `relationMode = "prisma"` truth. The behavioral consequence:
-- Prisma Client's relationMode="prisma" emulation still enforces
-- ON DELETE CASCADE for calls that go through the query engine, but a raw
-- SQL DELETE against RuntimeSession will no longer cascade-delete
-- MemoryCandidate rows at the database level. No code path in this repo is
-- known to delete RuntimeSession via raw SQL; this is flagged for owner
-- awareness rather than treated as a behavior change in need of a
-- workaround.
--
-- Index coverage after the drop: the FK-support index being dropped here
-- (`MemoryCandidate_runtimeSessionId_fkey`, a bare single-column key MySQL
-- auto-created because no pre-existing index led with `runtimeSessionId`)
-- is redundant, not load-bearing. `MemoryCandidate_workspaceId_runtimeSess
-- ionId_createdAt_idx` (`workspaceId`, `runtimeSessionId`, `createdAt`,
-- from the baseline migration, `@@index([workspaceId, runtimeSessionId,
-- createdAt])` in schema.prisma) already covers every tenant-scoped lookup
-- by `runtimeSessionId` this codebase performs (every query in this repo
-- filters by `workspaceId` first — see e.g.
-- lib/member-gateway/signal-store.service.ts's lockWorkspace pattern); a
-- bare `runtimeSessionId`-only index would only matter for a
-- cross-workspace scan, which no code path here does. No replacement index
-- is added.
ALTER TABLE `MemoryCandidate`
  DROP FOREIGN KEY `MemoryCandidate_runtimeSessionId_fkey`;

ALTER TABLE `MemoryCandidate`
  DROP INDEX `MemoryCandidate_runtimeSessionId_fkey`;
CREATE TABLE `MemberGatewaySession` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `memberRef` VARCHAR(191) NOT NULL,
  `deviceRegistrationRef` VARCHAR(191) NOT NULL,
  `clientId` VARCHAR(191) NOT NULL,
  `openedAt` DATETIME(3) NOT NULL,
  `closedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `MWGatewaySession_id_workspace_key` (`id`, `workspaceId`),
  INDEX `MWGatewaySession_tuple_opened_idx` (`workspaceId`, `memberRef`, `deviceRegistrationRef`, `clientId`, `openedAt`),
  CONSTRAINT `MWGatewaySession_closed_after_opened_check`
    CHECK (`closedAt` IS NULL OR `closedAt` > `openedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Issuance-time session stamp on the generic one-time member-write
-- challenge table (reused by both work signals and prompt responses, spec
-- §6.2/M3c Architecture #3) and on the three append-only receipt tables
-- that anchor writes to it.
ALTER TABLE `MemberWorkSignalChallenge`
  ADD COLUMN `gatewaySessionRef` VARCHAR(191) NULL;

ALTER TABLE `MemberWorkSignalReceipt`
  ADD COLUMN `gatewaySessionRef` VARCHAR(191) NULL;

ALTER TABLE `MemberPromptTransitionReceipt`
  ADD COLUMN `gatewaySessionRef` VARCHAR(191) NULL;

ALTER TABLE `MemberPromptResponseReceipt`
  ADD COLUMN `gatewaySessionRef` VARCHAR(191) NULL;

-- MemoryCandidate dual anchor (alignment A): runtimeSessionId becomes
-- optional, memberGatewaySessionRef is added, and exactly one of the two
-- must be set. The FK that previously covered runtimeSessionId was already
-- dropped above (see header note) so the CHECK below can be added.
ALTER TABLE `MemoryCandidate`
  MODIFY COLUMN `runtimeSessionId` VARCHAR(191) NULL,
  ADD COLUMN `memberGatewaySessionRef` VARCHAR(191) NULL,
  ADD CONSTRAINT `MemoryCandidate_anchor_check`
    CHECK ((`runtimeSessionId` IS NULL) <> (`memberGatewaySessionRef` IS NULL));

CREATE INDEX `MemoryCandidate_workspace_mgws_idx`
  ON `MemoryCandidate` (`workspaceId`, `memberGatewaySessionRef`, `createdAt`);
