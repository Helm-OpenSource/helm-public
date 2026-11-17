import { canonicalizeCaioGoalLedgerJson, computeCaioGoalLedgerEntryHash, sha256HexOfCaioGoalLedgerText } from "../canonical-json";
import type { CaioGoalLedgerEntrySource, CaioGoalLedgerStoredEntry, CaioGoalLedgerStoredHead } from "../chain";
import {
  CAIO_GOAL_LEDGER_DOCUMENT_FILE_KEY,
  CAIO_GOAL_LEDGER_ENTRY_SCHEMA_VERSION,
  CAIO_GOAL_LEDGER_GENESIS_PREV_HASH,
  type CaioGoalLedgerDocument,
  parseCaioGoalLedgerTimestamp,
} from "../contracts";

/**
 * Synthetic goal ledger fixtures for tests: invented goals, role keys and user ids, no tenant or person content.
 * Chains are sealed with the contract-layer hashing, so they exercise sequence, links and columns; the hashing
 * itself is pinned by literal digests in the tests.
 */

export function syntheticSha256(text: string): string {
  const digest = sha256HexOfCaioGoalLedgerText(text);
  if (!digest.ok) throw new Error(`synthetic text refused: ${digest.errorCode}`);
  return digest.hash;
}

function canonical(value: unknown): string {
  const result = canonicalizeCaioGoalLedgerJson(value);
  if (!result.ok) throw new Error(`synthetic value refused: ${result.errorCode}`);
  return result.text;
}

/** Stored bytes of one published attention route config version; publishing hashes exactly these bytes. */
export const SYNTHETIC_ROUTE_CONFIG_JSON = JSON.stringify({
  schemaVersion: "caio-attention-routes/v1",
  roleBindings: { line_a_owner: ["user:u_line_a"], line_b_owner: ["user:u_line_b"], release_holder: ["user:u_release"] },
  enterpriseOverrides: {},
});
export const SYNTHETIC_ROUTE_CONFIG_VERSION = 3;

/** A complete document that passes every contract check. */
export function syntheticCaioGoalLedgerDocument(): CaioGoalLedgerDocument {
  return {
    schema: "caio-goal-ledger-document/v1",
    goals: [
      {
        key: "goal.reliability",
        kind: "northstar",
        title: "示例：主链路稳定可用",
        standard: "连续两周没有阻断事故，复盘按时完成",
        metrics: [
          { key: "line_a.outcome", label: { zh: "结果", en: "Outcome" }, unit: "count", direction: "up_good", basisRef: "basis.line_a.outcome" },
          { key: "line_a.quality", label: { zh: "质量", en: "Quality" }, unit: "percent", direction: "up_good", basisRef: "basis.line_a.quality" },
        ],
        threshold: { ref: "threshold.goal.reliability", sha256: "b".repeat(64) },
        componentKeys: ["line_a", "line_b"],
      },
      {
        key: "goal.cadence",
        kind: "stage_metric",
        title: "Synthetic cadence goal",
        standard: "The weekly review happens on schedule",
        metrics: [
          { key: "review.close_days", label: { zh: "收尾天数", en: "Close-out days" }, unit: "days", direction: "down_good",
            basisRef: "basis.review.close_days" },
          { key: "review.spend_band", label: { zh: "投入分档", en: "Spend band" }, unit: "currency_band", direction: "neutral",
            basisRef: "basis.review.spend_band" },
        ],
        threshold: { ref: "threshold.goal.cadence", sha256: null },
        componentKeys: [],
      },
    ],
    components: [
      { key: "line_a", label: "示例工作线 A", primaryRoleKey: "line_a_owner" },
      { key: "line_b", label: "Synthetic line B", primaryRoleKey: "line_b_owner" },
    ],
    gates: [{ key: "gate.release", label: "发布关卡", holderRoleKey: "release_holder", note: "示例备注" }],
    roleBindingPin: {
      source: "caio_attention_route_config",
      version: SYNTHETIC_ROUTE_CONFIG_VERSION,
      contentHash: syntheticSha256(SYNTHETIC_ROUTE_CONFIG_JSON),
    },
  };
}

/** Files key an import bundle chose for its documents; locally appended entries use the fixed key. */
export const SYNTHETIC_IMPORT_DOCUMENT_FILE_KEY = "bundle/goal-document.json";
export const SYNTHETIC_RECORDED_AT = new Date(Date.UTC(2026, 1, 28, 8, 0, 0));

/** Imported documents keep their own indented layout; locally appended ones are canonical JSON. */
export function syntheticDocumentText(form: "imported" | "appended", document: unknown = syntheticCaioGoalLedgerDocument()) {
  return form === "imported" ? JSON.stringify(document, null, 2) : canonical(document);
}

/** Seals an entry object (without `hash`) into the row a store would hold, with every column derived from it. */
export function sealSyntheticCaioGoalLedgerEntry(
  entry: Readonly<Record<string, unknown>>,
  document: Readonly<{ fileKey: string; text: string }> | null,
  source: CaioGoalLedgerEntrySource,
): CaioGoalLedgerStoredEntry {
  const sealed = computeCaioGoalLedgerEntryHash(entry);
  if (!sealed.ok) throw new Error(`synthetic entry refused: ${sealed.errorCode}`);
  const effectiveAt = parseCaioGoalLedgerTimestamp(entry.effective_at ?? entry.ts);
  if (effectiveAt === null) throw new Error("synthetic entry needs a timestamp");
  return {
    seq: entry.seq as number,
    entryHash: sealed.hash,
    prevHash: entry.prev_hash as string,
    entryJson: canonical({ ...entry, hash: sealed.hash }),
    document: document && { fileKey: document.fileKey, hash: syntheticSha256(document.text), text: document.text },
    effectiveAt: new Date(effectiveAt),
    source,
    createdAt: SYNTHETIC_RECORDED_AT,
  };
}

/**
 * `imported` entries carry only the seven required keys, a +08:00 time and the bundle's files key next to another
 * sealed digest; `appended` entries add `schema`, `effective_at` and a `user:` writer. Up to 28 entries.
 */
export type SyntheticEntrySpec = Readonly<{ form: "imported" | "appended"; documentText: string | null }>;

export function buildSyntheticCaioGoalLedgerChain(specs: readonly SyntheticEntrySpec[]): {
  entries: CaioGoalLedgerStoredEntry[];
  head: CaioGoalLedgerStoredHead | null;
} {
  const entries: CaioGoalLedgerStoredEntry[] = [];
  let prevHash = CAIO_GOAL_LEDGER_GENESIS_PREV_HASH;
  for (const [index, { form, documentText }] of specs.entries()) {
    const seq = index + 1;
    const day = String(seq).padStart(2, "0");
    const fileKey = form === "imported" ? SYNTHETIC_IMPORT_DOCUMENT_FILE_KEY : CAIO_GOAL_LEDGER_DOCUMENT_FILE_KEY;
    const files: Record<string, string> = form === "imported"
      ? { "overlay/definitions.json": syntheticSha256(`synthetic definitions ${seq}`) }
      : {};
    if (documentText !== null) files[fileKey] = syntheticSha256(documentText);
    const common = { seq, owner_quote: `示例原话 ${seq}`, change: `synthetic change ${seq}`, files, prev_hash: prevHash };
    const entry = form === "imported"
      ? { ...common, ts: `2026-01-${day}T09:30:00+08:00`, writer: "synthetic-session" }
      : {
        ...common,
        ts: `2026-02-${day}T02:00:00.000Z`,
        effective_at: `2026-02-${day}T10:00:00+08:00`,
        writer: "user:u_synthetic_owner",
        schema: CAIO_GOAL_LEDGER_ENTRY_SCHEMA_VERSION,
      };
    const row = sealSyntheticCaioGoalLedgerEntry(entry, documentText === null ? null : { fileKey, text: documentText },
      form === "imported" ? "import" : "command");
    entries.push(row);
    prevHash = row.entryHash;
  }
  const last = entries.at(-1);
  return { entries, head: last ? { headSeq: last.seq, headHash: last.entryHash } : null };
}
