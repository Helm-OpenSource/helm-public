import { mkdtempSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => {
  // The command's identity may read Membership only; any other table read fails the test.
  const forbidden = () => {
    throw new Error("the pre-check read a table other than Membership");
  };
  return { dbMock: { membership: { findUnique: vi.fn() }, user: { findUnique: forbidden }, workspace: { findUnique: forbidden } } };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { CAIO_GOAL_LEDGER_GENESIS_PREV_HASH } from "@/lib/caio-goal-ledger/contracts";
import { createInMemoryCaioGoalLedgerStore } from "@/lib/caio-goal-ledger/testing/memory-store";
import {
  buildSyntheticCaioGoalLedgerChain,
  SYNTHETIC_IMPORT_DOCUMENT_FILE_KEY,
} from "@/lib/caio-goal-ledger/testing/synthetic-chain";
import { CAIO_GOAL_LEDGER_WRITE_REFUSAL_REASONS, CaioGoalLedgerWriteRefusal } from "@/lib/caio-goal-ledger/write.service";

import {
  CAIO_GOAL_LEDGER_IMPORT_FORMAT,
  CAIO_GOAL_LEDGER_IMPORT_MAX_ENTRIES,
  CAIO_GOAL_LEDGER_INPUT_FILE_MAX_BYTES,
  CAIO_GOAL_LEDGER_OPERATIONS,
  mapCaioGoalLedgerOperatorError,
  parseCaioGoalLedgerCliArgs,
  readCaioGoalLedgerInputFile,
  runCaioGoalLedgerOperation,
  verifyCaioGoalLedger,
} from "./goal-ledger-operator";
import { CAIO_OPERATOR_ERROR_CODES } from "./operator-error-codes";

const WORKSPACE = "ws_synthetic_a";
const OWNER = "u_synthetic_owner";
const QUOTE = "示例原话：先把主链路稳住";
const appendTemplate = CAIO_GOAL_LEDGER_OPERATIONS.appendEntry.template;
const templateDocument = appendTemplate.document as Record<string, unknown>;

function ownerStore() {
  const store = createInMemoryCaioGoalLedgerStore();
  store.loadMembership(WORKSPACE, OWNER, { role: WorkspaceRole.OWNER, status: MembershipStatus.ACTIVE });
  return store;
}

const run = (store: ReturnType<typeof ownerStore>, overrides: Partial<Parameters<typeof runCaioGoalLedgerOperation>[0]>) =>
  runCaioGoalLedgerOperation({
    operation: "appendEntry", workspaceId: WORKSPACE, actorUserId: OWNER, rawInput: { ...appendTemplate, ownerQuote: QUOTE },
    apply: true, english: false, ...overrides,
  }, store);

const bundleOf = (rows: ReturnType<typeof buildSyntheticCaioGoalLedgerChain>["entries"]) => ({
  format: CAIO_GOAL_LEDGER_IMPORT_FORMAT,
  documentFileKey: SYNTHETIC_IMPORT_DOCUMENT_FILE_KEY,
  entries: rows.map((row) => JSON.parse(row.entryJson) as unknown),
  documents: Object.fromEntries(rows.flatMap((row) => (row.document ? [[row.document.hash, row.document.text]] : []))),
});

const chain = buildSyntheticCaioGoalLedgerChain([
  { form: "imported", documentText: null },
  { form: "imported", documentText: null },
  { form: "imported", documentText: JSON.stringify(templateDocument, null, 2) },
]);

beforeEach(() => {
  dbMock.membership.findUnique.mockReset();
  dbMock.membership.findUnique.mockResolvedValue({ role: WorkspaceRole.OWNER, status: MembershipStatus.ACTIVE });
});

describe("runCaioGoalLedgerOperation", () => {
  it.each([
    ["an ADMIN", { role: WorkspaceRole.ADMIN, status: MembershipStatus.ACTIVE }],
    ["an inactive OWNER", { role: WorkspaceRole.OWNER, status: MembershipStatus.INACTIVE }],
    ["an invited OWNER", { role: WorkspaceRole.OWNER, status: MembershipStatus.INVITED }],
    ["a non-member", null],
  ])("refuses %s before the service and writes nothing", async (_name, membership) => {
    dbMock.membership.findUnique.mockResolvedValue(membership);
    const store = ownerStore();
    const writeTransaction = vi.fn(store.writeTransaction);
    const result = await run({ ...store, writeTransaction }, {});
    expect(result).toEqual({ ok: false, code: "not_owner", message: expect.any(String) });
    expect(writeTransaction).not.toHaveBeenCalled();
    expect(dbMock.membership.findUnique).toHaveBeenCalledWith({
      where: { workspaceId_userId: { workspaceId: WORKSPACE, userId: OWNER } }, select: { role: true, status: true },
    });
  });

  it("validates without writing unless apply is set", async () => {
    const store = ownerStore();
    expect(await run(store, { apply: false })).toEqual({ ok: true, value: { validated: true } });
    expect((await store.readChain(WORKSPACE)).entries).toEqual([]);
    expect(store.auditRows(WORKSPACE)).toEqual([]);
  });

  it.each([
    ["an unknown key", { ...appendTemplate, extra: 1 }],
    ["a head hash that is not a digest", { ...appendTemplate, expectedHeadHash: "head" }],
    ["a document that is not an object", { ...appendTemplate, document: "text" }],
    ["a missing quote", { ...appendTemplate, ownerQuote: undefined }],
  ])("refuses an append with %s as input_invalid", async (_name, rawInput) => {
    expect(await run(ownerStore(), { rawInput, apply: false })).toMatchObject({ ok: false, code: "input_invalid" });
  });

  it("caps an import at the entry limit", async () => {
    const bundle = (count: number) => ({ ...bundleOf(chain.entries), entries: Array.from({ length: count }, () => ({})) });
    const validate = (rawInput: unknown) => run(ownerStore(), { operation: "importChain", rawInput, apply: false });
    expect(await validate(bundle(CAIO_GOAL_LEDGER_IMPORT_MAX_ENTRIES))).toEqual({ ok: true, value: { validated: true } });
    for (const rawInput of [bundle(CAIO_GOAL_LEDGER_IMPORT_MAX_ENTRIES + 1), bundle(0), { ...bundle(1), format: "other/v1" }]) {
      expect(await validate(rawInput)).toMatchObject({ ok: false, code: "input_invalid" });
    }
  });

  it("appends the template with the owner's words and returns seq and digests only", async () => {
    const store = ownerStore();
    const result = await run(store, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.value).sort()).toEqual(["documentHash", "entryHash", "seq"]);
    expect(result.value.seq).toBe(1);
    expect(JSON.stringify(result)).not.toContain(QUOTE);
    expect((await store.readChain(WORKSPACE)).entries).toHaveLength(1);
  });

  it("imports a chain once, replays it, and refuses a fork at the entry it diverges", async () => {
    const store = ownerStore();
    const importing = (rawInput: unknown) => run(store, { operation: "importChain", rawInput });
    expect(await importing(bundleOf(chain.entries))).toMatchObject({ ok: true, value: { appended: 3, replayed: false, seq: 3 } });
    expect(await importing(bundleOf(chain.entries))).toMatchObject({ ok: true, value: { appended: 0, replayed: true } });
    const fork = buildSyntheticCaioGoalLedgerChain([
      { form: "imported", documentText: null },
      { form: "imported", documentText: JSON.stringify(templateDocument) },
    ]);
    expect(await importing(bundleOf(fork.entries))).toEqual({
      ok: false, code: "goal_ledger_rejected", message: expect.any(String), reason: "import_fork", atSeq: 2,
    });
  });

  it("refuses a stale head as a conflict with the reason and no owner text", async () => {
    const store = ownerStore();
    await run(store, {});
    const result = await run(store, { english: true });
    expect(result).toEqual({ ok: false, code: "goal_ledger_conflict", message: expect.any(String), reason: "head_conflict" });
    expect(JSON.stringify(result)).not.toContain(QUOTE);
  });

  it("refuses an in-transaction non-owner even when the pre-check passed", async () => {
    const store = createInMemoryCaioGoalLedgerStore();
    expect(await run(store, {})).toEqual({ ok: false, code: "not_owner", message: expect.any(String), reason: "not_owner" });
  });
});

describe("mapCaioGoalLedgerOperatorError", () => {
  it("maps every refusal and any other failure to a closed code", () => {
    for (const reason of CAIO_GOAL_LEDGER_WRITE_REFUSAL_REASONS) {
      const code = mapCaioGoalLedgerOperatorError(new CaioGoalLedgerWriteRefusal(reason, 2));
      const expected = reason === "not_owner" ? "not_owner" : reason === "head_conflict" ? "goal_ledger_conflict" : "goal_ledger_rejected";
      expect(code).toBe(expected);
    }
    for (const error of [new Error("private sql detail"), "text", null]) {
      expect(mapCaioGoalLedgerOperatorError(error)).toBe("unavailable");
    }
    expect(CAIO_OPERATOR_ERROR_CODES).toEqual(expect.arrayContaining(["goal_ledger_rejected", "goal_ledger_conflict"]));
  });
});

describe("verifyCaioGoalLedger", () => {
  it("exits 0 on an empty or intact ledger and prints the head without the document", async () => {
    const store = ownerStore();
    expect(await verifyCaioGoalLedger(WORKSPACE, store)).toEqual({ exitCode: 0, output: { state: "empty", readiness: { ready: true } } });
    await run(store, {});
    const { exitCode, output } = await verifyCaioGoalLedger(WORKSPACE, store);
    expect(exitCode).toBe(0);
    expect(output).toMatchObject({ state: "ok", head: { seq: 1, source: "command" }, readiness: { ready: true } });
    expect(Object.keys(output).sort()).toEqual(["head", "readiness", "state"]);
  });

  it("exits 3 on a rejected or unavailable ledger", async () => {
    const store = ownerStore();
    const [first, ...rest] = chain.entries;
    store.loadChain(WORKSPACE, { ...chain, entries: [{ ...first, entryJson: first.entryJson.replace("示例原话 1", "改") }, ...rest] });
    expect(await verifyCaioGoalLedger(WORKSPACE, store)).toMatchObject({ exitCode: 3, output: { state: "rejected", alarm: { atSeq: 1 } } });
    const missing = { ready: false, reason: "schema_incomplete", missing: ["CaioGoalLedgerHead.headSeq"] } as const;
    const broken = { ...store, readChain: () => Promise.reject(new Error("down")), probeSchemaReadiness: async () => missing };
    expect(await verifyCaioGoalLedger(WORKSPACE, broken)).toEqual({
      exitCode: 3, output: { state: "unavailable", reason: "schema_not_ready", readiness: missing },
    });
  });
});

describe("readCaioGoalLedgerInputFile", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "goal-ledger-input-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const file = (name: string, content: string | Buffer) => {
    const target = path.join(dir, name);
    writeFileSync(target, content);
    return target;
  };

  it("reads strict UTF-8 JSON and drops a byte order mark", () => {
    expect(readCaioGoalLedgerInputFile(file("ok.json", '{"q":"原话"}'))).toEqual({ ok: true, rawInput: { q: "原话" } });
    expect(readCaioGoalLedgerInputFile(file("bom.json", '﻿{"q":1}'))).toEqual({ ok: true, rawInput: { q: 1 } });
  });

  it("refuses with a closed reason and nothing from the file", () => {
    const large = file("large.json", "");
    truncateSync(large, CAIO_GOAL_LEDGER_INPUT_FILE_MAX_BYTES + 1);
    expect(readCaioGoalLedgerInputFile(large)).toEqual({ ok: false, reason: "input_file_too_large" });
    expect(readCaioGoalLedgerInputFile(path.join(dir, "absent.json"))).toEqual({ ok: false, reason: "input_file_unreadable" });
    expect(readCaioGoalLedgerInputFile(file("latin1.json", Buffer.from([0x7b, 0x22, 0xe9, 0x22, 0x7d]))))
      .toEqual({ ok: false, reason: "input_file_not_utf8" });
    expect(readCaioGoalLedgerInputFile(file("text.json", "原话不是 JSON"))).toEqual({ ok: false, reason: "input_file_not_json" });
  });
});

describe("parseCaioGoalLedgerCliArgs", () => {
  const runArgs = ["--operation=appendEntry", "--workspace-id=ws", "--actor-user-id=u", "--input-file=in.json"];
  it.each([
    [["--template=importChain"], { mode: "template", operation: "importChain" }],
    [["--verify", "--workspace-id=ws"], { mode: "verify", workspaceId: "ws" }],
    [runArgs, { mode: "run", operation: "appendEntry", workspaceId: "ws", actorUserId: "u", inputFile: "in.json", apply: false, english: false }],
    [[...runArgs, "--apply", "--english"], expect.objectContaining({ mode: "run", apply: true, english: true })],
    [["--template=appendEntry", "--apply"], { mode: "invalid", reason: "template_takes_no_other_arguments" }],
    [["--template=export"], { mode: "invalid", reason: "unknown_operation" }],
    [["--verify"], { mode: "invalid", reason: "verify_takes_only_workspace_id" }],
    [["--verify", "--workspace-id=ws", "--apply"], { mode: "invalid", reason: "verify_takes_only_workspace_id" }],
    [[...runArgs, "--apply", "--apply"], { mode: "invalid", reason: "duplicate_argument" }],
    [[...runArgs, "--workspace-id=other"], { mode: "invalid", reason: "duplicate_argument" }],
    [runArgs.slice(1), { mode: "invalid", reason: "missing_argument" }],
    [["--operation=exportChain", ...runArgs.slice(1)], { mode: "invalid", reason: "unknown_operation" }],
    [[...runArgs, "--force"], { mode: "invalid", reason: "unknown_argument" }],
    [[...runArgs, "--actor-name=x"], { mode: "invalid", reason: "unknown_argument" }],
  ])("parses %j", (argv, expected) => {
    expect(parseCaioGoalLedgerCliArgs(argv)).toEqual(expected);
  });
});

it("keeps the genesis hash in the append template", () => {
  expect(appendTemplate.expectedHeadHash).toBe(CAIO_GOAL_LEDGER_GENESIS_PREV_HASH);
});
