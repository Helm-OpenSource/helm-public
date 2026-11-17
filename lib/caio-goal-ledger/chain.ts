import { computeCaioGoalLedgerEntryHash, sha256HexOfCaioGoalLedgerText } from "./canonical-json";
import {
  CAIO_GOAL_LEDGER_GENESIS_PREV_HASH,
  type CaioGoalLedgerDocument,
  type CaioGoalLedgerEntry,
  parseCaioGoalLedgerDocument,
  parseCaioGoalLedgerEntry,
  parseCaioGoalLedgerTimestamp,
} from "./contracts";

/**
 * CAIO goal ledger chain verification: pure, no IO and no clock.
 *
 * Every read verifies the whole chain from entry 1 to the head and trusts only the stored text: entry JSON and
 * document text are reparsed and rehashed, and the indexed columns must agree with them. One break rejects the
 * whole ledger. A rejected read names the break and how far the chain verified; it never carries a document and
 * never falls back to an earlier version.
 */

export const CAIO_GOAL_LEDGER_ALARM_CODES = [
  "seq_gap", "prev_hash_mismatch", "entry_hash_mismatch", "entry_shape_invalid", "column_mismatch",
  "head_anchor_missing", "head_anchor_mismatch", "document_missing", "document_hash_mismatch", "document_invalid",
] as const;
export type CaioGoalLedgerAlarmCode = (typeof CAIO_GOAL_LEDGER_ALARM_CODES)[number];

export type CaioGoalLedgerEntrySource = "command" | "import";

/** One stored entry: the text the chain hashes, and the columns indexed beside it, which are never trusted alone. */
export type CaioGoalLedgerStoredEntry = Readonly<{
  seq: number;
  entryHash: string;
  prevHash: string;
  entryJson: string;
  /** The document's files key, its digest and its text, byte for byte; the three columns are null together. */
  document: Readonly<{ fileKey: string; hash: string; text: string }> | null;
  effectiveAt: Date;
  source: CaioGoalLedgerEntrySource;
  createdAt: Date;
}>;

export type CaioGoalLedgerStoredHead = Readonly<{ headSeq: number; headHash: string }>;

/** `effectiveAt` is as written in the entry: `effective_at`, or `ts` when the entry has none. */
export type CaioGoalLedgerHeadView = Readonly<{
  seq: number; entryHash: string; documentHash: string; effectiveAt: string; recordedAt: string;
  source: CaioGoalLedgerEntrySource;
}>;

/**
 * `atSeq` is the position of the entry that failed (1-based; a broken entry has no trustworthy seq of its own), or
 * null when the head anchor disagrees with a chain that verified in full. `verifiedThroughSeq` is the last position
 * that passed every check.
 */
export type CaioGoalLedgerAlarm = Readonly<{
  code: CaioGoalLedgerAlarmCode; atSeq: number | null; verifiedThroughSeq: number; entryCount: number;
}>;

/** `sealedDigests` is the head entry's `files`. */
export type CaioGoalLedgerChainRead =
  | { state: "empty" }
  | { state: "ok"; head: CaioGoalLedgerHeadView; document: CaioGoalLedgerDocument; sealedDigests: Readonly<Record<string, string>> }
  | { state: "rejected"; alarm: CaioGoalLedgerAlarm };

function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// History documents are checked against their sealed digest only; the head document is also parsed in full later.
function checkEntry(row: CaioGoalLedgerStoredEntry, position: number, expectedPrevHash: string):
  | { ok: true; entry: CaioGoalLedgerEntry }
  | { ok: false; code: CaioGoalLedgerAlarmCode } {
  const fail = (code: CaioGoalLedgerAlarmCode) => ({ ok: false, code }) as const;
  const raw = parseJsonText(row.entryJson);
  const parsed = parseCaioGoalLedgerEntry(raw);
  if (!parsed.ok) return fail("entry_shape_invalid");
  const { entry } = parsed;
  if (entry.seq !== position) return fail("seq_gap");
  if (entry.prev_hash !== expectedPrevHash) return fail("prev_hash_mismatch");
  const computed = computeCaioGoalLedgerEntryHash(raw);
  if (!computed.ok) return fail("entry_shape_invalid");
  if (computed.hash !== entry.hash) return fail("entry_hash_mismatch");
  if (
    row.seq !== entry.seq
    || row.entryHash !== entry.hash
    || row.prevHash !== entry.prev_hash
    || row.effectiveAt.getTime() !== parseCaioGoalLedgerTimestamp(entry.effective_at ?? entry.ts)
  ) {
    return fail("column_mismatch");
  }
  if (row.document !== null) {
    // `files` keys may be names such as "constructor", so only own keys count.
    if (!Object.hasOwn(entry.files, row.document.fileKey)) return fail("column_mismatch");
    const sealed = entry.files[row.document.fileKey];
    const digest = sha256HexOfCaioGoalLedgerText(row.document.text);
    if (!digest.ok || digest.hash !== sealed) return fail("document_hash_mismatch");
    if (row.document.hash !== sealed) return fail("column_mismatch");
  }
  return { ok: true, entry };
}

/** Verifies the stored rows, given in ascending seq-column order, and the per-workspace head anchor. */
export function verifyCaioGoalLedgerChain(input: Readonly<{
  entries: readonly CaioGoalLedgerStoredEntry[];
  head: CaioGoalLedgerStoredHead | null;
}>): CaioGoalLedgerChainRead {
  const { entries, head } = input;
  const entryCount = entries.length;
  if (entryCount === 0 && head === null) return { state: "empty" };
  const reject = (code: CaioGoalLedgerAlarmCode, atSeq: number | null, verifiedThroughSeq: number) =>
    ({ state: "rejected", alarm: { code, atSeq, verifiedThroughSeq, entryCount } }) as const;

  let prevHash = CAIO_GOAL_LEDGER_GENESIS_PREV_HASH;
  let last: { row: CaioGoalLedgerStoredEntry; entry: CaioGoalLedgerEntry } | null = null;
  for (const [index, row] of entries.entries()) {
    const checked = checkEntry(row, index + 1, prevHash);
    if (!checked.ok) return reject(checked.code, index + 1, index);
    prevHash = checked.entry.hash;
    last = { row, entry: checked.entry };
  }

  // A truncated tail leaves a chain that is still self-consistent; only the anchor tells. It is checked before the
  // head document, because the entry left last after a truncation may be a history entry without one.
  if (head === null) return reject("head_anchor_missing", null, entryCount);
  if (last === null || head.headSeq !== last.entry.seq || head.headHash !== last.entry.hash) {
    return reject("head_anchor_mismatch", null, entryCount);
  }

  const { row, entry } = last;
  if (row.document === null) return reject("document_missing", entryCount, entryCount - 1);
  const document = parseCaioGoalLedgerDocument(parseJsonText(row.document.text));
  if (!document.ok) return reject("document_invalid", entryCount, entryCount - 1);
  const headView = {
    seq: entry.seq, entryHash: entry.hash, documentHash: row.document.hash, effectiveAt: entry.effective_at ?? entry.ts,
    recordedAt: row.createdAt.toISOString(), source: row.source,
  };
  return { state: "ok", head: headView, document: document.document, sealedDigests: entry.files };
}
