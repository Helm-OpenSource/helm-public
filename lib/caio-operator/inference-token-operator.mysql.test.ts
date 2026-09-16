import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Pull inference access material on an isolated MySQL database: OWNER-only, validation by default, material
 * returned once and never stored in the audit trail.
 *
 *   CAIO_INFERENCE_DATABASE_URL=<disposable helm_caio_inference_* db url> DATABASE_URL=<same url> \
 *     npx vitest run lib/caio-operator/inference-token-operator.mysql.test.ts --config vitest.public.config.ts
 */

import { db } from "@/lib/db";

import { runCaioInferenceTokenOperation } from "./inference-token-operator";

const integrationDatabaseUrl = process.env.CAIO_INFERENCE_DATABASE_URL;
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const suffix = `t${process.pid}${Date.now()}`.replace(/\d/gu, (digit) => "abcdefghij"[Number(digit)]);
const NOW = new Date("2026-09-16T05:00:00.000Z");
const DEVICE_IP = [10, 0, 0, 12].join(".");

describeMysql("CAIO inference token operator with an isolated MySQL database", () => {
  let workspaceId = "";
  let ownerId = "";
  let memberId = "";

  const issueInput = {
    userRef: "user:inference-worker",
    deviceRef: `device:on-premises-${suffix}`,
    approvedSourceIp: DEVICE_IP,
  };

  beforeAll(async () => {
    const databaseName = new URL(integrationDatabaseUrl!).pathname.replace(/^\//u, "");
    if (process.env.DATABASE_URL !== integrationDatabaseUrl || !databaseName.startsWith("helm_caio_inference_")) {
      throw new Error("Refusing token operator integration test: use a disposable helm_caio_inference_* database as DATABASE_URL.");
    }
    workspaceId = (await db.workspace.create({ data: { name: `CAIO token ${suffix}`, slug: `caio-token-${suffix}` } })).id;
    ownerId = (await db.user.create({ data: { name: "Token Owner", email: `owner-${suffix}@example.test` } })).id;
    memberId = (await db.user.create({ data: { name: "Token Member", email: `member-${suffix}@example.test` } })).id;
    await db.membership.create({
      data: { workspaceId, userId: ownerId, role: WorkspaceRole.OWNER, status: MembershipStatus.ACTIVE },
    });
    await db.membership.create({
      data: { workspaceId, userId: memberId, role: WorkspaceRole.MEMBER, status: MembershipStatus.ACTIVE },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("refuses a non-owner and validates without issuing anything", async () => {
    await expect(
      runCaioInferenceTokenOperation({
        operation: "issue", workspaceId, actorUserId: memberId, rawInput: issueInput, apply: true, now: NOW,
      }),
    ).resolves.toEqual({ ok: false, code: "not_owner" });

    await expect(
      runCaioInferenceTokenOperation({
        operation: "issue", workspaceId, actorUserId: ownerId, rawInput: { ...issueInput, approvedSourceIp: "worker.local" }, apply: true, now: NOW,
      }),
    ).resolves.toEqual({ ok: false, code: "input_invalid" });

    const dryRun = await runCaioInferenceTokenOperation({
      operation: "issue", workspaceId, actorUserId: ownerId, rawInput: issueInput, apply: false, now: NOW,
    });
    expect(dryRun).toEqual({ ok: true, applied: false, value: {} });
    expect(await db.caioAccessToken.count({ where: { workspaceId } })).toBe(0);
  });

  it("issues one single-audience material, returns it once, and keeps it out of the audit trail", async () => {
    const issued = await runCaioInferenceTokenOperation({
      operation: "issue", workspaceId, actorUserId: ownerId, rawInput: issueInput, apply: true, now: NOW,
    });
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    expect(issued.rawToken?.startsWith("hcaio_inf_")).toBe(true);
    expect(issued.value).toMatchObject({ status: "active", tokenPrefix: issued.rawToken!.slice(0, 12) });

    const rows = await db.caioAccessToken.findMany({ where: { workspaceId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ audience: "inference", clientType: "inference_worker", status: "active" });
    // Only the hash is persisted; the material itself never reaches a column.
    expect(rows[0]!.tokenHash).not.toBe(issued.rawToken);
    expect(JSON.stringify(rows[0])).not.toContain(issued.rawToken!.slice(12));

    const audit = await db.auditLog.findFirst({
      where: { workspaceId, actionType: "CAIO_INFERENCE_TOKEN_ISSUED" },
    });
    expect(audit).not.toBeNull();
    expect(JSON.stringify(audit)).not.toContain(issued.rawToken!.slice(12));
    expect(JSON.stringify(audit)).not.toContain(rows[0]!.tokenHash);

    // A second issuance for the same binding is refused: revoke first, then issue.
    await expect(
      runCaioInferenceTokenOperation({
        operation: "issue", workspaceId, actorUserId: ownerId, rawInput: issueInput, apply: true, now: NOW,
      }),
    ).resolves.toEqual({ ok: false, code: "token_conflict" });
  });

  it("lists material without the hash and revokes it idempotently", async () => {
    const listed = await runCaioInferenceTokenOperation({
      operation: "list", workspaceId, actorUserId: ownerId, rawInput: {}, apply: false, now: NOW,
    });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.tokens).toHaveLength(1);
    expect(JSON.stringify(listed.value.tokens)).not.toContain("sha256:");
    const tokenId = listed.value.tokens![0]!.tokenId;

    await expect(
      runCaioInferenceTokenOperation({
        operation: "revoke", workspaceId, actorUserId: ownerId, rawInput: { tokenId }, apply: true, now: NOW,
      }),
    ).resolves.toMatchObject({ ok: true, value: { status: "revoked", alreadyRevoked: false } });
    await expect(
      runCaioInferenceTokenOperation({
        operation: "revoke", workspaceId, actorUserId: ownerId, rawInput: { tokenId }, apply: true, now: NOW,
      }),
    ).resolves.toMatchObject({ ok: true, value: { alreadyRevoked: true } });
    expect(
      (await db.caioAccessToken.findUniqueOrThrow({ where: { id: tokenId } })).status,
    ).toBe("revoked");
  });

  it("refuses to revoke material that is not this workspace's inference material", async () => {
    const foreign = await db.caioAccessToken.create({
      data: {
        id: `token-foreign-${suffix}`,
        createdAt: NOW,
        workspaceId,
        userRef: "user:codex",
        clientType: "codex",
        deviceRef: `device:mac-${suffix}`,
        audience: "mcp",
        tokenHash: `sha256:${"b".repeat(64)}`,
        tokenPrefix: "hcaio_mcp_a",
        approvedSourceIp: DEVICE_IP,
        status: "active",
        expiresAt: new Date(NOW.getTime() + 86_400_000),
        rateWindowStartedAt: NOW,
      },
      select: { id: true },
    });
    await expect(
      runCaioInferenceTokenOperation({
        operation: "revoke", workspaceId, actorUserId: ownerId, rawInput: { tokenId: foreign.id }, apply: true, now: NOW,
      }),
    ).resolves.toEqual({ ok: false, code: "token_rejected" });
    expect((await db.caioAccessToken.findUniqueOrThrow({ where: { id: foreign.id } })).status).toBe("active");
  });
});
