import { describe, expect, it, vi } from "vitest";

import {
  CaioFdeScopeResolutionError,
  resolveCaioFdeObservationEvidence,
  resolveCaioFdeObservationEvidenceBatch,
  resolveCaioFdePortfolioScope,
} from "./caio-fde-scope-resolver.service";

const NOW = new Date("2026-08-10T00:00:00.000Z");

function client() {
  return {
    opportunity: { findFirst: vi.fn() },
    observationSourceRun: { findFirst: vi.fn(), findMany: vi.fn() },
  };
}

function observationRun(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-1",
    workspaceId: "workspace-1",
    programId: "program-1",
    sourceId: "source-1",
    authorizationVersion: 3,
    windowStart: new Date("2026-08-09T22:00:00.000Z"),
    windowEnd: new Date("2026-08-10T00:30:00.000Z"),
    status: "SUCCEEDED",
    observedAt: new Date("2026-08-09T23:30:00.000Z"),
    freshness: "FRESH",
    outcome: "SUCCESS",
    evidenceRefs: JSON.stringify([
      "opportunity:opportunity-1",
      "decision-record:decision-1",
      "action-item:action-1",
    ]),
    program: {
      id: "program-1",
      workspaceId: "workspace-1",
      status: "ACTIVE",
      revokedAt: null,
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      expiresAt: new Date("2026-09-01T00:00:00.000Z"),
      authorizationVersion: 3,
      scopeRefs: JSON.stringify(["opportunity:opportunity-1"]),
    },
    source: {
      id: "source-1",
      workspaceId: "workspace-1",
      programId: "program-1",
      status: "ACTIVE",
      sourceKind: "portfolio_scope",
    },
    ...overrides,
  };
}

describe("CAIO Pro FDE workspace scope resolver", () => {
  it("resolves only the existing workspace-scoped Opportunity Portfolio", async () => {
    const db = client();
    db.opportunity.findFirst.mockResolvedValue({
      id: "opportunity-1",
      workspaceId: "workspace-1",
    });

    await expect(
      resolveCaioFdePortfolioScope({
        client: db as never,
        workspaceId: "workspace-1",
        workspaceRef: "workspace:workspace-1",
        portfolioRef: "opportunity:opportunity-1",
      }),
    ).resolves.toEqual({
      workspaceRef: "workspace:workspace-1",
      portfolioRef: "opportunity:opportunity-1",
      opportunityId: "opportunity-1",
    });
    expect(db.opportunity.findFirst).toHaveBeenCalledWith({
      where: { id: "opportunity-1", workspaceId: "workspace-1" },
      select: { id: true, workspaceId: true },
    });
  });

  it("rejects a missing or cross-workspace Portfolio", async () => {
    const db = client();
    db.opportunity.findFirst.mockResolvedValue(null);

    await expect(
      resolveCaioFdePortfolioScope({
        client: db as never,
        workspaceId: "workspace-1",
        workspaceRef: "workspace:workspace-1",
        portfolioRef: "opportunity:other-workspace-opportunity",
      }),
    ).rejects.toMatchObject({ reasons: ["workspace_portfolio_not_found"] });
  });

  it("resolves a terminal authorized observation bound to the Portfolio and work objects", async () => {
    const db = client();
    db.observationSourceRun.findFirst.mockResolvedValue(observationRun());

    await expect(
      resolveCaioFdeObservationEvidence({
        client: db as never,
        workspaceId: "workspace-1",
        evidenceRef: "observation-run:run-1",
        portfolioRef: "opportunity:opportunity-1",
        requiredBindingRefs: [
          "decision-record:decision-1",
          "action-item:action-1",
        ],
        expectedBusinessResult: "success",
        now: NOW,
      }),
    ).resolves.toMatchObject({
      runId: "run-1",
      evidenceRef: "observation-run:run-1",
      outcome: "SUCCESS",
      sourceKind: "portfolio_scope",
      freshness: "fresh",
    });
  });

  it("derives canonical evidence kinds and freshness for a bounded run set", async () => {
    const db = client();
    db.observationSourceRun.findMany.mockResolvedValue([
      observationRun(),
      observationRun({
        id: "run-2",
        sourceId: "source-2",
        freshness: "STALE",
        source: {
          ...observationRun().source,
          id: "source-2",
          sourceKind: "intake_quality",
        },
      }),
    ]);

    await expect(
      resolveCaioFdeObservationEvidenceBatch({
        client: db as never,
        workspaceId: "workspace-1",
        evidenceRefs: ["observation-run:run-2", "observation-run:run-1"],
        portfolioRef: "opportunity:opportunity-1",
        now: NOW,
      }),
    ).resolves.toMatchObject([
      {
        evidenceRef: "observation-run:run-2",
        sourceKind: "intake_quality",
        freshness: "stale",
      },
      {
        evidenceRef: "observation-run:run-1",
        sourceKind: "portfolio_scope",
        freshness: "fresh",
      },
    ]);
    expect(db.observationSourceRun.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["run-2", "run-1"] },
        workspaceId: "workspace-1",
      },
      include: { program: true, source: true },
    });
  });

  it.each([
    [
      observationRun({
        source: { ...observationRun().source, sourceKind: "Portfolio Scope" },
      }),
      "observation_evidence_source_kind_invalid",
    ],
    [
      observationRun({ freshness: "RECENT" }),
      "observation_evidence_freshness_invalid",
    ],
  ])("rejects invalid canonical evidence metadata", async (run, reason) => {
    const db = client();
    db.observationSourceRun.findFirst.mockResolvedValue(run);

    await expect(
      resolveCaioFdeObservationEvidence({
        client: db as never,
        workspaceId: "workspace-1",
        evidenceRef: "observation-run:run-1",
        portfolioRef: "opportunity:opportunity-1",
        now: NOW,
      }),
    ).rejects.toMatchObject({ reasons: [reason] });
  });

  it("fails closed for revoked, expired, stale-version or non-terminal evidence", async () => {
    const cases = [
      observationRun({
        program: {
          ...observationRun().program,
          revokedAt: new Date("2026-08-09T23:00:00.000Z"),
        },
      }),
      observationRun({
        program: {
          ...observationRun().program,
          expiresAt: new Date("2026-08-09T23:59:59.000Z"),
        },
      }),
      observationRun({ authorizationVersion: 2 }),
      observationRun({ status: "RUNNING", observedAt: null }),
    ];

    for (const run of cases) {
      const db = client();
      db.observationSourceRun.findFirst.mockResolvedValue(run);
      await expect(
        resolveCaioFdeObservationEvidence({
          client: db as never,
          workspaceId: "workspace-1",
          evidenceRef: "observation-run:run-1",
          portfolioRef: "opportunity:opportunity-1",
          now: NOW,
        }),
      ).rejects.toBeInstanceOf(CaioFdeScopeResolutionError);
    }
  });

  it("rejects Portfolio, work-object and canonical result mismatches", async () => {
    const db = client();
    db.observationSourceRun.findFirst.mockResolvedValue(observationRun());

    await expect(
      resolveCaioFdeObservationEvidence({
        client: db as never,
        workspaceId: "workspace-1",
        evidenceRef: "observation-run:run-1",
        portfolioRef: "opportunity:opportunity-2",
        requiredBindingRefs: ["approval-task:approval-1"],
        expectedBusinessResult: "failure",
        now: NOW,
      }),
    ).rejects.toMatchObject({
      reasons: expect.arrayContaining([
        "observation_evidence_portfolio_mismatch",
        "observation_evidence_binding_mismatch",
        "observation_evidence_outcome_mismatch",
      ]),
    });
  });
});
