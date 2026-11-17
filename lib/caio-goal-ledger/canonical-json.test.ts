import { describe, expect, it } from "vitest";

import {
  canonicalizeCaioGoalLedgerJson,
  computeCaioGoalLedgerEntryHash,
  sha256HexOfCaioGoalLedgerText,
} from "./canonical-json";

// Synthetic golden sample: produced by an independent sort_keys / ensure_ascii=False / compact-separator
// serializer and recomputed here byte for byte. Its document is deliberately minimal and fails document validation.
const GOLDEN_DOCUMENT_TEXT = String.raw`{"goals":[{"key":"g1","title":"示例目标：全链路可用"}],"schema":"caio-goal-ledger-document/v1"}`;
const GOLDEN_DOCUMENT_SHA256 = "fb4b2d9a6feb2b82dcec01caed2b1d871b8e80f2707ba2195c95d70a38824b91";
const GOLDEN_ENTRY_1_PREIMAGE = String.raw`{"change":"首版 synthetic","files":{"caio/goal-ledger-document.json":"fb4b2d9a6feb2b82dcec01caed2b1d871b8e80f2707ba2195c95d70a38824b91","register/other.json":"0000000000000000000000000000000000000000000000000000000000000000"},"owner_quote":"示例原话：\"本周目标\"不变\n第二行 \\ tab\t结束","prev_hash":"0000000000000000000000000000000000000000000000000000000000000000","seq":1,"ts":"2026-01-05T09:30:00+08:00","writer":"synthetic-session"}`;
const GOLDEN_ENTRY_1_HASH = "3e6c68bad610bc5000ad43371ec86682ecc9dc4a4ce21f21355c45dc046d0513";
const GOLDEN_ENTRY_2_HASH = "3e9ecd8b017c919757e456713373f933137296e38d64e68b209b8f24c9af1c70";
const ZERO_HASH = "0".repeat(64);

const canonical = (value: unknown) => {
  const result = canonicalizeCaioGoalLedgerJson(value);
  if (!result.ok) throw new Error(`unexpected refusal: ${result.errorCode}`);
  return result.text;
};

describe("golden sample", () => {
  it("hashes the document text over its UTF-8 bytes", () => {
    expect(sha256HexOfCaioGoalLedgerText(GOLDEN_DOCUMENT_TEXT)).toEqual({ ok: true, hash: GOLDEN_DOCUMENT_SHA256 });
  });

  it("rebuilds entry 1's preimage from a literal object and from the parsed preimage, and hashes it", () => {
    const entry1 = {
      writer: "synthetic-session",
      ts: "2026-01-05T09:30:00+08:00",
      seq: 1,
      prev_hash: ZERO_HASH,
      owner_quote: "示例原话：\"本周目标\"不变\n第二行 \\ tab\t结束",
      files: { "register/other.json": ZERO_HASH, "caio/goal-ledger-document.json": GOLDEN_DOCUMENT_SHA256 },
      change: "首版 synthetic",
      hash: GOLDEN_ENTRY_1_HASH,
    };
    expect(canonical(JSON.parse(GOLDEN_ENTRY_1_PREIMAGE))).toBe(GOLDEN_ENTRY_1_PREIMAGE);
    expect(computeCaioGoalLedgerEntryHash(entry1)).toEqual({
      ok: true, preimage: GOLDEN_ENTRY_1_PREIMAGE, hash: GOLDEN_ENTRY_1_HASH,
    });
  });

  it("chains entry 2 onto entry 1", () => {
    const entry2 = {
      seq: 2,
      ts: "2026-01-12T10:00:00+08:00",
      writer: "synthetic-session",
      owner_quote: "第二条",
      change: "二版",
      files: { "caio/goal-ledger-document.json": GOLDEN_DOCUMENT_SHA256 },
      prev_hash: GOLDEN_ENTRY_1_HASH,
    };
    const result = computeCaioGoalLedgerEntryHash(entry2);
    expect(result).toMatchObject({ ok: true, hash: GOLDEN_ENTRY_2_HASH });
    expect(computeCaioGoalLedgerEntryHash({ ...entry2, hash: "f".repeat(64) })).toEqual(result);
  });
});

describe("canonical form", () => {
  // Expected strings come from the same independent serializer as the golden sample.
  it("sorts keys by code point, not by UTF-16 unit", () => {
    const value = { "": 1, "\u{1f600}": 2, a: 3, B: 4, "é": 5 };
    expect(canonical(value)).toBe('{"B":4,"a":3,"é":5,"":1,"\u{1f600}":2}');
    // The default sort puts the astral key (a high surrogate unit) before U+E000; code point order does not.
    expect(Object.keys(value).sort()).toEqual(["B", "a", "é", "\u{1f600}", ""]);
  });

  it("escapes strings like JSON.stringify and leaves other characters as they are", () => {
    expect(canonical({ s: "\u0000\u0001\u001f\u007f\b\f\n\r\t\"\\/  " }))
      .toBe('{"s":"\\u0000\\u0001\\u001f\u007f\\b\\f\\n\\r\\t\\"\\\\/  "}');
  });

  it("writes nested values compactly, -0 as 0 and safe integers in full", () => {
    expect(canonical({ z: [1, true, null, { b: "x", a: [] }], a: {}, m: -0, n: 9007199254740991, o: -9007199254740991 }))
      .toBe('{"a":{},"m":0,"n":9007199254740991,"o":-9007199254740991,"z":[1,true,null,{"a":[],"b":"x"}]}');
    expect(canonical(Object.assign(Object.create(null), { k: false }))).toBe('{"k":false}');
  });

  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  let deep: unknown = 1;
  for (let depth = 0; depth < 65; depth += 1) deep = [deep];

  it.each([
    ["a fraction", { n: 1.5 }, "non_integer_number"],
    ["NaN", [Number.NaN], "non_integer_number"],
    ["Infinity", { n: Number.POSITIVE_INFINITY }, "non_integer_number"],
    ["2^53", { n: 2 ** 53 }, "unsafe_integer"],
    ["-(2^53)", [-(2 ** 53)], "unsafe_integer"],
    ["a lone high surrogate in a value", { s: "a\ud83d" }, "lone_surrogate"],
    ["a lone low surrogate in a key", { "\ude00b": 1 }, "lone_surrogate"],
    ["undefined at the top", undefined, "unsupported_value"],
    ["undefined as an object value", { a: undefined }, "unsupported_value"],
    ["undefined in an array", [1, undefined], "unsupported_value"],
    ["array holes", new Array<number>(2), "unsupported_value"],
    ["a bigint", { n: BigInt(1) }, "unsupported_value"],
    ["a function", { f: () => 1 }, "unsupported_value"],
    ["a symbol value", { s: Symbol("s") }, "unsupported_value"],
    ["a symbol key", { [Symbol("k")]: 1 }, "unsupported_value"],
    ["a Date", { d: new Date(0) }, "unsupported_value"],
    ["a Map", new Map(), "unsupported_value"],
    ["an array with a named property", Object.assign([1], { extra: 2 }), "unsupported_value"],
    ["a hole balanced by a named property", Object.assign(Object.assign(new Array<number>(3), { 0: 1, 2: 3 }), { extra: 2 }),
      "unsupported_value"],
    ["a cycle", cyclic, "cycle"],
    ["nesting deeper than 64", deep, "too_deep"],
  ])("refuses %s", (_name, value, errorCode) => {
    expect(canonicalizeCaioGoalLedgerJson(value)).toEqual({ ok: false, errorCode });
  });

  it("refuses to hash text with a lone surrogate instead of replacing it", () => {
    expect(sha256HexOfCaioGoalLedgerText("x\ud800")).toEqual({ ok: false, errorCode: "lone_surrogate" });
  });
});

describe("entry hash", () => {
  it("drops only the top-level hash key", () => {
    const result = computeCaioGoalLedgerEntryHash({ seq: 1, files: { hash: ZERO_HASH }, hash: ZERO_HASH });
    expect(result).toMatchObject({ ok: true, preimage: `{"files":{"hash":"${ZERO_HASH}"},"seq":1}` });
  });

  it.each([[null], [[]], ["entry"], [new Date(0)]])("refuses a non-object entry %j", (entry) => {
    expect(computeCaioGoalLedgerEntryHash(entry)).toEqual({ ok: false, errorCode: "entry_not_object" });
  });

  it("passes refusals through", () => {
    expect(computeCaioGoalLedgerEntryHash({ seq: 1.5 })).toEqual({ ok: false, errorCode: "non_integer_number" });
  });
});
