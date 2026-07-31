-- CAIO Pro: record the deployment posture a dispatch receipt was written under.
--
-- The minimal audit receipt has SEVEN fields and posture is the seventh; it is
-- already part of the receipt digest, so two dispatches that differ only in
-- posture are different dispatches. Until now the Prisma store had no column
-- for it and therefore could not compare it, so a duplicate
-- [workspaceId, requestId] arriving from a differently-postured deployment
-- that shared the workspace resolved as an idempotent REPLAY instead of a
-- CONFLICT.
--
-- PHASE 1 OF TWO. THE COLUMN IS NULLABLE, AND NULL IS A MEANING.
--
-- An earlier draft of this migration added the column `NOT NULL` with no
-- default and asserted in this comment that the statement would FAIL if
-- historical rows existed, so a table with unknown-posture rows could not be
-- migrated by accident. THAT ASSERTION WAS FALSE and has been measured to be
-- false. On MySQL 8.4.8 with the default
--   ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,
--   ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION
-- an `ALTER TABLE ... ADD COLUMN x VARCHAR(191) NOT NULL` against a table with
-- existing rows SUCCEEDS and silently backfills every one of them with the
-- EMPTY STRING. Strict mode governs DML, not the implicit default ADD COLUMN
-- materialises for rows that predate it. The draft therefore did the exact
-- thing it claimed to prevent: it invented a posture for rows whose posture is
-- unknown, and made it '' — a value outside the vocabulary, indistinguishable
-- in the digest comparison from a real posture only by luck.
--
-- So the column is NULLABLE here, and NULL is an explicit state with a name:
-- LEGACY UNKNOWN / QUARANTINED. It says "this row predates posture recording
-- and its posture cannot be recovered from the row itself". It is not a
-- default, not a guess, and not a placeholder to be filled in by inference.
-- The store treats it accordingly: a NULL stored posture can never compare
-- EQUAL to a live receipt's posture, so a legacy row can never certify a new
-- dispatch as an idempotent replay. Fail-closed on ignorance.
--
-- THE CLOSED SET IS ENFORCED AT THE DATABASE LAYER, for non-NULL values only.
-- The vocabulary is the one in lib/caio-audit-state/deployment-posture.ts
-- (CAIO_DEPLOYMENT_POSTURES). Application-side parsing already refuses anything
-- else at construction time; the CHECK is the second line, so a row written by
-- anything other than that code path — a repair script, a manual insert, a
-- future adapter — still cannot introduce a third posture or the empty string.
-- Note that `x IN (...)` evaluates to NULL rather than FALSE when x IS NULL and
-- MySQL accepts a CHECK that is not FALSE, so `IS NULL` is stated explicitly
-- rather than relied upon as a side effect of three-valued logic.
--
-- PHASE 2 (NOT WRITTEN, DELIBERATELY). Making this column NOT NULL is a
-- separate migration that is legitimate ONLY after all of the following are
-- true and evidenced. It is not scheduled by this file, and no part of it may
-- be performed by a migration that also alters the column:
--   1. `SELECT COUNT(*) FROM CaioAuditDispatchReceipt WHERE posture IS NULL`
--      returns 0 on the target installation, captured as evidence BEFORE the
--      ALTER and again inside the same maintenance window.
--   2. Every row that was NULL reached its value through an OWNER-RECEIPTED
--      backfill: the owner names the posture each affected installation was
--      running for the period those rows cover, that decision is recorded as
--      an owner receipt referencing the row ids or the [workspaceId, createdAt]
--      range it covers, and the backfill statement sets exactly that set.
--      Deriving the value from the row itself, from the current process
--      posture, or from "whichever posture this deployment uses now" is not a
--      backfill — it is the guess this column exists to prevent.
--   3. Rows whose posture the owner CANNOT attest to are not backfilled. They
--      stay NULL, which means phase 2 cannot run on that installation, which is
--      the correct outcome: an un-attestable audit row must not be laundered
--      into an attested one by a schema change.
--   4. The NOT NULL migration carries no DEFAULT, and is verified against a
--      copy of the target data — not an empty database — because, as measured
--      above, an empty table proves nothing about what this statement does to a
--      populated one.
ALTER TABLE `CaioAuditDispatchReceipt`
  ADD COLUMN `posture` VARCHAR(191) NULL;

ALTER TABLE `CaioAuditDispatchReceipt`
  ADD CONSTRAINT `CaioAuditDispatchReceipt_posture_chk`
  CHECK (
    `posture` IS NULL
    OR `posture` IN ('self_service', 'governed_fde')
  );
