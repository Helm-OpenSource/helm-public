import { type CaioGoalLedgerChainRead, verifyCaioGoalLedgerChain } from "./chain";
import type { CaioGoalLedgerDocument } from "./contracts";
import { type CaioGoalLedgerRoleBindingResolution, resolveCaioGoalLedgerRoleBindings } from "./role-binding";
import type { CaioGoalLedgerActiveRouteConfig, CaioGoalLedgerChainRows, CaioGoalLedgerStore } from "./store-port";

/**
 * CAIO goal ledger reads, on the store port; nothing here writes. Every read verifies the whole chain from entry 1
 * to the head, with no cache, so one break anywhere rejects the ledger. A ledger that cannot be read is
 * `unavailable`, never `empty`.
 */

export type CaioGoalLedgerRead =
  | CaioGoalLedgerChainRead
  | { state: "unavailable"; reason: "schema_not_ready" | "read_failed" };

export async function readCaioGoalLedger(
  store: CaioGoalLedgerStore,
  input: Readonly<{ workspaceId: string }>,
): Promise<CaioGoalLedgerRead> {
  let rows: CaioGoalLedgerChainRows;
  try {
    rows = await store.readChain(input.workspaceId);
  } catch {
    // Only a schema known to be incomplete is schema_not_ready; a probe that failed as well learned nothing about it.
    const readiness = await store.probeSchemaReadiness();
    const schemaIncomplete = !readiness.ready && readiness.reason === "schema_incomplete";
    return { state: "unavailable", reason: schemaIncomplete ? "schema_not_ready" : "read_failed" };
  }
  return verifyCaioGoalLedgerChain(rows);
}

export type CaioGoalLedgerRoleBindingRead = CaioGoalLedgerRoleBindingResolution | { state: "unavailable" };

/** People for the role binding pin of a head document that `readCaioGoalLedger` returned as `ok`. */
export async function readCaioGoalLedgerRoleBindings(
  store: CaioGoalLedgerStore,
  input: Readonly<{ workspaceId: string; pin: NonNullable<CaioGoalLedgerDocument["roleBindingPin"]> }>,
): Promise<CaioGoalLedgerRoleBindingRead> {
  let active: CaioGoalLedgerActiveRouteConfig;
  try {
    active = await store.readActiveRouteConfig(input.workspaceId);
  } catch {
    return { state: "unavailable" };
  }
  return resolveCaioGoalLedgerRoleBindings(input.pin, active);
}
