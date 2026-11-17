import { MembershipStatus, WorkspaceRole } from "@prisma/client";

import { canonicalizeCaioGoalLedgerJson, computeCaioGoalLedgerEntryHash, sha256HexOfCaioGoalLedgerText } from "./canonical-json";
import { type CaioGoalLedgerAlarmCode, type CaioGoalLedgerChainRead, verifyCaioGoalLedgerChain } from "./chain";
import {
  CAIO_GOAL_LEDGER_DOCUMENT_FILE_KEY,
  CAIO_GOAL_LEDGER_ENTRY_SCHEMA_VERSION,
  CAIO_GOAL_LEDGER_GENESIS_PREV_HASH,
  type CaioGoalLedgerDocument,
  parseCaioGoalLedgerDocument,
  parseCaioGoalLedgerEntry,
  parseCaioGoalLedgerTimestamp,
} from "./contracts";
import { verifyCaioGoalLedgerRoleBindingPin } from "./role-binding";
import {
  type CaioGoalLedgerChainRows,
  type CaioGoalLedgerLockedHead,
  type CaioGoalLedgerNewEntry,
  type CaioGoalLedgerStore,
  CaioGoalLedgerStoreError,
  type CaioGoalLedgerWriteTransaction,
} from "./store-port";

/**
 * CAIO goal ledger writes, on the store port. The ledger only grows: an append adds one entry, an import adds the
 * entries a bundle has beyond the stored chain. Each write runs in one transaction that first re-checks that the
 * actor is an ACTIVE OWNER and verifies the whole stored chain, and refuses with a closed reason; a refused write
 * leaves no row behind, audit row included.
 */

export const CAIO_GOAL_LEDGER_WRITE_REFUSAL_REASONS = [
  "not_owner", "entry_invalid", "document_invalid", "prose_carries_value", "effective_at_in_future",
  "effective_at_regression", "chain_rejected", "head_conflict", "bundle_chain_invalid", "import_fork", "document_missing",
  "head_document_missing", "document_hash_mismatch", "role_binding_pin_invalid", "storage_roundtrip_mismatch",
] as const;
export type CaioGoalLedgerWriteRefusalReason = (typeof CAIO_GOAL_LEDGER_WRITE_REFUSAL_REASONS)[number];

/** `atSeq` names the entry position a chain or bundle refusal points at, when there is one. */
export class CaioGoalLedgerWriteRefusal extends Error {
  constructor(readonly reason: CaioGoalLedgerWriteRefusalReason, readonly atSeq: number | null = null, options?: ErrorOptions) {
    super(atSeq === null ? reason : `${reason} at ${atSeq}`, options);
    this.name = "CaioGoalLedgerWriteRefusal";
  }
}

// actorUserId is the value the caller declares. The write re-checks that it is an ACTIVE OWNER of the workspace but
// does not authenticate it; authenticating whoever names it is the caller's responsibility.
type WriteIdentity = Readonly<{ workspaceId: string; actorUserId: string }>;

/** `expectedHeadHash` is the head the writer saw: the genesis hash (64 zeros) on an empty ledger. */
export type CaioGoalLedgerAppendInput = WriteIdentity & Readonly<{
  ownerQuote: string;
  change: string;
  effectiveAt: string;
  expectedHeadHash: string;
  document: unknown;
}>;

/** `entries` are the bundle's chain lines, parsed, in order; `documents` maps a sealed digest to its exact text. */
export type CaioGoalLedgerImportInput = WriteIdentity & Readonly<{
  documentFileKey: string;
  entries: readonly unknown[];
  documents: Readonly<Record<string, string>>;
}>;

const AUDIT_SUMMARY = {
  append: "CAIO goal ledger entry appended (seq and digests only)",
  import: "CAIO goal ledger chain imported (seq range and digests only)",
} as const;

function refuse(reason: CaioGoalLedgerWriteRefusalReason, atSeq: number | null = null): never {
  throw new CaioGoalLedgerWriteRefusal(reason, atSeq);
}

function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// Steps 1 to 3 of every write: owner re-check, head lock, then the first plain read, of the whole chain.
async function lockLedger(tx: CaioGoalLedgerWriteTransaction) {
  const membership = await tx.lockMembership();
  if (membership?.role !== WorkspaceRole.OWNER || membership.status !== MembershipStatus.ACTIVE) refuse("not_owner");
  const lockedHead = await tx.lockHead();
  const rows = await tx.readChain();
  const read = verifyCaioGoalLedgerChain(rows);
  if (read.state === "rejected") refuse("chain_rejected", read.alarm.atSeq);
  return { lockedHead, rows, read };
}

async function writeLedger<T>(
  store: CaioGoalLedgerStore,
  identity: WriteIdentity,
  work: (tx: CaioGoalLedgerWriteTransaction, locked: Awaited<ReturnType<typeof lockLedger>>) => Promise<T>,
): Promise<T> {
  try {
    return await store.writeTransaction(identity.workspaceId, identity.actorUserId, async (tx) => work(tx, await lockLedger(tx)));
  } catch (error) {
    if (error instanceof CaioGoalLedgerStoreError && error.code === "write_conflict") {
      throw new CaioGoalLedgerWriteRefusal("head_conflict", null, { cause: error });
    }
    throw error;
  }
}

// The pinned version need not be active; only the document about to become the head is checked.
async function checkRoleBindingPin(tx: CaioGoalLedgerWriteTransaction, document: CaioGoalLedgerDocument) {
  const pinned = document.roleBindingPin === null ? null : await tx.readRouteConfigVersion(document.roleBindingPin.version);
  if (!verifyCaioGoalLedgerRoleBindingPin(document, pinned).ok) refuse("role_binding_pin_invalid");
}

// Insert, move the anchor, then read the chain back and verify it before anything else is written.
async function commitEntries(
  tx: CaioGoalLedgerWriteTransaction,
  lockedHead: CaioGoalLedgerLockedHead | null,
  entries: readonly CaioGoalLedgerNewEntry[],
) {
  const last = entries[entries.length - 1];
  await tx.insertEntries(entries);
  if (!(await tx.moveHead(lockedHead, { headSeq: last.seq, headHash: last.entryHash }))) refuse("head_conflict");
  const reread = verifyCaioGoalLedgerChain(await tx.readChain());
  if (reread.state !== "ok" || reread.head.seq !== last.seq || reread.head.entryHash !== last.entryHash) {
    refuse("storage_roundtrip_mismatch");
  }
}

function sealAppendedEntry(
  input: CaioGoalLedgerAppendInput,
  rows: CaioGoalLedgerChainRows,
  at: Readonly<{ now: Date; effectiveAt: number }>,
  document: CaioGoalLedgerDocument,
) {
  const documentText = canonicalizeCaioGoalLedgerJson(document);
  if (!documentText.ok) refuse("document_invalid");
  const documentHash = sha256HexOfCaioGoalLedgerText(documentText.text);
  if (!documentHash.ok) refuse("document_invalid");
  const seq = rows.entries.length + 1;
  const body = {
    seq,
    ts: at.now.toISOString(),
    owner_quote: input.ownerQuote,
    change: input.change,
    files: { [CAIO_GOAL_LEDGER_DOCUMENT_FILE_KEY]: documentHash.hash },
    prev_hash: input.expectedHeadHash,
    writer: `user:${input.actorUserId}`,
    effective_at: input.effectiveAt,
    schema: CAIO_GOAL_LEDGER_ENTRY_SCHEMA_VERSION,
  };
  const sealed = computeCaioGoalLedgerEntryHash(body);
  if (!sealed.ok) refuse("entry_invalid");
  const entry = { ...body, hash: sealed.hash };
  const entryJson = canonicalizeCaioGoalLedgerJson(entry);
  if (!parseCaioGoalLedgerEntry(entry).ok || !entryJson.ok) refuse("entry_invalid");
  return {
    seq,
    entryHash: sealed.hash,
    prevHash: input.expectedHeadHash,
    entryJson: entryJson.text,
    document: { fileKey: CAIO_GOAL_LEDGER_DOCUMENT_FILE_KEY, hash: documentHash.hash, text: documentText.text },
    effectiveAt: new Date(at.effectiveAt),
    source: "command",
  } as const satisfies CaioGoalLedgerNewEntry;
}

/**
 * Appends one entry on top of `expectedHeadHash`. The effective time may not lie ahead of `now` nor before the
 * previous entry's; the document is stored as canonical JSON under the fixed files key.
 */
export async function appendCaioGoalLedgerEntry(store: CaioGoalLedgerStore, input: CaioGoalLedgerAppendInput, now = new Date()) {
  return writeLedger(store, input, async (tx, { lockedHead, rows, read }) => {
    const headHash = read.state === "ok" ? read.head.entryHash : CAIO_GOAL_LEDGER_GENESIS_PREV_HASH;
    if (input.expectedHeadHash !== headHash) refuse("head_conflict");
    const effectiveAt = parseCaioGoalLedgerTimestamp(input.effectiveAt);
    if (effectiveAt === null) refuse("entry_invalid");
    if (effectiveAt > now.getTime()) refuse("effective_at_in_future");
    const previous = rows.entries[rows.entries.length - 1];
    if (previous !== undefined && effectiveAt < previous.effectiveAt.getTime()) refuse("effective_at_regression");
    const document = parseCaioGoalLedgerDocument(input.document);
    if (!document.ok) refuse(document.errorCode);
    await checkRoleBindingPin(tx, document.document);
    const entry = sealAppendedEntry(input, rows, { now, effectiveAt }, document.document);
    await commitEntries(tx, lockedHead, [entry]);
    const result = { seq: entry.seq, entryHash: entry.entryHash, prevHash: entry.prevHash, documentHash: entry.document.hash };
    await tx.writeAudit({
      actionType: "CAIO_GOAL_LEDGER_ENTRY_APPENDED", targetId: entry.entryHash, summary: AUDIT_SUMMARY.append,
      payload: { ...result, source: entry.source },
    });
    return result;
  });
}

const BUNDLE_ALARMS: Partial<Record<CaioGoalLedgerAlarmCode, CaioGoalLedgerWriteRefusalReason>> = {
  document_hash_mismatch: "document_hash_mismatch",
  document_missing: "head_document_missing",
  document_invalid: "document_invalid",
};

/**
 * The bundle as the rows it would be stored as, verified on its own before any lock: links and hashes, every
 * document text given against its sealed digest, and the last entry's document in full. A history entry whose
 * document text the bundle leaves out is kept without one; whether that is allowed depends on the stored chain.
 */
function sealBundle(input: CaioGoalLedgerImportInput) {
  const entries: CaioGoalLedgerNewEntry[] = [];
  const sealsDocument: boolean[] = [];
  for (const [index, raw] of input.entries.entries()) {
    const parsed = parseCaioGoalLedgerEntry(raw);
    const entryJson = canonicalizeCaioGoalLedgerJson(raw);
    if (!parsed.ok || !entryJson.ok) refuse("bundle_chain_invalid", index + 1);
    const { entry } = parsed;
    const digest = Object.hasOwn(entry.files, input.documentFileKey) ? entry.files[input.documentFileKey] : null;
    const text = digest !== null && Object.hasOwn(input.documents, digest) ? input.documents[digest] : null;
    sealsDocument.push(digest !== null);
    entries.push({
      seq: entry.seq,
      entryHash: entry.hash,
      prevHash: entry.prev_hash,
      entryJson: entryJson.text,
      document: digest !== null && text !== null ? { fileKey: input.documentFileKey, hash: digest, text } : null,
      // The entry schema accepts only timestamps this parses.
      effectiveAt: new Date(parseCaioGoalLedgerTimestamp(entry.effective_at ?? entry.ts)!),
      source: "import",
    });
  }
  const last = entries[entries.length - 1];
  if (last === undefined) refuse("bundle_chain_invalid");
  const read: CaioGoalLedgerChainRead = verifyCaioGoalLedgerChain({
    entries: entries.map((entry) => ({ ...entry, createdAt: new Date(0) })),
    head: { headSeq: last.seq, headHash: last.entryHash },
  });
  if (read.state === "rejected") {
    const { code, atSeq } = read.alarm;
    // The verifier reports a prose refusal as document_invalid; parse the head document again for the exact reason.
    const head = code === "document_invalid" && last.document !== null ? parseCaioGoalLedgerDocument(parseJsonText(last.document.text)) : null;
    refuse(head !== null && !head.ok ? head.errorCode : BUNDLE_ALARMS[code] ?? "bundle_chain_invalid", atSeq);
  }
  if (read.state !== "ok") refuse("bundle_chain_invalid");
  return { entries, sealsDocument, headDocument: read.document, head: read.head };
}

/**
 * Imports a bundle whose chain extends the stored one: the stored entries must be its prefix, hash for hash, and
 * only the entries beyond them are added. Re-importing the same chain writes nothing.
 */
export async function importCaioGoalLedgerChain(store: CaioGoalLedgerStore, input: CaioGoalLedgerImportInput) {
  const bundle = sealBundle(input);
  return writeLedger(store, input, async (tx, { lockedHead, rows }) => {
    const stored = rows.entries;
    const fork = stored.findIndex((row, index) => row.entryHash !== bundle.entries[index]?.entryHash);
    if (fork !== -1) refuse("import_fork", fork + 1);
    const head = { seq: bundle.head.seq, entryHash: bundle.head.entryHash, documentHash: bundle.head.documentHash };
    if (stored.length === bundle.entries.length) return { appended: 0, replayed: true, ...head };
    const added = bundle.entries.slice(stored.length);
    const missing = added.find((entry, index) => bundle.sealsDocument[stored.length + index] && entry.document === null);
    if (missing !== undefined) refuse("document_missing", missing.seq);
    await checkRoleBindingPin(tx, bundle.headDocument);
    await commitEntries(tx, lockedHead, added);
    await tx.writeAudit({
      actionType: "CAIO_GOAL_LEDGER_CHAIN_IMPORTED", targetId: head.entryHash, summary: AUDIT_SUMMARY.import,
      payload: {
        fromSeq: added[0].seq, toSeq: head.seq, entryHash: head.entryHash, prevHash: added[0].prevHash,
        documentHash: head.documentHash, source: "import",
      },
    });
    return { appended: added.length, replayed: false, ...head };
  });
}
