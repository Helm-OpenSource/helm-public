import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { createPrismaCaioMemoryStore } from "@/lib/caio-enterprise-memory/candidate-store.service";
import {
  CANDIDATE_TTL_MS,
  CaioMemoryError,
} from "@/lib/caio-enterprise-memory/memory-contracts";
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

  async function seedCandidate(
    body: string,
    options: { projectRef?: string; createdAt?: Date } = {},
  ) {
    return store.createCandidate(
      {
        workspaceId,
        createdByRef: "user:creator",
        body,
        ...(options.projectRef ? { projectRef: options.projectRef } : {}),
        sourceRequestId: `req-${suffix}`,
      },
      options.createdAt ?? T0,
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
    // Diagnostic form: on MySQL 8.4 this reported "got 2" with no indication
    // of why both conditional updates matched. Asserting the observed shape
    // (outcomes + rejection codes + adopting actor) makes the CI failure
    // self-diagnosing instead of requiring a guess.
    const adoptedRow = await db.caioMemoryCandidate.findUniqueOrThrow({
      where: { id: created.id },
      select: { state: true, adoptedByRef: true, adoptedAt: true },
    });
    expect({
      fulfilled: attempts.filter((a) => a.status === "fulfilled").length,
      rejected: attempts.filter((a) => a.status === "rejected").length,
      rejectionCodes: attempts
        .filter(
          (a): a is PromiseRejectedResult => a.status === "rejected",
        )
        .map((a) =>
          a.reason instanceof CaioMemoryError
            ? a.reason.code
            : String(a.reason),
        ),
      storedState: adoptedRow.state,
      adoptedByRef: adoptedRow.adoptedByRef,
    }).toEqual({
      fulfilled: 1,
      rejected: 1,
      rejectionCodes: ["conflict"],
      storedState: "ephemeral",
      adoptedByRef: "user:creator",
    });
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

  // F7 regression on the Prisma path.
  it("preserves the creation-time projectRef on adoption unless promoted", async () => {
    const scoped = await seedCandidate(`scoped adoption ${suffix}`, {
      projectRef: "proj-a",
    });
    const adopted = await store.adoptCandidate({
      workspaceId,
      candidateId: scoped.id,
      actorRef: "user:creator",
      now: at(1_000),
    });
    expect(adopted.projectRef).toBe("proj-a");

    const promoted = await seedCandidate(`promoted adoption ${suffix}`, {
      projectRef: "proj-a",
    });
    const promotedRecord = await store.adoptCandidate({
      workspaceId,
      candidateId: promoted.id,
      actorRef: "user:creator",
      promoteToWorkspaceScope: true,
      now: at(1_000),
    });
    expect(promotedRecord.projectRef).toBeNull();
  });

  // F8 regression on the Prisma path: same observable order as in-memory.
  it("returns verified entries before ephemeral ones, newest first", async () => {
    const orderWorkspace = await db.workspace.create({
      data: {
        name: `Enterprise memory ordering ${suffix}`,
        slug: `enterprise-memory-ordering-${suffix}`,
      },
    });
    async function adoptAt(body: string, createdAt: Date) {
      const created = await store.createCandidate(
        {
          workspaceId: orderWorkspace.id,
          createdByRef: "user:creator",
          body,
          sourceRequestId: `req-${suffix}`,
        },
        createdAt,
      );
      await store.adoptCandidate({
        workspaceId: orderWorkspace.id,
        candidateId: created.id,
        actorRef: "user:creator",
        now: new Date(createdAt.getTime() + 1_000),
      });
      return created;
    }
    const olderEphemeral = await adoptAt(`ordering older ${suffix}`, T0);
    const newerVerified = await adoptAt(
      `ordering newer ${suffix}`,
      at(10 * 60_000),
    );
    await store.verifyEphemeral({
      workspaceId: orderWorkspace.id,
      candidateId: newerVerified.id,
      actorRef: "user:knowledge-owner",
      actorIsKnowledgeOwner: true,
      now: at(11 * 60_000),
    });
    const entries = await store.queryRetrievableMemory({
      workspaceId: orderWorkspace.id,
      now: at(12 * 60_000),
    });
    expect(entries.map((entry) => entry.id)).toEqual([
      newerVerified.id,
      olderEphemeral.id,
    ]);
    expect(entries[0]!.provenance.isVerified).toBe(true);
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
