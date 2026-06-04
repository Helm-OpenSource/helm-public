// Append-only, tamper-evident accountability ledger (spec §4.5, §7). Each entry chains to the
// previous via prevEntryHash; contentHash self-hashes the entry. Single-tenant; the schema is
// public Core, the content is tenant/control-plane private. Reuses the expert-capability hash
// util rather than introducing a new hashing surface.

import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";
import {
  LEDGER_GENESIS_HASH,
  type AccountabilityLedgerEntry,
  type CorrectionReasonCode,
  type LedgerDecision,
} from "./contracts";

export function computeLedgerEntryContentHash(entry: AccountabilityLedgerEntry): string {
  const { contentHash: _omit, ...rest } = entry;
  return sha256(canonicalJson(rest));
}

export function appendLedgerEntry(input: {
  prev: AccountabilityLedgerEntry | null;
  entryId: string;
  requestId: string;
  decision: LedgerDecision;
  reviewerId: string;
  reasonCode: CorrectionReasonCode;
  falsePositive: boolean;
  at: string;
}): AccountabilityLedgerEntry {
  const base: Omit<AccountabilityLedgerEntry, "contentHash"> = {
    entryId: input.entryId,
    prevEntryHash: input.prev ? input.prev.contentHash : LEDGER_GENESIS_HASH,
    requestId: input.requestId,
    decision: input.decision,
    reviewerId: input.reviewerId,
    reasonCode: input.reasonCode,
    falsePositive: input.falsePositive,
    at: input.at,
  };
  const contentHash = sha256(canonicalJson(base));
  return { ...base, contentHash };
}

export type LedgerChainResult = { ok: boolean; errors: string[] };

export function verifyLedgerChain(entries: AccountabilityLedgerEntry[]): LedgerChainResult {
  const errors: string[] = [];
  let expectedPrev = LEDGER_GENESIS_HASH;
  entries.forEach((entry, index) => {
    if (entry.prevEntryHash !== expectedPrev) {
      errors.push(`broken_chain_at:${index}:${entry.entryId}`);
    }
    if (computeLedgerEntryContentHash(entry) !== entry.contentHash) {
      errors.push(`content_hash_mismatch_at:${index}:${entry.entryId}`);
    }
    expectedPrev = entry.contentHash;
  });
  return { ok: errors.length === 0, errors };
}
