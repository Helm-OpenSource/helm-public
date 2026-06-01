import { describe, expect, it } from "vitest";
import type { ExternalAgentArtifact } from "./artifact-contract";
import {
  classifyP0Req07Boundary,
  externalAgentMayPromoteTo,
  P0_REQ_07_FORBIDDEN_PROMOTIONS,
} from "./p0-req-07-boundary";

const REFERENCE_TIME_ISO = "2026-05-04T00:00:00.000Z";
const WORKSPACE_ID = "ws-strict-boundary";

function baseArtifact(
  overrides: Partial<ExternalAgentArtifact> = {},
): ExternalAgentArtifact {
  return {
    artifactId: "EA-STRICT-001",
    workspaceId: WORKSPACE_ID,
    providerId: "coze_manual",
    providerArtifactRef: "coze:trace/source-001",
    artifactKind: "evidence_candidate",
    createdAt: "2026-05-01T00:00:00.000Z",
    sourceTimestamp: "2026-04-30T00:00:00.000Z",
    actorRef: "operator:demo",
    objectRef: { type: "opportunity", id: "opp-redacted-alpha" },
    actorVisibleSummary: "redacted",
    rawOutputHash: "sha256:redacted",
    redactionStatus: "redacted",
    providerTraceRefs: ["coze:trace/source-001"],
    governanceTrace: {
      traceId: "coze:trace/source-001",
      source: "coze_manual",
      actorType: "external_agent",
      workspaceId: WORKSPACE_ID,
      objectRef: { type: "opportunity", id: "opp-redacted-alpha" },
      inputEvidenceRefs: ["meeting:redacted-alpha"],
      proposedAction: "attach_as_candidate_evidence_for_human_review",
      outcomeStatus: "completed",
      boundaryDecision: "review_required",
      createdAt: "2026-05-01T00:00:00.000Z",
      redactionStatus: "redacted",
    },
    providerOutcomeStatus: "completed",
    citationsOrEvidenceRefs: ["meeting:redacted-alpha"],
    declaredSideEffects: ["none"],
    providerConfidenceClaim: 0.6,
    contentSummary: "redacted summary",
    contentShape: "text",
    ...overrides,
  };
}

describe("P0-REQ-07 strict boundary classifier", () => {
  it("passes a fully redacted, current, trace-bearing, same-workspace artifact", () => {
    const result = classifyP0Req07Boundary(baseArtifact(), {
      expectedWorkspaceId: WORKSPACE_ID,
      referenceTimeIso: REFERENCE_TIME_ISO,
    });
    expect(result.disposition).toBe("passes_strict_boundary");
    expect(result.reasonCodes).toEqual([]);
    expect(result.missingMetadata).toEqual([]);
  });

  it("quarantines cross-tenant artifacts", () => {
    const result = classifyP0Req07Boundary(
      baseArtifact({ workspaceId: "ws-other" }),
      {
        expectedWorkspaceId: WORKSPACE_ID,
        referenceTimeIso: REFERENCE_TIME_ISO,
      },
    );
    expect(result.disposition).toBe("quarantine");
    expect(result.reasonCodes).toContain("cross_tenant");
  });

  it("quarantines unredacted artifacts (contains_pii or unknown)", () => {
    for (const status of ["contains_pii", "unknown"] as const) {
      const result = classifyP0Req07Boundary(
        baseArtifact({ redactionStatus: status }),
        {
          expectedWorkspaceId: WORKSPACE_ID,
          referenceTimeIso: REFERENCE_TIME_ISO,
        },
      );
      expect(result.disposition).toBe("quarantine");
      expect(result.reasonCodes).toContain("unredacted");
    }
  });

  it("quarantines artifacts with no trace id (no providerTraceRefs and no governanceTrace.traceId)", () => {
    const result = classifyP0Req07Boundary(
      baseArtifact({ providerTraceRefs: [], governanceTrace: undefined }),
      {
        expectedWorkspaceId: WORKSPACE_ID,
        referenceTimeIso: REFERENCE_TIME_ISO,
      },
    );
    expect(result.disposition).toBe("quarantine");
    expect(result.reasonCodes).toContain("no_trace");
    expect(result.missingMetadata).toContain("trace_id");
  });

  it("quarantines stale artifacts older than the threshold", () => {
    const result = classifyP0Req07Boundary(
      baseArtifact({ sourceTimestamp: "2026-01-01T00:00:00.000Z" }),
      {
        expectedWorkspaceId: WORKSPACE_ID,
        referenceTimeIso: REFERENCE_TIME_ISO,
      },
    );
    expect(result.disposition).toBe("quarantine");
    expect(result.reasonCodes).toContain("stale");
  });

  it("flags missing required metadata: provider/source/timestamp/actor/workspace/raw output hash/redaction status/trace id", () => {
    const result = classifyP0Req07Boundary(
      {
        artifactId: "EA-NAKED",
      } as Partial<ExternalAgentArtifact>,
      {
        expectedWorkspaceId: WORKSPACE_ID,
        referenceTimeIso: REFERENCE_TIME_ISO,
      },
    );
    expect(result.disposition).toBe("quarantine");
    expect(result.reasonCodes).toContain("missing_required_metadata");
    expect(result.missingMetadata).toEqual(
      expect.arrayContaining([
        "provider",
        "source",
        "timestamp",
        "actor",
        "workspace",
        "raw_output_hash",
        "redaction_status",
        "trace_id",
      ]),
    );
  });

  it("never permits external agent promotion to Must Push / memory active asset / official write / commitment", () => {
    const result = classifyP0Req07Boundary(baseArtifact(), {
      expectedWorkspaceId: WORKSPACE_ID,
      referenceTimeIso: REFERENCE_TIME_ISO,
    });
    for (const target of P0_REQ_07_FORBIDDEN_PROMOTIONS) {
      expect(externalAgentMayPromoteTo(result, target)).toBe(false);
    }
  });
});
