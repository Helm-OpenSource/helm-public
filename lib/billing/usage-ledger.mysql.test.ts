import { randomUUID } from "node:crypto";
import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { ObjectType, PrismaClient, UsageType } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { recordIdempotentUsage, reverseUsageLedgerEntry } from "./usage-ledger";
import { getAcceptedBriefing, persistAcceptedBriefingInTransaction } from "@/lib/memory/briefing-usage.service";

// Never use DATABASE_URL or the application's default connection for this suite.
const socket = process.env.USAGE_LEDGER_MYSQL_SOCKET;
const ciUrl = process.env.USAGE_LEDGER_MYSQL_DATABASE_URL;
const required = process.env.USAGE_LEDGER_MYSQL_REQUIRED === "1";
if (required && !socket && !ciUrl) throw new Error("isolated_usage_database_required");
if (socket && ciUrl) throw new Error("isolated_usage_database_ambiguous");

describe.skipIf(!socket && !ciUrl)("persisted usage observation concurrency", () => {
  if (!socket && !ciUrl) { it.skip("requires an explicit synthetic target", () => {}); return; }
  const run = randomUUID().replaceAll("-", "");
  const workspace = `usage-${run}`, other = `other-${run}`;
  const owner = `owner-${run}`, reviewer = `reviewer-${run}`;
  const database = `helm_usage_${run}`;
  let admin: PrismaClient | undefined, a: PrismaClient, b: PrismaClient, createdDatabase = false;
  const source = { workspaceId: workspace, userId: owner, usageType: UsageType.BRIEFING_GENERATION, quantity: 3 };
  const correction = { workspaceId: workspace, actorUserId: owner, reasonCode: "invalid_measurement" as const };
  beforeAll(async () => {
    let url: string;
    if (socket) {
      if (!/^\/private\/tmp\/helm-usage-ledger-mysql\.[A-Za-z0-9]+\/db\.sock$/.test(socket)) throw new Error("synthetic_socket_path_invalid");
      const parent = dirname(socket), file = lstatSync(socket), directory = statSync(parent);
      if (!file.isSocket() || file.uid !== process.getuid?.() || directory.uid !== process.getuid?.() ||
          (directory.mode & 0o077) !== 0 || realpathSync(socket) !== socket) throw new Error("synthetic_socket_identity_invalid");
      admin = new PrismaClient({ datasources: { db: { url: `mysql://root@localhost/mysql?socket=${encodeURIComponent(socket)}` } } });
      const [server] = await admin.$queryRaw<Array<{ offline: bigint; directory: string }>>`SELECT @@skip_networking AS offline, @@datadir AS directory`;
      if (Number(server?.offline) !== 1 || realpathSync(server.directory) !== realpathSync(join(parent, "data"))) throw new Error("synthetic_server_identity_invalid");
      await admin.$executeRawUnsafe(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      createdDatabase = true;
      url = `mysql://root@localhost/${database}?socket=${encodeURIComponent(socket)}`;
    } else {
      const parsed = new URL(ciUrl!);
      if (process.env.GITHUB_ACTIONS !== "true" || !/^[a-f0-9]{12,64}$/.test(process.env.USAGE_LEDGER_MYSQL_CI_CONTAINER ?? "") ||
          parsed.protocol !== "mysql:" || parsed.hostname !== "127.0.0.1" || parsed.port !== "3306" ||
          parsed.pathname !== "/helm_caio_p1d_ci" || parsed.searchParams.has("socket")) throw new Error("ephemeral_ci_target_invalid");
      url = parsed.toString();
    }
    a = new PrismaClient({ datasources: { db: { url } } });
    b = new PrismaClient({ datasources: { db: { url } } });
    if (socket) {
      for (const sql of [
        "CREATE TABLE Workspace (id VARCHAR(191) PRIMARY KEY,name VARCHAR(191),slug VARCHAR(191),status VARCHAR(32) DEFAULT 'ACTIVE',updatedAt DATETIME(3))",
        "CREATE TABLE User (id VARCHAR(191) PRIMARY KEY,name VARCHAR(191),email VARCHAR(191),updatedAt DATETIME(3))",
        "CREATE TABLE Membership (id VARCHAR(191) PRIMARY KEY,workspaceId VARCHAR(191),userId VARCHAR(191),role VARCHAR(32),status VARCHAR(32) DEFAULT 'ACTIVE',accessScope VARCHAR(64) NULL,updatedAt DATETIME(3),UNIQUE KEY (workspaceId,userId))",
        `CREATE TABLE UsageLedger (id VARCHAR(191) PRIMARY KEY,workspaceId VARCHAR(191) NOT NULL,userId VARCHAR(191),usageType ENUM(${Object.values(UsageType).map(t => `'${t}'`).join(",")}) NOT NULL,quantity INT NOT NULL DEFAULT 1,metadata LONGTEXT,sourcePage VARCHAR(191),recordedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3))`,
        "CREATE TABLE BriefingSnapshot (id VARCHAR(191) PRIMARY KEY,workspaceId VARCHAR(191),objectType VARCHAR(191),objectId VARCHAR(191),snapshotType VARCHAR(191),content LONGTEXT,sourceFactIds LONGTEXT,sourceCommitmentIds LONGTEXT,sourceBlockerIds LONGTEXT,generatedAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),expiresAt DATETIME(3),version INT DEFAULT 1)",
        // Mirrors the settled/reserved shape CHECKs of 20260917200000_llm_spend_ledger_candidate so the
        // socket target rejects the same fixture rows the fully migrated CI schema rejects.
        "CREATE TABLE LLMSpendLedgerEntry (id VARCHAR(191) PRIMARY KEY,workspaceId VARCHAR(191),periodKey VARCHAR(191),periodPolicyVersion VARCHAR(191),attemptRef VARCHAR(191),state VARCHAR(191),reservedMicros BIGINT,settledMicros BIGINT,usageState VARCHAR(16) NULL,provider VARCHAR(191),model VARCHAR(191),settledAt DATETIME(3) NULL,expiresAt DATETIME(3),updatedAt DATETIME(3)," +
          "CONSTRAINT LLMSpendLedgerEntry_settled_shape_check CHECK (state <> 'settled' OR (settledMicros IS NOT NULL AND settledAt IS NOT NULL))," +
          "CONSTRAINT LLMSpendLedgerEntry_reserved_shape_check CHECK (state <> 'reserved' OR (settledMicros IS NULL AND settledAt IS NULL)))",
      ]) await a.$executeRawUnsafe(sql);
      await a.$executeRawUnsafe(readFileSync(new URL("../../prisma/migrations/20261109130000_usage_ledger_idempotency/migration.sql", import.meta.url), "utf8"));
      await a.$executeRawUnsafe(readFileSync(new URL("../../prisma/migrations/20261003190000_ordinary_llm_workflow_operation/migration.sql", import.meta.url), "utf8"));
    }
    for (const id of [workspace, other]) await a.$executeRaw`INSERT INTO Workspace (id,name,slug,updatedAt) VALUES (${id},'Synthetic usage',${id},NOW(3))`;
    for (const id of [owner, reviewer]) {
      await a.$executeRaw`INSERT INTO User (id,name,email,updatedAt) VALUES (${id},'Synthetic reviewer',${`${id}@example.invalid`},NOW(3))`;
      await a.$executeRaw`INSERT INTO Membership (id,workspaceId,userId,role,status,updatedAt) VALUES (${`membership-${id}`},${workspace},${id},'BILLING_ADMIN','ACTIVE',NOW(3))`;
    }
  });
  afterAll(async () => {
    if (a && !socket) {
      await a.briefingSnapshot.deleteMany({ where: { workspaceId: workspace } });
      await a.lLMWorkflowOperation.deleteMany({ where: { workspaceId: workspace } });
      await a.lLMSpendLedgerEntry.deleteMany({ where: { workspaceId: workspace } });
      await a.$executeRaw`DELETE FROM UsageLedger WHERE workspaceId IN (${workspace},${other})`;
      await a.$executeRaw`DELETE FROM Membership WHERE workspaceId = ${workspace}`;
      await a.$executeRaw`DELETE FROM Workspace WHERE id IN (${workspace},${other})`;
      await a.$executeRaw`DELETE FROM User WHERE id IN (${owner},${reviewer})`;
    }
    await Promise.all([a?.$disconnect(), b?.$disconnect()]);
    if (admin && createdDatabase) await admin.$executeRawUnsafe(`DROP DATABASE \`${database}\``);
    await admin?.$disconnect();
  });
  it("uses independent sessions and admits one row for eight concurrent replays", async () => {
    const [sa] = await a.$queryRaw<Array<{ id: bigint }>>`SELECT CONNECTION_ID() AS id`;
    const [sb] = await b.$queryRaw<Array<{ id: bigint }>>`SELECT CONNECTION_ID() AS id`;
    expect(sa.id).not.toBe(sb.id);
    const rows = await Promise.all(Array.from({ length: 8 }, (_, i) => recordIdempotentUsage({ ...source, operationKey: "same-operation" }, i % 2 ? a : b)));
    expect(new Set(rows.map(row => row.id)).size).toBe(1);
    expect(await a.usageLedger.count({ where: { workspaceId: workspace, operationKey: "same-operation" } })).toBe(1);
  });
  it("rejects same-key different content even when the writers race", async () => {
    const results = await Promise.allSettled([a,b].map((client, i) => recordIdempotentUsage({ ...source, operationKey: "content-race", quantity: i + 1 }, client)));
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(String((results.find(r => r.status === "rejected") as PromiseRejectedResult).reason)).toContain("usage_operation_conflict");
  });
  it("keeps workspace scopes and byte-exact keys independent", async () => {
    const rows = await Promise.all([
      recordIdempotentUsage({ ...source, operationKey: "CaseKey" }, a),
      recordIdempotentUsage({ ...source, operationKey: "casekey" }, b),
      recordIdempotentUsage({ ...source, operationKey: "CaseKey", workspaceId: other }, b),
    ]);
    expect(new Set(rows.map(r => r.id)).size).toBe(3);
    await expect(recordIdempotentUsage({ ...source, workspaceId: workspace.toUpperCase(), operationKey: "CaseKey" }, b)).rejects.toThrow("usage_operation_conflict");
  });
  it("appends one concurrent full reversal and preserves original and recognition time", async () => {
    const original = await recordIdempotentUsage({ ...source, operationKey: "reverse-original", recordedAt: new Date("2026-01-01T00:00:00Z") }, a);
    const rows = await Promise.all(Array.from({ length: 8 }, (_, i) => reverseUsageLedgerEntry({ ...correction, entryId: original.id, operationKey: "reverse-one" }, i % 2 ? a : b)));
    expect(new Set(rows.map(row => row.id)).size).toBe(1);
    expect(rows[0].quantity).toBe(-3); expect(rows[0].recordedAt).toEqual(original.recordedAt);
    expect(rows[0].createdAt.getTime()).toBeGreaterThan(original.recordedAt.getTime());
    expect(await a.usageLedger.findUnique({ where: { id: original.id } })).toEqual(original);
  });
  it("serializes different reviewers reversing the same original under different keys", async () => {
    const original = await recordIdempotentUsage({ ...source, operationKey: "reverse-race" }, a);
    const results = await Promise.allSettled([owner,reviewer].map((actorUserId,i) => reverseUsageLedgerEntry({
      ...correction, actorUserId, entryId: original.id, operationKey: `reverse-race-${i}`,
    }, i ? a : b)));
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(await a.usageLedger.count({ where: { reversalOfId: original.id } })).toBe(1);
  });
  it("rechecks revoked membership, role, external scope and workspace state", async () => {
    const original = await recordIdempotentUsage({ ...source, operationKey: "authorization" }, a);
    for (const change of ["role='MEMBER'", "status='INACTIVE'", "accessScope='synthetic-external'"]) {
      await a.$executeRawUnsafe(`UPDATE Membership SET ${change} WHERE userId=?`, owner);
      await expect(reverseUsageLedgerEntry({ ...correction, entryId: original.id, operationKey: "denied" }, b)).rejects.toThrow("usage_correction_forbidden");
      await a.$executeRaw`UPDATE Membership SET role='BILLING_ADMIN',status='ACTIVE',accessScope=NULL WHERE userId=${owner}`;
    }
    await a.$executeRaw`UPDATE Workspace SET status='SUSPENDED' WHERE id=${workspace}`;
    await expect(reverseUsageLedgerEntry({ ...correction, entryId: original.id, operationKey: "denied" }, b)).rejects.toThrow("usage_correction_forbidden");
    await a.$executeRaw`UPDATE Workspace SET status='ACTIVE' WHERE id=${workspace}`;
    const foreign = await recordIdempotentUsage({ ...source, workspaceId: other, operationKey: "foreign" }, a);
    await expect(reverseUsageLedgerEntry({ ...correction, entryId: foreign.id, operationKey: "cross-scope" }, b)).rejects.toThrow("usage_entry_unavailable");
  });
  it("rolls back a failed transaction and never retries an unknown outcome", async () => {
    let calls = 0;
    const broken = { $transaction: (run: Parameters<PrismaClient["$transaction"]>[0]) => a.$transaction(async tx => {
      calls++; await (run as (tx: typeof tx) => Promise<unknown>)(tx); throw new Error("synthetic_unknown_outcome");
    }) } as unknown as PrismaClient;
    await expect(recordIdempotentUsage({ ...source, operationKey: "rollback" }, broken)).rejects.toThrow("synthetic_unknown_outcome");
    expect(calls).toBe(1);
    expect(await a.usageLedger.count({ where: { workspaceId: workspace, operationKey: "rollback" } })).toBe(0);
  });
  it("enforces shape in SQL while leaving legacy unkeyed observations unchanged", async () => {
    await expect(a.usageLedger.create({ data: { ...source, operationKey: "no-hash" } })).rejects.toThrow();
    await expect(a.usageLedger.create({ data: { ...source, operationKey: "negative", quantity: -1, contentHash: "a".repeat(64) } })).rejects.toThrow();
    const legacy = await a.usageLedger.create({ data: { ...source, quantity: 0 } });
    expect(legacy.operationKey).toBeNull(); expect(legacy.quantity).toBe(0);
    await expect(reverseUsageLedgerEntry({ ...correction, entryId: legacy.id, operationKey: "legacy" }, b)).rejects.toThrow("usage_entry_not_reversible");
  });
  async function briefing(suffix: string) {
    const operation = await a.lLMWorkflowOperation.create({ data: { workspaceId: workspace, operationKey: `op-${suffix}`,
      requestKey: `request-${suffix}`, kind: "briefing", sourceType: "meeting", sourceId: `meeting-${suffix}`,
      sourceVersion: "synthetic-v1", sourceDigest: "synthetic-digest", actorUserId: owner, generation: 1, slot: "pre_meeting_brief" } });
    return { operationId: operation.id, actorUserId: owner, sourcePage: "/synthetic-briefing", data: {
      workspaceId: workspace, objectType: ObjectType.MEETING, objectId: operation.sourceId, snapshotType: operation.slot,
      content: JSON.stringify({ summary: "Synthetic accepted output", generationMode: "llm_enhanced", llmMeta: { success: true, fallbackUsed: false } }),
    } };
  }
  it("atomically persists one artifact and one observation under concurrent logical replays", async () => {
    const input = await briefing("concurrent");
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => (i % 2 ? a : b).$transaction(
      tx => persistAcceptedBriefingInTransaction(tx, input), { timeout: 10000 })));
    expect(new Set(results.map(result => result.snapshot.id)).size).toBe(1);
    expect(await a.briefingSnapshot.count({ where: { workspaceId: workspace, objectId: input.data.objectId } })).toBe(1);
    expect(await a.usageLedger.count({ where: { workspaceId: workspace, operationKey: `briefing:${input.operationId}` } })).toBe(1);
    const restarted = await getAcceptedBriefing(b, workspace, input.operationId);
    expect(restarted?.usageReceipt).toEqual(results[0].usageReceipt);
    await expect(b.$transaction(tx => persistAcceptedBriefingInTransaction(tx, { ...input,
      data: { ...input.data, content: input.data.content.replace("accepted", "different") } }))).rejects.toThrow("briefing_usage_conflict");
  });
  it("rolls back artifact, expiration and usage together without undoing previously settled provider cost", async () => {
    const input = await briefing("rollback");
    const previous = await a.briefingSnapshot.create({ data: { ...input.data, content: "legacy" } });
    const costId = `cost-${run}`;
    await a.$executeRaw`INSERT INTO LLMSpendLedgerEntry (id,workspaceId,periodKey,periodPolicyVersion,attemptRef,state,reservedMicros,settledMicros,usageState,provider,model,settledAt,expiresAt,updatedAt)
      VALUES (${costId},${workspace},'synthetic-period','v1',${costId},'settled',100,80,'known','synthetic','synthetic',NOW(3),NOW(3),NOW(3))`;
    const costs = () => a.$queryRaw`SELECT id,state,reservedMicros,settledMicros,usageState,settledAt FROM LLMSpendLedgerEntry WHERE id=${costId}`;
    const before = await costs();
    await expect(a.$transaction(async tx => {
      await persistAcceptedBriefingInTransaction(tx, input); throw new Error("synthetic_after_usage_failure");
    })).rejects.toThrow("synthetic_after_usage_failure");
    expect(await a.briefingSnapshot.findUnique({ where: { id: previous.id } })).toEqual(previous);
    expect(await a.briefingSnapshot.count({ where: { workspaceId: workspace, objectId: input.data.objectId } })).toBe(1);
    expect(await a.usageLedger.count({ where: { workspaceId: workspace, operationKey: `briefing:${input.operationId}` } })).toBe(0);
    for (const reason of ["output_parse_failed", "policy_pii_in_output"]) {
      await expect(b.$transaction(tx => persistAcceptedBriefingInTransaction(tx, { ...input, data: { ...input.data,
        content: JSON.stringify({ generationMode: "fallback", llmMeta: { success: false, fallbackUsed: true, fallbackReason: reason } }) } })))
        .rejects.toThrow("briefing_output_not_accepted");
    }
    expect(await costs()).toEqual(before);
  });
});
