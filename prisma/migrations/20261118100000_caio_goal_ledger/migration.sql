-- CAIO goal ledger (2026-11-18): one append-only, hash-chained goal ledger per workspace, and its head anchor.
-- New tables only; no existing table is touched.
--
-- Write model (enforced by grants, see lib/caio-goal-ledger/least-privilege-fixture.ts; no triggers):
--   * CaioGoalLedgerEntry: append-only. The controlled operator identity holds SELECT/INSERT only, so an entry can
--     never be changed or removed; every other identity reads.
--   * CaioGoalLedgerHead: one row per workspace, operator identity only, optimistic on rowVersion. It catches a
--     truncated tail, which leaves the chain itself consistent.
--
-- The chain is verified from the stored text, never from the columns: entryJson is the entry's canonical JSON
-- (its timestamps stay text, which a DATETIME would lose), documentText is the goal document byte for byte. seq,
-- the hashes and effectiveAt are derived columns kept beside the text for uniqueness and lookups. The three unique
-- keys carry concurrency: one entry per seq, per hash, and per predecessor, so a chain cannot fork in the database.
--
-- No database foreign keys (relationMode = "prisma"). Replay-safe (IF NOT EXISTS).
-- Rollback: prisma/rollback/20261118_rollback_caio_goal_ledger.sql.

CREATE TABLE IF NOT EXISTS `CaioGoalLedgerEntry` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `seq` INTEGER NOT NULL,
    `entryHash` VARCHAR(191) NOT NULL,
    `prevHash` VARCHAR(191) NOT NULL,
    `entryJson` LONGTEXT NOT NULL,
    `documentFileKey` VARCHAR(191) NULL,
    `documentHash` VARCHAR(191) NULL,
    `documentText` LONGTEXT NULL,
    `effectiveAt` DATETIME(3) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `recordedByUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CaioGoalLedgerEntry_workspaceId_seq_key`(`workspaceId`, `seq`),
    UNIQUE INDEX `CaioGoalLedgerEntry_workspaceId_entryHash_key`(`workspaceId`, `entryHash`),
    UNIQUE INDEX `CaioGoalLedgerEntry_workspaceId_prevHash_key`(`workspaceId`, `prevHash`),
    PRIMARY KEY (`id`),
    CONSTRAINT `CaioGoalLedgerEntry_seq_check` CHECK (`seq` >= 1),
    CONSTRAINT `CaioGoalLedgerEntry_hash_check` CHECK (CHAR_LENGTH(`entryHash`) = 64 AND CHAR_LENGTH(`prevHash`) = 64),
    -- The first entry, and only the first, links to 64 zeros.
    CONSTRAINT `CaioGoalLedgerEntry_genesis_check` CHECK ((`seq` = 1) =
      (`prevHash` = '0000000000000000000000000000000000000000000000000000000000000000')),
    CONSTRAINT `CaioGoalLedgerEntry_source_check` CHECK (`source` IN ('command', 'import')),
    CONSTRAINT `CaioGoalLedgerEntry_entry_json_check` CHECK (JSON_VALID(`entryJson`)),
    -- An entry carries its goal document whole or not at all.
    CONSTRAINT `CaioGoalLedgerEntry_document_check` CHECK (
      (`documentFileKey` IS NULL AND `documentHash` IS NULL AND `documentText` IS NULL)
      OR (`documentFileKey` IS NOT NULL AND `documentHash` IS NOT NULL AND `documentText` IS NOT NULL
        AND CHAR_LENGTH(`documentHash`) = 64 AND JSON_VALID(`documentText`)))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CaioGoalLedgerHead` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `headSeq` INTEGER NOT NULL,
    `headHash` VARCHAR(191) NOT NULL,
    `rowVersion` INTEGER NOT NULL DEFAULT 0,
    `updatedByUserId` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CaioGoalLedgerHead_workspaceId_key`(`workspaceId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `CaioGoalLedgerHead_version_check` CHECK (`headSeq` >= 1 AND `rowVersion` >= 0),
    CONSTRAINT `CaioGoalLedgerHead_hash_check` CHECK (CHAR_LENGTH(`headHash`) = 64)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
