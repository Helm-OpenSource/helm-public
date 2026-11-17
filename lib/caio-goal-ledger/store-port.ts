import type { CaioGoalLedgerStoredEntry, CaioGoalLedgerStoredHead } from "./chain";
import type { CaioGoalLedgerRouteConfigRow } from "./role-binding";
import type { CaioGoalLedgerSchemaReadiness } from "./schema-readiness";

/**
 * The narrow storage port the goal ledger services run on. The Prisma adapter and the in-memory implementation
 * for tests behave alike. Reads are plain consistent reads, never locking ones, so an identity holding nothing but
 * SELECT can serve every one of them.
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

export type CaioGoalLedgerStore = Readonly<{
  readChain(workspaceId: string): Promise<CaioGoalLedgerChainRows>;
  readActiveRouteConfig(workspaceId: string): Promise<CaioGoalLedgerActiveRouteConfig>;
  /** Does not throw: a probe that cannot run reports `probe_failed`. */
  probeSchemaReadiness(): Promise<CaioGoalLedgerSchemaReadiness>;
}>;

/**
 * A stored row the port cannot express: document columns that are not null together, or a source outside the
 * closed set. The migration's CHECK constraints exclude both, so this means the table is not the migrated one.
 */
export class CaioGoalLedgerStoreError extends Error {
  constructor(readonly code: "row_invalid") {
    super(code);
    this.name = "CaioGoalLedgerStoreError";
  }
}
