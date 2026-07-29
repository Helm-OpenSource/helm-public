import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { createPrismaCaioMemoryStore } from "@/lib/caio-enterprise-memory/candidate-store.service";
import { CANDIDATE_TTL_MS } from "@/lib/caio-enterprise-memory/memory-contracts";
import { sha256 } from "@/lib/expert-capability/hashing";

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
      "Refusing enterprise-memory integration test: confirm the isolated database name and use the helm_caio_ctx_ prefix.",
    );
  }
}

describeMysql("enterprise memory Prisma store on an isolated MySQL database", () => {
  const T0 = new Date();
  const store = createPrismaCaioMemoryStore();
  let workspaceId = "";

  function at(offsetMs: number): Date {
    return new Date(T0.getTime() + offsetMs);
  }

  async function seedCandidate(body: string) {
    return store.createCandidate(
      {
        workspaceId,
        createdByRef: "user:creator",
        body,
        sourceRequestId: `req-${suffix}`,
      },
      T0,
    );
  }

  beforeAll(async () => {
    assertIsolatedDatabaseTarget();
    const workspace = await db.workspace.create({
      data: {
        name: `Enterprise memory integration ${suffix}`,
        slug: `enterprise-memory-integration-${suffix}`,
      },
    });
    workspaceId = workspace.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("keeps a persisted candidate invisible to retrieval, even by id", async () => {
    const created = await seedCandidate(`invisible candidate ${suffix}`);
    expect(created.state).toBe("candidate");
    expect(
      await store.queryRetrievableMemory({
        workspaceId,
        id: created.id,
        now: at(1_000),
      }),
    ).toEqual([]);
    expect(
      await store.queryRetrievableMemory({ workspaceId, now: at(1_000) }),
    ).toEqual([]);
  });

  it("lets exactly one of two concurrent adopts win", async () => {
    const created = await seedCandidate(`concurrent adoption ${suffix}`);
    const attempts = await Promise.allSettled([
      store.adoptCandidate({
        workspaceId,
        candidateId: created.id,
        actorRef: "user:creator",
        now: at(1_000),
      }),
      store.adoptCandidate({
        workspaceId,
        candidateId: created.id,
        actorRef: "user:creator",
        now: at(1_000),
      }),
    ]);
    expect(
      attempts.filter((attempt) => attempt.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      attempts.filter((attempt) => attempt.status === "rejected"),
    ).toHaveLength(1);
    const stored = await db.caioMemoryCandidate.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stored.state).toBe("ephemeral");
    expect(stored.projectRef).toBeNull();
  });

  it("enforces creator-only adoption and knowledge-owner-only verification", async () => {
    const created = await seedCandidate(`permissions ${suffix}`);
    await expect(
      store.adoptCandidate({
        workspaceId,
        candidateId: created.id,
        actorRef: "user:other",
        now: at(1_000),
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await store.adoptCandidate({
      workspaceId,
      candidateId: created.id,
      actorRef: "user:creator",
      targetProjectRef: "proj-b",
      now: at(1_000),
    });
    await expect(
      store.verifyEphemeral({
        workspaceId,
        candidateId: created.id,
        actorRef: "user:creator",
        actorIsKnowledgeOwner: false,
        now: at(2_000),
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    const verified = await store.verifyEphemeral({
      workspaceId,
      candidateId: created.id,
      actorRef: "user:knowledge-owner",
      actorIsKnowledgeOwner: true,
      now: at(2_000),
    });
    expect(verified.state).toBe("verified");
    const entries = await store.queryRetrievableMemory({
      workspaceId,
      id: created.id,
      now: at(3_000),
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.provenance.isVerified).toBe(true);
    expect(entries[0]!.projectRef).toBe("proj-b");
  });

  it("reject deletes the body irrecoverably while keeping hash and receipt", async () => {
    const body = `reject me ${suffix}`;
    const created = await seedCandidate(body);
    await store.rejectCandidate({
      workspaceId,
      candidateId: created.id,
      actorRef: "user:creator",
      now: at(1_000),
    });
    const stored = await db.caioMemoryCandidate.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stored.state).toBe("rejected");
    expect(stored.body).toBeNull();
    expect(stored.contentHash).toBe(sha256(body));
    expect(JSON.stringify(stored)).not.toContain(body);
  });

  it("sweeps expired candidates and deletes their bodies", async () => {
    const body = `expire me ${suffix}`;
    const created = await seedCandidate(body);
    const expiredCount = await store.expireCandidates({
      workspaceId,
      now: at(CANDIDATE_TTL_MS + 1),
    });
    expect(expiredCount).toBeGreaterThanOrEqual(1);
    const stored = await db.caioMemoryCandidate.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stored.state).toBe("expired");
    expect(stored.body).toBeNull();
    expect(stored.contentHash).toBe(sha256(body));
  });
});
