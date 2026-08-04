import { describe, expect, it } from "vitest";

import {
  createInMemoryCaioMemoryStore,
  type CaioMemoryCandidateStore,
} from "@/lib/caio-enterprise-memory/candidate-store.service";
import {
  CANDIDATE_TTL_MS,
  EPHEMERAL_TTL_MS,
} from "@/lib/caio-enterprise-memory/memory-contracts";
import { sha256 } from "@/lib/expert-capability/hashing";

const T0 = new Date("2026-07-29T10:00:00.000Z");
const BODY = "Adopted playbook step: confirm invoice terms before renewal.";

function at(offsetMs: number): Date {
  return new Date(T0.getTime() + offsetMs);
}

async function seedCandidate(
  store: CaioMemoryCandidateStore,
  overrides: {
    createdByRef?: string;
    projectRef?: string;
    body?: string;
  } = {},
) {
  return store.createCandidate(
    {
      workspaceId: "ws-1",
      createdByRef: overrides.createdByRef ?? "user:creator",
      body: overrides.body ?? BODY,
      ...(overrides.projectRef ? { projectRef: overrides.projectRef } : {}),
      sourceRequestId: "req-1",
    },
    T0,
  );
}

describe("createCandidate", () => {
  it("creates state candidate with a 7 day TTL and a body hash", async () => {
    const store = createInMemoryCaioMemoryStore();
    const created = await seedCandidate(store);
    expect(created.state).toBe("candidate");
    expect(created.contentHash).toBe(sha256(BODY));
    expect(created.candidateExpiresAt).toBe(
      at(CANDIDATE_TTL_MS).toISOString(),
    );
    expect(created.adoptedAt).toBeNull();
    expect(created.ephemeralExpiresAt).toBeNull();
  });

  it("keeps the receipt secret-free (hash and refs, never the body)", async () => {
    const store = createInMemoryCaioMemoryStore();
    const secretBody = "internal-price-floor-discussion body text";
    const created = await seedCandidate(store, { body: secretBody });
    expect(created.receiptJson).not.toContain(secretBody);
    expect(created.receiptJson).toContain(created.contentHash);
  });

  it("refuses creation in any state other than candidate", async () => {
    const store = createInMemoryCaioMemoryStore();
    await expect(
      store.createCandidate(
        {
          workspaceId: "ws-1",
          createdByRef: "user:creator",
          body: BODY,
          state: "verified",
        } as never,
        T0,
      ),
    ).rejects.toThrow();
  });
});

describe("retrieval exclusion at the store layer", () => {
  it("keeps a candidate invisible through every query path, even by id", async () => {
    const store = createInMemoryCaioMemoryStore();
    const created = await seedCandidate(store);

    expect(
      await store.queryRetrievableMemory({ workspaceId: "ws-1", now: T0 }),
    ).toEqual([]);
    expect(
      await store.queryRetrievableMemory({
        workspaceId: "ws-1",
        id: created.id,
        now: T0,
      }),
    ).toEqual([]);
    expect(
      await store.queryRetrievableMemory({
        workspaceId: "ws-1",
        id: created.id,
        projectRef: "proj-a",
        now: T0,
      }),
    ).toEqual([]);
  });

  it("excludes rejected and expired entries from retrieval too", async () => {
    const store = createInMemoryCaioMemoryStore();
    const rejected = await seedCandidate(store);
    await store.rejectCandidate({
      workspaceId: "ws-1",
      candidateId: rejected.id,
      actorRef: "user:creator",
      now: at(1_000),
    });
    const expired = await seedCandidate(store, { body: `${BODY} v2` });
    await store.expireCandidates({
      workspaceId: "ws-1",
      now: at(CANDIDATE_TTL_MS + 1),
    });
    for (const id of [rejected.id, expired.id]) {
      expect(
        await store.queryRetrievableMemory({
          workspaceId: "ws-1",
          id,
          now: at(CANDIDATE_TTL_MS + 2),
        }),
      ).toEqual([]);
    }
  });

  it("lists own candidates only for their creator", async () => {
    const store = createInMemoryCaioMemoryStore();
    await seedCandidate(store);
    await seedCandidate(store, {
      createdByRef: "user:other",
      body: `${BODY} other`,
    });
    const own = await store.listOwnCandidates({
      workspaceId: "ws-1",
      userRef: "user:creator",
    });
    expect(own).toHaveLength(1);
    expect(own[0]!.createdByRef).toBe("user:creator");
    expect(
      await store.listOwnCandidates({
        workspaceId: "ws-1",
        userRef: "user:stranger",
      }),
    ).toEqual([]);
  });
});

describe("adoptCandidate", () => {
  it("only the creator may adopt", async () => {
    const store = createInMemoryCaioMemoryStore();
    const created = await seedCandidate(store);
    await expect(
      store.adoptCandidate({
        workspaceId: "ws-1",
        candidateId: created.id,
        actorRef: "user:other",
        now: at(1_000),
      }),
    ).rejects.toMatchObject({ name: "CaioMemoryError", code: "forbidden" });
  });

  // F7 regression: the previous behaviour ("adopts into workspace scope
  // without a targetProjectRef") silently WIDENED a project-scoped candidate
  // to workspace-wide visibility. Adoption must preserve the creation-time
  // scope instead.
  it("preserves the creation-time projectRef when no targetProjectRef is given", async () => {
    const store = createInMemoryCaioMemoryStore();
    const created = await seedCandidate(store, { projectRef: "proj-a" });
    const adopted = await store.adoptCandidate({
      workspaceId: "ws-1",
      candidateId: created.id,
      actorRef: "user:creator",
      now: at(1_000),
    });
    expect(adopted.state).toBe("ephemeral");
    expect(adopted.projectRef).toBe("proj-a");
    expect(adopted.adoptedByRef).toBe("user:creator");
    expect(adopted.ephemeralExpiresAt).toBe(
      at(1_000 + EPHEMERAL_TTL_MS).toISOString(),
    );
    // Still invisible from another project.
    expect(
      await store.queryRetrievableMemory({
        workspaceId: "ws-1",
        projectRef: "proj-z",
        now: at(2_000),
      }),
    ).toEqual([]);
  });

  it("keeps a workspace-scoped candidate workspace-scoped", async () => {
    const store = createInMemoryCaioMemoryStore();
    const created = await seedCandidate(store);
    const adopted = await store.adoptCandidate({
      workspaceId: "ws-1",
      candidateId: created.id,
      actorRef: "user:creator",
      now: at(1_000),
    });
    expect(adopted.projectRef).toBeNull();
  });

  it("widens to workspace scope only with an explicit promoteToWorkspaceScope opt-in", async () => {
    const store = createInMemoryCaioMemoryStore();
    const created = await seedCandidate(store, { projectRef: "proj-a" });
    const adopted = await store.adoptCandidate({
      workspaceId: "ws-1",
      candidateId: created.id,
      actorRef: "user:creator",
      promoteToWorkspaceScope: true,
      now: at(1_000),
    });
    expect(adopted.projectRef).toBeNull();
  });

  it("rejects a conflicting targetProjectRef + promoteToWorkspaceScope", async () => {
    const store = createInMemoryCaioMemoryStore();
    const created = await seedCandidate(store, { projectRef: "proj-a" });
    await expect(
      store.adoptCandidate({
        workspaceId: "ws-1",
        candidateId: created.id,
        actorRef: "user:creator",
        targetProjectRef: "proj-b",
        promoteToWorkspaceScope: true,
        now: at(1_000),
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("lands in a project only with an explicit targetProjectRef", async () => {
    const store = createInMemoryCaioMemoryStore();
    const created = await seedCandidate(store, { projectRef: "proj-a" });
    const adopted = await store.adoptCandidate({
      workspaceId: "ws-1",
      candidateId: created.id,
      actorRef: "user:creator",
      targetProjectRef: "proj-b",
      now: at(1_000),
    });
    expect(adopted.projectRef).toBe("proj-b");
  });

  it("refuses adoption past the candidate TTL", async () => {
    const store = createInMemoryCaioMemoryStore();
    const created = await seedCandidate(store);
    await expect(
      store.adoptCandidate({
        workspaceId: "ws-1",
        candidateId: created.id,
        actorRef: "user:creator",
        now: at(CANDIDATE_TTL_MS),
      }),
    ).rejects.toMatchObject({ code: "expired" });
  });

  it("lets exactly one of two concurrent adopts win", async () => {
    const store = createInMemoryCaioMemoryStore();
    const created = await seedCandidate(store);
    const attempts = await Promise.allSettled([
      store.adoptCandidate({
        workspaceId: "ws-1",
        candidateId: created.id,
        actorRef: "user:creator",
        now: at(1_000),
      }),
      store.adoptCandidate({
        workspaceId: "ws-1",
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
  });

  it("makes adopted content retrievable with unverified provenance", async () => {
    const store = createInMemoryCaioMemoryStore();
    const created = await seedCandidate(store);
    await store.adoptCandidate({
      workspaceId: "ws-1",
      candidateId: created.id,
      actorRef: "user:creator",
      now: at(1_000),
    });
    const entries = await store.queryRetrievableMemory({
      workspaceId: "ws-1",
      now: at(2_000),
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.provenance.state).toBe("ephemeral");
    expect(entries[0]!.provenance.isVerified).toBe(false);
    expect(entries[0]!.body).toBe(BODY);
  });
});

describe("rejectCandidate and TTL sweep", () => {
  it("reject deletes the body irrecoverably but preserves the hash and receipt", async () => {
    const store = createInMemoryCaioMemoryStore();
    const created = await seedCandidate(store);
    const rejected = await store.rejectCandidate({
      workspaceId: "ws-1",
      candidateId: created.id,
      actorRef: "user:creator",
      now: at(1_000),
    });
    expect(rejected.state).toBe("rejected");
    expect(rejected.body).toBeNull();
    expect(rejected.contentHash).toBe(sha256(BODY));
    expect(rejected.receiptJson).not.toContain(BODY);
    expect(JSON.stringify(rejected)).not.toContain(BODY);
  });

  it("only the creator may reject", async () => {
    const store = createInMemoryCaioMemoryStore();
    const created = await seedCandidate(store);
    await expect(
      store.rejectCandidate({
        workspaceId: "ws-1",
        candidateId: created.id,
        actorRef: "user:other",
        now: at(1_000),
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejection wins over later processing attempts", async () => {
    const store = createInMemoryCaioMemoryStore();
    const created = await seedCandidate(store);
    await store.rejectCandidate({
      workspaceId: "ws-1",
      candidateId: created.id,
      actorRef: "user:creator",
      now: at(1_000),
    });
    await expect(
      store.adoptCandidate({
        workspaceId: "ws-1",
        candidateId: created.id,
        actorRef: "user:creator",
        now: at(2_000),
      }),
    ).rejects.toMatchObject({ code: "illegal_transition" });
  });

  it("expires candidates past 7 days and ephemerals past 90 days, deleting bodies", async () => {
    const store = createInMemoryCaioMemoryStore();
    const staleCandidate = await seedCandidate(store);
    const adopted = await seedCandidate(store, { body: `${BODY} adopted` });
    await store.adoptCandidate({
      workspaceId: "ws-1",
      candidateId: adopted.id,
      actorRef: "user:creator",
      now: at(1_000),
    });

    expect(
      await store.expireCandidates({
        workspaceId: "ws-1",
        now: at(CANDIDATE_TTL_MS + 1),
      }),
    ).toBe(1);
    expect(
      await store.expireCandidates({
        workspaceId: "ws-1",
        now: at(1_000 + EPHEMERAL_TTL_MS + 1),
      }),
    ).toBe(1);

    for (const id of [staleCandidate.id, adopted.id]) {
      expect(
        await store.queryRetrievableMemory({
          workspaceId: "ws-1",
          id,
          now: at(1_000 + EPHEMERAL_TTL_MS + 2),
        }),
      ).toEqual([]);
    }
  });
});

describe("verifyEphemeral", () => {
  async function adoptedEntry(store: CaioMemoryCandidateStore) {
    const created = await seedCandidate(store);
    await store.adoptCandidate({
      workspaceId: "ws-1",
      candidateId: created.id,
      actorRef: "user:creator",
      now: at(1_000),
    });
    return created;
  }

  it("requires the knowledge-owner flag", async () => {
    const store = createInMemoryCaioMemoryStore();
    const created = await adoptedEntry(store);
    await expect(
      store.verifyEphemeral({
        workspaceId: "ws-1",
        candidateId: created.id,
        actorRef: "user:creator",
        actorIsKnowledgeOwner: false,
        now: at(2_000),
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("verifies an ephemeral entry and flips retrieval provenance", async () => {
    const store = createInMemoryCaioMemoryStore();
    const created = await adoptedEntry(store);
    const verified = await store.verifyEphemeral({
      workspaceId: "ws-1",
      candidateId: created.id,
      actorRef: "user:knowledge-owner",
      actorIsKnowledgeOwner: true,
      now: at(2_000),
    });
    expect(verified.state).toBe("verified");
    expect(verified.verifiedByRef).toBe("user:knowledge-owner");
    const entries = await store.queryRetrievableMemory({
      workspaceId: "ws-1",
      now: at(3_000),
    });
    expect(entries[0]!.provenance.isVerified).toBe(true);
    expect(entries[0]!.provenance.state).toBe("verified");
  });

  // F8 regression: "ephemeral cannot override verified" needs an actual
  // deterministic order in the retrieval result, not just a provenance flag.
  describe("retrieval precedence", () => {
    async function adoptAt(
      store: CaioMemoryCandidateStore,
      body: string,
      createdAt: Date,
    ) {
      const created = await store.createCandidate(
        {
          workspaceId: "ws-1",
          createdByRef: "user:creator",
          body,
          sourceRequestId: "req-1",
        },
        createdAt,
      );
      await store.adoptCandidate({
        workspaceId: "ws-1",
        candidateId: created.id,
        actorRef: "user:creator",
        now: new Date(createdAt.getTime() + 1),
      });
      return created;
    }

    it("orders a newer verified entry before an older ephemeral one", async () => {
      const store = createInMemoryCaioMemoryStore();
      const olderEphemeral = await adoptAt(store, `${BODY} older`, T0);
      const newerVerified = await adoptAt(
        store,
        `${BODY} newer`,
        at(10 * 60_000),
      );
      await store.verifyEphemeral({
        workspaceId: "ws-1",
        candidateId: newerVerified.id,
        actorRef: "user:knowledge-owner",
        actorIsKnowledgeOwner: true,
        now: at(11 * 60_000),
      });
      const entries = await store.queryRetrievableMemory({
        workspaceId: "ws-1",
        now: at(12 * 60_000),
      });
      expect(entries.map((entry) => entry.id)).toEqual([
        newerVerified.id,
        olderEphemeral.id,
      ]);
      expect(entries[0]!.provenance.isVerified).toBe(true);
    });

    it("keeps an older verified entry ahead of a newer ephemeral one", async () => {
      const store = createInMemoryCaioMemoryStore();
      const olderVerified = await adoptAt(store, `${BODY} v-old`, T0);
      await store.verifyEphemeral({
        workspaceId: "ws-1",
        candidateId: olderVerified.id,
        actorRef: "user:knowledge-owner",
        actorIsKnowledgeOwner: true,
        now: at(60_000),
      });
      const newerEphemeral = await adoptAt(
        store,
        `${BODY} e-new`,
        at(10 * 60_000),
      );
      const entries = await store.queryRetrievableMemory({
        workspaceId: "ws-1",
        now: at(12 * 60_000),
      });
      expect(entries.map((entry) => entry.id)).toEqual([
        olderVerified.id,
        newerEphemeral.id,
      ]);
    });

    it("orders newest first inside the same provenance class", async () => {
      const store = createInMemoryCaioMemoryStore();
      const older = await adoptAt(store, `${BODY} e1`, T0);
      const newer = await adoptAt(store, `${BODY} e2`, at(5 * 60_000));
      const entries = await store.queryRetrievableMemory({
        workspaceId: "ws-1",
        now: at(6 * 60_000),
      });
      expect(entries.map((entry) => entry.id)).toEqual([newer.id, older.id]);
    });
  });

  it("cannot verify a raw candidate (illegal transition)", async () => {
    const store = createInMemoryCaioMemoryStore();
    const created = await seedCandidate(store);
    await expect(
      store.verifyEphemeral({
        workspaceId: "ws-1",
        candidateId: created.id,
        actorRef: "user:knowledge-owner",
        actorIsKnowledgeOwner: true,
        now: at(2_000),
      }),
    ).rejects.toMatchObject({ code: "illegal_transition" });
  });
});
