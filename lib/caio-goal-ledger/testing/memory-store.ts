import type { CaioGoalLedgerRouteConfigRow } from "../role-binding";
import type { CaioGoalLedgerChainRows, CaioGoalLedgerStore } from "../store-port";

/**
 * In-memory goal ledger store for tests. Reads behave as the Prisma adapter's do: entries come back in ascending
 * seq-column order whatever order they were loaded in, a workspace sees only its own rows, and the active route
 * config is looked up by the head's version. Rows are kept as loaded, broken ones included, so a test can stage
 * any stored state. The schema always reads as ready.
 */

type RouteConfigRows = Readonly<{
  activeVersion: number | null;
  versions: Readonly<Record<number, CaioGoalLedgerRouteConfigRow>>;
}>;

export type InMemoryCaioGoalLedgerStore = CaioGoalLedgerStore & Readonly<{
  loadChain(workspaceId: string, rows: CaioGoalLedgerChainRows): void;
  loadRouteConfig(workspaceId: string, rows: RouteConfigRows): void;
}>;

export function createInMemoryCaioGoalLedgerStore(): InMemoryCaioGoalLedgerStore {
  const chains = new Map<string, CaioGoalLedgerChainRows>();
  const routeConfigs = new Map<string, RouteConfigRows>();
  return Object.freeze({
    loadChain(workspaceId: string, rows: CaioGoalLedgerChainRows) {
      chains.set(workspaceId, { entries: [...rows.entries], head: rows.head });
    },
    loadRouteConfig(workspaceId: string, rows: RouteConfigRows) {
      routeConfigs.set(workspaceId, rows);
    },
    async readChain(workspaceId: string) {
      const chain = chains.get(workspaceId);
      return { entries: [...(chain?.entries ?? [])].sort((a, b) => a.seq - b.seq), head: chain?.head ?? null };
    },
    async readActiveRouteConfig(workspaceId: string) {
      const rows = routeConfigs.get(workspaceId);
      const activeVersion = rows?.activeVersion ?? null;
      if (rows === undefined || activeVersion === null) return { activeVersion: null, activeConfig: null };
      return { activeVersion, activeConfig: Object.hasOwn(rows.versions, activeVersion) ? rows.versions[activeVersion] : null };
    },
    async probeSchemaReadiness() {
      return { ready: true } as const;
    },
  });
}
