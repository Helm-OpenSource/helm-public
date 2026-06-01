import { describe, expect, it } from "vitest";
import {
  EXTERNAL_AGENT_ARTIFACT_FIXTURES,
  EXTERNAL_AGENT_INTAKE_WORKSPACE_ID,
} from "./provider-fixtures";
import {
  evaluateExternalAgentArtifact,
  runExternalAgentIntakeEval,
} from "./intake-decision";

describe("external agent intake evaluator", () => {
  it("produces the expected disposition for all fixture cases", () => {
    expect(EXTERNAL_AGENT_ARTIFACT_FIXTURES).toHaveLength(22);

    for (const fixture of EXTERNAL_AGENT_ARTIFACT_FIXTURES) {
      const decision = evaluateExternalAgentArtifact(fixture.artifact, {
        expectedWorkspaceId: EXTERNAL_AGENT_INTAKE_WORKSPACE_ID,
      });

      expect(decision.disposition, fixture.id).toBe(fixture.expectedDisposition);
      for (const reason of fixture.expectedReasonIncludes) {
        expect(decision.reasonCodes, fixture.id).toContain(reason);
      }
      expect(decision.mayCreateMustPushCandidate).toBe(false);
      expect(decision.mayCreateMemoryCandidate).toBe(false);
      expect(decision.reasonCodes).not.toContain("trace_redaction_invalid");
    }
  });

  it("rejects missing required fields before downstream mapping", () => {
    const decision = evaluateExternalAgentArtifact({
      artifactId: "EA-MISSING",
      providerId: "coze_manual",
    });

    expect(decision.disposition).toBe("reject");
    expect(decision.reasonCodes).toContain("missing_required_field");
    expect(decision.mayCreateMustPushCandidate).toBe(false);
    expect(decision.mayCreateMemoryCandidate).toBe(false);
  });

  it("keeps accepted and review-required outputs bounded by a boundary note", () => {
    for (const fixture of EXTERNAL_AGENT_ARTIFACT_FIXTURES) {
      const decision = evaluateExternalAgentArtifact(fixture.artifact, {
        expectedWorkspaceId: EXTERNAL_AGENT_INTAKE_WORKSPACE_ID,
      });

      if (
        decision.disposition === "accept_as_evidence_candidate" ||
        decision.disposition === "accept_as_draft_candidate" ||
        decision.disposition === "review_required"
      ) {
        expect(decision.boundaryNote.trim(), fixture.id).not.toBe("");
      }
    }
  });

  it("passes the offline eval gate metrics", () => {
    const summary = runExternalAgentIntakeEval();

    expect(summary.totalFixtures).toBe(22);
    expect(summary.failedFixtures).toBe(0);
    expect(summary.directMustPushCreated).toBe(0);
    expect(summary.directMemoryCandidateCreated).toBe(0);
    expect(summary.finalRankingInfluencedByExternalAgent).toBe(0);
    expect(summary.acceptedWithoutBoundaryNote).toBe(0);
    expect(summary.acceptedWithUnsupportedPII).toBe(0);
    expect(summary.acceptedWithoutGovernanceTrace).toBe(0);
    expect(summary.traceConflictAccepted).toBe(0);
    expect(summary.connectorPermissionBypassed).toBe(0);
    expect(summary.refusedRetriedOrPromoted).toBe(0);
    expect(summary.overallPassed).toBe(true);
    expect(summary.metrics.every((metric) => metric.passed)).toBe(true);
  });
});
