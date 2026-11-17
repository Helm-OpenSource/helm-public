import { describe, expect, it } from "vitest";

import {
  CAIO_GOAL_LEDGER_ALARM_CODES,
  type CaioGoalLedgerAlarmCode,
  type CaioGoalLedgerStoredEntry,
  type CaioGoalLedgerStoredHead,
  verifyCaioGoalLedgerChain,
} from "./chain";
import { CAIO_GOAL_LEDGER_DOCUMENT_FILE_KEY, CAIO_GOAL_LEDGER_GENESIS_PREV_HASH } from "./contracts";
import {
  buildSyntheticCaioGoalLedgerChain,
  sealSyntheticCaioGoalLedgerEntry,
  SYNTHETIC_RECORDED_AT,
  syntheticCaioGoalLedgerDocument,
  syntheticDocumentText,
  type SyntheticEntrySpec,
} from "./testing/synthetic-chain";

// Golden rows: texts and digests recomputed outside this codebase (Python json with sorted keys, ensure_ascii off and
// compact separators, plus hashlib). Entries 1 and 2 are the imported golden sample; entry 3 is a locally appended
// entry. The golden document is minimal: fine as a sealed history document, invalid as a head document.
const GOLDEN_DOCUMENT_TEXT = String.raw`{"goals":[{"key":"g1","title":"示例目标：全链路可用"}],"schema":"caio-goal-ledger-document/v1"}`;
const GOLDEN_DOCUMENT_SHA256 = "fb4b2d9a6feb2b82dcec01caed2b1d871b8e80f2707ba2195c95d70a38824b91";
const HEAD_DOCUMENT_TEXT = String.raw`{"components":[],"gates":[],"goals":[{"componentKeys":[],"key":"goal.sample","kind":"northstar","metrics":[{"basisRef":"basis.sample.outcome","direction":"up_good","key":"sample.outcome","label":{"en":"Outcome","zh":"结果"},"unit":"count"}],"standard":"示例：每周复盘按时完成","threshold":{"ref":"threshold.goal.sample","sha256":null},"title":"示例：主链路稳定可用"}],"roleBindingPin":null,"schema":"caio-goal-ledger-document/v1"}`;
const HEAD_DOCUMENT_SHA256 = "a6314301397758ffc9987aec05dc2d67d34aa903324471fed3793571faa63ef9";
const GOLDEN_HASHES = [
  "3e6c68bad610bc5000ad43371ec86682ecc9dc4a4ce21f21355c45dc046d0513",
  "3e9ecd8b017c919757e456713373f933137296e38d64e68b209b8f24c9af1c70",
  "51ee575550af075b3b2772109c68de93c2f778999b7531ae19d16d50b9ada53b",
];
const GOLDEN_ENTRY_JSON = [
  String.raw`{"change":"首版 synthetic","files":{"caio/goal-ledger-document.json":"fb4b2d9a6feb2b82dcec01caed2b1d871b8e80f2707ba2195c95d70a38824b91","register/other.json":"0000000000000000000000000000000000000000000000000000000000000000"},"hash":"3e6c68bad610bc5000ad43371ec86682ecc9dc4a4ce21f21355c45dc046d0513","owner_quote":"示例原话：\"本周目标\"不变\n第二行 \\ tab\t结束","prev_hash":"0000000000000000000000000000000000000000000000000000000000000000","seq":1,"ts":"2026-01-05T09:30:00+08:00","writer":"synthetic-session"}`,
  String.raw`{"change":"二版","files":{"caio/goal-ledger-document.json":"fb4b2d9a6feb2b82dcec01caed2b1d871b8e80f2707ba2195c95d70a38824b91"},"hash":"3e9ecd8b017c919757e456713373f933137296e38d64e68b209b8f24c9af1c70","owner_quote":"第二条","prev_hash":"3e6c68bad610bc5000ad43371ec86682ecc9dc4a4ce21f21355c45dc046d0513","seq":2,"ts":"2026-01-12T10:00:00+08:00","writer":"synthetic-session"}`,
  String.raw`{"change":"三版 synthetic","effective_at":"2026-01-19T10:00:00+08:00","files":{"caio/goal-ledger-document.json":"a6314301397758ffc9987aec05dc2d67d34aa903324471fed3793571faa63ef9"},"hash":"51ee575550af075b3b2772109c68de93c2f778999b7531ae19d16d50b9ada53b","owner_quote":"第三条","prev_hash":"3e9ecd8b017c919757e456713373f933137296e38d64e68b209b8f24c9af1c70","schema":"caio-goal-ledger-entry/v1","seq":3,"ts":"2026-01-19T02:00:00.000Z","writer":"user:u_synthetic_owner"}`,
];
const GOLDEN_EFFECTIVE_AT = ["2026-01-05T01:30:00Z", "2026-01-12T02:00:00Z", "2026-01-19T02:00:00Z"];

const goldenRow = (index: number): CaioGoalLedgerStoredEntry => {
  const head = index === 2;
  return {
    seq: index + 1,
    entryHash: GOLDEN_HASHES[index],
    prevHash: index === 0 ? CAIO_GOAL_LEDGER_GENESIS_PREV_HASH : GOLDEN_HASHES[index - 1],
    entryJson: GOLDEN_ENTRY_JSON[index],
    document: {
      fileKey: CAIO_GOAL_LEDGER_DOCUMENT_FILE_KEY,
      hash: head ? HEAD_DOCUMENT_SHA256 : GOLDEN_DOCUMENT_SHA256,
      text: head ? HEAD_DOCUMENT_TEXT : GOLDEN_DOCUMENT_TEXT,
    },
    effectiveAt: new Date(GOLDEN_EFFECTIVE_AT[index]),
    source: head ? "command" : "import",
    createdAt: SYNTHETIC_RECORDED_AT,
  };
};
const golden = (count: number) => verifyCaioGoalLedgerChain({
  entries: [0, 1, 2].slice(0, count).map(goldenRow),
  head: { headSeq: count, headHash: GOLDEN_HASHES[count - 1] },
});

describe("golden chain", () => {
  it("verifies the imported entries through the chain checks, then refuses the minimal head document", () => {
    expect(golden(2)).toEqual({
      state: "rejected", alarm: { code: "document_invalid", atSeq: 2, verifiedThroughSeq: 1, entryCount: 2 },
    });
  });

  it("accepts a locally appended head on imported history, hashing each entry as written", () => {
    expect(golden(3)).toEqual({
      state: "ok",
      head: {
        seq: 3, entryHash: GOLDEN_HASHES[2], documentHash: HEAD_DOCUMENT_SHA256, effectiveAt: "2026-01-19T10:00:00+08:00",
        recordedAt: SYNTHETIC_RECORDED_AT.toISOString(), source: "command",
      },
      document: JSON.parse(HEAD_DOCUMENT_TEXT),
      sealedDigests: { [CAIO_GOAL_LEDGER_DOCUMENT_FILE_KEY]: HEAD_DOCUMENT_SHA256 },
    });
  });
});

type Chain = { entries: CaioGoalLedgerStoredEntry[]; head: CaioGoalLedgerStoredHead | null };
const MIXED: SyntheticEntrySpec[] = [
  { form: "imported", documentText: null },
  { form: "imported", documentText: syntheticDocumentText("imported") },
  { form: "imported", documentText: null },
  { form: "appended", documentText: syntheticDocumentText("appended") },
  { form: "appended", documentText: syntheticDocumentText("appended") },
];
const mixed = () => buildSyntheticCaioGoalLedgerChain(MIXED);
const withHeadDocument = (documentText: string) =>
  buildSyntheticCaioGoalLedgerChain([...MIXED.slice(0, 4), { form: "appended", documentText }]);
const at = (seq: number, change: (row: CaioGoalLedgerStoredEntry) => Partial<CaioGoalLedgerStoredEntry>): Chain => {
  const { entries, head } = mixed();
  return { entries: entries.map((row, index) => (index === seq - 1 ? { ...row, ...change(row) } : row)), head };
};
const reseal = (seq: number, change: Record<string, unknown>): Chain => {
  const { entries, head } = mixed();
  const { hash: _hash, ...entry } = JSON.parse(entries[seq - 1].entryJson) as Record<string, unknown>;
  entries[seq - 1] = sealSyntheticCaioGoalLedgerEntry({ ...entry, ...change }, entries[seq - 1].document,
    entries[seq - 1].source);
  return { entries, head };
};
const editDocument = (seq: number, edit: Partial<NonNullable<CaioGoalLedgerStoredEntry["document"]>>) =>
  at(seq, (row) => ({ document: { ...row.document!, ...edit } }));

describe("synthetic chains", () => {
  it("is empty only with no entries and no anchor", () => {
    expect(verifyCaioGoalLedgerChain({ entries: [], head: null })).toEqual({ state: "empty" });
  });

  it("accepts imported and appended entries mixed, where history entries may lack a document", () => {
    const read = verifyCaioGoalLedgerChain(mixed());
    expect(read).toMatchObject({
      state: "ok",
      head: { seq: 5, effectiveAt: "2026-02-05T10:00:00+08:00", source: "command" },
      document: syntheticCaioGoalLedgerDocument(),
    });
  });

  it("hashes an imported head document byte for byte instead of re-serializing it", () => {
    const text = syntheticDocumentText("imported");
    expect(text).toContain("\n  ");
    expect(verifyCaioGoalLedgerChain(buildSyntheticCaioGoalLedgerChain([{ form: "imported", documentText: text }])))
      .toMatchObject({ state: "ok", head: { seq: 1, source: "import" }, document: syntheticCaioGoalLedgerDocument() });
  });

  // Each break rejects the whole ledger of five, with nothing on the read beyond the alarm.
  const breaks: Array<[string, () => Chain, CaioGoalLedgerAlarmCode, number | null, number]> = [
    ["entry text that is not JSON", () => at(1, () => ({ entryJson: "{" })), "entry_shape_invalid", 1, 0],
    ["a resealed entry with a key outside the closed set", () => reseal(2, { score: 1 }), "entry_shape_invalid", 2, 1],
    ["an entry text with a lone surrogate", () => at(1, (row) => ({ entryJson: row.entryJson.replace("示例原话 1", "\\ud800") })),
      "entry_shape_invalid", 1, 0],
    ["a missing entry", () => ({ ...mixed(), entries: mixed().entries.filter((_, index) => index !== 2) }), "seq_gap", 3, 2],
    ["two entries swapped", () => {
      const { entries, head } = mixed();
      return { entries: [entries[0], entries[2], entries[1], ...entries.slice(3)], head };
    }, "seq_gap", 2, 1],
    ["an entry resealed onto another predecessor", () => reseal(3, { prev_hash: "a".repeat(64) }), "prev_hash_mismatch", 3, 2],
    ["an entry edited and resealed, caught by its successor", () => reseal(2, { owner_quote: "改过的原话" }),
      "prev_hash_mismatch", 3, 2],
    ["entry 2 of 5 with its owner quote edited in place",
      () => at(2, (row) => ({ entryJson: row.entryJson.replace("示例原话 2", "示例原话 2（改）") })), "entry_hash_mismatch", 2, 1],
    ["a seq column", () => at(2, () => ({ seq: 7 })), "column_mismatch", 2, 1],
    ["an entry-hash column", () => at(3, () => ({ entryHash: "c".repeat(64) })), "column_mismatch", 3, 2],
    ["a prev-hash column", () => at(3, () => ({ prevHash: "c".repeat(64) })), "column_mismatch", 3, 2],
    ["an effective-at column 1 ms off", () => at(4, (row) => ({ effectiveAt: new Date(row.effectiveAt.getTime() + 1) })),
      "column_mismatch", 4, 3],
    ["a document key the entry does not seal", () => editDocument(2, { fileKey: "bundle/other.json" }), "column_mismatch", 2, 1],
    ["a document key inherited from Object", () => editDocument(2, { fileKey: "constructor" }), "column_mismatch", 2, 1],
    ["a document-hash column", () => editDocument(4, { hash: "d".repeat(64) }), "column_mismatch", 4, 3],
    ["an edited history document", () => editDocument(2, { text: `${syntheticDocumentText("imported")} ` }),
      "document_hash_mismatch", 2, 1],
    ["an edited head document", () => editDocument(5, { text: syntheticDocumentText("imported") }),
      "document_hash_mismatch", 5, 4],
    ["no anchor", () => ({ ...mixed(), head: null }), "head_anchor_missing", null, 5],
    ["a truncated tail", () => ({ ...mixed(), entries: mixed().entries.slice(0, 4) }), "head_anchor_mismatch", null, 4],
    ["a truncated tail ending on an entry without a document", () => ({ ...mixed(), entries: mixed().entries.slice(0, 3) }),
      "head_anchor_mismatch", null, 3],
    ["an anchor naming another hash", () => ({ ...mixed(), head: { headSeq: 5, headHash: mixed().entries[3].entryHash } }),
      "head_anchor_mismatch", null, 5],
    ["an anchor without entries", () => ({ entries: [], head: mixed().head }), "head_anchor_mismatch", null, 0],
    ["a head that seals no document", () => buildSyntheticCaioGoalLedgerChain([...MIXED.slice(0, 4),
      { form: "appended", documentText: null }]), "document_missing", 5, 4],
    ["a head whose document columns were cleared", () => at(5, () => ({ document: null })), "document_missing", 5, 4],
    ["a sealed head document that is not JSON", () => withHeadDocument("not json"), "document_invalid", 5, 4],
    ["a sealed head document with an unknown key", () => withHeadDocument(syntheticDocumentText("appended",
      { ...syntheticCaioGoalLedgerDocument(), scores: {} })), "document_invalid", 5, 4],
    ["a sealed head document carrying a percentage", () => withHeadDocument(syntheticDocumentText("appended",
      { ...syntheticCaioGoalLedgerDocument(), goals: [{ ...syntheticCaioGoalLedgerDocument().goals[1], title: "完成率 30%" }] })),
    "document_invalid", 5, 4],
  ];

  it.each(breaks)("rejects %s", (_name, build, code, atSeq, verifiedThroughSeq) => {
    const chain = build();
    const read = verifyCaioGoalLedgerChain(chain);
    expect(read).toEqual({ state: "rejected", alarm: { code, atSeq, verifiedThroughSeq, entryCount: chain.entries.length } });
    expect(Object.keys(read)).toEqual(["state", "alarm"]);
  });

  it("reaches every alarm code", () => {
    expect(new Set(breaks.map(([, , code]) => code))).toEqual(new Set(CAIO_GOAL_LEDGER_ALARM_CODES));
  });
});
