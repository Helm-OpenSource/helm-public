import type { MembershipStatus, WorkspaceRole } from "@prisma/client";

import type { CaioGoalLedgerStoredEntry, CaioGoalLedgerStoredHead } from "./chain";
import type { CaioGoalLedgerRouteConfigRow } from "./role-binding";
import type { CaioGoalLedgerSchemaReadiness } from "./schema-readiness";

/**
 * The narrow storage port the goal ledger services run on. The Prisma adapter and the in-memory implementation
 * for tests behave alike. Reads are plain consistent reads, never locking ones, so an identity holding nothing but
 * SELECT can serve every one of them. Writes run in a write transaction, whose steps the write service orders.
 */

/** A workspace's entry rows in ascending seq-column order and its head anchor, both from one snapshot. */
export type CaioGoalLedgerChainRows = Readonly<{
  entries: readonly CaioGoalLedgerStoredEntry[];
  head: CaioGoalLedgerStoredHead | null;
}>;

/** The attention route config head's version (null without a head) and that version's stored row (null when missing). */
export type CaioGoalLedgerActiveRouteConfig = Readonly<{
  activeVersion: number | null;
  activeConfig: CaioGoalLedgerRouteConfigRow | null;
}>;

export type CaioGoalLedgerMembership = Readonly<{ role: WorkspaceRole; status: MembershipStatus }>;

/** The head anchor as locked for a write, with the row version its compare-and-set move expects. */
export type CaioGoalLedgerLockedHead = CaioGoalLedgerStoredHead & Readonly<{ rowVersion: number }>;

/** A row to insert: every stored column but the time the database records it at. */
export type CaioGoalLedgerNewEntry = Omit<CaioGoalLedgerStoredEntry, "createdAt">;

/** An audit row about a write; the store adds the workspace, the actor and the target type. */
export type CaioGoalLedgerAuditRecord = Readonly<{
  actionType: "CAIO_GOAL_LEDGER_ENTRY_APPENDED" | "CAIO_GOAL_LEDGER_CHAIN_IMPORTED";
  targetId: string;
  summary: string;
  payload: Readonly<Record<string, string | number>>;
}>;

/**
 * One write transaction on one workspace's ledger for one actor; the rows it writes carry that actor. The two
 * locking reads must come before any plain read: a REPEATABLE READ snapshot starts at the first plain read, so it
 * then includes everything committed before the locks were granted.
 */
export type CaioGoalLedgerWriteTransaction = Readonly<{
  /** The actor's membership, read FOR SHARE so a role change waits for the write to end; null without one. */
  lockMembership(): Promise<CaioGoalLedgerMembership | null>;
  /** The head anchor, read FOR UPDATE so a second writer waits here; null on a ledger without one. */
  lockHead(): Promise<CaioGoalLedgerLockedHead | null>;
  /** Plain reads, as readChain returns them, this transaction's own writes included. */
  readChain(): Promise<CaioGoalLedgerChainRows>;
  /** The stored row of an attention route config version, active or not; null when there is none. */
  readRouteConfigVersion(version: number): Promise<CaioGoalLedgerRouteConfigRow | null>;
  insertEntries(entries: readonly CaioGoalLedgerNewEntry[]): Promise<void>;
  /** Inserts the first anchor (`from` null) or moves the locked one by compare-and-set; false when no row moved. */
  moveHead(from: CaioGoalLedgerLockedHead | null, to: CaioGoalLedgerStoredHead): Promise<boolean>;
  writeAudit(record: CaioGoalLedgerAuditRecord): Promise<void>;
}>;

export type CaioGoalLedgerStore = Readonly<{
  readChain(workspaceId: string): Promise<CaioGoalLedgerChainRows>;
  readActiveRouteConfig(workspaceId: string): Promise<CaioGoalLedgerActiveRouteConfig>;
  /** Does not throw: a probe that cannot run reports `probe_failed`. */
  probeSchemaReadiness(): Promise<CaioGoalLedgerSchemaReadiness>;
  /**
   * Runs `work` in one transaction: everything commits when it resolves and nothing when it throws. Losing a race
   * that the database settles by rolling the transaction back surfaces as CaioGoalLedgerStoreError("write_conflict").
   */
  writeTransaction<T>(
    workspaceId: string,
    actorUserId: string,
    work: (tx: CaioGoalLedgerWriteTransaction) => Promise<T>,
  ): Promise<T>;
}>;

/**
 * `row_invalid`: a stored row the port cannot express, with document columns that are not null together or a
 * source outside the closed set. The migration's CHECK constraints exclude both, so the table is not the migrated
 * one. `write_conflict`: a write lost a race with another writer of the same ledger and was rolled back whole.
 */
export class CaioGoalLedgerStoreError extends Error {
  constructor(readonly code: "row_invalid" | "write_conflict", options?: ErrorOptions) {
    super(code, options);
    this.name = "CaioGoalLedgerStoreError";
  }
}
