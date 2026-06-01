import { describe, expect, it } from "vitest";

import {
  buildPackARepositoryIntegrationReadout,
  evaluatePackACase,
  runPackAPilotReadinessEval,
  scorePackACandidate,
  type PackAPilotReadinessCase,
} from "./pack-a-pilot-readiness";

function baseCase(overrides: Partial<PackAPilotReadinessCase> = {}): PackAPilotReadinessCase {
  return {
    id: "TEST",
    alias: "SaaS-Test",
    segment: "b2b_saas",
    expectedGate: "scope_call_ready",
    scorecard: {
      pain: 22,
      businessOwner: 18,
      dataAvailability: 18,
      proofValue: 12,
      paidPilotWillingness: 13,
      boundaryFit: 5,
    },
    signals: {
      failureEventCount: 3,
      budgetOwnerKnown: true,
      ownerLevel: "sales_vp",
      dataAccessTier: "one_week_redacted_samples",
      proofPosture: "anonymized_public",
      paidPilotAnchor: "50000",
      boundaryPosture: "review_first",
      phase3RuntimeAdoptionClaimed: false,
    },
    week0: {
      contractSigned: false,
      dpaSigned: false,
      dataChecklistConfirmed: true,
      workspaceReady: false,
      weeklyReviewScheduled: true,
      customerOwnerAssigned: true,
      founderDay1Available: true,
      gtmOperatorAssigned: true,
      implementationLeadAssigned: true,
    },
    ...overrides,
  };
}

const TARGETS = {
  scopeCallScore: 80,
  minimumPilotScore: 75,
  candidatePoolScore: 70,
  nurtureScore: 60,
  minimumFailureEvents: 3,
  requiredSkills: [
    "A1-meeting-followup",
    "A2-priority-customers",
    "A3-manager-attention",
    "A4-cs-handoff-pack",
  ],
};

describe("Pack A pilot readiness eval", () => {
  it("passes the bundled alias-only market and Week 0 readiness fixtures", () => {
    const summary = runPackAPilotReadinessEval();

    expect(summary.passed).toBe(true);
    expect(summary.totalCases).toBe(5);
    expect(summary.gateMatches).toBe(5);
    expect(summary.week0ReadyCases).toBe(1);
    expect(summary.scopeCallReadyCases).toBe(1);
    expect(summary.noGoCases).toBe(2);
  });

  it("scores the Pack A OPC scorecard using the documented 100-point weights", () => {
    expect(scorePackACandidate(baseCase())).toBe(88);
  });

  it("allows scope call for strong candidates but blocks Week 0 until contract, DPA, workspace, and roles are ready", () => {
    const result = evaluatePackACase(baseCase(), TARGETS);

    expect(result.actualGate).toBe("scope_call_ready");
    expect(result.scopeCallEligible).toBe(true);
    expect(result.week0StartAllowed).toBe(false);
    expect(result.blockedReasons).toContain("week0_blocker:contract_not_signed");
    expect(result.blockedReasons).toContain("week0_blocker:dpa_not_signed");
    expect(result.blockedReasons).toContain("week0_blocker:workspace_not_ready");
  });

  it("opens Week 0 only when legal, data, owner, founder, GTM, and implementation gates are all closed", () => {
    const result = evaluatePackACase(
      baseCase({
        expectedGate: "week0_ready",
        week0: {
          contractSigned: true,
          dpaSigned: true,
          dataChecklistConfirmed: true,
          workspaceReady: true,
          weeklyReviewScheduled: true,
          customerOwnerAssigned: true,
          founderDay1Available: true,
          gtmOperatorAssigned: true,
          implementationLeadAssigned: true,
        },
      }),
      TARGETS,
    );

    expect(result.actualGate).toBe("week0_ready");
    expect(result.week0StartAllowed).toBe(true);
    expect(result.blockedReasons).toEqual([]);
  });

  it("rejects candidates that demand auto-send, auto CRM write, or free-only pilot", () => {
    const result = evaluatePackACase(
      baseCase({
        expectedGate: "no_go",
        signals: {
          ...baseCase().signals,
          budgetOwnerKnown: false,
          paidPilotAnchor: "free_only",
          boundaryPosture: "demands_auto_send_or_crm_write",
        },
      }),
      TARGETS,
    );

    expect(result.actualGate).toBe("no_go");
    expect(result.blockedReasons).toContain("no_go:paid_pilot_not_validated");
    expect(result.blockedReasons).toContain("no_go:boundary_mismatch");
  });

  it("rejects Phase 3 production runtime overclaim even when the candidate otherwise looks strong", () => {
    const result = evaluatePackACase(
      baseCase({
        expectedGate: "no_go",
        signals: {
          ...baseCase().signals,
          phase3RuntimeAdoptionClaimed: true,
        },
      }),
      TARGETS,
    );

    expect(result.actualGate).toBe("no_go");
    expect(result.blockedReasons).toContain("no_go:phase3_runtime_overclaim");
  });

  it("keeps hard safety counters at zero for every case", () => {
    const summary = runPackAPilotReadinessEval();

    for (const result of summary.caseResults) {
      expect(result.hardSafety).toEqual({
        autoOutreachCreated: 0,
        autoSendCreated: 0,
        crmWriteCreated: 0,
        priceCommitmentCreated: 0,
        publicClaimPublished: 0,
        llmFinalRankingUsed: 0,
      });
    }
  });

  it("integrates all four Pack A skills with config, SKILL.md, fixtures, seed playbooks, thresholds, and templates", () => {
    const integration = buildPackARepositoryIntegrationReadout();

    expect(integration.passed).toBe(true);
    expect(integration.requiredSkillCount).toBe(4);
    expect(integration.integratedSkillCount).toBe(4);
    expect(integration.rows.map((row) => row.skillId)).toEqual(TARGETS.requiredSkills);
  });
});
