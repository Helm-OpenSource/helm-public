import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { describe, expect, it } from "vitest";

import type { CaioGoalLedgerStoredEntry } from "./chain";
import { CAIO_GOAL_LEDGER_DOCUMENT_FILE_KEY, CAIO_GOAL_LEDGER_GENESIS_PREV_HASH } from "./contracts";
import { readCaioGoalLedger } from "./read.service";
import { CaioGoalLedgerStoreError } from "./store-port";
import { createInMemoryCaioGoalLedgerStore } from "./testing/memory-store";
import {
  buildSyntheticCaioGoalLedgerChain,
  sealSyntheticCaioGoalLedgerEntry,
  SYNTHETIC_IMPORT_DOCUMENT_FILE_KEY,
  SYNTHETIC_ROUTE_CONFIG_JSON,
  SYNTHETIC_ROUTE_CONFIG_VERSION,
  syntheticCaioGoalLedgerDocument,
  syntheticDocumentText,
  syntheticSha256,
  type SyntheticEntrySpec,
} from "./testing/synthetic-chain";
import { appendCaioGoalLedgerEntry, CaioGoalLedgerWriteRefusal, importCaioGoalLedgerChain } from "./write.service";

const WORKSPACE = "ws_synthetic_a";
const OWNER = "u_synthetic_owner";
const NOW = new Date("2026-03-01T00:00:00.000Z");
const QUOTE = "示例原话：把主链路稳定性放在第一位 🚩\n第二行";
const document = syntheticCaioGoalLedgerDocument();

// Four imported entries under the bundle's own files key; the second and the head carry a document, in two layouts.
const IMPORTED: SyntheticEntrySpec[] = [
  { form: "imported", documentText: null },
  { form: "imported", documentText: JSON.stringify(document) },
  { form: "imported", documentText: null },
  { form: "imported", documentText: syntheticDocumentText("imported") },
];
const imported = (specs: readonly SyntheticEntrySpec[] = IMPORTED) => buildSyntheticCaioGoalLedgerChain(specs);

function ownerStore() {
  const store = createInMemoryCaioGoalLedgerStore();
  store.loadMembership(WORKSPACE, OWNER, { role: WorkspaceRole.OWNER, status: MembershipStatus.ACTIVE });
  const row = { configJson: SYNTHETIC_ROUTE_CONFIG_JSON, contentHash: syntheticSha256(SYNTHETIC_ROUTE_CONFIG_JSON) };
  // The pinned version is published but not the active one: a write needs it to exist, not to be active.
  store.loadRouteConfig(WORKSPACE, { activeVersion: 4, versions: { [SYNTHETIC_ROUTE_CONFIG_VERSION]: row } });
  return store;
}

const appendInput = (overrides: Record<string, unknown> = {}) => ({
  workspaceId: WORKSPACE, actorUserId: OWNER, ownerQuote: QUOTE, change: "设定示例目标", effectiveAt: "2026-02-28T10:00:00+08:00",
  expectedHeadHash: CAIO_GOAL_LEDGER_GENESIS_PREV_HASH, document: document as unknown, ...overrides,
});

const bundleOf = (rows: readonly CaioGoalLedgerStoredEntry[], documents?: Record<string, string>) => ({
  workspaceId: WORKSPACE, actorUserId: OWNER, documentFileKey: SYNTHETIC_IMPORT_DOCUMENT_FILE_KEY,
  entries: rows.map((row) => JSON.parse(row.entryJson) as unknown),
  documents: documents ?? Object.fromEntries(rows.flatMap((row) => (row.document ? [[row.document.hash, row.document.text]] : []))),
});

async function refusalOf(write: Promise<unknown>): Promise<string> {
  try {
    await write;
    return "written";
  } catch (error) {
    if (!(error instanceof CaioGoalLedgerWriteRefusal)) throw error;
    return error.atSeq === null ? error.reason : `${error.reason}@${error.atSeq}`;
  }
}

const stateOf = async (store: ReturnType<typeof ownerStore>) =>
  ({ chain: await store.readChain(WORKSPACE), audit: store.auditRows(WORKSPACE) });

describe("appendCaioGoalLedgerEntry", () => {
  it("appends the first entry: a canonical document under the fixed key, read back ok, one audit row without content", async () => {
    const store = ownerStore();
    const result = await appendCaioGoalLedgerEntry(store, appendInput(), NOW);

    const [row] = (await store.readChain(WORKSPACE)).entries;
    expect(result).toEqual({ seq: 1, entryHash: row.entryHash, prevHash: CAIO_GOAL_LEDGER_GENESIS_PREV_HASH, documentHash: row.document?.hash });
    expect(row.document).toEqual({ fileKey: CAIO_GOAL_LEDGER_DOCUMENT_FILE_KEY, hash: syntheticSha256(syntheticDocumentText("appended")),
      text: syntheticDocumentText("appended") });
    expect(row.entryJson).toBe(sealSyntheticCaioGoalLedgerEntry({
      seq: 1, ts: NOW.toISOString(), owner_quote: QUOTE, change: "设定示例目标", files: { [CAIO_GOAL_LEDGER_DOCUMENT_FILE_KEY]: row.document?.hash },
      prev_hash: CAIO_GOAL_LEDGER_GENESIS_PREV_HASH, writer: `user:${OWNER}`, effective_at: "2026-02-28T10:00:00+08:00",
      schema: "caio-goal-ledger-entry/v1",
    }, null, "command").entryJson);
    expect(row).toMatchObject({ source: "command", effectiveAt: new Date("2026-02-28T02:00:00.000Z") });

    const read = await readCaioGoalLedger(store, { workspaceId: WORKSPACE });
    expect(read).toMatchObject({ state: "ok", head: { seq: 1, entryHash: row.entryHash, source: "command" }, document });

    const audit = store.auditRows(WORKSPACE);
    expect(audit).toEqual([{
      actionType: "CAIO_GOAL_LEDGER_ENTRY_APPENDED", targetId: row.entryHash, summary: expect.any(String), actorUserId: OWNER,
      payload: { seq: 1, entryHash: row.entryHash, prevHash: CAIO_GOAL_LEDGER_GENESIS_PREV_HASH, documentHash: row.document?.hash, source: "command" },
    }]);
    expect(JSON.stringify(audit)).not.toMatch(/示例原话|设定示例目标|主链路稳定可用/u);
  });

  it("appends on top of an imported chain and of its own entries", async () => {
    const store = ownerStore();
    const chain = imported();
    store.loadChain(WORKSPACE, chain);
    const fifth = await appendCaioGoalLedgerEntry(store, appendInput({ expectedHeadHash: chain.head?.headHash }), NOW);
    const sixth = await appendCaioGoalLedgerEntry(store, appendInput({ expectedHeadHash: fifth.entryHash }), NOW);
    expect([fifth.seq, sixth.seq, sixth.prevHash]).toEqual([5, 6, fifth.entryHash]);
    expect(await readCaioGoalLedger(store, { workspaceId: WORKSPACE })).toMatchObject({ state: "ok", head: { seq: 6, entryHash: sixth.entryHash } });
    expect(store.auditRows(WORKSPACE)).toHaveLength(2);
  });

  it("refuses anyone but an ACTIVE OWNER called directly, before looking at the chain, and writes nothing", async () => {
    const actors = [
      ["u_admin", { role: WorkspaceRole.ADMIN, status: MembershipStatus.ACTIVE }],
      ["u_operator", { role: WorkspaceRole.OPERATOR, status: MembershipStatus.ACTIVE }],
      ["u_invited_owner", { role: WorkspaceRole.OWNER, status: MembershipStatus.INVITED }],
      ["u_inactive_owner", { role: WorkspaceRole.OWNER, status: MembershipStatus.INACTIVE }],
      ["u_stranger", null],
    ] as const;
    for (const chain of [null, imported(), { ...imported(), head: null }]) {
      const store = ownerStore();
      if (chain !== null) store.loadChain(WORKSPACE, chain);
      const before = await stateOf(store);
      for (const [actorUserId, membership] of actors) {
        if (membership !== null) store.loadMembership(WORKSPACE, actorUserId, membership);
        const head = chain?.head?.headHash ?? CAIO_GOAL_LEDGER_GENESIS_PREV_HASH;
        expect(await refusalOf(appendCaioGoalLedgerEntry(store, appendInput({ actorUserId, expectedHeadHash: head }), NOW))).toBe("not_owner");
        expect(await refusalOf(importCaioGoalLedgerChain(store, { ...bundleOf(imported().entries), actorUserId }))).toBe("not_owner");
      }
      expect(await stateOf(store)).toEqual(before);
    }
  });

  it("refuses a stale expected head, and of two writers on the same head exactly one lands", async () => {
    const store = ownerStore();
    const first = await appendCaioGoalLedgerEntry(store, appendInput(), NOW);
    const before = await stateOf(store);
    expect(await refusalOf(appendCaioGoalLedgerEntry(store, appendInput(), NOW))).toBe("head_conflict");
    expect(await refusalOf(appendCaioGoalLedgerEntry(store, appendInput({ expectedHeadHash: "f".repeat(64) }), NOW))).toBe("head_conflict");
    expect(await stateOf(store)).toEqual(before);

    const racing = await Promise.all([1, 2].map((n) =>
      refusalOf(appendCaioGoalLedgerEntry(store, appendInput({ change: `racer ${n}`, expectedHeadHash: first.entryHash }), NOW))));
    expect(racing.sort()).toEqual(["head_conflict", "written"]);
    expect((await store.readChain(WORKSPACE)).entries).toHaveLength(2);
    expect(store.auditRows(WORKSPACE)).toHaveLength(2);
  });

  it("reports a race the store lost and rolled back as head_conflict, and passes any other failure through", async () => {
    const failing = (error: Error) => ({ ...ownerStore(), writeTransaction: async () => { throw error; } });
    const lost = new CaioGoalLedgerStoreError("write_conflict");
    const refused = await appendCaioGoalLedgerEntry(failing(lost), appendInput(), NOW).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(CaioGoalLedgerWriteRefusal);
    expect([(refused as CaioGoalLedgerWriteRefusal).reason, (refused as Error).cause]).toEqual(["head_conflict", lost]);
    const broken = new Error("connection lost");
    await expect(appendCaioGoalLedgerEntry(failing(broken), appendInput(), NOW)).rejects.toBe(broken);
  });

  it("refuses to append to a chain that does not verify, naming where it broke", async () => {
    const store = ownerStore();
    const { entries, head } = imported();
    store.loadChain(WORKSPACE, { entries: entries.map((row) => (row.seq === 2 ? { ...row, entryJson: row.entryJson.replace("示例原话", "改过") } : row)), head });
    const before = await stateOf(store);
    expect(await refusalOf(appendCaioGoalLedgerEntry(store, appendInput({ expectedHeadHash: head?.headHash }), NOW))).toBe("chain_rejected@2");
    store.loadChain(WORKSPACE, { entries: entries.slice(0, 3), head });
    expect(await refusalOf(appendCaioGoalLedgerEntry(store, appendInput({ expectedHeadHash: entries[2].entryHash }), NOW))).toBe("chain_rejected");
    expect(store.auditRows(WORKSPACE)).toEqual(before.audit);
  });

  it("checks the effective time against now and the previous entry, and the entry fields", async () => {
    const store = ownerStore();
    const chain = imported();
    store.loadChain(WORKSPACE, chain);
    const on = (overrides: Record<string, unknown>) =>
      refusalOf(appendCaioGoalLedgerEntry(store, appendInput({ expectedHeadHash: chain.head?.headHash, ...overrides }), NOW));
    const before = await stateOf(store);
    expect(await on({ effectiveAt: "2026-03-01T08:00:01+08:00" })).toBe("effective_at_in_future");
    expect(await on({ effectiveAt: "2026-01-04T09:29:59+08:00" })).toBe("effective_at_regression");
    expect(await on({ effectiveAt: "2026-02-30T10:00:00+08:00" })).toBe("entry_invalid");
    expect(await on({ ownerQuote: "   " })).toBe("entry_invalid");
    expect(await on({ change: "长".repeat(4001) })).toBe("entry_invalid");
    expect(await on({ ownerQuote: "\uD800 lone" })).toBe("entry_invalid");
    expect(await stateOf(store)).toEqual(before);
    expect(await on({ effectiveAt: "2026-01-04T09:30:00+08:00", ownerQuote: "长".repeat(4000) })).toBe("written");
    expect(await on({ effectiveAt: NOW.toISOString(), expectedHeadHash: (await store.readChain(WORKSPACE)).head?.headHash })).toBe("written");
  });

  it("refuses an invalid document, prose carrying a value, and a pin the stored route config does not hold", async () => {
    const store = ownerStore();
    const before = await stateOf(store);
    const [goal, ...goals] = document.goals;
    const on = (doc: unknown) => refusalOf(appendCaioGoalLedgerEntry(store, appendInput({ document: doc }), NOW));
    expect(await on({ ...document, goals: [{ ...goal, threshold: { ...goal.threshold, value: 30 } }, ...goals] })).toBe("document_invalid");
    expect(await on({ ...document, goals: [{ ...goal, title: "转化率提升到 30%" }, ...goals] })).toBe("prose_carries_value");
    const pin = document.roleBindingPin!;
    expect(await on({ ...document, roleBindingPin: { ...pin, version: 9 } })).toBe("role_binding_pin_invalid");
    expect(await on({ ...document, roleBindingPin: { ...pin, contentHash: "c".repeat(64) } })).toBe("role_binding_pin_invalid");
    expect(await on({ ...document, components: [], gates: [], goals: [{ ...goal, componentKeys: [] }], roleBindingPin: null })).toBe("written");
    expect((await stateOf(store)).chain.entries).toHaveLength(before.chain.entries.length + 1);
  });
});

describe("importCaioGoalLedgerChain", () => {
  it("imports a chain into an empty ledger and keeps every line and document byte for byte", async () => {
    const store = ownerStore();
    const source = imported();
    expect(await importCaioGoalLedgerChain(store, bundleOf(source.entries))).toEqual({
      appended: 4, replayed: false, seq: 4, entryHash: source.entries[3].entryHash, documentHash: source.entries[3].document?.hash,
    });
    const stored = (await store.readChain(WORKSPACE)).entries;
    expect(stored.map((row) => row.entryJson)).toEqual(source.entries.map((row) => row.entryJson));
    expect(stored.map((row) => row.document)).toEqual(source.entries.map((row) => row.document));
    expect(stored.every((row) => row.source === "import")).toBe(true);
    expect(await readCaioGoalLedger(store, { workspaceId: WORKSPACE })).toMatchObject({ state: "ok", head: { seq: 4, source: "import" }, document });
    expect(store.auditRows(WORKSPACE)).toEqual([{
      actionType: "CAIO_GOAL_LEDGER_CHAIN_IMPORTED", targetId: source.entries[3].entryHash, summary: expect.any(String), actorUserId: OWNER,
      payload: { fromSeq: 1, toSeq: 4, entryHash: source.entries[3].entryHash, prevHash: CAIO_GOAL_LEDGER_GENESIS_PREV_HASH,
        documentHash: source.entries[3].document?.hash, source: "import" },
    }]);
  });

  it("writes nothing for the same chain again, adds only what a longer bundle has beyond it, and refuses a fork", async () => {
    const store = ownerStore();
    const longer = imported([...IMPORTED, { form: "imported", documentText: syntheticDocumentText("imported") }]);
    const four = longer.entries.slice(0, 4);
    await importCaioGoalLedgerChain(store, bundleOf(four));
    const once = await stateOf(store);
    expect(await importCaioGoalLedgerChain(store, bundleOf(four))).toMatchObject({ appended: 0, replayed: true, seq: 4 });
    expect(await stateOf(store)).toEqual(once);

    // History documents already stored need not travel again.
    const withoutHistory = { [longer.entries[4].document!.hash]: longer.entries[4].document!.text };
    expect(await importCaioGoalLedgerChain(store, bundleOf(longer.entries, withoutHistory))).toMatchObject({ appended: 1, replayed: false, seq: 5 });
    expect(store.auditRows(WORKSPACE).at(-1)?.payload).toMatchObject({ fromSeq: 5, toSeq: 5, prevHash: four[3].entryHash });
    const five = await stateOf(store);

    const forked = imported(IMPORTED.map((spec, index) => (index === 2 ? { ...spec, documentText: syntheticDocumentText("imported") } : spec)));
    expect(await refusalOf(importCaioGoalLedgerChain(store, bundleOf(forked.entries)))).toBe("import_fork@3");
    expect(await refusalOf(importCaioGoalLedgerChain(store, bundleOf(four)))).toBe("import_fork@5");
    await appendCaioGoalLedgerEntry(store, appendInput({ expectedHeadHash: longer.entries[4].entryHash }), NOW);
    expect(await refusalOf(importCaioGoalLedgerChain(store, bundleOf(longer.entries)))).toBe("import_fork@6");
    expect((await stateOf(store)).audit).toHaveLength(five.audit.length + 1);
  });

  it("refuses a bundle whose chain, documents or head do not verify, and writes nothing", async () => {
    const store = ownerStore();
    const { entries } = imported();
    const lines = bundleOf(entries);
    const on = (bundle: ReturnType<typeof bundleOf>) => refusalOf(importCaioGoalLedgerChain(store, bundle));
    const [second, head] = [entries[1].document!, entries[3].document!];
    expect(await on({ ...lines, entries: [] })).toBe("bundle_chain_invalid");
    expect(await on({ ...lines, entries: [lines.entries[0], lines.entries[2], lines.entries[3]] })).toBe("bundle_chain_invalid@2");
    expect(await on({ ...lines, entries: lines.entries.map((entry, index) => (index === 1 ? { ...(entry as object), owner_quote: "改过" } : entry)) }))
      .toBe("bundle_chain_invalid@2");
    expect(await on({ ...lines, entries: [{ ...(lines.entries[0] as object), extra: true }, ...lines.entries.slice(1)] })).toBe("bundle_chain_invalid@1");
    expect(await on({ ...lines, documents: { [head.hash]: head.text } })).toBe("document_missing@2");
    expect(await on({ ...lines, documents: { ...lines.documents, [second.hash]: `${second.text}\n` } })).toBe("document_hash_mismatch@2");
    expect(await on({ ...lines, documents: { [second.hash]: second.text } })).toBe("head_document_missing@4");
    expect(await on(bundleOf(imported(IMPORTED.slice(0, 3)).entries))).toBe("head_document_missing@3");
    const [goal, ...goals] = document.goals;
    const headWith = (doc: unknown) => bundleOf(imported([...IMPORTED.slice(0, 3), { form: "imported", documentText: JSON.stringify(doc) }]).entries);
    expect(await on(headWith({ ...document, goals: [{ ...goal, title: "毛利 5 万元" }, ...goals] }))).toBe("prose_carries_value@4");
    expect(await on(headWith({ ...document, schema: "other" }))).toBe("document_invalid@4");
    expect(await on(headWith({ ...document, roleBindingPin: { ...document.roleBindingPin!, version: 9 } }))).toBe("role_binding_pin_invalid");
    expect(await stateOf(store)).toEqual({ chain: { entries: [], head: null }, audit: [] });
  });
});
