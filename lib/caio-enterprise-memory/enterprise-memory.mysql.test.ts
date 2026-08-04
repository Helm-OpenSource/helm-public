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

  // ------------------------------------------------------------------
  // TTL IS DECIDED BY THE DATABASE AT THE INSTANT OF THE WRITE.
  //
  // `adoptCandidate` and `verifyEphemeral` check the deadline against the
  // APPLICATION clock at read time and then issue an UPDATE. Anything that
  // happens between those two points — read→write latency, a GC pause, a
  // retry, an app host whose clock runs slow — lands inside the window, and
  // the write goes through on a row that is already past its deadline. A
  // concurrency campaign against MySQL 8.4.8 reproduced it at CONCURRENCY 1
  // (32 successes, 7 of them past deadline) and closed it exactly when the
  // margin exceeded read→write latency, which is the signature of a
  // check-then-act bug rather than an interleaving race.
  //
  // It matters most on the verify path: `verified` carries NO FURTHER TTL, so
  // an entry that should have expired becomes PERMANENT — a retention
  // failure in a product whose proposition is bounded retention.
  //
  // The tests below make that window DETERMINISTIC instead of chasing it with
  // timing. The row's deadline is already past by the DATABASE's clock, while
  // the caller passes an `input.now` from before it — exactly what a stale
  // read or a skewed app host produces, with none of the flakiness.
  // The caller's clock, an hour behind the database's. Every read-time TTL
  // check therefore PASSES, which is the precondition for testing what the
  // WRITE does.
  const STALE_CLOCK = new Date(Date.now() - 60 * 60_000);

  async function setDeadlineInThePast(
    candidateId: string,
    column: "candidateExpiresAt" | "ephemeralExpiresAt",
  ): Promise<void> {
    const affected = await db.$executeRawUnsafe(
      `UPDATE \`CaioMemoryCandidate\` SET \`${column}\` = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 5 SECOND) WHERE \`id\` = ?`,
      candidateId,
    );
    // A silent zero here would make every assertion below vacuous.
    expect(affected).toBe(1);
  }

  it("refuses to adopt a candidate the DATABASE considers expired, whatever the caller's clock says", async () => {
    const created = await seedCandidate(`late adopt ${suffix}`);
    await setDeadlineInThePast(created.id, "candidateExpiresAt");

    await expect(
      store.adoptCandidate({
        workspaceId,
        candidateId: created.id,
        actorRef: "user:creator",
        // Well inside the TTL by the caller's reckoning — this is the
        // stale/skewed read. The caller is wrong, and the database is the one
        // holding the row.
        now: STALE_CLOCK,
      }),
    ).rejects.toBeInstanceOf(CaioMemoryError);

    const stored = await db.caioMemoryCandidate.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stored.state).toBe("candidate");
    expect(stored.adoptedAt).toBeNull();
    expect(stored.adoptedByRef).toBeNull();
  });

  it("refuses to verify an ephemeral entry the DATABASE considers expired", async () => {
    const created = await seedCandidate(`late verify ${suffix}`);
    const adopted = await store.adoptCandidate({
      workspaceId,
      candidateId: created.id,
      actorRef: "user:creator",
      now: new Date(),
    });
    expect(adopted.state).toBe("ephemeral");
    await setDeadlineInThePast(created.id, "ephemeralExpiresAt");

    await expect(
      store.verifyEphemeral({
        workspaceId,
        candidateId: created.id,
        actorRef: "user:knowledge-owner",
        actorIsKnowledgeOwner: true,
        now: STALE_CLOCK,
      }),
    ).rejects.toBeInstanceOf(CaioMemoryError);

    const stored = await db.caioMemoryCandidate.findUniqueOrThrow({
      where: { id: created.id },
    });
    // `verified` has no further TTL, so this row would have been permanent.
    expect(stored.state).toBe("ephemeral");
    expect(stored.verifiedAt).toBeNull();
  });

  it("refuses to verify an ephemeral row whose deadline is NULL", async () => {
    const created = await seedCandidate(`null deadline ${suffix}`);
    await store.adoptCandidate({
      workspaceId,
      candidateId: created.id,
      actorRef: "user:creator",
      now: new Date(),
    });
    const affected = await db.$executeRawUnsafe(
      "UPDATE `CaioMemoryCandidate` SET `ephemeralExpiresAt` = NULL WHERE `id` = ?",
      created.id,
    );
    expect(affected).toBe(1);

    // The read-time check already treats a missing deadline as expired; the
    // write must agree, or `NULL > UTC_TIMESTAMP(3)` quietly becoming NULL
    // would reopen the same hole from the other side.
    await expect(
      store.verifyEphemeral({
        workspaceId,
        candidateId: created.id,
        actorRef: "user:knowledge-owner",
        actorIsKnowledgeOwner: true,
        now: T0,
      }),
    ).rejects.toBeInstanceOf(CaioMemoryError);
  });

  it("CONTROL: adopt and verify still succeed inside the deadline", async () => {
    // Without this, every refusal above is satisfied by a store that refuses
    // everything.
    const created = await seedCandidate(`happy path ${suffix}`);
    const adopted = await store.adoptCandidate({
      workspaceId,
      candidateId: created.id,
      actorRef: "user:creator",
      now: new Date(),
    });
    expect(adopted.state).toBe("ephemeral");
    const verified = await store.verifyEphemeral({
      workspaceId,
      candidateId: created.id,
      actorRef: "user:knowledge-owner",
      actorIsKnowledgeOwner: true,
      now: new Date(),
    });
    expect(verified.state).toBe("verified");
  });

  // ------------------------------------------------------------------
  // THE SWEEP'S ERROR CONTRACT, AND WHY THE TWO STATEMENTS ARE ONE UNIT.
  //
  // A point update by primary key (verifyEphemeral) racing this sweep's two
  // workspace-wide index scans DEADLOCKS — measured at 9 deadlocks in 60
  // rounds at 32-way concurrency on a hot single-row workspace. This store
  // used bare `$executeRaw` with no retry helper, unlike the token store, so
  // MySQL 1213 surfaced as a raw Prisma engine error and took a caller down as
  // an unhandled rejection.
  //
  // A deadlock is a lottery, so the test does not run one. It INJECTS the
  // engine error with a trigger, on the SECOND statement only, which pins two
  // things a real deadlock would leave to chance:
  //   - no raw engine error escapes: callers are promised CaioMemoryError;
  //   - the first statement does NOT stay committed. As separate autocommit
  //     writes it did, so a failed sweep could report failure having already
  //     half-run, and the caller could neither trust the count nor assume
  //     nothing happened.
  async function seedExpiredPair(): Promise<{
    candidateId: string;
    ephemeralId: string;
    workspaceId: string;
  }> {
    const sweepWorkspace = await db.workspace.create({
      data: {
        name: `Memory sweep contract ${suffix}-${Math.random()}`,
        slug: `memory-sweep-${suffix}-${Math.floor(Math.random() * 1e9)}`,
      },
    });
    const stale = await store.createCandidate(
      {
        workspaceId: sweepWorkspace.id,
        createdByRef: "user:creator",
        body: `sweep candidate ${suffix}`,
        sourceRequestId: `req-${suffix}`,
      },
      T0,
    );
    const adoptable = await store.createCandidate(
      {
        workspaceId: sweepWorkspace.id,
        createdByRef: "user:creator",
        body: `sweep ephemeral ${suffix}`,
        sourceRequestId: `req-${suffix}`,
      },
      T0,
    );
    await store.adoptCandidate({
      workspaceId: sweepWorkspace.id,
      candidateId: adoptable.id,
      actorRef: "user:creator",
      now: new Date(),
    });
    await setDeadlineInThePast(stale.id, "candidateExpiresAt");
    await setDeadlineInThePast(adoptable.id, "ephemeralExpiresAt");
    return {
      candidateId: stale.id,
      ephemeralId: adoptable.id,
      workspaceId: sweepWorkspace.id,
    };
  }

  it("CONTROL: the sweep expires BOTH rows when nothing goes wrong", async () => {
    const seeded = await seedExpiredPair();
    const count = await store.expireCandidates({
      workspaceId: seeded.workspaceId,
      now: new Date(),
    });
    // Non-zero on purpose: the injected-failure test below asserts the first
    // row survives, which a sweep that never touches anything also satisfies.
    expect(count).toBe(2);
    for (const id of [seeded.candidateId, seeded.ephemeralId]) {
      const row = await db.caioMemoryCandidate.findUniqueOrThrow({ where: { id } });
      expect(row.state).toBe("expired");
      expect(row.body).toBeNull();
    }
  });

  it("reports a CaioMemoryError and rolls the whole sweep back when the engine fails mid-way", async () => {
    const seeded = await seedExpiredPair();
    // The engine failure is injected on the SECOND statement only. A CHECK
    // constraint scoped to this one row's contentHash is used rather than a
    // trigger, because `CREATE TRIGGER` is not available over Prisma's
    // prepared-statement protocol (MySQL 1295) — the mechanism differs from a
    // real deadlock, the SHAPE the store must handle does not: a mid-sweep
    // engine error after the first statement has already written.
    const boomHash = `boom-${suffix}`;
    await db.$executeRawUnsafe(
      "UPDATE `CaioMemoryCandidate` SET `contentHash` = ? WHERE `id` = ?",
      boomHash,
      seeded.ephemeralId,
    );
    await db.$executeRawUnsafe(
      "ALTER TABLE `CaioMemoryCandidate` ADD CONSTRAINT `caio_mem_sweep_boom` " +
        `CHECK (NOT (\`state\` = 'expired' AND \`contentHash\` = '${boomHash}'))`,
    );
    try {
      const failure = await store
        .expireCandidates({ workspaceId: seeded.workspaceId, now: new Date() })
        .then(
          () => null,
          (error: unknown) => error,
        );
      // Not a raw PrismaClientKnownRequestError.
      expect(failure).toBeInstanceOf(CaioMemoryError);
      expect((failure as CaioMemoryError).code).toBe("conflict");

      // The first statement must not have survived the failure of the second.
      const candidateRow = await db.caioMemoryCandidate.findUniqueOrThrow({
        where: { id: seeded.candidateId },
      });
      expect(candidateRow.state).toBe("candidate");
      expect(candidateRow.body).not.toBeNull();
    } finally {
      await db.$executeRawUnsafe(
        "ALTER TABLE `CaioMemoryCandidate` DROP CONSTRAINT `caio_mem_sweep_boom`",
      );
    }
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
