import { Prisma, type PrismaClient } from "@prisma/client";

import type { CaioGoalLedgerStoredEntry } from "./chain";
import { probeCaioGoalLedgerSchemaReadiness } from "./schema-readiness";
import { type CaioGoalLedgerStore, CaioGoalLedgerStoreError } from "./store-port";

/** Prisma adapter of the goal ledger store port. Reads only take plain SELECTs: no FOR UPDATE, no FOR SHARE. */

const ENTRY_SELECT = {
  seq: true, entryHash: true, prevHash: true, entryJson: true, documentFileKey: true, documentHash: true, documentText: true,
  effectiveAt: true, source: true, createdAt: true,
} as const satisfies Prisma.CaioGoalLedgerEntrySelect;

type EntryRow = Prisma.CaioGoalLedgerEntryGetPayload<{ select: typeof ENTRY_SELECT }>;

function toStoredEntry(row: EntryRow): CaioGoalLedgerStoredEntry {
  const { documentFileKey: fileKey, documentHash: hash, documentText: text, source, ...columns } = row;
  if (source !== "command" && source !== "import") throw new CaioGoalLedgerStoreError("row_invalid");
  if (fileKey !== null && hash !== null && text !== null) return { ...columns, source, document: { fileKey, hash, text } };
  if (fileKey === null && hash === null && text === null) return { ...columns, source, document: null };
  throw new CaioGoalLedgerStoreError("row_invalid");
}

export function createPrismaCaioGoalLedgerStore(client: PrismaClient): CaioGoalLedgerStore {
  return Object.freeze({
    async readChain(workspaceId: string) {
      // One snapshot for both reads. An append commits its entry and the moved anchor together; two autocommit reads
      // could fall on either side of it and report a healthy ledger's anchor as mismatched. The level is set
      // explicitly because under READ COMMITTED each statement would see a snapshot of its own.
      const [entries, head] = await client.$transaction([
        client.caioGoalLedgerEntry.findMany({
          where: { workspaceId }, orderBy: [{ workspaceId: "asc" }, { seq: "asc" }], select: ENTRY_SELECT,
        }),
        client.caioGoalLedgerHead.findUnique({ where: { workspaceId }, select: { headSeq: true, headHash: true } }),
      ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
      return { entries: entries.map(toStoredEntry), head };
    },

    async readActiveRouteConfig(workspaceId: string) {
      // A published version's row never changes, so the head and the row need no common snapshot.
      const head = await client.caioAttentionRouteConfigHead.findUnique({ where: { workspaceId }, select: { activeVersion: true } });
      if (head === null) return { activeVersion: null, activeConfig: null };
      const activeConfig = await client.caioAttentionRouteConfig.findUnique({
        where: { workspaceId_version: { workspaceId, version: head.activeVersion } },
        select: { configJson: true, contentHash: true },
      });
      return { activeVersion: head.activeVersion, activeConfig };
    },

    probeSchemaReadiness: () => probeCaioGoalLedgerSchemaReadiness(client),
  });
}
