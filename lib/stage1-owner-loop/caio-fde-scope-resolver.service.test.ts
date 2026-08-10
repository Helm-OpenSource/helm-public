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
    observedAt: new Date("2026-08-09T23:30:00.001Z"),
    summaryHash: `sha256:${"a".repeat(64)}`,
    completenessPercent: 100,
    freshness: "FRESH",
    outcome: "SUCCESS",
    errorCodes: null,
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
      authorizationRef: "authorization:program-1",
      scopeRefs: JSON.stringify(["opportunity:opportunity-1"]),
    },
    source: {
      id: "source-1",
      workspaceId: "workspace-1",
      programId: "program-1",
      status: "ACTIVE",
      sourceKind: "crm",
      freshnessSlaMinutes: 30,
      authorizationRef: "authorization:program-1",
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
      sourceKind: "crm",
      freshness: "fresh",
    });
  });

  it("recomputes current freshness for a bounded run set", async () => {
    const db = client();
    db.observationSourceRun.findMany.mockResolvedValue([
      observationRun(),
      observationRun({
        id: "run-2",
        sourceId: "source-2",
        observedAt: new Date("2026-08-09T23:29:59.999Z"),
        source: {
          ...observationRun().source,
          id: "source-2",
          freshnessSlaMinutes: 30,
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
        sourceKind: "crm",
        freshness: "stale",
      },
      {
        evidenceRef: "observation-run:run-1",
        sourceKind: "crm",
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
    {
      label: "exact SLA boundary",
      observedAt: "2026-08-09T23:30:00.000Z",
      storedFreshness: "FRESH",
      slaMinutes: 30,
      expected: "stale",
    },
    {
      label: "expired by one millisecond",
      observedAt: "2026-08-09T23:29:59.999Z",
      storedFreshness: "FRESH",
      slaMinutes: 30,
      expected: "stale",
    },
    {
      label: "stored stale",
      observedAt: "2026-08-09T23:59:00.000Z",
      storedFreshness: "STALE",
      slaMinutes: 30,
      expected: "unknown",
    },
    {
      label: "stored unknown",
      observedAt: "2026-08-09T23:59:00.000Z",
      storedFreshness: "UNKNOWN",
      slaMinutes: 30,
      expected: "unknown",
    },
    {
      label: "invalid SLA",
      observedAt: "2026-08-09T23:59:00.000Z",
      storedFreshness: "FRESH",
      slaMinutes: 0,
      expected: "unknown",
    },
  ])(
    "classifies $label freshness",
    async ({ observedAt, storedFreshness, slaMinutes, expected }) => {
      const db = client();
      db.observationSourceRun.findFirst.mockResolvedValue(
        observationRun({
          observedAt: new Date(observedAt),
          freshness: storedFreshness,
          source: {
            ...observationRun().source,
            freshnessSlaMinutes: slaMinutes,
          },
        }),
      );

      await expect(
        resolveCaioFdeObservationEvidence({
          client: db as never,
          workspaceId: "workspace-1",
          evidenceRef: "observation-run:run-1",
          portfolioRef: "opportunity:opportunity-1",
          now: NOW,
        }),
      ).resolves.toMatchObject({ freshness: expected });
    },
  );

  it("rejects evidence observed in the future", async () => {
    const db = client();
    db.observationSourceRun.findFirst.mockResolvedValue(
      observationRun({
        observedAt: new Date("2026-08-10T00:00:00.001Z"),
      }),
    );

    await expect(
      resolveCaioFdeObservationEvidence({
        client: db as never,
        workspaceId: "workspace-1",
        evidenceRef: "observation-run:run-1",
        portfolioRef: "opportunity:opportunity-1",
        now: NOW,
      }),
    ).rejects.toMatchObject({
      reasons: expect.arrayContaining([
        "observation_evidence_terminal_state_invalid",
      ]),
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

  it("reconstructs and validates the complete canonical observation receipt", async () => {
    const invalidRuns = [
      observationRun({ summaryHash: null }),
      observationRun({ completenessPercent: null }),
      observationRun({ completenessPercent: 101 }),
      observationRun({ freshness: "UNKNOWN_VALUE" }),
      observationRun({ errorCodes: "not-json" }),
      observationRun({ status: "SUCCEEDED", outcome: "FAILURE" }),
      observationRun({
        status: "FAILED",
        outcome: "FAILURE",
        summaryHash: null,
        completenessPercent: null,
        errorCodes: JSON.stringify([]),
      }),
      observationRun({
        source: {
          ...observationRun().source,
          authorizationRef: "authorization:other-program",
        },
      }),
      observationRun({ id: "run-other" }),
    ];

    for (const run of invalidRuns) {
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

  it("accepts a canonical failed observation only with failure identity and error codes", async () => {
    const db = client();
    db.observationSourceRun.findFirst.mockResolvedValue(
      observationRun({
        status: "FAILED",
        outcome: "FAILURE",
        summaryHash: null,
        completenessPercent: null,
        freshness: "UNKNOWN",
        errorCodes: JSON.stringify(["connector_timeout"]),
      }),
    );

    await expect(
      resolveCaioFdeObservationEvidence({
        client: db as never,
        workspaceId: "workspace-1",
        evidenceRef: "observation-run:run-1",
        portfolioRef: "opportunity:opportunity-1",
        expectedBusinessResult: "failure",
        now: NOW,
      }),
    ).resolves.toMatchObject({
      runId: "run-1",
      outcome: "FAILURE",
    });
  });
});
