import { MembershipStatus, Prisma, PrismaClient, WorkspaceRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type CaioGoalLedgerStoredEntry, verifyCaioGoalLedgerChain } from "./chain";
import { CAIO_GOAL_LEDGER_GENESIS_PREV_HASH } from "./contracts";
import { CAIO_GOAL_LEDGER_FIXTURE_IDENTITIES } from "./least-privilege-fixture";
import { createPrismaCaioGoalLedgerStore } from "./prisma-store";
import { readCaioGoalLedger, readCaioGoalLedgerRoleBindings } from "./read.service";
import { type CaioGoalLedgerChainRows, type CaioGoalLedgerStore, CaioGoalLedgerStoreError } from "./store-port";
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

/**
 * CAIO goal ledger store on an isolated MySQL database, through the ledger's two least-privilege fixture identities.
 *
 *   CAIO_GOAL_LEDGER_DATABASE_URL=<disposable helm_caio_goal_ledger_* db, migration identity> DATABASE_URL=<same>
 *   CAIO_GOAL_LEDGER_{READER,OPS}_DATABASE_URL=<fixture identities on the same db, granted by
 *     scripts/caio-goal-ledger-grant-fixture.ts>
 *   npm run test:caio-goal-ledger:mysql   (sets CAIO_GOAL_LEDGER_MYSQL_REQUIRED=1: a missing URL fails instead of skipping)
 *
 * The migration identity needs every privilege on that database and nothing beyond it: the suite reads only its
 * own connections' state, never another user's.
 */
const urls = {
  admin: process.env.CAIO_GOAL_LEDGER_DATABASE_URL,
  goal_ledger_reader: process.env.CAIO_GOAL_LEDGER_READER_DATABASE_URL,
  goal_ledger_ops: process.env.CAIO_GOAL_LEDGER_OPS_DATABASE_URL,
};
const configured = Object.values(urls).every(Boolean);
if (process.env.CAIO_GOAL_LEDGER_MYSQL_REQUIRED === "1" && !configured) {
  throw new Error("CAIO_GOAL_LEDGER_MYSQL_REQUIRED=1 but a CAIO_GOAL_LEDGER_*_DATABASE_URL is missing.");
}
const describeMysql = configured ? describe.sequential : describe.skip;

function assertDisposableDatabase() {
  const admin = new URL(urls.admin!);
  if (process.env.DATABASE_URL !== urls.admin || !admin.pathname.slice(1).startsWith("helm_caio_goal_ledger_")) {
    throw new Error("DATABASE_URL must equal CAIO_GOAL_LEDGER_DATABASE_URL and name a disposable helm_caio_goal_ledger_* database.");
  }
  for (const identity of CAIO_GOAL_LEDGER_FIXTURE_IDENTITIES) {
    const url = new URL(urls[identity]!);
    if (url.host !== admin.host || url.pathname !== admin.pathname || url.username !== identity) {
      throw new Error(`CAIO_GOAL_LEDGER ${identity} URL must use user ${identity} on the same database.`);
    }
  }
}

const GENESIS = CAIO_GOAL_LEDGER_GENESIS_PREV_HASH;
const E = "CaioGoalLedgerEntry";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  return { promise: new Promise<void>((done) => { resolve = done; }), resolve };
}
async function until(condition: () => Promise<boolean>, what: string) {
  for (const started = Date.now(); Date.now() - started < 15_000; await sleep(50)) if (await condition()) return;
  throw new Error(`timed out waiting until ${what}`);
}

/** MySQL errno of a failed query: raw queries report it as meta.code, model queries inside their message. */
function errnoOf(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return String((error.meta as { code?: unknown } | undefined)?.code ?? error.code);
  if (error instanceof Prisma.PrismaClientUnknownRequestError) return /MysqlError \{ code: (\d+)/u.exec(error.message)?.[1] ?? "unknown";
  return `unclassified: ${error instanceof Error ? error.message : String(error)}`;
}
async function errnoOfStatement(statement: Promise<unknown>): Promise<string | null> {
  try {
    await statement;
    return null;
  } catch (error) {
    return errnoOf(error);
  }
}
/** "written", the refusal reason (with the entry it names, and the database error behind a lost race), or the errno. */
async function outcomeOf(write: Promise<unknown>): Promise<string> {
  try {
    await write;
    return "written";
  } catch (error) {
    if (!(error instanceof CaioGoalLedgerWriteRefusal)) return `error:${errnoOf(error)}`;
    const lostRace = error.cause instanceof CaioGoalLedgerStoreError ? `:${errnoOf(error.cause.cause)}` : "";
    return `${error.reason}${error.atSeq === null ? "" : `@${error.atSeq}`}${lostRace}`;
  }
}

const FORBIDDEN_FOR_READER = /\bFOR\s+(UPDATE|SHARE)\b|LOCK\s+IN\s+SHARE\s+MODE|^\s*(INSERT|UPDATE|DELETE|REPLACE|LOCK|CREATE|ALTER|DROP|GRANT|TRUNCATE)\b/iu;
const document = syntheticCaioGoalLedgerDocument();
// Multi-byte text in the quote and the document: CJK, four-byte characters, line breaks.
const QUOTE = "示例原话：先把主链路稳定性做扎实 🚩\n第二行 𠮷";
const wideDocument = { ...document, goals: [{ ...document.goals[0], title: "示例：主链路稳定可用 𠮷\n第二行" }, ...document.goals.slice(1)] };
const IMPORTED: SyntheticEntrySpec[] = [
  { form: "imported", documentText: null },
  { form: "imported", documentText: JSON.stringify(document) },
  { form: "imported", documentText: null },
  { form: "imported", documentText: syntheticDocumentText("imported") },
];
const MIXED: SyntheticEntrySpec[] = [
  ...IMPORTED.slice(0, 3),
  { form: "appended", documentText: syntheticDocumentText("appended") },
  { form: "appended", documentText: syntheticDocumentText("appended") },
];
const mixed = () => buildSyntheticCaioGoalLedgerChain(MIXED);
const imported = () => buildSyntheticCaioGoalLedgerChain(IMPORTED);
const bundleOf = (workspaceId: string, actorUserId: string, rows: readonly CaioGoalLedgerStoredEntry[]) => ({
  workspaceId, actorUserId, documentFileKey: SYNTHETIC_IMPORT_DOCUMENT_FILE_KEY,
  entries: rows.map((row) => JSON.parse(row.entryJson) as unknown),
  documents: Object.fromEntries(rows.flatMap((row) => (row.document ? [[row.document.hash, row.document.text]] : []))),
});

describeMysql("CAIO goal ledger store on MySQL", () => {
  const statements = { reader: [] as string[], ops: [] as string[], ops2: [] as string[] };
  let admin: PrismaClient;
  let reader: PrismaClient;
  // Same reader identity, not audited: the privilege probes and the snapshot control run on it.
  let readerControl: PrismaClient;
  let ops: PrismaClient;
  let ops2: PrismaClient;
  let readerStore: CaioGoalLedgerStore;
  let opsStore: CaioGoalLedgerStore;
  let ops2Store: CaioGoalLedgerStore;
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  function logged(url: string, sink: string[]): PrismaClient {
    const client = new PrismaClient({ datasourceUrl: url, log: [{ emit: "event", level: "query" }] });
    client.$on("query", (event) => { sink.push(event.query); });
    return client as unknown as PrismaClient;
  }

  async function newLedger(label: string) {
    const workspace = await admin.workspace.create({ data: { name: `Goal ledger ${label}`, slug: `goal-ledger-${label}-${suffix}` } });
    const member = async (name: string, role: WorkspaceRole, status: MembershipStatus = MembershipStatus.ACTIVE) => {
      const user = await admin.user.create({ data: { email: `goal-ledger-${label}-${name}-${suffix}@example.com`, name: `Synthetic ${name}` } });
      await admin.membership.create({ data: { workspaceId: workspace.id, userId: user.id, role, status } });
      return user.id;
    };
    await admin.caioAttentionRouteConfig.create({ data: {
      workspaceId: workspace.id, version: SYNTHETIC_ROUTE_CONFIG_VERSION, schemaVersion: "caio-attention-routes/v1",
      configJson: SYNTHETIC_ROUTE_CONFIG_JSON, contentHash: syntheticSha256(SYNTHETIC_ROUTE_CONFIG_JSON), createdByRef: "operator:synthetic",
    } });
    return { workspaceId: workspace.id, owner: await member("owner", WorkspaceRole.OWNER), owner2: await member("owner2", WorkspaceRole.OWNER), member };
  }
  type Ledger = Awaited<ReturnType<typeof newLedger>>;

  const appendAs = (store: CaioGoalLedgerStore, ledger: Ledger, actorUserId: string, expectedHeadHash: string, change = "设定示例目标") =>
    appendCaioGoalLedgerEntry(store, {
      workspaceId: ledger.workspaceId, actorUserId, ownerQuote: QUOTE, change, effectiveAt: "2026-02-28T10:00:00+08:00",
      expectedHeadHash, document: wideDocument,
    });
  const stateOf = async (workspaceId: string) => ({
    entries: await admin.caioGoalLedgerEntry.count({ where: { workspaceId } }),
    head: await admin.caioGoalLedgerHead.findUnique({ where: { workspaceId }, select: { headSeq: true, headHash: true, rowVersion: true } }),
    audit: await admin.auditLog.count({ where: { workspaceId } }),
  });
  // NOWAIT fails with 3572 exactly when another transaction holds the row: a writer's FOR SHARE, or its uncommitted insert.
  const rowHeld = async (statement: Promise<unknown>) => {
    const errno = await errnoOfStatement(statement);
    if (errno !== null && errno !== "3572") throw new Error(`probe failed: ${errno}`);
    return errno === "3572";
  };
  const membershipHeld = (workspaceId: string, userId: string) =>
    rowHeld(admin.$queryRaw`SELECT id FROM Membership WHERE workspaceId = ${workspaceId} AND userId = ${userId} FOR UPDATE NOWAIT`);
  const entryHeld = (workspaceId: string, seq: number) =>
    rowHeld(admin.$queryRaw`SELECT id FROM CaioGoalLedgerEntry WHERE workspaceId = ${workspaceId} AND seq = ${seq} FOR UPDATE NOWAIT`);
  async function insertChain(workspaceId: string, { entries, head }: CaioGoalLedgerChainRows) {
    // Reverse order, so a read that returned rows in insertion order would fail.
    for (const row of [...entries].reverse()) {
      await admin.caioGoalLedgerEntry.create({ data: {
        workspaceId, seq: row.seq, entryHash: row.entryHash, prevHash: row.prevHash, entryJson: row.entryJson,
        documentFileKey: row.document?.fileKey ?? null, documentHash: row.document?.hash ?? null, documentText: row.document?.text ?? null,
        effectiveAt: row.effectiveAt, source: row.source, recordedByUserId: "u_synthetic_owner", createdAt: row.createdAt,
      } });
    }
    if (head) await admin.caioGoalLedgerHead.create({ data: { workspaceId, ...head, updatedByUserId: "u_synthetic_owner" } });
  }

  beforeAll(async () => {
    assertDisposableDatabase();
    admin = new PrismaClient({ datasourceUrl: urls.admin });
    reader = logged(urls.goal_ledger_reader!, statements.reader);
    readerControl = new PrismaClient({ datasourceUrl: urls.goal_ledger_reader });
    ops = logged(urls.goal_ledger_ops!, statements.ops);
    ops2 = logged(urls.goal_ledger_ops!, statements.ops2);
    [readerStore, opsStore, ops2Store] = [reader, ops, ops2].map(createPrismaCaioGoalLedgerStore);
  });

  afterAll(async () => {
    await Promise.all([admin, reader, readerControl, ops, ops2].map((client) => client?.$disconnect()));
  });

  it("holds the fixture matrix: the reader writes nothing, nobody changes or locks an entry, nobody deletes the anchor", async () => {
    const probe = {
      insert: (table: string) => `INSERT INTO \`${table}\` (\`id\`) SELECT 'probe' FROM DUAL WHERE 1 = 0`,
      update: (table: string) => `UPDATE \`${table}\` SET \`workspaceId\` = \`workspaceId\` WHERE 1 = 0`,
      delete: (table: string) => `DELETE FROM \`${table}\` WHERE 1 = 0`,
      lock: (table: string) => `SELECT \`id\` FROM \`${table}\` WHERE 1 = 0 FOR UPDATE`,
    };
    const cases: Array<[PrismaClient, keyof typeof probe, string, string | null]> = [
      [readerControl, "insert", E, "1142"], [readerControl, "update", E, "1142"], [readerControl, "delete", E, "1142"],
      [readerControl, "lock", E, "1142"], [readerControl, "insert", "CaioGoalLedgerHead", "1142"],
      [readerControl, "update", "CaioGoalLedgerHead", "1142"], [readerControl, "delete", "CaioGoalLedgerHead", "1142"],
      [readerControl, "lock", "CaioGoalLedgerHead", "1142"],
      [ops, "update", E, "1142"], [ops, "delete", E, "1142"], [ops, "lock", E, "1142"], [ops, "delete", "CaioGoalLedgerHead", "1142"],
      [ops, "insert", E, null], [ops, "update", "CaioGoalLedgerHead", null], [ops, "lock", "CaioGoalLedgerHead", null],
    ];
    const got = await Promise.all(cases.map(async ([client, kind, table]) => errnoOfStatement(client.$executeRawUnsafe(probe[kind](table)))));
    expect(got).toEqual(cases.map(([, , , want]) => want));
    expect(await readerStore.probeSchemaReadiness()).toEqual({ ready: true });
  });

  it("reads the same rows the in-memory store holds, broken ones included, with the same verdict", async () => {
    const at = (seq: number, change: (row: CaioGoalLedgerStoredEntry) => Partial<CaioGoalLedgerStoredEntry>) => {
      const { entries, head } = mixed();
      return { entries: entries.map((row) => (row.seq === seq ? { ...row, ...change(row) } : row)), head };
    };
    const { hash: _hash, ...second } = JSON.parse(mixed().entries[1].entryJson) as Record<string, unknown>;
    const resealed = sealSyntheticCaioGoalLedgerEntry({ ...second, owner_quote: "改过的原话" }, mixed().entries[1].document, "import");
    const badHead = buildSyntheticCaioGoalLedgerChain([...MIXED.slice(0, 4),
      { form: "appended", documentText: syntheticDocumentText("appended", { ...document, scores: {} }) }]);
    // [name, rows in memory, rows inserted, SQL run as the migration identity (the workspaceId binds the last ?), verdict]
    const scenarios: Array<[string, CaioGoalLedgerChainRows | null, CaioGoalLedgerChainRows | null, Array<[string, ...unknown[]]>, string]> = [
      ["empty workspace", null, null, [], "empty"],
      ["valid mixed chain of five", mixed(), mixed(), [], "ok"],
      ["entry 1 text replaced by {}", at(1, () => ({ entryJson: "{}" })), mixed(), [[`UPDATE ${E} SET entryJson = '{}' WHERE workspaceId = ? AND seq = 1`]],
        "entry_shape_invalid@1"],
      ["entry 3 deleted", { ...mixed(), entries: mixed().entries.filter((row) => row.seq !== 3) }, mixed(),
        [[`DELETE FROM ${E} WHERE workspaceId = ? AND seq = 3`]], "seq_gap@3"],
      ["entry 2 seq column set to 7", at(2, () => ({ seq: 7 })), mixed(), [[`UPDATE ${E} SET seq = 7 WHERE workspaceId = ? AND seq = 2`]], "seq_gap@2"],
      ["entry 2 edited and resealed", at(2, () => ({ entryJson: resealed.entryJson, entryHash: resealed.entryHash })), mixed(),
        [[`UPDATE ${E} SET entryJson = ?, entryHash = ? WHERE workspaceId = ? AND seq = 2`, resealed.entryJson, resealed.entryHash]], "prev_hash_mismatch@3"],
      ["entry 2 owner quote edited in place", at(2, (row) => ({ entryJson: row.entryJson.replace("示例原话 2", "示例原话 2（改）") })), mixed(),
        [[`UPDATE ${E} SET entryJson = REPLACE(entryJson, '示例原话 2', '示例原话 2（改）') WHERE workspaceId = ? AND seq = 2`]], "entry_hash_mismatch@2"],
      ["entry 3 entryHash column changed", at(3, () => ({ entryHash: "c".repeat(64) })), mixed(),
        [[`UPDATE ${E} SET entryHash = REPEAT('c', 64) WHERE workspaceId = ? AND seq = 3`]], "column_mismatch@3"],
      ["head anchor row deleted", { ...mixed(), head: null }, mixed(), [["DELETE FROM CaioGoalLedgerHead WHERE workspaceId = ?"]], "head_anchor_missing"],
      ["tail entry deleted", { ...mixed(), entries: mixed().entries.slice(0, 4) }, mixed(),
        [[`DELETE FROM ${E} WHERE workspaceId = ? AND seq = 5`]], "head_anchor_mismatch"],
      ["every entry deleted, anchor kept", { ...mixed(), entries: [] }, mixed(), [[`DELETE FROM ${E} WHERE workspaceId = ?`]], "head_anchor_mismatch"],
      ["head document columns cleared", at(5, () => ({ document: null })), mixed(),
        [[`UPDATE ${E} SET documentFileKey = NULL, documentHash = NULL, documentText = NULL WHERE workspaceId = ? AND seq = 5`]], "document_missing@5"],
      ["head document text gets a trailing space", at(5, (row) => ({ document: row.document && { ...row.document, text: `${row.document.text} ` } })),
        mixed(), [[`UPDATE ${E} SET documentText = CONCAT(documentText, ' ') WHERE workspaceId = ? AND seq = 5`]], "document_hash_mismatch@5"],
      ["sealed head document with an unknown key", badHead, badHead, [], "document_invalid@5"],
    ];
    for (const [index, [name, memoryRows, dbRows, corruptions, verdict]] of scenarios.entries()) {
      const workspaceId = `ws_parity_${index}_${suffix}`;
      if (dbRows) await insertChain(workspaceId, dbRows);
      for (const [sql, ...params] of corruptions) expect(await admin.$executeRawUnsafe(sql, ...params, workspaceId), name).toBeGreaterThan(0);
      const memory = createInMemoryCaioGoalLedgerStore();
      if (memoryRows) memory.loadChain(workspaceId, memoryRows);
      expect(await readerStore.readChain(workspaceId), name).toEqual(await memory.readChain(workspaceId));
      const read = await readCaioGoalLedger(readerStore, { workspaceId });
      expect(read, name).toEqual(await readCaioGoalLedger(memory, { workspaceId }));
      const got = read.state === "rejected" ? `${read.alarm.code}${read.alarm.atSeq === null ? "" : `@${read.alarm.atSeq}`}` : read.state;
      expect(got, name).toBe(verdict);
      if (read.state === "ok") expect(read.document).toEqual(document);
      if (read.state === "rejected") expect(Object.keys(read)).toEqual(["state", "alarm"]);
    }
  });

  it("appends as the ops identity: multi-byte text round-trips, the anchor moves by one version, one audit row of digests, the pin matches", async () => {
    const ledger = await newLedger("append");
    const first = await appendAs(opsStore, ledger, ledger.owner, GENESIS);
    const second = await appendAs(opsStore, ledger, ledger.owner, first.entryHash, "第二条 🚩");
    expect([first.seq, second.seq, second.prevHash]).toEqual([1, 2, first.entryHash]);

    const read = await readCaioGoalLedger(readerStore, { workspaceId: ledger.workspaceId });
    expect(read).toMatchObject({ state: "ok", head: { seq: 2, entryHash: second.entryHash, source: "command" }, document: wideDocument });
    const rows = await admin.caioGoalLedgerEntry.findMany({ where: { workspaceId: ledger.workspaceId }, orderBy: { seq: "asc" } });
    expect(rows.map((row) => [row.source, row.recordedByUserId, JSON.parse(row.entryJson).owner_quote])).toEqual([
      ["command", ledger.owner, QUOTE], ["command", ledger.owner, QUOTE],
    ]);
    expect(await stateOf(ledger.workspaceId)).toMatchObject({ head: { headSeq: 2, headHash: second.entryHash, rowVersion: 1 }, audit: 2 });

    const audit = await admin.auditLog.findMany({ where: { workspaceId: ledger.workspaceId }, orderBy: { createdAt: "asc" } });
    expect(audit.map((row) => [row.actionType, row.targetType, row.targetId, row.actor, row.userId, row.actorType])).toEqual([
      ["CAIO_GOAL_LEDGER_ENTRY_APPENDED", "CaioGoalLedgerEntry", first.entryHash, ledger.owner, ledger.owner, "USER"],
      ["CAIO_GOAL_LEDGER_ENTRY_APPENDED", "CaioGoalLedgerEntry", second.entryHash, ledger.owner, ledger.owner, "USER"],
    ]);
    expect(JSON.parse(audit[1].payload!)).toEqual({ ...second, source: "command" });
    expect(JSON.stringify(audit)).not.toMatch(/示例原话|设定示例目标|第二条|主链路/u);

    await admin.caioAttentionRouteConfigHead.create({ data: {
      workspaceId: ledger.workspaceId, activeVersion: SYNTHETIC_ROUTE_CONFIG_VERSION, updatedByRef: "operator:synthetic",
    } });
    expect(await readCaioGoalLedgerRoleBindings(readerStore, { workspaceId: ledger.workspaceId, pin: document.roleBindingPin! }))
      .toMatchObject({ state: "match", routeConfigVersion: SYNTHETIC_ROUTE_CONFIG_VERSION });
  });

  it("re-checks the owner inside the transaction: other roles and inactive owners are refused and write nothing", async () => {
    const ledger = await newLedger("owner");
    await appendAs(opsStore, ledger, ledger.owner, GENESIS);
    const before = await stateOf(ledger.workspaceId);
    const outsider = (await admin.user.create({ data: { email: `goal-ledger-outsider-${suffix}@example.com`, name: "Synthetic outsider" } })).id;
    const actors = [
      await ledger.member("admin", WorkspaceRole.ADMIN), await ledger.member("operator", WorkspaceRole.OPERATOR),
      await ledger.member("invited", WorkspaceRole.OWNER, MembershipStatus.INVITED),
      await ledger.member("inactive", WorkspaceRole.OWNER, MembershipStatus.INACTIVE), outsider,
    ];
    for (const actor of actors) {
      expect(await outcomeOf(appendAs(opsStore, ledger, actor, before.head!.headHash))).toBe("not_owner");
      expect(await outcomeOf(importCaioGoalLedgerChain(opsStore, bundleOf(ledger.workspaceId, actor, imported().entries)))).toBe("not_owner");
    }
    expect(await stateOf(ledger.workspaceId)).toEqual(before);
  });

  it("refuses to append to a chain broken in storage, and writes nothing", async () => {
    const ledger = await newLedger("broken");
    const first = await appendAs(opsStore, ledger, ledger.owner, GENESIS);
    const second = await appendAs(opsStore, ledger, ledger.owner, first.entryHash);
    await admin.$executeRawUnsafe(`UPDATE ${E} SET entryJson = REPLACE(entryJson, '扎实', '扎扎实实') WHERE workspaceId = ? AND seq = 1`, ledger.workspaceId);
    const before = await stateOf(ledger.workspaceId);
    expect(await outcomeOf(appendAs(opsStore, ledger, ledger.owner, second.entryHash))).toBe("chain_rejected@1");
    await admin.$executeRawUnsafe(`DELETE FROM ${E} WHERE workspaceId = ? AND seq = 1`, ledger.workspaceId);
    expect(await outcomeOf(appendAs(opsStore, ledger, ledger.owner, second.entryHash))).toBe("chain_rejected@1");
    expect(await stateOf(ledger.workspaceId)).toEqual({ ...before, entries: before.entries - 1 });
  });

  it("commits the audit row and the ledger rows together: a failing audit insert leaves no entry and no anchor", async () => {
    const ledger = await newLedger("audit");
    const check = `goal_ledger_audit_probe_${suffix}`;
    // Refuses audit rows of this ledger's owner only (workspaceId sits in a foreign key, so a CHECK cannot use it).
    // The user id is a cuid, so it is safe inside the literal.
    await admin.$executeRawUnsafe(`ALTER TABLE AuditLog ADD CONSTRAINT \`${check}\` CHECK (actor <> '${ledger.owner}')`);
    try {
      expect(await outcomeOf(appendAs(opsStore, ledger, ledger.owner, GENESIS))).toBe("error:3819");
      expect(await outcomeOf(importCaioGoalLedgerChain(opsStore, bundleOf(ledger.workspaceId, ledger.owner, imported().entries)))).toBe("error:3819");
      expect(await stateOf(ledger.workspaceId)).toEqual({ entries: 0, head: null, audit: 0 });
    } finally {
      await admin.$executeRawUnsafe(`ALTER TABLE AuditLog DROP CHECK \`${check}\``);
    }
    expect(await outcomeOf(appendAs(opsStore, ledger, ledger.owner, GENESIS))).toBe("written");
    expect(await stateOf(ledger.workspaceId)).toMatchObject({ entries: 1, head: { headSeq: 1 }, audit: 1 });
  });

  it("imports a chain line for line, writes nothing on the same chain again, adds only the difference, refuses a fork", async () => {
    const ledger = await newLedger("import");
    const longer = buildSyntheticCaioGoalLedgerChain([...IMPORTED, { form: "imported", documentText: syntheticDocumentText("imported") }]);
    const four = longer.entries.slice(0, 4);
    expect(await importCaioGoalLedgerChain(opsStore, bundleOf(ledger.workspaceId, ledger.owner, four))).toMatchObject({ appended: 4, replayed: false });
    const stored = await admin.caioGoalLedgerEntry.findMany({ where: { workspaceId: ledger.workspaceId }, orderBy: { seq: "asc" } });
    expect(stored.map((row) => row.entryJson)).toEqual(four.map((row) => row.entryJson));
    expect(stored.map((row) => row.documentText)).toEqual(four.map((row) => row.document?.text ?? null));
    expect(await readCaioGoalLedger(readerStore, { workspaceId: ledger.workspaceId })).toMatchObject({ state: "ok", head: { seq: 4, source: "import" }, document });
    const once = await stateOf(ledger.workspaceId);
    expect(once).toMatchObject({ entries: 4, audit: 1 });

    expect(await importCaioGoalLedgerChain(opsStore, bundleOf(ledger.workspaceId, ledger.owner, four))).toMatchObject({ appended: 0, replayed: true });
    expect(await stateOf(ledger.workspaceId)).toEqual(once);
    expect(await importCaioGoalLedgerChain(opsStore, bundleOf(ledger.workspaceId, ledger.owner, longer.entries))).toMatchObject({ appended: 1, seq: 5 });
    const five = await stateOf(ledger.workspaceId);
    const forked = buildSyntheticCaioGoalLedgerChain(IMPORTED.map((spec, index) => (index === 2 ? { ...spec, documentText: syntheticDocumentText("imported") } : spec)));
    expect(await outcomeOf(importCaioGoalLedgerChain(opsStore, bundleOf(ledger.workspaceId, ledger.owner, forked.entries)))).toBe("import_fork@3");
    expect(await stateOf(ledger.workspaceId)).toEqual(five);
    expect(five).toMatchObject({ entries: 5, head: { headSeq: 5, rowVersion: 1 }, audit: 2 });
  });

  it("two owners appending on the same head at once: both wait on the anchor lock, one lands, the other is refused", async () => {
    const ledger = await newLedger("race-head");
    const first = await appendAs(opsStore, ledger, ledger.owner, GENESIS);
    const before = await stateOf(ledger.workspaceId);
    const locked = deferred();
    const release = deferred();
    const holder = admin.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM CaioGoalLedgerHead WHERE workspaceId = ${ledger.workspaceId} FOR UPDATE`;
      locked.resolve();
      await release.promise;
    }, { timeout: 30_000 });
    await locked.promise;
    const settled: string[] = [];
    const writers = ([[opsStore, ledger.owner], [ops2Store, ledger.owner2]] as const).map(([store, actor], n) =>
      outcomeOf(appendAs(store, ledger, actor, first.entryHash, `racer ${n}`)).then((outcome) => { settled.push(outcome); return outcome; }));
    // Each writer's first statement holds its own membership row FOR SHARE until it ends; the anchor it locks next is held here.
    // Both rows held at once means both transactions are open and waiting at the same lock.
    await until(async () => (await membershipHeld(ledger.workspaceId, ledger.owner)) && (await membershipHeld(ledger.workspaceId, ledger.owner2)),
      "both writers hold their membership row");
    await sleep(300);
    expect(settled).toEqual([]);
    release.resolve();
    await holder;
    // The second to get the lock sees the first one's entry and is refused on its stale head, before writing anything.
    expect((await Promise.all(writers)).sort()).toEqual(["head_conflict", "written"]);
    const after = await stateOf(ledger.workspaceId);
    expect(after).toMatchObject({ entries: 2, head: { headSeq: 2, rowVersion: before.head!.rowVersion + 1 }, audit: before.audit + 1 });
    expect(await admin.caioGoalLedgerEntry.count({ where: { workspaceId: ledger.workspaceId, prevHash: first.entryHash } })).toBe(1);
    expect(await readCaioGoalLedger(readerStore, { workspaceId: ledger.workspaceId })).toMatchObject({ state: "ok", head: { seq: 2 } });
  }, 60_000);

  it("two owners writing a ledger's first entry at once: the loser collides with the parked winner's entry and is rolled back", async () => {
    const ledger = await newLedger("race-first");
    const locked = deferred();
    const release = deferred();
    // There is no anchor row to lock yet. Locking the absent one under REPEATABLE READ takes a gap lock that keeps the
    // anchor from being inserted, so the first writer parks at its anchor INSERT holding its uncommitted entry 1.
    const holder = admin.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM CaioGoalLedgerHead WHERE workspaceId = ${ledger.workspaceId} FOR UPDATE`;
      locked.resolve();
      await release.promise;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000 });
    await locked.promise;
    const firstWriter = outcomeOf(appendAs(opsStore, ledger, ledger.owner, GENESIS, "racer 1"));
    await until(() => entryHeld(ledger.workspaceId, 1), "the first writer holds its uncommitted entry 1");
    // Prisma logs a query once it has returned: the second writer then holds its own gap lock on the absent anchor, so
    // the winner can no longer insert the anchor ahead of it, whatever happens after the release.
    let secondSettled = false;
    const mark = statements.ops2.length;
    const secondWriter = outcomeOf(appendAs(ops2Store, ledger, ledger.owner2, GENESIS, "racer 2")).finally(() => { secondSettled = true; });
    await until(async () => secondSettled || statements.ops2.slice(mark).some((statement) => /FROM CaioGoalLedgerHead WHERE .* FOR UPDATE/su.test(statement)),
      "the second writer holds its anchor lock");
    release.resolve();
    await holder;
    // The loser fails on a deadlock (P2034), not on a stale head: it read the same empty chain while the winner's
    // entry 1 was uncommitted, collided with it at its own INSERT, and was rolled back whole.
    expect((await Promise.all([firstWriter, secondWriter])).sort()).toEqual(["head_conflict:P2034", "written"]);
    expect(await stateOf(ledger.workspaceId)).toMatchObject({ entries: 1, head: { headSeq: 1, rowVersion: 0 }, audit: 1 });
  }, 60_000);

  it("an append that commits between the reader's entry read and its anchor read: the store's one snapshot still reads ok", async () => {
    const ledger = await newLedger("snapshot");
    const first = await appendAs(opsStore, ledger, ledger.owner, GENESIS);
    const locked = deferred();
    const release = deferred();
    // 1. Every AuditLog row and gap held: the real append below inserts its entry, moves the anchor, reads both back,
    //    then parks at its audit row, uncommitted, holding the anchor table open.
    const auditHeld = admin.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM AuditLog FOR UPDATE`;
      locked.resolve();
      await release.promise;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 60_000 });
    await locked.promise;
    const append = outcomeOf(appendAs(opsStore, ledger, ledger.owner, first.entryHash, "between the reads"));
    await until(() => entryHeld(ledger.workspaceId, 2), "the append holds its uncommitted entry 2");
    // 2. A metadata-only change of the anchor table waits for the open append; every new read of that table queues
    //    behind it, so it runs only after the append commits. The default set is the one the table already has.
    //    A Prisma query runs only once awaited or then-ed, hence the immediate then. The migration identity sees its
    //    own sessions in PROCESSLIST without the PROCESS privilege.
    let alterSettled = "";
    const alter = admin.$executeRawUnsafe("ALTER TABLE `CaioGoalLedgerHead` ALTER COLUMN `rowVersion` SET DEFAULT 0, ALGORITHM=INSTANT")
      .then(() => { alterSettled = "done"; }, (error: unknown) => { alterSettled = errnoOf(error); });
    await until(async () => {
      if (alterSettled !== "") throw new Error(`the ALTER did not wait: ${alterSettled}`);
      const [{ n }] = await admin.$queryRaw<Array<{ n: bigint }>>`SELECT COUNT(*) AS n FROM information_schema.PROCESSLIST
        WHERE INFO LIKE 'ALTER TABLE \`CaioGoalLedgerHead\`%' AND STATE = 'Waiting for table metadata lock'`;
      return n > BigInt(0);
    }, "the ALTER waits");
    // 3. Both readers read the entries now, before the append commits, then queue for the anchor.
    const storeRead = readerStore.readChain(ledger.workspaceId);
    const controlRead = (async () => {
      const entries = await readerControl.caioGoalLedgerEntry.findMany({ where: { workspaceId: ledger.workspaceId }, select: { seq: true } });
      const head = await readerControl.caioGoalLedgerHead.findUnique({ where: { workspaceId: ledger.workspaceId }, select: { headSeq: true } });
      return { entries: entries.length, headSeq: head?.headSeq };
    })();
    await sleep(500);
    release.resolve();
    await auditHeld;
    expect(await append).toBe("written");
    await alter;
    // The control, two separate reads, saw one entry and then the moved anchor: the append did commit between the reads.
    expect(await controlRead).toEqual({ entries: 1, headSeq: 2 });
    expect(verifyCaioGoalLedgerChain(await storeRead)).toMatchObject({ state: "ok", head: { seq: 1, entryHash: first.entryHash } });
    expect(await readCaioGoalLedger(readerStore, { workspaceId: ledger.workspaceId })).toMatchObject({ state: "ok", head: { seq: 2 } });
  }, 90_000);

  it("sent only plain reads as the reader, and opened every write with the membership share lock, then the anchor lock", () => {
    expect(statements.reader.length).toBeGreaterThan(0);
    expect(statements.reader.filter((statement) => FORBIDDEN_FOR_READER.test(statement))).toEqual([]);
    for (const sink of [statements.ops, statements.ops2]) {
      const transactions: string[][] = [];
      let open = false;
      for (const statement of sink) {
        if (/^\s*BEGIN\b/iu.test(statement)) {
          transactions.push([]);
          open = true;
        } else if (/^\s*(COMMIT|ROLLBACK)\b/iu.test(statement)) {
          open = false;
        } else if (open) {
          transactions.at(-1)?.push(statement);
        }
      }
      const writes = transactions.filter((statements) => statements.some((statement) => /^\s*INSERT INTO `[^`]+`\.`CaioGoalLedgerEntry`/u.test(statement)));
      expect(writes.length).toBeGreaterThan(0);
      // A write refused as not_owner ends after its first statement.
      for (const write of transactions) {
        expect(write[0]).toMatch(/FROM Membership WHERE .* FOR SHARE/su);
        if (write.length > 1) expect(write[1]).toMatch(/FROM CaioGoalLedgerHead WHERE .* FOR UPDATE/su);
      }
    }
  });
});
