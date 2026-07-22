import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  activateCaioMandate,
  CaioMandateStoreError,
  createCaioMandateDraft,
  getCaioMandateWithStops,
  projectStoredEnvelopeValidity,
  recordCaioGuardianStop,
  registerCaioPrincipalBinding,
  resumeCaioGuardianStop,
  revokeCaioMandate,
  revokeCaioPrincipalBinding,
  suspendCaioMandate,
} from "./mandate-store.service";
import type { CaioPolicyEnvelope } from "./types";

const integrationDatabaseUrl = process.env.CAIO_MANDATE_STORE_DATABASE_URL;
const describeMysql = integrationDatabaseUrl
  ? describe.sequential
  : describe.skip;
const suffix = `${process.pid}-${Date.now()}`;

const CEO_REF = "ceo-principal-1";
const GUARDIAN_REF = "guardian-principal-1";

function draftInput(workspaceId: string, ownerUserId: string) {
  const now = Date.now();
  return {
    workspaceId,
    actorUserId: ownerUserId,
    caioRef: "caio:helm-self",
    ceoRef: CEO_REF,
    stage: "observe" as const,
    stageDecisionRef: "stage-decision:2026-07-22",
    objectiveRefs: ["objective:collections-flywheel"],
    scopeRefs: ["scope:observe-readouts"],
    grantBasisRefs: [`caio-mandate-grant:${CEO_REF}:issuance-${suffix}`],
    reservedMatterRefs: ["reserved:legal"],
    humanResponsePolicyRef: "policy:human-response-v1",
    accountabilityAnchorRefs: ["anchor:ceo"],
    guardianStopRefs: [GUARDIAN_REF],
    validFrom: new Date(now - 60_000).toISOString().replace(/\.\d{3}Z$/u, "Z"),
    validUntil: new Date(now + 86_400_000)
      .toISOString()
      .replace(/\.\d{3}Z$/u, "Z"),
    inFlightDisposition: "freeze" as const,
    auditRefs: [`audit:test-${suffix}`],
  };
}

describeMysql("CAIO mandate store with an isolated MySQL database", () => {
  let workspaceId = "";
  let ownerUserId = "";

  beforeAll(async () => {
    if (process.env.DATABASE_URL !== integrationDatabaseUrl) {
      throw new Error(
        "DATABASE_URL must equal CAIO_MANDATE_STORE_DATABASE_URL for the isolated integration test.",
      );
    }
    const workspace = await db.workspace.create({
      data: {
        name: `CAIO store integration ${suffix}`,
        slug: `caio-store-integration-${suffix}`,
      },
    });
    workspaceId = workspace.id;
    const owner = await db.user.create({
      data: {
        email: `caio-store-owner-${suffix}@example.com`,
        name: "CAIO store owner",
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
    // Register the identity-seam bindings this suite acts under. In
    // production the private overlay slice feeds these; here the OWNER
    // registers them explicitly and the audit trail records it.
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
  });

  afterAll(async () => {
    if (workspaceId) {
      await db.workspace.delete({ where: { id: workspaceId } });
    }
    await db.$disconnect();
  });

  it("creates a validated draft and refuses invalid grant bases", async () => {
    const draft = await createCaioMandateDraft(draftInput(workspaceId, ownerUserId));
    expect(draft.status).toBe("draft");
    expect(draft.authorityEffect).toBe("none");
    expect(draft.runtimeAuthorityRef).toBeNull();

    await expect(
      createCaioMandateDraft({
        ...draftInput(workspaceId, ownerUserId),
        grantBasisRefs: ["legacy-owner-approval:metadata-registration"],
      }),
    ).rejects.toThrow(CaioMandateStoreError);
  });

  it("activates CEO-only with a workspace-unique claim", async () => {
    const draft = await createCaioMandateDraft(draftInput(workspaceId, ownerUserId));

    await expect(
      activateCaioMandate({
        workspaceId,
        actorUserId: ownerUserId,
        actorCeoRef: "cfo-principal-1",
        mandateRecordId: draft.mandateId,
      }),
    ).rejects.toThrow(/only the issuing CEO/u);

    const active = await activateCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: draft.mandateId,
    });
    expect(active.status).toBe("active");

    const second = await createCaioMandateDraft(draftInput(workspaceId, ownerUserId));
    await expect(
      activateCaioMandate({
        workspaceId,
        actorUserId: ownerUserId,
        actorCeoRef: CEO_REF,
        mandateRecordId: second.mandateId,
      }),
    ).rejects.toThrow(/already active/u);

    // supersede path: the second activates by explicitly superseding
    const superseding = await activateCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: second.mandateId,
      supersedesRecordId: active.mandateId,
    });
    expect(superseding.status).toBe("active");
    const old = await getCaioMandateWithStops({
      workspaceId,
      actorUserId: ownerUserId,
      mandateRecordId: active.mandateId,
    });
    expect(old.mandate.status).toBe("superseded");

    // clean up the active claim for later tests
    await revokeCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: superseding.mandateId,
    });
  });

  it("guardian stop suspends in-transaction; only the CEO resumes; no auto-reactivation", async () => {
    const draft = await createCaioMandateDraft(draftInput(workspaceId, ownerUserId));
    const active = await activateCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: draft.mandateId,
    });

    await expect(
      recordCaioGuardianStop({
        workspaceId,
        actorUserId: ownerUserId,
        guardianRef: "not-a-guardian",
        mandateRecordId: active.mandateId,
        reason: "not designated",
        auditRefs: ["audit:x"],
      }),
    ).rejects.toThrow(/not a designated guardian/u);

    const { stop, mandate } = await recordCaioGuardianStop({
      workspaceId,
      actorUserId: ownerUserId,
      guardianRef: GUARDIAN_REF,
      mandateRecordId: active.mandateId,
      reason: "anomalous behaviour observed",
      auditRefs: ["audit:stop-1"],
    });
    expect(mandate.status).toBe("suspended");
    expect(mandate.emergencyStopRef).toBe(stop.stopId);

    // an envelope over a stopped mandate is ineffective
    const envelope: CaioPolicyEnvelope = {
      envelopeId: "envelope-1",
      mandateRef: mandate.mandateId,
      grantedByRef: CEO_REF,
      scopeRefs: ["scope:observe-readouts"],
      validFrom: mandate.validFrom,
      validUntil: mandate.validUntil,
      status: "active",
      auditRefs: ["audit:env-1"],
      authorityEffect: "none",
    };
    const projection = await projectStoredEnvelopeValidity({
      workspaceId,
      actorUserId: ownerUserId,
      mandateRecordId: mandate.mandateId,
      envelope,
      at: new Date().toISOString().replace(/\.\d{3}Z$/u, "Z"),
    });
    expect(projection.effective).toBe(false);

    // a guardian cannot resume (the service only accepts the issuing CEO ref)
    await expect(
      resumeCaioGuardianStop({
        workspaceId,
        actorUserId: ownerUserId,
        actorCeoRef: GUARDIAN_REF,
        stopRecordId: stop.stopId,
      }),
    ).rejects.toThrow(/issuing CEO alone/u);

    const resumed = await resumeCaioGuardianStop({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      stopRecordId: stop.stopId,
    });
    expect(resumed.mandate.emergencyStopRef).toBeNull();
    // resuming does NOT reactivate
    expect(resumed.mandate.status).toBe("suspended");

    // explicit CEO reactivation is required and works after resume
    const reactivated = await activateCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: mandate.mandateId,
    });
    expect(reactivated.status).toBe("active");
    await revokeCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: mandate.mandateId,
    });
  });

  it("enforces legal transitions and expiry projection", async () => {
    const draft = await createCaioMandateDraft(draftInput(workspaceId, ownerUserId));
    await expect(
      suspendCaioMandate({
        workspaceId,
        actorUserId: ownerUserId,
        actorCeoRef: CEO_REF,
        mandateRecordId: draft.mandateId,
      }),
    ).rejects.toThrow(/illegal transition/u);

    const revoked = await revokeCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: draft.mandateId,
    });
    expect(revoked.status).toBe("revoked");
    await expect(
      activateCaioMandate({
        workspaceId,
        actorUserId: ownerUserId,
        actorCeoRef: CEO_REF,
        mandateRecordId: draft.mandateId,
      }),
    ).rejects.toThrow(/illegal transition/u);

    // expiry: backdate an active mandate and read it back
    const expiring = await createCaioMandateDraft(draftInput(workspaceId, ownerUserId));
    await activateCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: expiring.mandateId,
    });
    await db.caioMandateRecord.update({
      where: { id: expiring.mandateId },
      data: { validUntil: new Date(Date.now() - 1000) },
    });
    const projected = await getCaioMandateWithStops({
      workspaceId,
      actorUserId: ownerUserId,
      mandateRecordId: expiring.mandateId,
    });
    expect(projected.mandate.status).toBe("expired");
    await expect(
      activateCaioMandate({
        workspaceId,
        actorUserId: ownerUserId,
        actorCeoRef: CEO_REF,
        mandateRecordId: expiring.mandateId,
      }),
    ).rejects.toThrow(/expired|illegal/u);

    // the SERVICE reclaims the expired incumbent's claim atomically: a new
    // mandate can take over with no manual cleanup
    const successor = await createCaioMandateDraft(
      draftInput(workspaceId, ownerUserId),
    );
    const takenOver = await activateCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: successor.mandateId,
    });
    expect(takenOver.status).toBe("active");
    const incumbent = await getCaioMandateWithStops({
      workspaceId,
      actorUserId: ownerUserId,
      mandateRecordId: expiring.mandateId,
    });
    expect(incumbent.mandate.status).toBe("expired");
    await revokeCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: successor.mandateId,
    });
  });

  it("keeps the mandate stopped while ANY stop remains in force", async () => {
    const draft = await createCaioMandateDraft(draftInput(workspaceId, ownerUserId));
    const active = await activateCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: draft.mandateId,
    });
    const first = await recordCaioGuardianStop({
      workspaceId,
      actorUserId: ownerUserId,
      guardianRef: GUARDIAN_REF,
      mandateRecordId: active.mandateId,
      reason: "first stop",
      auditRefs: ["audit:stop-a"],
    });
    const second = await recordCaioGuardianStop({
      workspaceId,
      actorUserId: ownerUserId,
      guardianRef: GUARDIAN_REF,
      mandateRecordId: active.mandateId,
      reason: "second stop",
      auditRefs: ["audit:stop-b"],
    });
    // resume the LATEST stop: the first is still in force, so the pointer
    // repoints instead of clearing, and activation stays refused
    const afterOne = await resumeCaioGuardianStop({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      stopRecordId: second.stop.stopId,
    });
    expect(afterOne.mandate.emergencyStopRef).toBe(first.stop.stopId);
    await expect(
      activateCaioMandate({
        workspaceId,
        actorUserId: ownerUserId,
        actorCeoRef: CEO_REF,
        mandateRecordId: active.mandateId,
      }),
    ).rejects.toThrow(/in force/u);
    const afterBoth = await resumeCaioGuardianStop({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      stopRecordId: first.stop.stopId,
    });
    expect(afterBoth.mandate.emergencyStopRef).toBeNull();
    const reactivated = await activateCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: active.mandateId,
    });
    expect(reactivated.status).toBe("active");
    await revokeCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: active.mandateId,
    });
  });

  it("fails closed when the acting user holds no principal binding", async () => {
    const stranger = await db.user.create({
      data: {
        email: `caio-store-unbound-${suffix}@example.com`,
        name: "Unbound admin",
      },
    });
    await db.membership.create({
      data: {
        workspaceId,
        userId: stranger.id,
        role: WorkspaceRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });
    const draft = await createCaioMandateDraft(
      draftInput(workspaceId, stranger.id),
    );
    // workspace power alone is NOT enough: no ceo binding -> fail closed
    await expect(
      activateCaioMandate({
        workspaceId,
        actorUserId: stranger.id,
        actorCeoRef: CEO_REF,
        mandateRecordId: draft.mandateId,
      }),
    ).rejects.toThrow(/no live ceo principal binding/u);
  });

  it("refuses binding registration by an ADMIN and by an empty actor", async () => {
    const admin = await db.user.create({
      data: {
        email: `caio-store-admin-${suffix}@example.com`,
        name: "Admin",
      },
    });
    await db.membership.create({
      data: {
        workspaceId,
        userId: admin.id,
        role: WorkspaceRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });
    await expect(
      registerCaioPrincipalBinding({
        workspaceId,
        actorUserId: admin.id,
        userId: admin.id,
        principalRef: "self-appointed-ceo",
        principalKind: "ceo",
        evidenceRef: "forged",
      }),
    ).rejects.toThrow(/OWNER-only/u);
    await expect(
      createCaioMandateDraft({
        ...draftInput(workspaceId, ""),
      }),
    ).rejects.toThrow(/fail closed/u);
  });

  it("a revoked binding stops authorizing principal actions", async () => {
    const draft = await createCaioMandateDraft(draftInput(workspaceId, ownerUserId));
    const temp = await registerCaioPrincipalBinding({
      workspaceId,
      actorUserId: ownerUserId,
      userId: ownerUserId,
      principalRef: "temp-guardian",
      principalKind: "guardian",
      evidenceRef: `temp-${suffix}`,
    });
    await revokeCaioPrincipalBinding({
      workspaceId,
      actorUserId: ownerUserId,
      bindingId: temp.id,
    });
    const active = await activateCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: draft.mandateId,
    });
    // temp-guardian was designated on no mandates anyway, but even a
    // designated ref with a REVOKED binding must fail: designate it first
    const designated = await createCaioMandateDraft({
      ...draftInput(workspaceId, ownerUserId),
      guardianStopRefs: ["temp-guardian"],
    });
    await revokeCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: active.mandateId,
    });
    const secondActive = await activateCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: designated.mandateId,
    });
    await expect(
      recordCaioGuardianStop({
        workspaceId,
        actorUserId: ownerUserId,
        guardianRef: "temp-guardian",
        mandateRecordId: secondActive.mandateId,
        reason: "should fail",
        auditRefs: ["audit:x"],
      }),
    ).rejects.toThrow(/no live guardian principal binding/u);
    await revokeCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: secondActive.mandateId,
    });
  });

  it("double-resume of one stop and concurrent resumes keep the ledger sane", async () => {
    const draft = await createCaioMandateDraft(draftInput(workspaceId, ownerUserId));
    const active = await activateCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: draft.mandateId,
    });
    const a = await recordCaioGuardianStop({
      workspaceId,
      actorUserId: ownerUserId,
      guardianRef: GUARDIAN_REF,
      mandateRecordId: active.mandateId,
      reason: "stop A",
      auditRefs: ["audit:a"],
    });
    const b = await recordCaioGuardianStop({
      workspaceId,
      actorUserId: ownerUserId,
      guardianRef: GUARDIAN_REF,
      mandateRecordId: active.mandateId,
      reason: "stop B",
      auditRefs: ["audit:b"],
    });
    // concurrent resumes of DIFFERENT stops: row lock serializes them
    const results = await Promise.allSettled([
      resumeCaioGuardianStop({
        workspaceId,
        actorUserId: ownerUserId,
        actorCeoRef: CEO_REF,
        stopRecordId: a.stop.stopId,
      }),
      resumeCaioGuardianStop({
        workspaceId,
        actorUserId: ownerUserId,
        actorCeoRef: CEO_REF,
        stopRecordId: b.stop.stopId,
      }),
    ]);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    const after = await getCaioMandateWithStops({
      workspaceId,
      actorUserId: ownerUserId,
      mandateRecordId: active.mandateId,
    });
    expect(after.mandate.emergencyStopRef).toBeNull();
    expect(after.stops.every((stop) => stop.resumedAt !== null)).toBe(true);
    // double-resume of an already-resumed stop loses the CAS
    await expect(
      resumeCaioGuardianStop({
        workspaceId,
        actorUserId: ownerUserId,
        actorCeoRef: CEO_REF,
        stopRecordId: a.stop.stopId,
      }),
    ).rejects.toThrow(/already resumed/u);
    // and the mandate can reactivate cleanly
    const reactivated = await activateCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: active.mandateId,
    });
    expect(reactivated.status).toBe("active");
    await revokeCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: active.mandateId,
    });
  });

  it("cross-workspace stops are unrepresentable at the database level", async () => {
    const otherWorkspace = await db.workspace.create({
      data: {
        name: `CAIO other ${suffix}`,
        slug: `caio-other-${suffix}`,
      },
    });
    const draft = await createCaioMandateDraft(draftInput(workspaceId, ownerUserId));
    await expect(
      db.caioGuardianStopRecord.create({
        data: {
          workspaceId: otherWorkspace.id,
          mandateRecordId: draft.mandateId,
          guardianRef: GUARDIAN_REF,
          reason: "cross-workspace forgery",
          triggeredAt: new Date(),
          auditRefs: "[]",
        },
      }),
    ).rejects.toThrow();
    await db.workspace.delete({ where: { id: otherWorkspace.id } });
  });

  it("historical reads stay on one clock", async () => {
    const draft = await createCaioMandateDraft(draftInput(workspaceId, ownerUserId));
    const active = await activateCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: draft.mandateId,
    });
    const beforeStop = new Date().toISOString();
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const { stop } = await recordCaioGuardianStop({
      workspaceId,
      actorUserId: ownerUserId,
      guardianRef: GUARDIAN_REF,
      mandateRecordId: active.mandateId,
      reason: "later stop",
      auditRefs: ["audit:late"],
    });
    // at a instant BEFORE the stop was triggered, the ledger view is empty
    const historic = await getCaioMandateWithStops({
      workspaceId,
      actorUserId: ownerUserId,
      mandateRecordId: active.mandateId,
      at: beforeStop,
    });
    expect(historic.stops).toHaveLength(0);
    // now resume; at an instant between trigger and resume, the stop shows
    // as still in force
    const betweenInstant = new Date().toISOString();
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await resumeCaioGuardianStop({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      stopRecordId: stop.stopId,
    });
    const midView = await getCaioMandateWithStops({
      workspaceId,
      actorUserId: ownerUserId,
      mandateRecordId: active.mandateId,
      at: betweenInstant,
    });
    expect(midView.stops).toHaveLength(1);
    expect(midView.stops[0]?.resumedAt).toBeNull();
  });

  it("audits resume flows truthfully and exactly once", async () => {
    const draft = await createCaioMandateDraft(draftInput(workspaceId, ownerUserId));
    const active = await activateCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: draft.mandateId,
    });
    const { stop } = await recordCaioGuardianStop({
      workspaceId,
      actorUserId: ownerUserId,
      guardianRef: GUARDIAN_REF,
      mandateRecordId: active.mandateId,
      reason: "audit check",
      auditRefs: ["audit:only"],
    });
    await resumeCaioGuardianStop({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      stopRecordId: stop.stopId,
    });
    const audits = await db.auditLog.findMany({
      where: {
        workspaceId,
        targetType: "CaioGuardianStopRecord",
        targetId: stop.stopId,
      },
      orderBy: { createdAt: "asc" },
    });
    const recorded = audits.filter(
      (row) => row.actionType === "CAIO_GUARDIAN_STOP_RECORDED",
    );
    const resumed = audits.filter(
      (row) => row.actionType === "CAIO_GUARDIAN_STOP_RESUMED",
    );
    expect(recorded).toHaveLength(1);
    expect(resumed).toHaveLength(1);
    // userId is the authenticated operator; actor is the principal ref
    expect(recorded[0]?.userId).toBe(ownerUserId);
    expect(recorded[0]?.actor).toBe(GUARDIAN_REF);
    expect(resumed[0]?.userId).toBe(ownerUserId);
    expect(resumed[0]?.actor).toBe(CEO_REF);
    // truthful summary: this was the last in-force stop, mandate suspended
    expect(resumed[0]?.summary).toContain("remains suspended");
    await revokeCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: active.mandateId,
    });
  });

  it("holds the ledger/pointer invariant under a concurrent stop + resume mix", async () => {
    const draft = await createCaioMandateDraft(draftInput(workspaceId, ownerUserId));
    const active = await activateCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: draft.mandateId,
    });
    const first = await recordCaioGuardianStop({
      workspaceId,
      actorUserId: ownerUserId,
      guardianRef: GUARDIAN_REF,
      mandateRecordId: active.mandateId,
      reason: "existing stop",
      auditRefs: ["audit:mix-a"],
    });
    // concurrently: resume the existing stop while recording a NEW stop —
    // the lock-before-read ordering serializes them in either order
    const [resumeResult, stopResult] = await Promise.allSettled([
      resumeCaioGuardianStop({
        workspaceId,
        actorUserId: ownerUserId,
        actorCeoRef: CEO_REF,
        stopRecordId: first.stop.stopId,
      }),
      recordCaioGuardianStop({
        workspaceId,
        actorUserId: ownerUserId,
        guardianRef: GUARDIAN_REF,
        mandateRecordId: active.mandateId,
        reason: "concurrent new stop",
        auditRefs: ["audit:mix-b"],
      }),
    ]);
    expect(resumeResult.status).toBe("fulfilled");
    expect(stopResult.status).toBe("fulfilled");
    // INVARIANT: pointer is null iff no in-force stop exists, and always
    // points at an in-force stop otherwise
    const after = await getCaioMandateWithStops({
      workspaceId,
      actorUserId: ownerUserId,
      mandateRecordId: active.mandateId,
    });
    const inForce = after.stops.filter((row) => row.resumedAt === null);
    if (inForce.length === 0) {
      expect(after.mandate.emergencyStopRef).toBeNull();
    } else {
      expect(
        inForce.some((row) => row.stopId === after.mandate.emergencyStopRef),
      ).toBe(true);
    }
    // drain remaining stops and reactivate to prove no dead-end state
    for (const row of inForce) {
      await resumeCaioGuardianStop({
        workspaceId,
        actorUserId: ownerUserId,
        actorCeoRef: CEO_REF,
        stopRecordId: row.stopId,
      });
    }
    const reactivated = await activateCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: active.mandateId,
    });
    expect(reactivated.status).toBe("active");
    await revokeCaioMandate({
      workspaceId,
      actorUserId: ownerUserId,
      actorCeoRef: CEO_REF,
      mandateRecordId: active.mandateId,
    });
  });

  it("refuses activating a mandate whose window has not started", async () => {
    const future = await createCaioMandateDraft({
      ...draftInput(workspaceId, ownerUserId),
      validFrom: new Date(Date.now() + 3_600_000).toISOString(),
      validUntil: new Date(Date.now() + 86_400_000).toISOString(),
    });
    await expect(
      activateCaioMandate({
        workspaceId,
        actorUserId: ownerUserId,
        actorCeoRef: CEO_REF,
        mandateRecordId: future.mandateId,
      }),
    ).rejects.toThrow(/not started/u);
  });

  it("denies non-members outright", async () => {
    const outsider = await db.user.create({
      data: {
        email: `caio-store-outsider-${suffix}@example.com`,
        name: "Outsider",
      },
    });
    await expect(
      createCaioMandateDraft({
        ...draftInput(workspaceId, outsider.id),
      }),
    ).rejects.toThrow();
  });
});
