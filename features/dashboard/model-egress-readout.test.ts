import { describe, expect, it } from "vitest";
import {
  buildModelEgressOwnerReadout,
  type ModelEgressDecisionReadRow,
} from "@/features/dashboard/model-egress-readout";

const now = new Date("2026-07-23T16:00:00.000Z");

function decision(
  overrides: Partial<ModelEgressDecisionReadRow> = {},
): ModelEgressDecisionReadRow {
  return {
    id: "route-decision-1",
    taskClass: "summary_briefing",
    sensitivity: "confidential",
    processingDisposition: "remote_projected",
    routeRef: "route:domestic-primary",
    adapterReadinessState: "ready",
    catalogVisibilityState: "listed",
    decision: "allowed",
    reasonCodes: "[]",
    dispatchClaimedAt: null,
    validUntil: new Date("2026-07-23T16:05:00.000Z"),
    createdAt: new Date("2026-07-23T15:59:00.000Z"),
    egressReceipts: [],
    ...overrides,
  };
}

function build(
  overrides: Partial<
    Parameters<typeof buildModelEgressOwnerReadout>[0]
  > = {},
) {
  return buildModelEgressOwnerReadout({
    now,
    metrics: {
      policyTotal: 0,
      activePolicyCount: 0,
      readinessTotal: 0,
      readyReadinessCount: 0,
      rawCredentialViolationCount: 0,
      decisionTotal: 0,
      allowedDecisionCount: 0,
      blockedDecisionCount: 0,
      claimedDispatchCount: 0,
      inDoubtDispatchCount: 0,
    },
    terminalOutcomeCounts: [],
    policies: [],
    readiness: [],
    decisions: [],
    ...overrides,
  });
}

describe("model-egress owner readout", () => {
  it("keeps an empty workspace honest", () => {
    const readout = build();

    expect(readout.posture).toBe("not_configured");
    expect(readout.boundary).toEqual({
      mode: "read_only",
      rawContentVisible: false,
      credentialsVisible: false,
      dispatchAvailable: false,
    });
  });

  it("marks a claimed route without a terminal receipt as in doubt", () => {
    const readout = build({
      metrics: {
        policyTotal: 1,
        activePolicyCount: 1,
        readinessTotal: 1,
        readyReadinessCount: 1,
        rawCredentialViolationCount: 0,
        decisionTotal: 1,
        allowedDecisionCount: 1,
        blockedDecisionCount: 0,
        claimedDispatchCount: 1,
        inDoubtDispatchCount: 1,
      },
      decisions: [decision({ dispatchClaimedAt: now })],
    });

    expect(readout.posture).toBe("attention_required");
    expect(readout.dispatch.inDoubt).toBe(1);
    expect(readout.recentDecisions[0]?.state).toBe("in_doubt");
  });

  it("projects terminal outcomes without exposing provider payloads", () => {
    const readout = build({
      metrics: {
        policyTotal: 1,
        activePolicyCount: 1,
        readinessTotal: 1,
        readyReadinessCount: 1,
        rawCredentialViolationCount: 0,
        decisionTotal: 1,
        allowedDecisionCount: 1,
        blockedDecisionCount: 0,
        claimedDispatchCount: 1,
        inDoubtDispatchCount: 0,
      },
      terminalOutcomeCounts: [
        { outcome: "SUCCESS", _count: { _all: 1 } },
      ],
      decisions: [
        decision({
          decision: "ALLOWED",
          dispatchClaimedAt: now,
          egressReceipts: [
            {
              sequence: 2,
              phase: "terminal",
              outcome: "SUCCESS",
              finishedAt: now,
              latencyMs: 820,
              costBand: "low",
              errorCode: null,
              recordedAt: now,
            },
          ],
        }),
      ],
    });

    expect(readout.posture).toBe("operational");
    expect(readout.dispatch).toMatchObject({
      terminal: 1,
      succeeded: 1,
      failed: 0,
      partial: 0,
      unknown: 0,
    });
    expect(readout.recentDecisions[0]).toMatchObject({
      state: "succeeded",
      outcome: "success",
    });
    const serialized = JSON.stringify(readout);
    expect(serialized).not.toContain("credentialRef");
    expect(serialized).not.toContain("secret:");
    expect(serialized).not.toContain("projectedPayload");
    expect(serialized).not.toContain("providerRequest");
  });

  it("fails closed when readiness includes raw credentials", () => {
    const readout = build({
      metrics: {
        policyTotal: 1,
        activePolicyCount: 1,
        readinessTotal: 1,
        readyReadinessCount: 0,
        rawCredentialViolationCount: 1,
        decisionTotal: 0,
        allowedDecisionCount: 0,
        blockedDecisionCount: 0,
        claimedDispatchCount: 0,
        inDoubtDispatchCount: 0,
      },
      readiness: [
        {
          id: "readiness-1",
          provider: "synthetic-provider",
          modelId: "synthetic-model",
          modelVersion: "synthetic-model-v1",
          adapterKey: "synthetic-adapter",
          deploymentForm: "domestic_cloud",
          jurisdiction: "domestic",
          region: "cn-test-1",
          adapterRegistered: true,
          credentialConfigured: true,
          modelProbeStatus: "READY",
          expiresAt: new Date("2026-07-24T16:00:00.000Z"),
          rawCredentialIncluded: true,
          checkedAt: now,
        },
      ],
    });

    expect(readout.posture).toBe("attention_required");
    expect(readout.readiness.rawCredentialViolations).toBe(1);
    expect(readout.recentReadiness[0]?.state).toBe("unsafe");
  });
});
