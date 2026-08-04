import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  buildContextReceipt,
  createPrismaContextReceiptStore,
} from "@/lib/caio-context-broker/receipt.service";
import { createPrismaContextRuleStore } from "@/lib/caio-context-broker/rule-store.service";

const integrationDatabaseUrl =
  process.env.CAIO_CONTEXT_MEMORY_DATABASE_URL;
const confirmedIntegrationDatabaseName =
  process.env.CAIO_CONTEXT_MEMORY_TEST_DATABASE_NAME;
const describeMysql = integrationDatabaseUrl
  ? describe.sequential
  : describe.skip;
const suffix = `${process.pid}-${Date.now()}`;
const ISOLATED_DATABASE_PREFIX = "helm_caio_ctx_";

function assertIsolatedDatabaseTarget(): void {
  if (
    !integrationDatabaseUrl ||
    process.env.DATABASE_URL !== integrationDatabaseUrl
  ) {
    throw new Error(
      "DATABASE_URL must equal CAIO_CONTEXT_MEMORY_DATABASE_URL for the isolated integration test.",
    );
  }
  let databaseName = "";
  try {
    const parsed = new URL(integrationDatabaseUrl);
    databaseName = decodeURIComponent(
      parsed.pathname.replace(/^\/+/u, ""),
    );
  } catch {
    throw new Error(
      "CAIO_CONTEXT_MEMORY_DATABASE_URL must be a valid isolated MySQL URL.",
    );
  }
  if (
    !databaseName.startsWith(ISOLATED_DATABASE_PREFIX) ||
    databaseName !== confirmedIntegrationDatabaseName
  ) {
    throw new Error(
      "Refusing context-broker integration test: confirm the isolated database name and use the helm_caio_ctx_ prefix.",
    );
  }
}

describeMysql("context broker Prisma stores on an isolated MySQL database", () => {
  const NOW = new Date();
  const OWNER = { actorRef: "user:owner", isOwnerOrAdmin: true };
  let workspaceId = "";

  beforeAll(async () => {
    assertIsolatedDatabaseTarget();
    const workspace = await db.workspace.create({
      data: {
        name: `Context broker integration ${suffix}`,
        slug: `context-broker-integration-${suffix}`,
      },
    });
    workspaceId = workspace.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("runs the negative rule lifecycle with version supersession", async () => {
    const store = createPrismaContextRuleStore();
    const ruleKey = `block-vendor-${suffix}`;
    const v1 = await store.createDraftRule(
      {
        workspaceId,
        ruleKey,
        scopeKind: "workspace",
        scopeRef: null,
        ruleKind: "deny",
        pattern: { sourceProject: "vendor" },
        createdByRef: "user:a",
      },
      NOW,
    );
    expect(v1.version).toBe(1);
    expect(v1.status).toBe("draft");

    await expect(
      store.publishRule({
        workspaceId,
        ruleId: v1.id,
        actor: { actorRef: "user:member", isOwnerOrAdmin: false },
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "caio_rule_forbidden" });

    const published = await store.publishRule({
      workspaceId,
      ruleId: v1.id,
      actor: OWNER,
      now: NOW,
    });
    expect(published.status).toBe("published");
    expect(published.publishedByRef).toBe(OWNER.actorRef);

    const v2 = await store.createDraftRule(
      {
        workspaceId,
        ruleKey,
        scopeKind: "workspace",
        scopeRef: null,
        ruleKind: "deny",
        pattern: { sourceProject: "vendor", classification: "internal" },
        createdByRef: "user:a",
      },
      NOW,
    );
    expect(v2.version).toBe(2);
    await store.publishRule({
      workspaceId,
      ruleId: v2.id,
      actor: OWNER,
      now: new Date(NOW.getTime() + 1_000),
    });

    const listed = await store.listPublishedRules({ workspaceId });
    const forKey = listed.filter((rule) => rule.ruleKey === ruleKey);
    expect(forKey.map((rule) => rule.version)).toEqual([2]);
    const superseded = await store.getRule({ workspaceId, ruleId: v1.id });
    expect(superseded?.status).toBe("revoked");

    const revoked = await store.revokeRule({
      workspaceId,
      ruleId: v2.id,
      actor: OWNER,
      now: new Date(NOW.getTime() + 2_000),
    });
    expect(revoked.status).toBe("revoked");
    expect(
      (await store.listPublishedRules({ workspaceId })).filter(
        (rule) => rule.ruleKey === ruleKey,
      ),
    ).toEqual([]);
  });

  it("keeps audit suggestions as drafts", async () => {
    const store = createPrismaContextRuleStore();
    const suggested = await store.suggestRuleFromAudit(
      {
        workspaceId,
        ruleKey: `audit-suggested-${suffix}`,
        scopeKind: "workspace",
        scopeRef: null,
        ruleKind: "redact",
        pattern: { contentRegex: "codename-\\w+" },
        createdByRef: "audit:runner",
        auditFindingRef: "audit:finding-1",
      },
      NOW,
    );
    expect(suggested.status).toBe("draft");
    expect(suggested.publishedAt).toBeNull();
  });

  it("writes one receipt per request, rejects re-writes, and stores no secret content", async () => {
    const store = createPrismaContextReceiptStore();
    const seededSecret = `sk-integrationsecret${suffix.replace(/[^a-z0-9]/giu, "")}`;
    const receipt = buildContextReceipt({
      workspaceId,
      userRef: "user:a",
      requestId: `req-${suffix}`,
      decision: "DENY_EXTERNAL",
      policyVersion: "policy-v1",
      ruleHits: ["hard_boundary:api_or_session_token"],
      sources: [
        {
          sourceProject: "proj-b",
          sourceRef: "doc:secret-note",
          sourceVersionOrContentHash: `sha256:${"a".repeat(64)}`,
          classification: "internal",
          redactionState: "none",
          receiptId: "caio-context-receipt:pending",
        },
      ],
      redactionReliable: false,
      now: NOW,
    });
    await store.writeReceipt(receipt);
    await expect(store.writeReceipt(receipt)).rejects.toMatchObject({
      code: "caio_receipt_conflict",
    });

    const read = await store.readReceipt({
      workspaceId,
      requestId: `req-${suffix}`,
    });
    expect(read).not.toBeNull();
    expect(read!.contentHash).toBe(receipt.contentHash);
    expect(read!.sources[0]!.citationLabel).toBe("[CAIO:S1]");

    const row = await db.caioContextReceipt.findUniqueOrThrow({
      where: {
        workspaceId_requestId: {
          workspaceId,
          requestId: `req-${suffix}`,
        },
      },
    });
    expect(JSON.stringify(row)).not.toContain(seededSecret);
  });
});
