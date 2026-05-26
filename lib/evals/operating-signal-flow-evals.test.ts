import { describe, expect, it } from "vitest";

import {
  evaluateOperatingSignalFlowCase,
  runOperatingSignalFlowEval,
} from "@/lib/evals/operating-signal-flow-evals";
import type {
  OperatingSignalFlowCase,
  OperatingSignalFlowFixturePack,
} from "@/lib/operating-signal-flow/contract";
import { selectHighestPressurePath } from "@/lib/operating-signal-flow/projection";

const BASE_CASE: OperatingSignalFlowCase = {
  id: "OSF-UNIT-BOUNDARY",
  description: "Boundary incident wins highest-pressure selection.",
  expectedSelectedPathSignalKey: "boundary:test",
  expectedDataPosture: "current_window",
  expectedBoundaryIncidentCount: 1,
  expectedBlockedCount: 1,
  expectedReviewRequiredCount: 1,
  snapshot: {
    workspaceId: "workspace_demo",
    dataPosture: "current_window",
    window: "24h",
    generatedAt: "2026-05-17T12:00:00+08:00",
    judgementHeadline: "阻塞 · 越权动作已停住",
    boundaryStatementVisible: true,
    fixtureBannerVisible: false,
    animationPolicy: "affected_paths_static",
    selectedPathSignalKey: "boundary:test",
    aiWorkPosture: {
      deterministicCoveragePercent: 100,
      explanationCoveragePercent: 80,
      evidenceCoveragePercent: 100,
      boundaryStoppedCount: 1,
    },
    nodes: [
      {
        id: "gate:test",
        workspaceId: "workspace_demo",
        kind: "gate",
        lane: "blocked",
        label: "Boundary gate",
        status: "blocked",
        signalCount: 1,
        blockedCount: 1,
        boundaryIncidentCount: 1,
        pendingReviewCount: 1,
        signalFamilyMix: [{ family: "boundary_attempt", count: 1 }],
        latestEventAt: "2026-05-17T11:00:00+08:00",
        lastBlockerAt: "2026-05-17T11:00:00+08:00",
        staleness: "fresh",
        connectorPosture: "n/a",
        boundaryNote: "只读视图。",
      },
      {
        id: "review:test",
        workspaceId: "workspace_demo",
        kind: "review",
        lane: "blocked",
        label: "Boundary review",
        status: "blocked",
        signalCount: 1,
        blockedCount: 1,
        boundaryIncidentCount: 1,
        pendingReviewCount: 1,
        signalFamilyMix: [{ family: "boundary_attempt", count: 1 }],
        latestEventAt: "2026-05-17T11:00:00+08:00",
        lastBlockerAt: "2026-05-17T11:00:00+08:00",
        staleness: "fresh",
        connectorPosture: "n/a",
        boundaryNote: "非自动执行。",
      },
    ],
    edges: [
      {
        id: "edge:test",
        workspaceId: "workspace_demo",
        fromNodeId: "gate:test",
        toNodeId: "review:test",
        direction: "forward",
        signalCount: 1,
        pendingCount: 1,
        throughputPerHour: 0,
        medianLatencySeconds: null,
        flowPosture: "stalled",
        lastEventAt: "2026-05-17T11:00:00+08:00",
        oldestPendingSince: "2026-05-17T11:00:00+08:00",
        blockedCount: 1,
        blockedReasonsBreakdown: [{ reason: "boundary_blocked", count: 1 }],
        sweepEligible: false,
        boundaryCounter: 1,
        evidenceCoveragePercent: 100,
        reviewRequiredCount: 1,
      },
    ],
    events: [
      {
        id: "event:test",
        workspaceId: "workspace_demo",
        signalKey: "boundary:test",
        traceId: "trace:test",
        previousEventId: null,
        causedByEventId: null,
        sourceKind: "internal_capture",
        sourceRef: "capture:test",
        signalFamily: "boundary_attempt",
        objectRef: "Workspace:demo",
        objectKind: "Workspace",
        transitionFrom: "GATED",
        transitionTo: "BOUNDARY_BLOCKED",
        triggeredBy: "deterministic_rule",
        ruleId: "authority-boundary-gate",
        actorRef: null,
        currentBlockerType: "boundary_blocked",
        blockerSince: "2026-05-17T11:00:00+08:00",
        awaitingReceiptSince: null,
        evidenceCoverage: { provided: 2, required: 2 },
        confidenceBand: "high",
        confidenceSource: "deterministic",
        redactionStatus: "alias_only",
        crossTenantProjection: false,
        dedupeKey: null,
        mergedIntoSignalKey: null,
        supersededBySignalKey: null,
        revocationReason: null,
        boundaryCheckResult: "blocked",
        policyVersion: "osf-p1",
        latencyFromPriorMs: null,
        occurredAt: "2026-05-17T11:00:00+08:00",
        evidenceRefs: ["capture:test"],
        reviewerRequired: true,
        allowedNextActions: ["/approvals"],
        forbiddenNextActions: ["external_send_not_allowed"],
        boundaryNote: "保持 blocked 并准备复核材料。",
      },
    ],
  },
};

const TARGETS: OperatingSignalFlowFixturePack["targets"] = {
  minimumTotalCases: 1,
  minimumSignalFamilyCount: 1,
  minimumBlockerCoverageCount: 1,
  minimumRequiredStateCoverageCount: 1,
  maximumCrossTenantProjectionCount: 0,
  maximumLlmTransitionCount: 0,
  maximumLlmRankingCount: 0,
  maximumRawPayloadEchoCount: 0,
  maximumAuthorityLeakCount: 0,
  maximumInvalidRouteCount: 0,
};

describe("operating signal flow eval", () => {
  it("passes the checked-in Phase 0/1 fixture pack", () => {
    const summary = runOperatingSignalFlowEval();

    expect(summary.passed).toBe(true);
    expect(summary.totalCases).toBe(15);
    expect(summary.signalFamilyCount).toBe(7);
    expect(summary.blockerCoverageCount).toBe(10);
    expect(summary.requiredStateCoverageCount).toBe(22);
    expect(summary.crossTenantProjectionCount).toBe(0);
    expect(summary.llmTransitionCount).toBe(0);
    expect(summary.llmRankingCount).toBe(0);
    expect(summary.rawPayloadEchoCount).toBe(0);
    expect(summary.authorityLeakCount).toBe(0);
    expect(summary.invalidRouteCount).toBe(0);
  });

  it("selects boundary incidents before older blockers", () => {
    const selected = selectHighestPressurePath({
      ...BASE_CASE.snapshot,
      selectedPathSignalKey: "boundary:test",
      events: [
        {
          ...BASE_CASE.snapshot.events[0],
          signalKey: "older-blocker:test",
          boundaryCheckResult: "pass",
          currentBlockerType: "missing_evidence",
          blockerSince: "2026-05-17T10:00:00+08:00",
          transitionTo: "MISSING_EVIDENCE",
          ruleId: "evidence-minimum-gate",
        },
        BASE_CASE.snapshot.events[0],
      ],
    });

    expect(selected).toBe("boundary:test");
  });

  it("uses stable signal-key tie-breaks when pressure timestamps are equal", () => {
    const selected = selectHighestPressurePath({
      ...BASE_CASE.snapshot,
      selectedPathSignalKey: "alpha:blocker",
      events: [
        {
          ...BASE_CASE.snapshot.events[0],
          id: "event:zeta",
          signalKey: "zeta:blocker",
          boundaryCheckResult: "pass",
          currentBlockerType: "missing_evidence",
          blockerSince: "2026-05-17T10:00:00+08:00",
          transitionTo: "MISSING_EVIDENCE",
          ruleId: "evidence-minimum-gate",
        },
        {
          ...BASE_CASE.snapshot.events[0],
          id: "event:alpha",
          signalKey: "alpha:blocker",
          boundaryCheckResult: "pass",
          currentBlockerType: "missing_owner",
          blockerSince: "2026-05-17T10:00:00+08:00",
          transitionTo: "MISSING_OWNER",
          ruleId: "owner-required-gate",
        },
      ],
    });

    expect(selected).toBe("alpha:blocker");
  });

  it("enforces fixture posture banner and disabled animation", () => {
    const result = evaluateOperatingSignalFlowCase({
      ...BASE_CASE,
      expectedDataPosture: "fixture",
      snapshot: {
        ...BASE_CASE.snapshot,
        dataPosture: "fixture",
        fixtureBannerVisible: false,
        animationPolicy: "enabled",
      },
    });

    expect(result.failures).toContain("fixture_banner_missing");
    expect(result.failures).toContain("fixture_animation_not_disabled");
  });

  it("rejects LLM-driven state transitions and LLM final ranking", () => {
    const result = evaluateOperatingSignalFlowCase({
      ...BASE_CASE,
      snapshot: {
        ...BASE_CASE.snapshot,
        events: [
          {
            ...BASE_CASE.snapshot.events[0],
            triggeredBy: "llm",
            confidenceSource: "llm_ranking",
          },
        ],
      },
    });

    expect(result.llmTransitionCount).toBe(1);
    expect(result.llmRankingCount).toBe(1);
    expect(result.failures).toContain("llm_triggered_transition_present");
    expect(result.failures).toContain("llm_final_ranking_present");
  });

  it("detects raw payload echoes and authority leaks", () => {
    const result = evaluateOperatingSignalFlowCase({
      ...BASE_CASE,
      snapshot: {
        ...BASE_CASE.snapshot,
        events: [
          {
            ...BASE_CASE.snapshot.events[0],
            boundaryNote: "raw payload was requested for official write",
          },
        ],
      },
    });

    expect(result.rawPayloadEchoCount).toBe(1);
    expect(result.authorityLeakCount).toBe(1);
    expect(result.failures).toContain("raw_payload_echo_present");
    expect(result.failures).toContain("authority_leak_present");
  });

  it("detects forbidden boolean authority grants by key", () => {
    const eventWithAuthorityGrant = {
      ...BASE_CASE.snapshot.events[0],
      autoApprove: true,
    };
    const result = evaluateOperatingSignalFlowCase({
      ...BASE_CASE,
      snapshot: {
        ...BASE_CASE.snapshot,
        events: [eventWithAuthorityGrant],
      },
    });

    expect(result.authorityLeakCount).toBe(1);
    expect(result.failures).toContain("authority_leak_present");
  });

  it("allows English judgement prefixes for English deployment fixtures", () => {
    const result = evaluateOperatingSignalFlowCase({
      ...BASE_CASE,
      snapshot: {
        ...BASE_CASE.snapshot,
        judgementHeadline: "Blocked - human review required before any action.",
      },
    });

    expect(result.failures).not.toContain("judgement_headline_prefix_invalid");
  });

  it("requires merge and supersede pointers to resolve inside the snapshot", () => {
    const result = evaluateOperatingSignalFlowCase({
      ...BASE_CASE,
      snapshot: {
        ...BASE_CASE.snapshot,
        events: [
          {
            ...BASE_CASE.snapshot.events[0],
            mergedIntoSignalKey: "missing:signal",
            transitionTo: "MERGED",
          },
        ],
      },
    });

    expect(result.failures).toContain(
      "missing_signal_pointer:event:test:mergedIntoSignalKey",
    );
  });

  it("fails summary targets when a fixture introduces cross-workspace projection", () => {
    const brokenPack: OperatingSignalFlowFixturePack = {
      version: "broken",
      status: "offline_fixture_only",
      boundary: "test",
      entryPoints: {
        happyPathCaseId: BASE_CASE.id,
      },
      targets: TARGETS,
      cases: [
        {
          ...BASE_CASE,
          snapshot: {
            ...BASE_CASE.snapshot,
            nodes: [
              {
                ...BASE_CASE.snapshot.nodes[0],
                workspaceId: "other_workspace",
              },
            ],
            events: [
              {
                ...BASE_CASE.snapshot.events[0],
                crossTenantProjection: true,
              },
            ],
          },
        },
      ],
    };

    const summary = runOperatingSignalFlowEval(brokenPack);

    expect(summary.passed).toBe(false);
    expect(summary.crossTenantProjectionCount).toBe(1);
    expect(summary.failures).toContainEqual({
      caseId: "OSF-UNIT-BOUNDARY",
      reason: "workspace_scope_not_single",
    });
    expect(summary.failures).toContainEqual({
      caseId: "OSF-UNIT-BOUNDARY",
      reason: "cross_tenant_projection_present",
    });
  });
});
