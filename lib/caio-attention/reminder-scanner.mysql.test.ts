import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { parseCaioAttentionRouteConfig, parseCaioAttentionRouteRule, type CaioAttentionSeverity } from "./contracts";
import { runCaioAttentionReminderScan } from "./reminder-scanner.service";
import { resolveCaioAttentionPrefill } from "./routing";
import { CAIO_ATTENTION_TEST_DEFAULT_POLICY as P, caioAttentionDispatchFields, caioAttentionSuggestFields } from "./schedule";

/**
 * Reminder scanner on an isolated MySQL database. Setup rows are written by the migration identity
 * (standing in for the generator and the lifecycle service); every scan runs as the least-privilege web identity.
 * Same environment as schema.mysql.test.ts; `npm run test:caio-attention:mysql` fails instead of skipping.
 */
const urls = { admin: process.env.CAIO_ATTENTION_DATABASE_URL, web: process.env.CAIO_ATTENTION_WEB_DATABASE_URL };
const configured = Boolean(urls.admin && urls.web);
if (process.env.CAIO_ATTENTION_MYSQL_REQUIRED === "1" && !configured) {
  throw new Error("CAIO_ATTENTION_MYSQL_REQUIRED=1 but a CAIO_ATTENTION_*_DATABASE_URL is missing.");
}
const describeMysql = configured ? describe.sequential : describe.skip;

const WS = "ws-remind";
/** Local (UTC+8, the anonymous test policy) wall-clock time on 2026-11-<day>. */
const local = (day: number, hour: number, minute = 0) => new Date(Date.UTC(2026, 10, day, hour - 8, minute));

describeMysql("CAIO attention reminder scanner on MySQL as the web identity", () => {
  let admin: PrismaClient, web: PrismaClient, web2: PrismaClient;
  let shortNo = 0;

  const USERS = ["u-owner", "u-lead", "u-primary", "u-cc", "u-rev"];

  beforeAll(async () => {
    if (!new URL(urls.admin!).pathname.slice(1).startsWith("helm_caio_attention_") || new URL(urls.web!).username !== "attention_web") {
      throw new Error("reminder scanner tests need a disposable helm_caio_attention_* database and the attention_web identity.");
    }
    admin = new PrismaClient({ datasources: { db: { url: urls.admin! } } });
    web = new PrismaClient({ datasources: { db: { url: urls.web! } } });
    web2 = new PrismaClient({ datasources: { db: { url: urls.web! } } });
    // Membership and Notification keep their foreign keys to Workspace and User; synthetic rows satisfy them.
    await admin.workspace.upsert({ where: { id: WS }, update: {}, create: { id: WS, name: "Reminder scan", slug: WS } });
    for (const id of USERS) {
      await admin.user.upsert({ where: { id }, update: {}, create: { id, name: id, email: `${id}@example.test` } });
    }
  });

  beforeEach(async () => {
    for (const table of ["CaioAttentionCase", "CaioAttentionCaseEvent"]) {
      await admin.$executeRawUnsafe(`DELETE FROM \`${table}\``);
    }
    await admin.$executeRaw`DELETE FROM Notification WHERE workspaceId = ${WS}`;
    await admin.$executeRaw`DELETE FROM Membership WHERE workspaceId = ${WS}`;
    for (const [userId, role] of [["u-owner", "OWNER"], ["u-lead", "ADMIN"], ["u-primary", "MEMBER"], ["u-cc", "MEMBER"],
      ["u-rev", "REVIEWER"]] as const) {
      await admin.$executeRaw`INSERT INTO Membership (id, workspaceId, userId, role, status, updatedAt)
        VALUES (${`m-${userId}`}, ${WS}, ${userId}, ${role}, 'ACTIVE', NOW(3))`;
    }
  });

  afterAll(async () => {
    await admin?.workspace.deleteMany({ where: { id: WS } });
    await admin?.user.deleteMany({ where: { id: { in: USERS } } });
    await Promise.all([admin, web, web2].map((client) => client?.$disconnect()));
  });

  type CaseInput = {
    id: string; status: string; severity: CaioAttentionSeverity; commandVersion?: number;
    primary?: string | null; cc?: string[]; escalation?: string | null; reviewers?: string[];
    dispatchedAt?: Date | null; respondedAt?: Date | null; fields?: Record<string, Date | string | null>;
  };
  async function insertCase(c: CaseInput) {
    shortNo += 1;
    const terminal = ["DISMISSED", "CANCELLED", "CLOSED"].includes(c.status);
    await admin.$executeRaw`INSERT INTO CaioAttentionCase (id, workspaceId, shortNo, detectorId, mergeKey, objectKey, category,
      originCandidateId, activeKey, status, commandVersion, primaryUserId, ccUserIdsJson, escalationUserId, reviewerUserIdsJson,
      confirmedByUserId, severityAtSuggest, effectiveSeverity, reminderPolicy, dispatchedAt, respondedAt)
      VALUES (${c.id}, ${WS}, ${shortNo}, 'det', ${`mk-${c.id}`}, 'obj', 'business', ${`cand-${c.id}`},
        ${terminal ? null : `det:mk-${c.id}`}, ${c.status}, ${c.commandVersion ?? (c.status === "SUGGESTED" ? 0 : 1)},
        ${c.primary ?? null}, ${JSON.stringify(c.cc ?? [])}, ${c.escalation ?? null}, ${JSON.stringify(c.reviewers ?? [])},
        ${c.dispatchedAt ? "u-owner" : null}, ${c.severity}, ${c.severity}, ${c.severity}, ${c.dispatchedAt ?? null}, ${c.respondedAt ?? null})`;
    for (const [column, value] of Object.entries(c.fields ?? {})) {
      await admin.$executeRawUnsafe(`UPDATE CaioAttentionCase SET \`${column}\` = ? WHERE id = ?`, value, c.id);
    }
  }
  /** A confirmed case, with reminder fields exactly as the lifecycle service writes them through S1. */
  async function dispatched(id: string, severity: CaioAttentionSeverity, at: Date, extra: Partial<CaseInput> = {}) {
    const { dispatchNoticeAt: _notice, ...fields } = caioAttentionDispatchFields(severity, at, P);
    await insertCase({ id, status: "DISPATCHED", severity, primary: "u-primary", cc: ["u-cc"], escalation: "u-lead",
      reviewers: ["u-rev"], dispatchedAt: at, ...extra, fields: { ...fields, ...extra.fields } });
  }
  /** Close every open case so the next scenario starts from a quiet table. */
  const retire = () => admin.$executeRaw`UPDATE CaioAttentionCase SET status = 'CLOSED', activeKey = NULL`;
  const scan = (now: Date, client = web) => runCaioAttentionReminderScan({ client, now, policy: P });
  const notices = () => admin.$queryRaw<Array<{ userId: string; dedupeKey: string; title: string; type: string }>>`
    SELECT userId, dedupeKey, title, type FROM Notification WHERE workspaceId = ${WS} ORDER BY dedupeKey`;
  const caseRow = (id: string) => admin.$queryRaw<Array<Record<string, unknown>>>`SELECT * FROM CaioAttentionCase WHERE id = ${id}`
    .then((rows) => rows[0]);

  it("consumes every due rule of one case in one locked pass and advances each rule's own fields (T-N19, T-N20)", async () => {
    await dispatched("c1", "critical", local(4, 10));
    const first = await scan(local(4, 12, 3));
    expect(first.sends).toEqual({ R1: 1, R4: 1 });
    const keys = (await notices()).map((n) => `${n.userId} ${n.dedupeKey}`);
    expect(keys).toEqual(expect.arrayContaining([
      "u-lead ca:c1:R1:v1:u-lead", "u-primary ca:c1:R1:v1:u-primary",
      `u-primary ca:c1:R4:v1:DISPATCHED:u-primary:${local(4, 12).toISOString()}`,
    ]));
    expect(keys).toHaveLength(3);
    const row = await caseRow("c1");
    expect(row.r1FiredAt).toEqual(local(4, 12, 3));
    expect(row.nextPeriodicAt).toEqual(local(4, 14, 3));
    expect(row.status).toBe("DISPATCHED");
    expect(row.commandVersion).toBe(1);
    expect((await scan(local(4, 12, 8))).sends).toEqual({});

    await retire();
    // 20:00: the same-day critical deadline (R2) and the periodic reminder fall due together.
    await dispatched("c2", "critical", local(5, 14), { respondedAt: local(5, 14, 30),
      fields: { noResponseDueAt: null, nextPeriodicAt: local(5, 20) } });
    const evening = await scan(local(5, 20));
    expect(evening.sends).toEqual({ R2: 1, R4: 1 });
    expect((await caseRow("c2")).r2FiredSeverity).toBe("critical");
    const events = await admin.$queryRaw<Array<{ kind: string; dedupeKey: string }>>`
      SELECT kind, dedupeKey FROM CaioAttentionCaseEvent WHERE caseId = 'c2' ORDER BY kind`;
    expect(events).toEqual([{ kind: "ESCALATED", dedupeKey: "R2:v1:critical" },
      { kind: "REMINDED", dedupeKey: `R4:v1:DISPATCHED:${local(5, 20).toISOString()}` }]);
  });

  it("keeps the night rules: R1, R0a and R0b go out at night, periodic reminders wait for one 08:00 send (T-N14, T-N22, T-N25)", async () => {
    // Warning periodic due at 21:00: nothing at night, exactly one at the next window opening, none an hour later.
    await dispatched("w1", "warning", local(4, 9), { fields: { nextPeriodicAt: local(4, 21) } });
    expect((await scan(local(4, 21, 3))).sends).toEqual({});
    expect((await scan(local(5, 2, 3))).sends).toEqual({});
    expect((await scan(local(5, 8, 2))).sends).toEqual({ R4: 1 });
    expect((await scan(local(5, 9))).sends).toEqual({});
    expect((await caseRow("w1")).nextPeriodicAt).toEqual(local(5, 10));

    await retire();
    // Critical dispatched at 00:00: R1 escalates at 02:03; R4 waits for 08:00; R2 is the same day 20:00.
    await dispatched("n1", "critical", local(6, 0));
    expect((await caseRow("n1")).nextPeriodicAt).toEqual(local(6, 8));
    expect((await caseRow("n1")).unresolvedEscalateAt).toEqual(local(6, 20));
    expect((await scan(local(6, 2, 3))).sends).toEqual({ R1: 1 });
    await retire();
    // Dispatched at 18:00 or later: R2 moves to next day 12:00, and fires there even before the periodic one.
    await dispatched("n2", "critical", local(6, 18), { respondedAt: local(6, 18, 5) });
    expect((await caseRow("n2")).unresolvedEscalateAt).toEqual(local(7, 12));
    expect((await scan(local(6, 23))).sends).toEqual({});
    expect((await scan(local(7, 12))).sends).toMatchObject({ R2: 1 });
    await retire();

    // Critical suggestion generated at 02:00: R0a at once, R0b 30 minutes after, then silence.
    await insertCase({ id: "s1", status: "SUGGESTED", severity: "critical", fields: caioAttentionSuggestFields("critical", local(7, 2)) });
    expect((await scan(local(7, 2, 3))).sends).toEqual({ R0a: 1 });
    expect((await scan(local(7, 2, 20))).sends).toEqual({});
    expect((await scan(local(7, 2, 35))).sends).toEqual({ R0b: 1 });
    expect((await scan(local(7, 3, 30))).sends).toEqual({});
    const owner = (await notices()).filter((n) => n.dedupeKey.startsWith("ca:s1:"));
    expect(owner.map((n) => n.userId)).toEqual(["u-owner", "u-owner"]);
    expect(owner.map((n) => n.dedupeKey)).toEqual([expect.stringMatching(/^ca:s1:R0a:u-owner/u), expect.stringMatching(/^ca:s1:R0b:u-owner/u)]);

    await retire();
    // Terminal cases never remind, whatever their fields say.
    await insertCase({ id: "t1", status: "CLOSED", severity: "critical", primary: "u-primary", escalation: "u-lead",
      dispatchedAt: local(7, 9), fields: { noResponseDueAt: local(7, 10), nextPeriodicAt: local(7, 10) } });
    expect((await scan(local(7, 12))).sends).toEqual({});
  });

  it("delivers each notice once when two nodes interleave on the same and on different cases (T-N10, T-N21)", async () => {
    const ids = ["d1", "d2", "d3", "d4", "d5", "d6"];
    for (const id of ids) await dispatched(id, "critical", local(4, 10));
    // A notice written earlier under the same key (e.g. a crashed attempt replayed by another node) is not repeated.
    await admin.$executeRaw`INSERT INTO Notification (id, workspaceId, userId, type, title, body, dedupeKey)
      VALUES ('pre', ${WS}, 'u-lead', 'REMINDER', 't', 'b', 'ca:d2:R1:v1:u-lead')`;

    // Node A is stuck on d1's row lock (a lifecycle write holds it) while node B, which skips d1, works d2..d6.
    let release!: () => void;
    let locked!: () => void;
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const isLocked = new Promise<void>((resolve) => { locked = resolve; });
    const holder = admin.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM CaioAttentionCase WHERE id = 'd1' FOR UPDATE`;
      locked();
      await hold;
    }, { timeout: 20_000 });
    await isLocked;
    let aSettled = false;
    const a = scan(local(4, 12, 3), web).finally(() => { aSettled = true; });
    const b = await runCaioAttentionReminderScan({ client: web2, now: local(4, 12, 3), policy: P, skipCaseIds: ["d1"] });
    expect(aSettled).toBe(false);
    expect(b.casesScanned).toBe(5);
    release();
    await holder;
    const resultA = await a;
    expect([...resultA.failedCaseIds, ...b.failedCaseIds]).toEqual([]);
    expect(resultA.sends).toEqual({ R1: 1, R4: 1 }); // only d1 was left for A; d2..d6 were already consumed by B

    // Then both nodes write side by side on disjoint cases: adjacent dedupe keys, no deadlock, no duplicate.
    const [left, right] = await Promise.all([
      runCaioAttentionReminderScan({ client: web, now: local(4, 14, 5), policy: P, skipCaseIds: ["d4", "d5", "d6"] }),
      runCaioAttentionReminderScan({ client: web2, now: local(4, 14, 5), policy: P, skipCaseIds: ["d1", "d2", "d3"] }),
    ]);
    expect([...left.failedCaseIds, ...right.failedCaseIds]).toEqual([]);
    expect([left.sends, right.sends]).toEqual([{ R4: 3 }, { R4: 3 }]);
    const all = await notices();
    expect(new Set(all.map((n) => n.dedupeKey)).size).toBe(all.length);
    for (const id of ids) expect(all.filter((n) => n.dedupeKey.startsWith(`ca:${id}:`))).toHaveLength(4);
    const escalations = await admin.$queryRaw<Array<{ caseId: string; n: bigint }>>`
      SELECT caseId, COUNT(*) AS n FROM CaioAttentionCaseEvent WHERE kind = 'ESCALATED' GROUP BY caseId ORDER BY caseId`;
    expect(escalations.map((row) => [row.caseId, Number(row.n)])).toEqual(ids.map((id) => [id, 1]));
    // The dedupe key carries recipient, stage and command version: a reissued command escalates again.
    await admin.$executeRaw`UPDATE CaioAttentionCase SET commandVersion = 2, r1FiredAt = NULL, noResponseDueAt = ${local(4, 14, 30)}
      WHERE id = 'd1'`;
    expect((await scan(local(4, 14, 33))).sends).toMatchObject({ R1: 1 });
    expect((await notices()).map((n) => n.dedupeKey)).toEqual(expect.arrayContaining(["ca:d1:R1:v2:u-lead", "ca:d1:R1:v2:u-primary"]));
  });

  it("isolates a failing case, skips it for one round, and leaves rules with no recipient due (P2-6, P2-7)", async () => {
    const long = `x${"y".repeat(180)}`; // its dedupe keys exceed the column: every insert for it fails
    await dispatched(long, "critical", local(4, 10));
    await dispatched("ok1", "critical", local(4, 10));
    const first = await scan(local(4, 12, 3));
    expect(first.failedCaseIds).toEqual([long]);
    expect(first.sends).toEqual({ R1: 1, R4: 1 });
    expect((await caseRow(long)).r1FiredAt).toBeNull(); // rolled back as a whole
    const next = await runCaioAttentionReminderScan({ client: web, now: local(4, 12, 8), policy: P, skipCaseIds: [long] });
    expect(next).toMatchObject({ casesScanned: 0, failedCaseIds: [] });
    await retire();

    // The only OWNER is an external-scope member: not an active member for attention, so R0a has nobody to tell.
    await admin.$executeRaw`UPDATE Membership SET accessScope = 'external' WHERE workspaceId = ${WS} AND userId = 'u-owner'`;
    await insertCase({ id: "s9", status: "SUGGESTED", severity: "critical", fields: caioAttentionSuggestFields("critical", local(5, 9)) });
    const blind = await scan(local(5, 9, 3));
    expect(blind.sends).toEqual({});
    expect(blind.skippedNoRecipient).toEqual({ R0a: 1 });
    expect((await caseRow("s9")).r0aSentAt).toBeNull();
    await admin.$executeRaw`UPDATE Membership SET accessScope = NULL WHERE workspaceId = ${WS} AND userId = 'u-owner'`;
    expect((await scan(local(5, 9, 8))).sends).toEqual({ R0a: 1 });
  });

  it("holds a warning R2 for the daytime window, while a critical one goes out at night", async () => {
    await dispatched("wr", "warning", local(4, 9), { respondedAt: local(4, 9, 5),
      fields: { unresolvedEscalateAt: local(6, 21), nextPeriodicAt: local(9, 10) } });
    await dispatched("cr", "critical", local(4, 19), { respondedAt: local(4, 19, 5),
      fields: { unresolvedEscalateAt: local(6, 21), nextPeriodicAt: local(9, 10) } });
    expect((await scan(local(6, 21, 3))).sends).toEqual({ R2: 1 });
    expect((await caseRow("cr")).r2FiredSeverity).toBe("critical");
    expect((await caseRow("wr")).r2FiredSeverity).toBeNull();
    expect((await scan(local(7, 2))).sends).toEqual({});
    expect((await scan(local(7, 8, 1))).sends).toEqual({ R2: 1 });
    expect((await notices()).filter((n) => n.dedupeKey.includes(":R2:")).map((n) => n.dedupeKey))
      .toEqual(["ca:cr:R2:v1:critical:u-lead", "ca:wr:R2:v1:warning:u-lead"]);
  });

  it("escalates to the OWNER when the escalation holder is the primary (owner ruling §6.10)", async () => {
    const rule = parseCaioAttentionRouteRule({ detectorId: "det", category: "business", primaryRoleKey: "supervisor",
      primaryFallbackRoleKeys: ["lead"], ccRoleKeys: ["partner"], escalationRoleKey: "lead", escalationFallbackRoleKey: "owner",
      reviewerRoleKey: "lead", reviewerFallbackRoleKey: "owner", compatibleRuleVersions: ["v1"], committedDue: "suggest" });
    const config = parseCaioAttentionRouteConfig({ schemaVersion: "caio-attention-routes/v1",
      roleBindings: { supervisor: [], lead: ["user:u-lead"], partner: ["user:u-cc"], owner: ["user:u-owner"] } });
    if (!rule.ok || !config.ok) throw new Error("fixture route invalid");
    // The supervisor is absent, the lead takes the primary seat, so escalation falls to the owner role.
    const prefill = resolveCaioAttentionPrefill({ rule: rule.rule, config: config.config, enterpriseSlug: null,
      enterpriseScope: "not_applicable", isActive: () => true, confirmerUserId: "u-owner" });
    expect(prefill).toMatchObject({ primaryUserId: "u-lead", escalationUserId: "u-owner", blocks: [] });
    await dispatched("e1", "critical", local(4, 10), { primary: prefill.primaryUserId, cc: [...prefill.ccUserIds],
      escalation: prefill.escalationUserId, reviewers: [...prefill.reviewerUserIds] });
    // A row whose escalation holder equals the primary (stale or hand-edited) still escalates to the OWNER.
    await dispatched("e2", "critical", local(4, 10), { primary: "u-lead", escalation: "u-lead" });
    expect((await scan(local(4, 12, 3))).sends).toMatchObject({ R1: 2 });
    const r1 = (await notices()).filter((n) => n.dedupeKey.includes(":R1:")).map((n) => n.dedupeKey);
    expect(r1).toEqual(["ca:e1:R1:v1:u-lead", "ca:e1:R1:v1:u-owner", "ca:e2:R1:v1:u-lead", "ca:e2:R1:v1:u-owner"]);
  });

  it("sends recurrence notices to primary and cc in daytime only, across a reissue, and the warning digest once a day (T-N3, T-N16)", async () => {
    await dispatched("r1", "warning", local(4, 9), { respondedAt: local(4, 9, 30), fields: { nextPeriodicAt: local(9, 10) } });
    await admin.$executeRaw`INSERT INTO CaioAttentionCaseEvent (id, caseId, kind, candidateId, payloadJson, createdAt)
      VALUES ('ev-r1', 'r1', 'RECURRED', 'cand-2', '{}', ${local(4, 21)})`;
    expect((await scan(local(4, 21, 5))).sends).toEqual({});
    // Reissued at 07:00, after the night recurrence: the notice is still owed (not cut at the new dispatchedAt).
    await admin.$executeRaw`UPDATE CaioAttentionCase SET commandVersion = 2, dispatchedAt = ${local(5, 7)} WHERE id = 'r1'`;
    expect((await scan(local(5, 8, 1))).sends).toEqual({ R3: 1 });
    expect((await scan(local(5, 8, 6))).sends).toEqual({});
    const r3 = (await notices()).filter((n) => n.dedupeKey.includes(":R3:")).map((n) => n.dedupeKey);
    expect(r3).toEqual(["ca:r1:R3:cand-2:u-cc", "ca:r1:R3:cand-2:u-primary"]);

    await insertCase({ id: "g1", status: "SUGGESTED", severity: "warning" });
    await insertCase({ id: "g2", status: "SUGGESTED", severity: "warning" });
    expect((await scan(local(6, 9, 25))).sends).toEqual({});
    expect((await scan(local(6, 9, 31))).sends).toEqual({ R0w: 1 });
    expect((await scan(local(6, 15))).sends).toEqual({});
    const digest = (await notices()).filter((n) => n.dedupeKey.startsWith("ca-digest:"));
    expect(digest).toEqual([expect.objectContaining({ userId: "u-owner", dedupeKey: `ca-digest:${WS}:u-owner:2026-11-06` })]);
  });
});
