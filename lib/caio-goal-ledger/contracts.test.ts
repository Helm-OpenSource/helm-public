import { describe, expect, it } from "vitest";

import { validateNorthstarKpis } from "@/lib/shell/northstar-kpi";

import {
  CAIO_GOAL_LEDGER_DOCUMENT_FILE_KEY,
  CAIO_GOAL_LEDGER_GENESIS_PREV_HASH,
  CAIO_GOAL_LEDGER_METRIC_DIRECTIONS,
  CAIO_GOAL_LEDGER_METRIC_UNITS,
  caioGoalLedgerProseCarriesValue,
  collectCaioGoalLedgerRoleKeys,
  parseCaioGoalLedgerDocument,
  parseCaioGoalLedgerEntry,
  parseCaioGoalLedgerTimestamp,
} from "./contracts";

type Json = Record<string, unknown>;
const hex = (char: string) => char.repeat(64);

// Synthetic document: every list populated, no tenant, person or value content.
const validDocument = () => ({
  schema: "caio-goal-ledger-document/v1",
  goals: [
    {
      key: "goal.reliability",
      kind: "northstar",
      title: "示例：主链路稳定可用",
      standard: "连续两周没有阻断事故，复盘按时完成",
      metrics: [{
        key: "line_a.outcome",
        label: { zh: "结果", en: "Outcome" },
        unit: "count",
        direction: "up_good",
        basisRef: "basis.line_a.outcome",
      }],
      threshold: { ref: "threshold.goal.reliability", sha256: hex("b") },
      componentKeys: ["line_a", "line_b"],
    },
    {
      key: "goal.cadence",
      kind: "stage_metric",
      title: "Synthetic cadence goal",
      standard: "The weekly review happens on schedule",
      metrics: [],
      threshold: null,
      componentKeys: [],
    },
  ],
  components: [
    { key: "line_a", label: "示例工作线 A", primaryRoleKey: "line_a_owner" },
    { key: "line_b", label: "Synthetic line B", primaryRoleKey: "line_b_owner" },
  ],
  gates: [{ key: "gate.release", label: "发布关卡", holderRoleKey: "release_holder", note: "示例备注" }],
  roleBindingPin: { source: "caio_attention_route_config", version: 3, contentHash: hex("a") },
});

type Doc = ReturnType<typeof validDocument>;
const mutate = (change: (document: Doc & Json) => void) => {
  const document = validDocument() as Doc & Json;
  change(document);
  return document;
};
const goal = (document: Doc, index = 0) => document.goals[index] as Json & Doc["goals"][number];
const metric = (document: Doc) => goal(document).metrics[0] as Json & Doc["goals"][number]["metrics"][number];
const invalid = (detail: string) => ({ ok: false, errorCode: "document_invalid", detail });

describe("goal ledger document", () => {
  it("accepts a complete synthetic document as parsed", () => {
    expect(parseCaioGoalLedgerDocument(validDocument())).toEqual({ ok: true, document: validDocument() });
  });

  it("accepts a document without role keys only with a null pin", () => {
    const bare = mutate((document) => {
      document.components = [];
      document.gates = [];
      goal(document).componentKeys = [];
      (document as Json).roleBindingPin = null;
    });
    expect(parseCaioGoalLedgerDocument(bare).ok).toBe(true);
    expect(parseCaioGoalLedgerDocument({ ...bare, roleBindingPin: validDocument().roleBindingPin }))
      .toEqual(invalid("role_binding_pin_unexpected"));
  });

  it("refuses the minimal golden-sample document", () => {
    expect(parseCaioGoalLedgerDocument({ goals: [{ key: "g1", title: "示例目标：全链路可用" }], schema: "caio-goal-ledger-document/v1" }))
      .toEqual(invalid("shape_invalid"));
  });

  it.each<[string, (document: Doc & Json) => void]>([
    ["a threshold value next to the reference", (d) => { (goal(d).threshold as Json).value = 0.95; }],
    ["a goal-level line", (d) => { goal(d).line = 3; }],
    ["a metric target", (d) => { metric(d).target = 10; }],
    ["an extra label language", (d) => { (metric(d).label as Json).ja = "x"; }],
    ["a person on a component", (d) => { (d.components[0] as Json).owner = "user:u_1"; }],
    ["an extra gate key", (d) => { (d.gates[0] as Json).holderUserId = "u_1"; }],
    ["an extra pin key", (d) => { (d.roleBindingPin as Json).activatedAt = "2026-01-01T00:00:00Z"; }],
    ["an extra top-level key", (d) => { d.scores = {}; }],
    ["a missing pin key", (d) => { delete (d as Json).roleBindingPin; }],
    ["a wrong schema", (d) => { (d as Json).schema = "caio-goal-ledger-document/v2"; }],
    ["no goals", (d) => { d.goals = []; }],
    ["21 goals", (d) => { d.goals = Array.from({ length: 21 }, (_, i) => ({ ...goal(d, 1), key: `goal.g${i}` })); }],
    ["an unknown kind", (d) => { (goal(d) as Json).kind = "weekly"; }],
    ["an unknown unit", (d) => { (metric(d) as Json).unit = "currency"; }],
    ["an unknown direction", (d) => { (metric(d) as Json).direction = "higher"; }],
    ["a goal key outside the ref pattern", (d) => { goal(d).key = "goal key"; }],
    ["a basis ref outside the ref pattern", (d) => { metric(d).basisRef = "basis/a"; }],
    ["a role key with a space", (d) => { d.components[0].primaryRoleKey = "Line Owner"; }],
    ["a role key starting with a digit", (d) => { d.gates[0].holderRoleKey = "1holder"; }],
    ["a 65-character role key", (d) => { d.components[0].primaryRoleKey = "a".repeat(65); }],
    ["a 201-character title", (d) => { goal(d).title = "目".repeat(201); }],
    ["a blank standard", (d) => { goal(d).standard = "   "; }],
    ["an upper-case threshold digest", (d) => { goal(d).threshold = { ref: "threshold.x", sha256: hex("B") }; }],
    ["pin version 0", (d) => { d.roleBindingPin.version = 0; }],
    ["a fractional pin version", (d) => { d.roleBindingPin.version = 1.5; }],
    ["another pin source", (d) => { (d.roleBindingPin as Json).source = "workspace_settings"; }],
  ])("refuses %s", (_name, change) => {
    expect(parseCaioGoalLedgerDocument(mutate(change))).toEqual(invalid("shape_invalid"));
  });

  it.each<[string, (document: Doc & Json) => void]>([
    ["goal keys", (d) => { goal(d, 1).key = goal(d, 0).key; }],
    ["component keys", (d) => { d.components[1].key = "line_a"; goal(d).componentKeys = ["line_a"]; }],
    ["gate keys", (d) => { d.gates.push({ ...d.gates[0], label: "另一关卡" }); }],
    ["metric keys across goals", (d) => { goal(d, 1).metrics = [...goal(d, 0).metrics]; }],
    ["component references within a goal", (d) => { goal(d).componentKeys = ["line_a", "line_a"]; }],
  ])("refuses duplicate %s", (_name, change) => {
    expect(parseCaioGoalLedgerDocument(mutate(change))).toEqual(invalid("duplicate_key"));
  });

  it("refuses a component reference that does not resolve", () => {
    expect(parseCaioGoalLedgerDocument(mutate((d) => { goal(d).componentKeys = ["line_a", "line_c"]; })))
      .toEqual(invalid("unknown_component_key"));
  });

  it.each<[string, (document: Doc & Json) => void]>([
    ["components", (d) => { d.gates = []; }],
    ["gates", (d) => { d.components = []; goal(d).componentKeys = []; }],
  ])("requires the pin when %s carry role keys", (_name, change) => {
    expect(parseCaioGoalLedgerDocument(mutate((d) => { change(d); (d as Json).roleBindingPin = null; })))
      .toEqual(invalid("role_binding_pin_required"));
  });

  it.each<[string, (document: Doc & Json) => void]>([
    ["a title with an amount", (d) => { goal(d).title = "回款达到 1,000 元"; }],
    ["a standard with a percentage", (d) => { goal(d).standard = "完成率 30%"; }],
    ["a Chinese metric label with a currency sign", (d) => { metric(d).label.zh = "目标 ¥5000"; }],
    ["an English metric label with a spaced percentage", (d) => { metric(d).label.en = "Hit 12.5 % of plan"; }],
    ["a component label with full-width digits", (d) => { d.components[0].label = "覆盖３０％"; }],
    ["a gate label with 万元", (d) => { d.gates[0].label = "预算 2万元"; }],
    ["a gate note with an amount", (d) => { d.gates[0].note = "放行前核对 ¥300"; }],
    ["a gate note with a percentage", (d) => { d.gates[0].note = "上限 50%"; }],
  ])("refuses %s", (_name, change) => {
    expect(parseCaioGoalLedgerDocument(mutate(change))).toEqual({ ok: false, errorCode: "prose_carries_value" });
  });

  it("accepts a gate note in ordinary words, and a gate without a note", () => {
    expect(parseCaioGoalLedgerDocument(mutate((d) => { d.gates[0].note = "第 2 道关卡，放行前复核 3 次"; })).ok).toBe(true);
    expect(parseCaioGoalLedgerDocument(mutate((d) => { delete (d.gates[0] as Json).note; })).ok).toBe(true);
  });

  it("tells values from ordinary numbers in prose", () => {
    for (const prose of ["元数据完整", "元组与元素", "3 元组", "5 元数据", "2 元素", "第 3 版", "100 个部件", "v2 发布", "单价按元计",
      "2026 元旦前上线", "2026 元月", "3 元运算符", "2 元函数", "10 元器件", "目标 1，元旦前交付"]) {
      expect(caioGoalLedgerProseCarriesValue(prose)).toBe(false);
    }
    for (const prose of ["￥ 12", "3.5亿元", "100元", "1，000元", "８０％", "100 元", "元旦前付 100 元"]) {
      expect(caioGoalLedgerProseCarriesValue(prose)).toBe(true);
    }
  });

  it("collects role keys once each, components first", () => {
    const parsed = parseCaioGoalLedgerDocument(mutate((d) => { d.gates[0].holderRoleKey = "line_a_owner"; }));
    if (!parsed.ok) throw new Error("synthetic document must parse");
    expect(collectCaioGoalLedgerRoleKeys(parsed.document)).toEqual(["line_a_owner", "line_b_owner"]);
  });

  it("accepts exactly the northstar KPI units and directions", () => {
    for (const unit of CAIO_GOAL_LEDGER_METRIC_UNITS) {
      expect(parseCaioGoalLedgerDocument(mutate((d) => { (metric(d) as Json).unit = unit; })).ok).toBe(true);
    }
    for (const direction of CAIO_GOAL_LEDGER_METRIC_DIRECTIONS) {
      expect(parseCaioGoalLedgerDocument(mutate((d) => { (metric(d) as Json).direction = direction; })).ok).toBe(true);
    }
    const kpis = CAIO_GOAL_LEDGER_METRIC_UNITS.flatMap((unit) => CAIO_GOAL_LEDGER_METRIC_DIRECTIONS.map((direction) => ({
      key: `${unit}.${direction}`, label: "x", status: "pending_source" as const, unit, value: null, bandLabel: null,
      direction, href: null, basisRef: "basis.x", pendingSourceNote: "no source yet",
    })));
    expect(validateNorthstarKpis(kpis)).toEqual([]);
  });
});

describe("goal ledger entry", () => {
  const importedEntry = () => ({
    change: "首版 synthetic",
    files: { "caio/goal-ledger-document.json": hex("f"), "overlay/definitions.json": hex("0") },
    hash: hex("3"),
    owner_quote: "示例原话：\"本周目标\"不变\n第二行 \\ tab\t结束",
    prev_hash: CAIO_GOAL_LEDGER_GENESIS_PREV_HASH,
    seq: 1,
    ts: "2026-01-05T09:30:00+08:00",
    writer: "synthetic-session",
  });
  const appendedEntry = () => ({
    seq: 2,
    ts: "2026-01-12T02:00:00.000Z",
    owner_quote: "第二条",
    change: "二版",
    files: { [CAIO_GOAL_LEDGER_DOCUMENT_FILE_KEY]: hex("e") },
    prev_hash: hex("3"),
    hash: hex("4"),
    writer: "user:u_owner",
    effective_at: "2026-01-12T10:00:00+08:00",
    schema: "caio-goal-ledger-entry/v1",
  });

  it("accepts the imported and the locally appended forms", () => {
    expect(parseCaioGoalLedgerEntry(importedEntry())).toEqual({ ok: true, entry: importedEntry() });
    expect(parseCaioGoalLedgerEntry(appendedEntry())).toEqual({ ok: true, entry: appendedEntry() });
    const { writer: _writer, ...withoutWriter } = importedEntry();
    expect(parseCaioGoalLedgerEntry(withoutWriter).ok).toBe(true);
  });

  it("counts text limits in code points", () => {
    expect(parseCaioGoalLedgerEntry({ ...importedEntry(), owner_quote: "\u{1f600}".repeat(4000) }).ok).toBe(true);
    expect(parseCaioGoalLedgerEntry({ ...importedEntry(), owner_quote: "\u{1f600}".repeat(4001) }).ok).toBe(false);
  });

  const without = (key: string) => {
    const entry: Json = importedEntry();
    delete entry[key];
    return entry;
  };

  it.each<[string, unknown]>([
    ["an extra key", { ...importedEntry(), owner: "u_1" }],
    ...["seq", "ts", "owner_quote", "change", "files", "prev_hash", "hash"]
      .map((key): [string, unknown] => [`a missing ${key}`, without(key)]),
    ["seq 0", { ...importedEntry(), seq: 0 }],
    ["a fractional seq", { ...importedEntry(), seq: 1.5 }],
    ["a string seq", { ...importedEntry(), seq: "1" }],
    ["a timestamp without an offset", { ...importedEntry(), ts: "2026-01-05T09:30:00" }],
    ["a date-only timestamp", { ...importedEntry(), ts: "2026-01-05" }],
    ["an impossible calendar date", { ...importedEntry(), ts: "2026-02-30T09:30:00+08:00" }],
    ["hour 24", { ...appendedEntry(), effective_at: "2026-01-12T24:00:00Z" }],
    ["an upper-case file digest", { ...importedEntry(), files: { "a.json": hex("A") } }],
    ["an absolute file key", { ...importedEntry(), files: { "/a.json": hex("a") } }],
    ["a file key with a space", { ...importedEntry(), files: { "a b.json": hex("a") } }],
    ["501 sealed files", { ...importedEntry(), files: Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`f${i}`, hex("a")])) }],
    ["a short hash", { ...importedEntry(), hash: "3".repeat(63) }],
    ["an empty owner quote", { ...importedEntry(), owner_quote: "" }],
    ["a blank change", { ...importedEntry(), change: " \n" }],
    ["an empty writer", { ...importedEntry(), writer: "" }],
    ["a null writer", { ...importedEntry(), writer: null }],
    ["another entry schema", { ...appendedEntry(), schema: "caio-goal-ledger-entry/v2" }],
  ])("refuses %s", (_name, raw) => {
    expect(parseCaioGoalLedgerEntry(raw)).toEqual({ ok: false, errorCode: "entry_shape_invalid" });
  });
});

describe("timestamps", () => {
  it("reads offset and UTC forms to the same instant", () => {
    expect(parseCaioGoalLedgerTimestamp("2026-01-05T09:30:00+08:00")).toBe(Date.UTC(2026, 0, 5, 1, 30));
    expect(parseCaioGoalLedgerTimestamp("2026-01-05T01:30:00.000Z")).toBe(Date.UTC(2026, 0, 5, 1, 30));
    expect(parseCaioGoalLedgerTimestamp("2024-02-29T00:00:00-05:00")).toBe(Date.UTC(2024, 1, 29, 5));
  });

  it.each([["2025-02-29T00:00:00Z"], ["2026-13-01T00:00:00Z"], ["2026-01-05T09:60:00Z"], ["2026-01-05T09:30:00+24:00"],
    ["2026-01-05 09:30:00Z"], [""], [20260105]])("refuses %j", (value) => {
    expect(parseCaioGoalLedgerTimestamp(value)).toBeNull();
  });
});
