import { ActorType, Prisma, type PrismaClient } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit";

import type { CaioGoalLedgerStoredEntry } from "./chain";
import { probeCaioGoalLedgerSchemaReadiness } from "./schema-readiness";
import {
  type CaioGoalLedgerLockedHead,
  type CaioGoalLedgerMembership,
  type CaioGoalLedgerStore,
  CaioGoalLedgerStoreError,
  type CaioGoalLedgerWriteTransaction,
} from "./store-port";

/**
 * Prisma adapter of the goal ledger store port. Reads only take plain SELECTs: no FOR UPDATE, no FOR SHARE. The
 * write transaction needs the write identity: INSERT on the entry table, INSERT and UPDATE on the head anchor.
 */

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

type Client = PrismaClient | Prisma.TransactionClient;

const entryRows = (client: Client, workspaceId: string) => client.caioGoalLedgerEntry.findMany({
  where: { workspaceId }, orderBy: [{ workspaceId: "asc" }, { seq: "asc" }], select: ENTRY_SELECT,
});
const headRow = (client: Client, workspaceId: string) =>
  client.caioGoalLedgerHead.findUnique({ where: { workspaceId }, select: { headSeq: true, headHash: true } });

// REPEATABLE READ keeps the lock-before-read order meaningful whatever the server default is. A large import is
// one transaction, hence the minute.
const WRITE_TRANSACTION = {
  isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 10_000, timeout: 60_000,
} as const;

// Two writers of a ledger's first entry: an anchor that does not exist yet has no row to lock, so both read the
// empty chain and insert the same entry 1. Under REPEATABLE READ each holds a gap lock on the absent anchor, and
// InnoDB breaks the resulting wait cycle as a deadlock (P2034), rolling the loser back whole. A later writer finds
// the anchor row and waits on it instead.
function isLostRace(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

function writeTransaction(tx: Prisma.TransactionClient, workspaceId: string, actorUserId: string): CaioGoalLedgerWriteTransaction {
  return Object.freeze({
    async lockMembership() {
      const rows = await tx.$queryRaw<CaioGoalLedgerMembership[]>`
        SELECT role, status FROM Membership WHERE workspaceId = ${workspaceId} AND userId = ${actorUserId} FOR SHARE`;
      return rows[0] ?? null;
    },
    async lockHead() {
      const rows = await tx.$queryRaw<CaioGoalLedgerLockedHead[]>`
        SELECT headSeq, headHash, rowVersion FROM CaioGoalLedgerHead WHERE workspaceId = ${workspaceId} FOR UPDATE`;
      return rows[0] ?? null;
    },
    async readChain() {
      const entries = await entryRows(tx, workspaceId);
      return { entries: entries.map(toStoredEntry), head: await headRow(tx, workspaceId) };
    },
    readRouteConfigVersion: (version: number) => tx.caioAttentionRouteConfig.findUnique({
      where: { workspaceId_version: { workspaceId, version } }, select: { configJson: true, contentHash: true },
    }),
    async insertEntries(entries) {
      await tx.caioGoalLedgerEntry.createMany({
        data: entries.map(({ document, ...columns }) => ({
          ...columns, workspaceId, recordedByUserId: actorUserId,
          documentFileKey: document?.fileKey ?? null, documentHash: document?.hash ?? null, documentText: document?.text ?? null,
        })),
      });
    },
    async moveHead(from, to) {
      if (from === null) {
        await tx.caioGoalLedgerHead.create({ data: { workspaceId, ...to, updatedByUserId: actorUserId }, select: { id: true } });
        return true;
      }
      const moved = await tx.$executeRaw`
        UPDATE CaioGoalLedgerHead SET headSeq = ${to.headSeq}, headHash = ${to.headHash}, rowVersion = rowVersion + 1,
          updatedByUserId = ${actorUserId}, updatedAt = NOW(3)
        WHERE workspaceId = ${workspaceId} AND rowVersion = ${from.rowVersion}`;
      return moved === 1;
    },
    async writeAudit(record) {
      await writeAuditLog({
        workspaceId, userId: actorUserId, actor: actorUserId, actorType: ActorType.USER, targetType: "CaioGoalLedgerEntry",
        ...record,
      }, { client: tx });
    },
  });
}

export function createPrismaCaioGoalLedgerStore(client: PrismaClient): CaioGoalLedgerStore {
  return Object.freeze({
    async readChain(workspaceId: string) {
      // One snapshot for both reads. An append commits its entry and the moved anchor together; two autocommit reads
      // could fall on either side of it and report a healthy ledger's anchor as mismatched. The level is set
      // explicitly because under READ COMMITTED each statement would see a snapshot of its own.
      const [entries, head] = await client.$transaction([entryRows(client, workspaceId), headRow(client, workspaceId)],
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
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

    async writeTransaction(workspaceId, actorUserId, work) {
      try {
        return await client.$transaction((tx) => work(writeTransaction(tx, workspaceId, actorUserId)), WRITE_TRANSACTION);
      } catch (error) {
        if (isLostRace(error)) throw new CaioGoalLedgerStoreError("write_conflict", { cause: error });
        throw error;
      }
    },
  });
}
