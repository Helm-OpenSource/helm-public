import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Operator entry points against real services and an isolated MySQL database.
 * Only the session and Next cache are mocked; every permission, binding and audit check is real.
 *
 *   CAIO_OPERATOR_DATABASE_URL=<disposable helm_caio_operator_* db url> DATABASE_URL=<same url> \
 *     npx vitest run features/caio-operator/actions.mysql.test.ts --config vitest.public.config.ts
 */

const { sessionMock } = vi.hoisted(() => ({ sessionMock: { getCurrentWorkspaceSession: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentWorkspaceSession: sessionMock.getCurrentWorkspaceSession }));

import { db } from "@/lib/db";

import {
  activateMandateAction,
  createCatalogEntryAction,
  createMandateDraftAction,
  createObservationProgramAction,
  recordGuardianStopAction,
  registerPrincipalBindingAction,
  resumeGuardianStopAction,
  revokeMandateAction,
} from "./actions";

const integrationDatabaseUrl = process.env.CAIO_OPERATOR_DATABASE_URL;
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const suffix = `${process.pid}-${Date.now()}`;
const CEO_REF = "ceo-operator-it";
const GUARDIAN_REF = "guardian-operator-it";

type Actor = { id: string; name: string; role: WorkspaceRole };

function actAs(workspaceId: string, actor: Actor) {
  sessionMock.getCurrentWorkspaceSession.mockResolvedValue({
    user: { id: actor.id, name: actor.name },
    membership: { role: actor.role },
    workspace: { id: workspaceId, defaultLocale: "zh-CN" },
  });
}

function seconds(ms: number) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/u, "Z");
}

describeMysql("CAIO operator entry points with an isolated MySQL database", () => {
  let workspaceId = "";
  let owner: Actor;
  let guardian: Actor;
  let reviewer: Actor;

  async function auditCount(actionType: string) {
    return db.auditLog.count({ where: { workspaceId, actionType } });
  }

  beforeAll(async () => {
    if (process.env.DATABASE_URL !== integrationDatabaseUrl) {
      throw new Error("DATABASE_URL must equal CAIO_OPERATOR_DATABASE_URL for the isolated integration test.");
    }
    // Disposable databases only: rows are retained (append-only evidence, per-run suffixes), so never
    // point this suite at a shared development or production database.
    const databaseName = new URL(integrationDatabaseUrl ?? "").pathname.replace(/^\//u, "");
    if (!databaseName.startsWith("helm_caio_operator_")) {
      throw new Error("CAIO_OPERATOR_DATABASE_URL must name a disposable helm_caio_operator_* database.");
    }
    const workspace = await db.workspace.create({ data: { name: `CAIO operator ${suffix}`, slug: `caio-operator-${suffix}` } });
    workspaceId = workspace.id;
    const makeMember = async (label: string, role: WorkspaceRole): Promise<Actor> => {
      const user = await db.user.create({ data: { email: `caio-operator-${label}-${suffix}@example.com`, name: `CAIO ${label}` } });
      await db.membership.create({ data: { workspaceId, userId: user.id, role, status: MembershipStatus.ACTIVE } });
      return { id: user.id, name: user.name ?? label, role };
    };
    owner = await makeMember("owner", WorkspaceRole.OWNER);
    guardian = await makeMember("guardian", WorkspaceRole.ADMIN);
    reviewer = await makeMember("reviewer", WorkspaceRole.REVIEWER);
  });

  afterAll(async () => {
    // Same retention rule as the other CAIO isolated suites: governance, catalog and audit rows are kept.
    await db.$disconnect();
  });

  it("refuses a non-owner registration before any write or audit", async () => {
    actAs(workspaceId, reviewer);
    const before = await auditCount("CAIO_PRINCIPAL_BINDING_REGISTERED");
    const result = await registerPrincipalBindingAction({
      userId: reviewer.id, principalRef: "reviewer-self", principalKind: "ceo", evidenceRef: `evidence-${suffix}`,
    });
    expect(result).toMatchObject({ ok: false, code: "not_owner" });
    expect(await auditCount("CAIO_PRINCIPAL_BINDING_REGISTERED")).toBe(before);
    expect(await db.caioPrincipalBinding.count({ where: { workspaceId } })).toBe(0);
  });

  it("runs the governance loop: owner registers, CEO activates, a non-owner guardian stops, only the CEO resumes", async () => {
    actAs(workspaceId, owner);
    await expect(registerPrincipalBindingAction({
      userId: owner.id, principalRef: CEO_REF, principalKind: "ceo", evidenceRef: `binding-ceo-${suffix}`,
    })).resolves.toMatchObject({ ok: true });
    await expect(registerPrincipalBindingAction({
      userId: guardian.id, principalRef: GUARDIAN_REF, principalKind: "guardian", evidenceRef: `binding-guardian-${suffix}`,
    })).resolves.toMatchObject({ ok: true });
    expect(await auditCount("CAIO_PRINCIPAL_BINDING_REGISTERED")).toBe(2);

    const now = Date.now();
    const draft = await createMandateDraftAction({
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

    await expect(activateMandateAction({ actorCeoRef: CEO_REF, mandateRecordId }))
      .resolves.toMatchObject({ ok: true, value: { status: "active" } });

    // The guardian is ADMIN, not OWNER, and must still be able to stop.
    actAs(workspaceId, guardian);
    const stop = await recordGuardianStopAction({
      guardianRef: GUARDIAN_REF, mandateRecordId, reason: "operator integration stop", auditRefs: [`audit:stop-${suffix}`],
    });
    expect(stop).toMatchObject({ ok: true, value: { "mandate.status": "suspended" } });
    const stopRecordId = (stop as { value: Record<string, string> }).value["stop.stopId"];
    expect(stopRecordId).toMatch(/\S/);

    // A guardian can never resume, even by naming the CEO ref.
    await expect(resumeGuardianStopAction({ actorCeoRef: CEO_REF, stopRecordId }))
      .resolves.toMatchObject({ ok: false, code: "governance_rejected" });

    actAs(workspaceId, owner);
    await expect(resumeGuardianStopAction({ actorCeoRef: CEO_REF, stopRecordId })).resolves.toMatchObject({ ok: true });
    await expect(revokeMandateAction({ actorCeoRef: CEO_REF, mandateRecordId })).resolves.toMatchObject({ ok: true });
  });

  it("registers a catalog entry and an observation program under the owner with audit, and reports contract refusals as closed codes", async () => {
    actAs(workspaceId, owner);
    const entry = await createCatalogEntryAction({
      assetKey: `activity-${suffix}`, sourceSystemRef: "system:operator-it", displayName: "Operator IT activity",
      sourceKind: "relational_database", businessDomain: "operations", businessOwnerRef: "owner:operations",
      purpose: "Observe aggregate activity", scopeRefs: ["scope:workspace"], recommendedAccessMode: "read_only_replica",
      retentionDays: 90, freshnessSlaMinutes: 10, residencyRequirements: ["domestic"], blindSpots: [], blockerCodes: [],
      riskOwnerRef: null, nextReviewAt: null, evidenceRefs: [`evidence:inventory-${suffix}`],
    });
    expect(entry.ok).toBe(true);

    const program = await createObservationProgramAction({
      purpose: "Observe operations", scopeRefs: ["scope:workspace"], dataCategories: ["operations_aggregate"],
      startsAt: new Date(Date.now() - 60_000).toISOString(), expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      retentionDays: 90, authorizationRef: `authorization:operator-it-${suffix}`,
    });
    // Either registered, or refused by the observation contract with a closed code — never an unmapped failure.
    if (!program.ok) expect(["observation_rejected", "observation_denied"]).toContain(program.code);

    const duplicate = await createCatalogEntryAction({
      assetKey: `activity-${suffix}`, sourceSystemRef: "system:operator-it", displayName: "Operator IT activity",
      sourceKind: "relational_database", businessDomain: "operations", businessOwnerRef: "owner:operations",
      purpose: "Observe aggregate activity", scopeRefs: ["scope:workspace"], recommendedAccessMode: "read_only_replica",
      retentionDays: 90, freshnessSlaMinutes: 10, residencyRequirements: ["domestic"], blindSpots: [], blockerCodes: [],
      riskOwnerRef: null, nextReviewAt: null, evidenceRefs: [`evidence:inventory-${suffix}`],
    });
    if (!duplicate.ok) expect(["catalog_conflict", "catalog_rejected"]).toContain(duplicate.code);

    const audits = await db.auditLog.findMany({ where: { workspaceId }, select: { actionType: true, userId: true } });
    expect(audits.length).toBeGreaterThan(0);
    expect(audits.every((row) => row.userId === owner.id || row.userId === guardian.id)).toBe(true);
  });
});
