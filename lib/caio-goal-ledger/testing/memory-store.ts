import type { CaioGoalLedgerStoredEntry, CaioGoalLedgerStoredHead } from "../chain";
import type { CaioGoalLedgerRouteConfigRow } from "../role-binding";
import type {
  CaioGoalLedgerAuditRecord,
  CaioGoalLedgerChainRows,
  CaioGoalLedgerMembership,
  CaioGoalLedgerStore,
  CaioGoalLedgerWriteTransaction,
} from "../store-port";

/**
 * In-memory goal ledger store for tests. Reads behave as the Prisma adapter's do: entries come back in ascending
 * seq-column order whatever order they were loaded in, a workspace sees only its own rows, and the active route
 * config is looked up by the head's version. Rows are kept as loaded, broken ones included, so a test can stage
 * any stored state. The schema always reads as ready.
 *
 * Write transactions run one at a time, as the head lock makes them run on one ledger, against a staged copy that
 * replaces the stored rows only when the work resolves. The entry table's three unique keys and the anchor's
 * one-per-workspace key fail an insert as the database's do, with a plain error.
 */

type RouteConfigRows = Readonly<{
  activeVersion: number | null;
  versions: Readonly<Record<number, CaioGoalLedgerRouteConfigRow>>;
}>;

type Ledger = { entries: CaioGoalLedgerStoredEntry[]; head: CaioGoalLedgerStoredHead | null; rowVersion: number };

export type InMemoryAuditRow = CaioGoalLedgerAuditRecord & Readonly<{ actorUserId: string }>;

export type InMemoryCaioGoalLedgerStore = CaioGoalLedgerStore & Readonly<{
  loadChain(workspaceId: string, rows: CaioGoalLedgerChainRows): void;
  loadRouteConfig(workspaceId: string, rows: RouteConfigRows): void;
  loadMembership(workspaceId: string, userId: string, membership: CaioGoalLedgerMembership): void;
  auditRows(workspaceId: string): readonly InMemoryAuditRow[];
}>;

const memberKey = (workspaceId: string, userId: string) => JSON.stringify([workspaceId, userId]);

export function createInMemoryCaioGoalLedgerStore(): InMemoryCaioGoalLedgerStore {
  const ledgers = new Map<string, Ledger>();
  const routeConfigs = new Map<string, RouteConfigRows>();
  const memberships = new Map<string, CaioGoalLedgerMembership>();
  const audits = new Map<string, InMemoryAuditRow[]>();
  // Orders the write transactions only; each caller still receives its own outcome.
  let queue: Promise<unknown> = Promise.resolve();

  const chainOf = (ledger: Ledger | undefined): CaioGoalLedgerChainRows =>
    ({ entries: [...(ledger?.entries ?? [])].sort((a, b) => a.seq - b.seq), head: ledger?.head ?? null });

  async function runStaged<T>(workspaceId: string, actorUserId: string, work: (tx: CaioGoalLedgerWriteTransaction) => Promise<T>) {
    const stored = ledgers.get(workspaceId);
    const staged: Ledger = { entries: [...(stored?.entries ?? [])], head: stored?.head ?? null, rowVersion: stored?.rowVersion ?? 0 };
    const stagedAudit: InMemoryAuditRow[] = [];
    const tx: CaioGoalLedgerWriteTransaction = Object.freeze({
      lockMembership: async () => memberships.get(memberKey(workspaceId, actorUserId)) ?? null,
      lockHead: async () => staged.head && { ...staged.head, rowVersion: staged.rowVersion },
      readChain: async () => chainOf(staged),
      readRouteConfigVersion: async (version: number) => {
        const versions = routeConfigs.get(workspaceId)?.versions;
        return versions !== undefined && Object.hasOwn(versions, version) ? versions[version] : null;
      },
      async insertEntries(entries) {
        for (const entry of entries) {
          const taken = staged.entries.some((row) =>
            row.seq === entry.seq || row.entryHash === entry.entryHash || row.prevHash === entry.prevHash);
          if (taken) throw new Error("duplicate entry key");
          staged.entries.push({ ...entry, createdAt: new Date() });
        }
      },
      async moveHead(from, to) {
        if (from === null) {
          if (staged.head !== null) throw new Error("duplicate anchor key");
        } else if (staged.rowVersion !== from.rowVersion) {
          return false;
        } else {
          staged.rowVersion += 1;
        }
        staged.head = to;
        return true;
      },
      writeAudit: async (record) => {
        stagedAudit.push({ ...record, actorUserId });
      },
    });
    const result = await work(tx);
    ledgers.set(workspaceId, staged);
    audits.set(workspaceId, [...(audits.get(workspaceId) ?? []), ...stagedAudit]);
    return result;
  }

  return Object.freeze({
    loadChain(workspaceId: string, rows: CaioGoalLedgerChainRows) {
      ledgers.set(workspaceId, { entries: [...rows.entries], head: rows.head, rowVersion: 0 });
    },
    loadRouteConfig(workspaceId: string, rows: RouteConfigRows) {
      routeConfigs.set(workspaceId, rows);
    },
    loadMembership(workspaceId: string, userId: string, membership: CaioGoalLedgerMembership) {
      memberships.set(memberKey(workspaceId, userId), membership);
    },
    auditRows: (workspaceId: string) => [...(audits.get(workspaceId) ?? [])],
    async readChain(workspaceId: string) {
      return chainOf(ledgers.get(workspaceId));
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
    writeTransaction<T>(workspaceId: string, actorUserId: string, work: (tx: CaioGoalLedgerWriteTransaction) => Promise<T>) {
      const run = queue.then(() => runStaged(workspaceId, actorUserId, work));
      queue = run.catch(() => undefined);
      return run;
    },
  });
}
