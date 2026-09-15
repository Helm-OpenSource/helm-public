import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Governance CLI runner against real services and an isolated MySQL database. Nothing is mocked:
 * membership, binding, stop/resume and audit checks are the real ones.
 *
 *   CAIO_OPERATOR_DATABASE_URL=<disposable helm_caio_operator_* db url> DATABASE_URL=<same url> \
 *     npx vitest run lib/caio-operator/governance-operator.mysql.test.ts --config vitest.public.config.ts
 */

import { db } from "@/lib/db";

import { runCaioGovernanceOperation, type CaioGovernanceOperationKey } from "./governance-operator";

const integrationDatabaseUrl = process.env.CAIO_OPERATOR_DATABASE_URL;
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const suffix = `${process.pid}-${Date.now()}`;
const CEO_REF = "ceo-operator-it";
const GUARDIAN_REF = "guardian-operator-it";

function seconds(ms: number) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/u, "Z");
}

describeMysql("CAIO governance CLI runner with an isolated MySQL database", () => {
  let workspaceId = "";
  let ownerId = "";
  let guardianId = "";
  let reviewerId = "";

  const run = (operation: CaioGovernanceOperationKey, actorUserId: string, rawInput: unknown, apply = true) =>
    runCaioGovernanceOperation({ operation, workspaceId, actorUserId, rawInput, apply });
  const auditCount = (actionType: string) => db.auditLog.count({ where: { workspaceId, actionType } });

  beforeAll(async () => {
    if (process.env.DATABASE_URL !== integrationDatabaseUrl) {
      throw new Error("DATABASE_URL must equal CAIO_OPERATOR_DATABASE_URL for the isolated integration test.");
    }
    // Disposable databases only: rows are retained (append-only evidence, per-run suffixes).
    const databaseName = new URL(integrationDatabaseUrl ?? "").pathname.replace(/^\//u, "");
    if (!databaseName.startsWith("helm_caio_operator_")) {
      throw new Error("CAIO_OPERATOR_DATABASE_URL must name a disposable helm_caio_operator_* database.");
    }
    const workspace = await db.workspace.create({ data: { name: `CAIO governance ${suffix}`, slug: `caio-governance-${suffix}` } });
    workspaceId = workspace.id;
    const makeMember = async (label: string, role: WorkspaceRole) => {
      const user = await db.user.create({ data: { email: `caio-governance-${label}-${suffix}@example.com`, name: `CAIO ${label}` } });
      await db.membership.create({ data: { workspaceId, userId: user.id, role, status: MembershipStatus.ACTIVE } });
      return user.id;
    };
    ownerId = await makeMember("owner", WorkspaceRole.OWNER);
    guardianId = await makeMember("guardian", WorkspaceRole.ADMIN);
    reviewerId = await makeMember("reviewer", WorkspaceRole.REVIEWER);
  });

  afterAll(async () => {
    // Same retention rule as the other CAIO isolated suites: governance and audit rows are kept.
    await db.$disconnect();
  });

  it("refuses a non-owner registration and writes nothing without --apply", async () => {
    const binding = { userId: reviewerId, principalRef: "reviewer-self", principalKind: "ceo", evidenceRef: `evidence-${suffix}` };
    await expect(run("registerPrincipalBinding", reviewerId, binding)).resolves.toMatchObject({ ok: false, code: "not_owner" });
    await expect(run("registerPrincipalBinding", ownerId, binding, false)).resolves.toEqual({ ok: true, value: { validated: true } });
    expect(await auditCount("CAIO_PRINCIPAL_BINDING_REGISTERED")).toBe(0);
    expect(await db.caioPrincipalBinding.count({ where: { workspaceId } })).toBe(0);
  });

  it("runs the governance loop: owner registers, CEO activates, a non-owner guardian stops, only the CEO resumes", async () => {
    await expect(run("registerPrincipalBinding", ownerId, {
      userId: ownerId, principalRef: CEO_REF, principalKind: "ceo", evidenceRef: `binding-ceo-${suffix}`,
    })).resolves.toMatchObject({ ok: true });
    await expect(run("registerPrincipalBinding", ownerId, {
      userId: guardianId, principalRef: GUARDIAN_REF, principalKind: "guardian", evidenceRef: `binding-guardian-${suffix}`,
    })).resolves.toMatchObject({ ok: true });
    expect(await auditCount("CAIO_PRINCIPAL_BINDING_REGISTERED")).toBe(2);

    const now = Date.now();
    const draft = await run("createMandateDraft", ownerId, {
      caioRef: "caio-operator-it", ceoRef: CEO_REF, stage: "observe", stageDecisionRef: `stage-decision-${suffix}`,
      objectiveRefs: ["objective:operator-it"], scopeRefs: ["scope:observe-readouts"],
      grantBasisRefs: [`caio-mandate-grant:${CEO_REF}:issuance-${suffix}`], reservedMatterRefs: ["reserved:legal"],
      humanResponsePolicyRef: "policy:human-response-v1", accountabilityAnchorRefs: ["anchor:ceo"],
      guardianStopRefs: [GUARDIAN_REF], validFrom: seconds(now - 60_000), validUntil: seconds(now + 86_400_000),
      inFlightDisposition: "freeze", auditRefs: [`audit:operator-it-${suffix}`],
    });
    expect(draft).toMatchObject({ ok: true, value: { status: "draft" } });
    const mandateRecordId = (draft as { value: { mandateId: string } }).value.mandateId;
    expect(mandateRecordId).toMatch(/\S/);

    await expect(run("activateMandate", ownerId, { actorCeoRef: CEO_REF, mandateRecordId }))
      .resolves.toMatchObject({ ok: true, value: { status: "active" } });

    // The guardian is ADMIN, not OWNER, and must still be able to stop.
    const stop = await run("recordGuardianStop", guardianId, {
      guardianRef: GUARDIAN_REF, mandateRecordId, reason: "operator integration stop", auditRefs: [`audit:stop-${suffix}`],
    });
    expect(stop).toMatchObject({ ok: true, value: { "mandate.status": "suspended" } });
    const stopRecordId = (stop as { value: Record<string, string> }).value["stop.stopId"];
    expect(stopRecordId).toMatch(/\S/);

    // A guardian can never resume, even by naming the CEO ref.
    await expect(run("resumeGuardianStop", guardianId, { actorCeoRef: CEO_REF, stopRecordId }))
      .resolves.toMatchObject({ ok: false, code: "governance_rejected" });

    await expect(run("resumeGuardianStop", ownerId, { actorCeoRef: CEO_REF, stopRecordId })).resolves.toMatchObject({ ok: true });
    await expect(run("revokeMandate", ownerId, { actorCeoRef: CEO_REF, mandateRecordId })).resolves.toMatchObject({ ok: true });
  });
});
