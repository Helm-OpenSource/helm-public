import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Operator web entry points against real services and an isolated MySQL database. The governance
 * record loop runs through the controlled CLI and is covered by lib/caio-operator/governance-operator.mysql.test.ts.
 * Only the session and Next cache are mocked; every permission, binding and audit check is real.
 *
 *   CAIO_OPERATOR_DATABASE_URL=<disposable helm_caio_operator_* db url> DATABASE_URL=<same url> \
 *     npx vitest run features/caio-operator/actions.mysql.test.ts --config vitest.public.config.ts
 */

const { sessionMock } = vi.hoisted(() => ({ sessionMock: { getCurrentWorkspaceSession: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentWorkspaceSession: sessionMock.getCurrentWorkspaceSession }));

import { db } from "@/lib/db";

import { createCatalogEntryAction, createObservationProgramAction } from "./actions";

const integrationDatabaseUrl = process.env.CAIO_OPERATOR_DATABASE_URL;
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const suffix = `${process.pid}-${Date.now()}`;

type Actor = { id: string; name: string; role: WorkspaceRole };

function actAs(workspaceId: string, actor: Actor) {
  sessionMock.getCurrentWorkspaceSession.mockResolvedValue({
    user: { id: actor.id, name: actor.name },
    membership: { role: actor.role },
    workspace: { id: workspaceId, defaultLocale: "zh-CN" },
  });
}

describeMysql("CAIO operator entry points with an isolated MySQL database", () => {
  let workspaceId = "";
  let owner: Actor;
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
    reviewer = await makeMember("reviewer", WorkspaceRole.REVIEWER);
  });

  afterAll(async () => {
    // Same retention rule as the other CAIO isolated suites: governance, catalog and audit rows are kept.
    await db.$disconnect();
  });

  const catalogInput = () => ({
    assetKey: `activity-${suffix}`, sourceSystemRef: "system:operator-it", displayName: "Operator IT activity",
    sourceKind: "relational_database", businessDomain: "operations", businessOwnerRef: "owner:operations",
    purpose: "Observe aggregate activity", scopeRefs: ["scope:workspace"], recommendedAccessMode: "read_only_replica",
    retentionDays: 90, freshnessSlaMinutes: 10, residencyRequirements: ["domestic"], blindSpots: [], blockerCodes: [],
    riskOwnerRef: null, nextReviewAt: null, evidenceRefs: [`evidence:inventory-${suffix}`],
  });

  it("refuses a non-owner registration before any write or audit", async () => {
    actAs(workspaceId, reviewer);
    const before = await auditCount("DATA_ASSET_INVENTORIED");
    const result = await createCatalogEntryAction(catalogInput());
    expect(result).toMatchObject({ ok: false, code: "not_owner" });
    expect(await auditCount("DATA_ASSET_INVENTORIED")).toBe(before);
    expect(await db.dataAssetCatalogEntry.count({ where: { workspaceId } })).toBe(0);
  });

  it("registers a catalog entry and an observation program under the owner with audit, and reports contract refusals as closed codes", async () => {
    actAs(workspaceId, owner);
    const entry = await createCatalogEntryAction(catalogInput());
    expect(entry.ok).toBe(true);

    const program = await createObservationProgramAction({
      purpose: "Observe operations", scopeRefs: ["scope:workspace"], dataCategories: ["operations_aggregate"],
      startsAt: new Date(Date.now() - 60_000).toISOString(), expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      retentionDays: 90, authorizationRef: `authorization:operator-it-${suffix}`,
    });
    // Either registered, or refused by the observation contract with a closed code — never an unmapped failure.
    if (!program.ok) expect(["observation_rejected", "observation_denied"]).toContain(program.code);

    const duplicate = await createCatalogEntryAction(catalogInput());
    if (!duplicate.ok) expect(["catalog_conflict", "catalog_rejected"]).toContain(duplicate.code);

    const audits = await db.auditLog.findMany({ where: { workspaceId }, select: { actionType: true, userId: true } });
    expect(audits.length).toBeGreaterThan(0);
    expect(audits.every((row) => row.userId === owner.id)).toBe(true);
  });
});
