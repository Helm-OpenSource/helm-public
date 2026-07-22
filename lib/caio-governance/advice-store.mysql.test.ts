import { MembershipStatus, type Prisma, WorkspaceRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  CaioAdviceStoreError,
  decideCaioAdvice,
  getCaioAdviceLedger,
  proposeCaioAdvice,
  withdrawCaioAdvice,
} from "./advice-store.service";
import {
  activateCaioMandate,
  createCaioMandateDraft,
  recordCaioGuardianStop,
  registerCaioPrincipalBinding,
  resumeCaioGuardianStop,
  revokeCaioPrincipalBinding,
} from "./mandate-store.service";

const integrationDatabaseUrl = process.env.CAIO_MANDATE_STORE_DATABASE_URL;
const describeMysql = integrationDatabaseUrl
  ? describe.sequential
  : describe.skip;
const suffix = `advice-${process.pid}-${Date.now()}`;

const CEO_REF = "ceo-principal-1";
const GUARDIAN_REF = "guardian-principal-1";

function instant(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

// Deterministic barrier: resolves once at least `minCount` OTHER
// connections have been blocked for >= 1s executing a FOR UPDATE on the
// given table. PROCESSLIST is the only real-time source on this MariaDB:
// information_schema.INNODB_LOCK_WAITS exists but is deprecated and
// PERMANENTLY EMPTY since MariaDB 11, so blocking-connection joins are
// unavailable. Precision comes from (a) the table filter, (b) the
// sustained TIME >= 1 requirement — a granted statement finishes in
// milliseconds, and no other suite HOLDS a row lock across an await gap
// the way holdRowLock does — and (c) the caller asserting its blocked
// promise is still pending at the barrier. Prisma issues prepared
// statements, hence COMMAND 'Execute'.
async function waitForBlockedRowLock(
  tableName: "CaioMandateRecord" | "CaioAdviceRecord",
  minCount: number,
): Promise<void> {
  const pattern = `%FROM ${tableName}%FOR UPDATE%`;
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const rows = await db.$queryRaw<Array<{ n: bigint | number }>>`
      SELECT COUNT(*) AS n FROM information_schema.PROCESSLIST
      WHERE COMMAND IN ('Query', 'Execute')
        AND INFO LIKE ${pattern}
        AND TIME >= 1
        AND ID <> CONNECTION_ID()`;
    if (Number(rows[0]?.n ?? 0) >= minCount) return;
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 25));
  }
  throw new Error(
    `timed out waiting for ${minCount} blocked FOR UPDATE on ${tableName}`,
  );
}

// True iff the promise has already settled (used to prove the call under
// test is still in flight when the barrier passes). A race against
// Promise.resolve() cannot detect this — an already-settled promise's
// reaction still needs its own microtask turn — so we set an explicit
// flag and drain several microtask turns before reading it.
async function hasSettled(promise: Promise<unknown>): Promise<boolean> {
  let settled = false;
  void promise.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
  return settled;
}

describe("hasSettled (pure promise-state probe)", () => {
  it("reports true for fulfilled, true for rejected, false for pending", async () => {
    expect(await hasSettled(Promise.resolve(42))).toBe(true);
    const rejected = Promise.reject(new Error("already failed"));
    rejected.catch(() => {});
    expect(await hasSettled(rejected)).toBe(true);
    let resolvePending: (value: unknown) => void = () => {};
    const pending = new Promise((resolvePromise) => {
      resolvePending = resolvePromise;
    });
    expect(await hasSettled(pending)).toBe(false);
    resolvePending(null);
    expect(await hasSettled(pending)).toBe(true);
  });
});

// A transaction that provably HOLDS a FOR UPDATE lock until released:
// `acquired` resolves only after the locking read has been granted.
function holdRowLock(
  lockingRead: (tx: Prisma.TransactionClient) => Promise<unknown>,
) {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolveGate) => {
    release = resolveGate;
  });
  let acquiredResolve: () => void = () => {};
  const acquired = new Promise<void>((resolveAcquired) => {
    acquiredResolve = resolveAcquired;
  });
  const done = db.$transaction(
    async (tx) => {
      await lockingRead(tx);
      acquiredResolve();
      await gate;
    },
    { timeout: 30_000 },
  );
  return { acquired, release, done };
}

function mandateDraftInput(
  workspaceId: string,
  actorUserId: string,
  stage: "observe" | "advise",
) {
  const now = Date.now();
  return {
    workspaceId,
    actorUserId,
    caioRef: "caio:helm-self",
    ceoRef: CEO_REF,
    stage,
    stageDecisionRef: "stage-decision:2026-07-22",
    objectiveRefs: ["objective:collections-flywheel"],
    scopeRefs: ["scope:advise-readouts"],
    grantBasisRefs: [`caio-mandate-grant:${CEO_REF}:issuance-${suffix}`],
    reservedMatterRefs: ["reserved:legal"],
    humanResponsePolicyRef: "policy:human-response-v1",
    accountabilityAnchorRefs: ["anchor:ceo"],
    guardianStopRefs: [GUARDIAN_REF],
    validFrom: instant(now - 60_000),
    validUntil: instant(now + 86_400_000),
    inFlightDisposition: "freeze" as const,
    auditRefs: [`audit:test-${suffix}`],
  };
}

let adviceCounter = 0;
function proposalInput(workspaceId: string, mandateRecordId: string) {
  adviceCounter += 1;
  return {
    workspaceId,
    mandateRecordId,
    adviceKey: `advice-${suffix}-${adviceCounter}`,
    subjectRef: "subject:churn-risk-q3",
    title: "Reduce churn in the Q3 cohort",
    recommendation: "Prioritize win-back outreach for the top decile.",
    observationRefs: ["observation:churn-2026-07"],
    validUntil: instant(Date.now() + 3_600_000),
    actorName: "caio:helm-self",
  };
}

describeMysql("CAIO advice store with an isolated MySQL database", () => {
  let workspaceId = "";
  let ownerUserId = "";
  let adminUserId = "";
  let activeMandateId = "";

  beforeAll(async () => {
    if (process.env.DATABASE_URL !== integrationDatabaseUrl) {
      throw new Error(
        "DATABASE_URL must equal CAIO_MANDATE_STORE_DATABASE_URL for the isolated integration test.",
      );
    }
    const workspace = await db.workspace.create({
      data: {
        name: `CAIO advice integration ${suffix}`,
        slug: `caio-advice-integration-${suffix}`,
      },
    });
    workspaceId = workspace.id;
    const owner = await db.user.create({
      data: {
        email: `caio-advice-owner-${suffix}@example.com`,
        name: "CAIO advice owner",
      },
    });
    ownerUserId = owner.id;
    await db.membership.create({
      data: {
        workspaceId,
        userId: ownerUserId,
        role: WorkspaceRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });
    // A capable ADMIN without any principal binding: capability access
    // alone must never be enough to decide advice.
    const admin = await db.user.create({
      data: {
        email: `caio-advice-admin-${suffix}@example.com`,
        name: "CAIO advice admin",
      },
    });
    adminUserId = admin.id;
    await db.membership.create({
      data: {
        workspaceId,
        userId: adminUserId,
        role: WorkspaceRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });
    await registerCaioPrincipalBinding({
      workspaceId,
      actorUserId: ownerUserId,
      userId: ownerUserId,
      principalRef: CEO_REF,
      principalKind: "ceo",
      evidenceRef: `binding-evidence-ceo-${suffix}`,
    });
    await registerCaioPrincipalBinding({
      workspaceId,
      actorUserId: ownerUserId,
      userId: ownerUserId,
      principalRef: GUARDIAN_REF,
      principalKind: "guardian",
      evidenceRef: `binding-evidence-guardian-${suffix}`,
    });
    const draft = await createCaioMandateDraft(
      mandateDraftInput(workspaceId, ownerUserId, "advise"),
    );
    const active = await activateCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: draft.mandateId,
    });
    activeMandateId = active.mandateId;
  });

  afterAll(async () => {
    if (workspaceId) {
      await db.workspace.delete({ where: { id: workspaceId } });
    }
    await db.$disconnect();
  });

  it("refuses advice under a non-active mandate", async () => {
    const draft = await createCaioMandateDraft(
      mandateDraftInput(workspaceId, ownerUserId, "advise"),
    );
    await expect(
      proposeCaioAdvice(proposalInput(workspaceId, draft.mandateId)),
    ).rejects.toThrow(/draft, not active/u);
  });

  it("refuses advice under an active observe-stage mandate (no stage implies advise)", async () => {
    // A separate workspace: the advise workspace's active-claim slot is
    // already taken, and stage refusal must be judged on an ACTIVE mandate.
    const workspace = await db.workspace.create({
      data: {
        name: `CAIO advice observe ${suffix}`,
        slug: `caio-advice-observe-${suffix}`,
      },
    });
    try {
      await db.membership.create({
        data: {
          workspaceId: workspace.id,
          userId: ownerUserId,
          role: WorkspaceRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      });
      await registerCaioPrincipalBinding({
        workspaceId: workspace.id,
        actorUserId: ownerUserId,
        userId: ownerUserId,
        principalRef: CEO_REF,
        principalKind: "ceo",
        evidenceRef: `binding-evidence-ceo-observe-${suffix}`,
      });
      const draft = await createCaioMandateDraft(
        mandateDraftInput(workspace.id, ownerUserId, "observe"),
      );
      const active = await activateCaioMandate({
        workspaceId: workspace.id,
        actorUserId: ownerUserId,
        actorCeoRef: CEO_REF,
        mandateRecordId: draft.mandateId,
      });
      await expect(
        proposeCaioAdvice(proposalInput(workspace.id, active.mandateId)),
      ).rejects.toThrow(/stage "observe", not "advise"/u);
    } finally {
      await db.workspace.delete({ where: { id: workspace.id } });
    }
  });

  it("closes the loop: propose -> CEO decision -> receipt projection, audited exactly once", async () => {
    const advice = await proposeCaioAdvice(
      proposalInput(workspaceId, activeMandateId),
    );
    expect(advice.status).toBe("proposed");
    expect(advice.authorityEffect).toBe("none");
    expect(advice.executionRef).toBeNull();

    const result = await decideCaioAdvice({
      workspaceId,
      adviceRecordId: advice.adviceId,
      outcome: "accepted",
      reason: "Aligned with the retention objective.",
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
    });
    expect(result.kind).toBe("decided");
    if (result.kind !== "decided") throw new Error("unreachable");
    expect(result.advice.status).toBe("accepted");
    expect(result.projection.state).toBe("decided");
    if (result.projection.state !== "decided") throw new Error("unreachable");
    expect(result.projection.receipt.outcome).toBe("accepted");
    expect(result.projection.receipt.decidedByRef).toBe(CEO_REF);
    expect(result.projection.receipt.authorityEffect).toBe("none");

    const audits = await db.auditLog.findMany({
      where: {
        workspaceId,
        targetType: "CaioAdviceRecord",
        targetId: advice.adviceId,
      },
      orderBy: { createdAt: "asc" },
    });
    const proposed = audits.filter(
      (row) => row.actionType === "CAIO_ADVICE_PROPOSED",
    );
    const decided = audits.filter(
      (row) => row.actionType === "CAIO_ADVICE_DECIDED",
    );
    expect(proposed).toHaveLength(1);
    expect(decided).toHaveLength(1);
    // userId is the authenticated operator; actor is the principal ref
    expect(decided[0]?.userId).toBe(ownerUserId);
    expect(decided[0]?.actor).toBe(CEO_REF);
  });

  it("is idempotent on adviceKey for identical content and refuses divergent content", async () => {
    const input = proposalInput(workspaceId, activeMandateId);
    const first = await proposeCaioAdvice(input);
    const retried = await proposeCaioAdvice(input);
    expect(retried.adviceId).toBe(first.adviceId);

    await expect(
      proposeCaioAdvice({
        ...input,
        recommendation: "A different recommendation entirely.",
      }),
    ).rejects.toThrow(/idempotency conflict/u);
  });

  it("refuses decisions from anyone but the bound CEO", async () => {
    const advice = await proposeCaioAdvice(
      proposalInput(workspaceId, activeMandateId),
    );
    // A capable ADMIN claiming a non-CEO ref: identity mismatch.
    await expect(
      decideCaioAdvice({
        workspaceId,
        adviceRecordId: advice.adviceId,
        outcome: "accepted",
        reason: "should fail",
        actorUserId: adminUserId,
        actorCeoRef: "cfo-principal-1",
      }),
    ).rejects.toThrow(/only the mandate's CEO/u);
    // The same ADMIN claiming the CEO ref without a live binding.
    await expect(
      decideCaioAdvice({
        workspaceId,
        adviceRecordId: advice.adviceId,
        outcome: "accepted",
        reason: "should fail",
        actorUserId: adminUserId,
        actorCeoRef: CEO_REF,
      }),
    ).rejects.toThrow(/no live ceo principal binding/u);
    // An empty actor identity fails closed before any gate.
    await expect(
      decideCaioAdvice({
        workspaceId,
        adviceRecordId: advice.adviceId,
        outcome: "accepted",
        reason: "should fail",
        actorUserId: "",
        actorCeoRef: CEO_REF,
      }),
    ).rejects.toThrow(/empty actor identities fail closed/u);
  });

  it("treats repeated same-outcome decisions as idempotent and refuses relabeling", async () => {
    const advice = await proposeCaioAdvice(
      proposalInput(workspaceId, activeMandateId),
    );
    await decideCaioAdvice({
      workspaceId,
      adviceRecordId: advice.adviceId,
      outcome: "deferred",
      reason: "Revisit after the Q3 close.",
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
    });
    const repeat = await decideCaioAdvice({
      workspaceId,
      adviceRecordId: advice.adviceId,
      outcome: "deferred",
      reason: "Revisit after the Q3 close.",
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
    });
    expect(repeat.kind).toBe("idempotent");
    await expect(
      decideCaioAdvice({
        workspaceId,
        adviceRecordId: advice.adviceId,
        outcome: "accepted",
        reason: "changed my mind",
        actorUserId: ownerUserId,
        actorCeoRef: CEO_REF,
      }),
    ).rejects.toThrow(/cannot become accepted/u);
  });

  it("freezes the loop while a guardian stop is in force and thaws only after CEO resume + reactivation", async () => {
    const before = await proposeCaioAdvice(
      proposalInput(workspaceId, activeMandateId),
    );
    const { stop } = await recordCaioGuardianStop({
      workspaceId,
      actorUserId: ownerUserId,
      guardianRef: GUARDIAN_REF,
      mandateRecordId: activeMandateId,
      reason: "advice loop freeze check",
      auditRefs: ["audit:freeze"],
    });
    await expect(
      proposeCaioAdvice(proposalInput(workspaceId, activeMandateId)),
    ).rejects.toThrow(/not active|emergency stops/u);
    await expect(
      decideCaioAdvice({
        workspaceId,
        adviceRecordId: before.adviceId,
        outcome: "accepted",
        reason: "should be frozen",
        actorUserId: ownerUserId,
        actorCeoRef: CEO_REF,
      }),
    ).rejects.toThrow(/not active|emergency stops/u);
    // Resume never reactivates by itself: the CEO resumes the stop, then
    // explicitly re-activates the mandate.
    await resumeCaioGuardianStop({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      stopRecordId: stop.stopId,
    });
    await activateCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: activeMandateId,
    });
    const after = await decideCaioAdvice({
      workspaceId,
      adviceRecordId: before.adviceId,
      outcome: "rejected",
      reason: "Superseded by the freeze-period review.",
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
    });
    expect(after.kind).toBe("decided");
  });

  it("persists natural expiry when a decision arrives too late", async () => {
    const input = {
      ...proposalInput(workspaceId, activeMandateId),
      validUntil: instant(Date.now() + 1_200),
    };
    const advice = await proposeCaioAdvice(input);
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 1_400));
    const result = await decideCaioAdvice({
      workspaceId,
      adviceRecordId: advice.adviceId,
      outcome: "accepted",
      reason: "too late",
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
    });
    expect(result.kind).toBe("expired");
    expect(result.advice.status).toBe("expired");
    const audits = await db.auditLog.findMany({
      where: {
        workspaceId,
        targetType: "CaioAdviceRecord",
        targetId: advice.adviceId,
        actionType: "CAIO_ADVICE_EXPIRED",
      },
    });
    expect(audits).toHaveLength(1);
  });

  it("lets the proposer withdraw a proposed advice, after which no decision is possible", async () => {
    const advice = await proposeCaioAdvice(
      proposalInput(workspaceId, activeMandateId),
    );
    const withdrawn = await withdrawCaioAdvice({
      workspaceId,
      adviceRecordId: advice.adviceId,
      actorName: "caio:helm-self",
    });
    expect(withdrawn.status).toBe("withdrawn");
    // idempotent withdraw
    const again = await withdrawCaioAdvice({
      workspaceId,
      adviceRecordId: advice.adviceId,
      actorName: "caio:helm-self",
    });
    expect(again.status).toBe("withdrawn");
    await expect(
      decideCaioAdvice({
        workspaceId,
        adviceRecordId: advice.adviceId,
        outcome: "accepted",
        reason: "should fail",
        actorUserId: ownerUserId,
        actorCeoRef: CEO_REF,
      }),
    ).rejects.toThrow(/withdrawn advice cannot become accepted/u);
  });

  it("serializes concurrent conflicting decisions: exactly one wins", async () => {
    const advice = await proposeCaioAdvice(
      proposalInput(workspaceId, activeMandateId),
    );
    const [a, b] = await Promise.allSettled([
      decideCaioAdvice({
        workspaceId,
        adviceRecordId: advice.adviceId,
        outcome: "accepted",
        reason: "concurrent accept",
        actorUserId: ownerUserId,
        actorCeoRef: CEO_REF,
      }),
      decideCaioAdvice({
        workspaceId,
        adviceRecordId: advice.adviceId,
        outcome: "rejected",
        reason: "concurrent reject",
        actorUserId: ownerUserId,
        actorCeoRef: CEO_REF,
      }),
    ]);
    const fulfilled = [a, b].filter((r) => r.status === "fulfilled");
    const rejected = [a, b].filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const row = await db.caioAdviceRecord.findUniqueOrThrow({
      where: { id: advice.adviceId },
    });
    expect(["accepted", "rejected"]).toContain(row.status);
    expect(row.decisionOutcome).toBe(row.status);
    const decidedAudits = await db.auditLog.findMany({
      where: {
        workspaceId,
        targetType: "CaioAdviceRecord",
        targetId: advice.adviceId,
        actionType: "CAIO_ADVICE_DECIDED",
      },
    });
    expect(decidedAudits).toHaveLength(1);
  });

  it("scopes advice per workspace: a foreign workspace cannot see or decide it", async () => {
    const advice = await proposeCaioAdvice(
      proposalInput(workspaceId, activeMandateId),
    );
    const workspace = await db.workspace.create({
      data: {
        name: `CAIO advice foreign ${suffix}`,
        slug: `caio-advice-foreign-${suffix}`,
      },
    });
    try {
      await db.membership.create({
        data: {
          workspaceId: workspace.id,
          userId: ownerUserId,
          role: WorkspaceRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      });
      await expect(
        decideCaioAdvice({
          workspaceId: workspace.id,
          adviceRecordId: advice.adviceId,
          outcome: "accepted",
          reason: "cross-workspace",
          actorUserId: ownerUserId,
          actorCeoRef: CEO_REF,
        }),
      ).rejects.toThrow(/advice record not found/u);
    } finally {
      await db.workspace.delete({ where: { id: workspace.id } });
    }
  });

  it("projects a single-clock ledger view", async () => {
    const ledger = await getCaioAdviceLedger({
      workspaceId,
      mandateRecordId: activeMandateId,
      actorUserId: ownerUserId,
    });
    expect(ledger.entries.length).toBeGreaterThan(0);
    for (const entry of ledger.entries) {
      expect(entry.advice.authorityEffect).toBe("none");
      expect(entry.advice.executionRef).toBeNull();
      if (entry.advice.status === "proposed") {
        expect(["awaiting_decision", "expired"]).toContain(
          entry.projection.state,
        );
      }
      if (
        ["accepted", "rejected", "deferred"].includes(entry.advice.status)
      ) {
        expect(entry.projection.state).toBe("decided");
      }
    }
    await expect(
      getCaioAdviceLedger({
        workspaceId,
        mandateRecordId: activeMandateId,
        actorUserId: ownerUserId,
        at: "not-a-time",
      }),
    ).rejects.toThrow(CaioAdviceStoreError);
  });

  it("serializes concurrent duplicate proposals: one row, one audit", async () => {
    const input = proposalInput(workspaceId, activeMandateId);
    const [a, b] = await Promise.all([
      proposeCaioAdvice(input),
      proposeCaioAdvice(input),
    ]);
    expect(a.adviceId).toBe(b.adviceId);
    const rows = await db.caioAdviceRecord.findMany({
      where: { workspaceId, adviceKey: input.adviceKey },
    });
    expect(rows).toHaveLength(1);
    const audits = await db.auditLog.findMany({
      where: {
        workspaceId,
        targetType: "CaioAdviceRecord",
        targetId: a.adviceId,
        actionType: "CAIO_ADVICE_PROPOSED",
      },
    });
    expect(audits).toHaveLength(1);
  });

  it("survives the forced propose-vs-decide lock collision (deterministic interleaving)", async () => {
    // Forced interleaving, no sleeps: a holder pins the MANDATE row, a
    // duplicate propose queues on it FIRST, the decide locks the advice
    // row and queues on the mandate SECOND (both queue positions proven
    // via the sustained-blocked-FOR-UPDATE barrier before release). On release, InnoDB's FIFO grant
    // gives the mandate to the proposer while the decider still holds the
    // advice row lock — the exact overlap that can escalate to a
    // conflict/deadlock on the advice row's index entries. Whether InnoDB
    // resolves it by clean serialization or by killing a victim that
    // runWithWriteConflictRetry re-runs, the OBSERVABLE contract is
    // pinned: both calls land, one decided outcome, exactly one audit.
    const input = proposalInput(workspaceId, activeMandateId);
    const advice = await proposeCaioAdvice(input);
    const holder = holdRowLock(
      (tx) => tx.$queryRaw`
        SELECT id FROM CaioMandateRecord
        WHERE id = ${activeMandateId} AND workspaceId = ${workspaceId}
        FOR UPDATE`,
    );
    await holder.acquired;
    const reproposePromise = proposeCaioAdvice(input);
    await waitForBlockedRowLock("CaioMandateRecord", 1);
    expect(await hasSettled(reproposePromise)).toBe(false);
    const decidePromise = decideCaioAdvice({
      workspaceId,
      adviceRecordId: advice.adviceId,
      outcome: "accepted",
      reason: "decided during the duplicate proposal",
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
    });
    await waitForBlockedRowLock("CaioMandateRecord", 2);
    expect(await hasSettled(decidePromise)).toBe(false);
    holder.release();
    await holder.done;
    const [decided, reproposed] = await Promise.all([
      decidePromise,
      reproposePromise,
    ]);
    expect(decided.kind).toBe("decided");
    expect(reproposed.adviceId).toBe(advice.adviceId);
    const decidedAudits = await db.auditLog.findMany({
      where: {
        workspaceId,
        targetType: "CaioAdviceRecord",
        targetId: advice.adviceId,
        actionType: "CAIO_ADVICE_DECIDED",
      },
    });
    expect(decidedAudits).toHaveLength(1);
    const proposedAudits = await db.auditLog.findMany({
      where: {
        workspaceId,
        targetType: "CaioAdviceRecord",
        targetId: advice.adviceId,
        actionType: "CAIO_ADVICE_PROPOSED",
      },
    });
    expect(proposedAudits).toHaveLength(1);
    const row = await db.caioAdviceRecord.findUniqueOrThrow({
      where: { id: advice.adviceId },
    });
    expect(row.status).toBe("accepted");
  });

  it("re-verifies the capability half of the gate inside the transaction (membership TOCTOU)", async () => {
    // A dedicated CEO-bound ADMIN whose membership is deactivated AFTER
    // the pre-transaction gate has already passed.
    const toctou = await db.user.create({
      data: {
        email: `caio-advice-toctou-${suffix}@example.com`,
        name: "CAIO advice toctou",
      },
    });
    await db.membership.create({
      data: {
        workspaceId,
        userId: toctou.id,
        role: WorkspaceRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });
    await registerCaioPrincipalBinding({
      workspaceId,
      actorUserId: ownerUserId,
      userId: toctou.id,
      principalRef: CEO_REF,
      principalKind: "ceo",
      evidenceRef: `binding-evidence-toctou-${suffix}`,
    });
    const advice = await proposeCaioAdvice(
      proposalInput(workspaceId, activeMandateId),
    );
    const holder = holdRowLock(
      (tx) => tx.$queryRaw`
        SELECT id FROM CaioAdviceRecord
        WHERE id = ${advice.adviceId} AND workspaceId = ${workspaceId}
        FOR UPDATE`,
    );
    await holder.acquired;
    // decide passes the pre-transaction gate, then provably blocks on the
    // advice row lock held above (barrier, not a sleep)
    const decidePromise = decideCaioAdvice({
      workspaceId,
      adviceRecordId: advice.adviceId,
      outcome: "accepted",
      reason: "should never land",
      actorUserId: toctou.id,
      actorCeoRef: CEO_REF,
    });
    try {
      await waitForBlockedRowLock("CaioAdviceRecord", 1);
      expect(await hasSettled(decidePromise)).toBe(false);
      await db.membership.update({
        where: { workspaceId_userId: { workspaceId, userId: toctou.id } },
        data: { status: MembershipStatus.INACTIVE },
      });
    } finally {
      holder.release();
      await holder.done;
    }
    await expect(decidePromise).rejects.toThrow(
      /no longer holds an active governed-action membership/u,
    );
    const row = await db.caioAdviceRecord.findUniqueOrThrow({
      where: { id: advice.adviceId },
    });
    expect(row.status).toBe("proposed");
  });

  it("re-verifies the ceo binding inside the transaction (binding TOCTOU)", async () => {
    // Runs LAST: it permanently revokes the owner's ceo binding.
    const advice = await proposeCaioAdvice(
      proposalInput(workspaceId, activeMandateId),
    );
    const binding = await db.caioPrincipalBinding.findFirstOrThrow({
      where: {
        workspaceId,
        userId: ownerUserId,
        principalRef: CEO_REF,
        principalKind: "ceo",
        revokedAt: null,
      },
    });
    const holder = holdRowLock(
      (tx) => tx.$queryRaw`
        SELECT id FROM CaioAdviceRecord
        WHERE id = ${advice.adviceId} AND workspaceId = ${workspaceId}
        FOR UPDATE`,
    );
    await holder.acquired;
    const decidePromise = decideCaioAdvice({
      workspaceId,
      adviceRecordId: advice.adviceId,
      outcome: "accepted",
      reason: "should never land",
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
    });
    try {
      await waitForBlockedRowLock("CaioAdviceRecord", 1);
      expect(await hasSettled(decidePromise)).toBe(false);
      await revokeCaioPrincipalBinding({
        workspaceId,
        actorUserId: ownerUserId,
        bindingId: binding.id,
      });
    } finally {
      holder.release();
      await holder.done;
    }
    await expect(decidePromise).rejects.toThrow(
      /no live ceo principal binding/u,
    );
    const row = await db.caioAdviceRecord.findUniqueOrThrow({
      where: { id: advice.adviceId },
    });
    expect(row.status).toBe("proposed");
  });
});
