import { describe, expect, it } from "vitest";

import type { NorthstarKpi } from "@/lib/shell/northstar-kpi";

import { CAIO_GOAL_LEDGER_ALARM_CODES, type CaioGoalLedgerAlarmCode, type CaioGoalLedgerStoredEntry } from "./chain";
import { evaluateCaioGoalThresholdEcho, projectCaioGoalReadouts } from "./metric-readout";
import { readCaioGoalLedger, readCaioGoalLedgerRoleBindings } from "./read.service";
import type { CaioGoalLedgerSchemaReadiness } from "./schema-readiness";
import { type CaioGoalLedgerChainRows, type CaioGoalLedgerStore, CaioGoalLedgerStoreError } from "./store-port";
import { createInMemoryCaioGoalLedgerStore, type InMemoryCaioGoalLedgerStore } from "./testing/memory-store";
import {
  buildSyntheticCaioGoalLedgerChain,
  sealSyntheticCaioGoalLedgerEntry,
  SYNTHETIC_RECORDED_AT,
  SYNTHETIC_ROUTE_CONFIG_JSON,
  SYNTHETIC_ROUTE_CONFIG_VERSION,
  syntheticCaioGoalLedgerDocument,
  syntheticDocumentText,
  type SyntheticEntrySpec,
} from "./testing/synthetic-chain";

const WORKSPACE = "ws_synthetic_a";
const MIXED: SyntheticEntrySpec[] = [
  { form: "imported", documentText: null },
  { form: "imported", documentText: syntheticDocumentText("imported") },
  { form: "imported", documentText: null },
  { form: "appended", documentText: syntheticDocumentText("appended") },
  { form: "appended", documentText: syntheticDocumentText("appended") },
];
const mixed = () => buildSyntheticCaioGoalLedgerChain(MIXED);

const readLoaded = (rows: CaioGoalLedgerChainRows | null) => {
  const store = createInMemoryCaioGoalLedgerStore();
  if (rows !== null) store.loadChain(WORKSPACE, rows);
  return readCaioGoalLedger(store, { workspaceId: WORKSPACE });
};
const readOk = async () => {
  const read = await readLoaded(mixed());
  if (read.state !== "ok") throw new Error(`expected an ok read, got ${read.state}`);
  return read;
};
const at = (seq: number, change: (row: CaioGoalLedgerStoredEntry) => Partial<CaioGoalLedgerStoredEntry>) => {
  const { entries, head } = mixed();
  return { entries: entries.map((row) => (row.seq === seq ? { ...row, ...change(row) } : row)), head };
};
const reseal = (seq: number, change: Record<string, unknown>) => {
  const { entries, head } = mixed();
  const row = entries[seq - 1];
  const { hash: _hash, ...entry } = JSON.parse(row.entryJson) as Record<string, unknown>;
  entries[seq - 1] = sealSyntheticCaioGoalLedgerEntry({ ...entry, ...change }, row.document, row.source);
  return { entries, head };
};

describe("readCaioGoalLedger", () => {
  it("is empty only for a workspace that holds no entries and no anchor", async () => {
    const store = createInMemoryCaioGoalLedgerStore();
    store.loadChain("ws_synthetic_b", mixed());
    expect(await readCaioGoalLedger(store, { workspaceId: WORKSPACE })).toEqual({ state: "empty" });
  });

  it("verifies the chain in seq order whatever order the rows were loaded in", async () => {
    const { entries, head } = mixed();
    expect(await readLoaded({ entries: [...entries].reverse(), head })).toEqual({
      state: "ok",
      head: {
        seq: 5, entryHash: entries[4].entryHash, documentHash: entries[4].document!.hash,
        effectiveAt: "2026-02-05T10:00:00+08:00", recordedAt: SYNTHETIC_RECORDED_AT.toISOString(), source: "command",
      },
      document: syntheticCaioGoalLedgerDocument(),
      sealedDigests: JSON.parse(entries[4].entryJson).files,
    });
  });

  // One stored break per alarm code; each rejects the whole ledger of five and the read carries nothing but the alarm.
  const breaks: Array<[string, () => CaioGoalLedgerChainRows, CaioGoalLedgerAlarmCode, number | null, number]> = [
    ["entry text that is not an entry", () => at(1, () => ({ entryJson: "{}" })), "entry_shape_invalid", 1, 0],
    ["a missing entry", () => ({ ...mixed(), entries: mixed().entries.filter((row) => row.seq !== 3) }), "seq_gap", 3, 2],
    ["a seq column moved past the head, which reorders the rows", () => at(2, () => ({ seq: 7 })), "seq_gap", 2, 1],
    ["an entry edited and resealed, caught by its successor", () => reseal(2, { owner_quote: "改过的原话" }),
      "prev_hash_mismatch", 3, 2],
    ["entry 2 of 5 with its owner quote edited in place",
      () => at(2, (row) => ({ entryJson: row.entryJson.replace("示例原话 2", "示例原话 2（改）") })), "entry_hash_mismatch", 2, 1],
    ["an entry-hash column", () => at(3, () => ({ entryHash: "c".repeat(64) })), "column_mismatch", 3, 2],
    ["no anchor", () => ({ ...mixed(), head: null }), "head_anchor_missing", null, 5],
    ["a truncated tail", () => ({ ...mixed(), entries: mixed().entries.slice(0, 4) }), "head_anchor_mismatch", null, 4],
    ["an anchor without entries", () => ({ entries: [], head: mixed().head }), "head_anchor_mismatch", null, 0],
    ["a head whose document columns were cleared", () => at(5, () => ({ document: null })), "document_missing", 5, 4],
    ["an edited head document", () => at(5, (row) => ({ document: { ...row.document!, text: `${row.document!.text} ` } })),
      "document_hash_mismatch", 5, 4],
    ["a sealed head document with an unknown key", () => buildSyntheticCaioGoalLedgerChain([...MIXED.slice(0, 4),
      { form: "appended", documentText: syntheticDocumentText("appended", { ...syntheticCaioGoalLedgerDocument(), scores: {} }) }]),
    "document_invalid", 5, 4],
  ];

  it.each(breaks)("rejects %s", async (_name, build, code, atSeq, verifiedThroughSeq) => {
    const rows = build();
    const read = await readLoaded(rows);
    expect(read).toEqual({ state: "rejected", alarm: { code, atSeq, verifiedThroughSeq, entryCount: rows.entries.length } });
    expect(Object.keys(read)).toEqual(["state", "alarm"]);
  });

  it("reaches every alarm code", () => {
    expect(new Set(breaks.map(([, , code]) => code))).toEqual(new Set(CAIO_GOAL_LEDGER_ALARM_CODES));
  });

  const failing = (error: Error, readiness: CaioGoalLedgerSchemaReadiness): CaioGoalLedgerStore => ({
    ...createInMemoryCaioGoalLedgerStore(),
    readChain: async () => { throw error; },
    probeSchemaReadiness: async () => readiness,
  });

  it.each<[string, Error, CaioGoalLedgerSchemaReadiness, "schema_not_ready" | "read_failed"]>([
    ["missing columns", new Error("table missing"),
      { ready: false, reason: "schema_incomplete", missing: ["CaioGoalLedgerHead.headHash"] }, "schema_not_ready"],
    ["a ready schema", new Error("connection lost"), { ready: true }, "read_failed"],
    ["a probe that failed too", new Error("connection lost"), { ready: false, reason: "probe_failed", missing: [] }, "read_failed"],
    ["a ready schema, given a row the port cannot express", new CaioGoalLedgerStoreError("row_invalid"), { ready: true },
      "read_failed"],
  ])("reads a store that throws as unavailable, never empty, with %s", async (_name, error, readiness, reason) => {
    expect(await readCaioGoalLedger(failing(error, readiness), { workspaceId: WORKSPACE })).toEqual({ state: "unavailable", reason });
  });
});

describe("readCaioGoalLedgerRoleBindings", () => {
  const readBindings = async (rows: Parameters<InMemoryCaioGoalLedgerStore["loadRouteConfig"]>[1] | null) => {
    const { document } = await readOk();
    const store = createInMemoryCaioGoalLedgerStore();
    if (rows !== null) store.loadRouteConfig(WORKSPACE, rows);
    return readCaioGoalLedgerRoleBindings(store, { workspaceId: WORKSPACE, pin: document.roleBindingPin! });
  };
  const pinned = { configJson: SYNTHETIC_ROUTE_CONFIG_JSON, contentHash: syntheticCaioGoalLedgerDocument().roleBindingPin!.contentHash };
  const version = SYNTHETIC_ROUTE_CONFIG_VERSION;

  it("resolves people for the pin of a verified head document while the pinned version is active", async () => {
    expect(await readBindings({ activeVersion: version, versions: { [version]: pinned } })).toEqual({
      state: "match",
      routeConfigVersion: version,
      roleBindings: { line_a_owner: ["u_line_a"], line_b_owner: ["u_line_b"], release_holder: ["u_release"] },
    });
  });

  it("reports drift when another version is active or none is", async () => {
    expect(await readBindings({ activeVersion: version + 1, versions: { [version]: pinned, [version + 1]: pinned } }))
      .toEqual({ state: "drift", pinnedVersion: version, activeVersion: version + 1 });
    expect(await readBindings(null)).toEqual({ state: "drift", pinnedVersion: version, activeVersion: null });
  });

  it.each([
    ["missing", {}],
    ["re-serialized", { [version]: { ...pinned, configJson: JSON.stringify(JSON.parse(SYNTHETIC_ROUTE_CONFIG_JSON), null, 1) } }],
  ])("never matches when the pinned version is active but its row is %s", async (_name, versions) => {
    expect(await readBindings({ activeVersion: version, versions })).toEqual({ state: "route_config_missing" });
  });

  it("reads a store that throws as unavailable", async () => {
    const store: CaioGoalLedgerStore = {
      ...createInMemoryCaioGoalLedgerStore(),
      readActiveRouteConfig: async () => { throw new Error("connection lost"); },
    };
    const { document } = await readOk();
    expect(await readCaioGoalLedgerRoleBindings(store, { workspaceId: WORKSPACE, pin: document.roleBindingPin! }))
      .toEqual({ state: "unavailable" });
  });
});

describe("readouts of a verified head document", () => {
  const sourceKpi = (overrides: Partial<NorthstarKpi>): NorthstarKpi => ({
    key: "line_a.outcome", label: "Source outcome", status: "measured", unit: "count", value: 0, bandLabel: null,
    direction: "up_good", href: "/northstar", basisRef: "basis.source.outcome", ...overrides,
  });

  it("projects every metric state and threshold state, never reading an unsourced metric as 0", async () => {
    const { document } = await readOk();
    const readouts = projectCaioGoalReadouts(document, [
      sourceKpi({}),
      sourceKpi({ key: "line_a.quality", unit: "count", value: 3 }),
      sourceKpi({ key: "review.close_days", unit: "days", status: "no_data", value: null, direction: "down_good" }),
    ], false);
    expect(readouts.flatMap((readout) => readout.metrics).map(({ key, status, value }) => ({ key, status, value }))).toEqual([
      { key: "line_a.outcome", status: "measured", value: 0 },
      { key: "line_a.quality", status: "pending_source", value: null },
      { key: "review.close_days", status: "no_data", value: null },
      { key: "review.spend_band", status: "pending_source", value: null },
    ]);
    expect(readouts.map((readout) => readout.threshold?.state)).toEqual(["pinned", "unset"]);
    const [pinnedGoal, unsetGoal] = document.goals;
    expect(evaluateCaioGoalThresholdEcho(pinnedGoal.threshold, "b".repeat(64))).toBe("match");
    expect(evaluateCaioGoalThresholdEcho(pinnedGoal.threshold, "c".repeat(64))).toBe("mismatch");
    expect(evaluateCaioGoalThresholdEcho(unsetGoal.threshold, null)).toBe("unset");
  });
});
