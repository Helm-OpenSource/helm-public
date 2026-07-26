import { describe, expect, it } from "vitest";
import { evaluateExternalAgentArtifact } from "@/features/external-agent-intake/intake-decision";
import { buildQoderWorkExternalAgentArtifact } from "./artifact-adapter";

const IDENTITY = {
  workspaceId: "workspace-server-derived",
  userId: "user-server-derived",
  connectionId: "connection-server-derived",
  deviceRef: "device:synthetic-1",
} as const;

describe("QoderWork artifact adapter", () => {
  it("derives workspace and actor from the authenticated connection", () => {
    const artifact = buildQoderWorkExternalAgentArtifact({
      identity: IDENTITY,
      toolName: "propose_evidence_manifest",
      receivedAt: "2026-07-20T09:00:00.000Z",
      proposal: {
        schemaVersion: "1.0",
        correlationRef: "corr_artifact_001",
        idempotencyKey: "idem_artifact_001",
        sourceProgramRef: "program:synthetic-owner-loop",
        observationSourceRef: "source_synthetic_meeting_001",
        sourceRef: "opaque:meeting:sha256:5a61",
        sourceKind: "meeting_note",
        objectRef: { type: "opportunity", id: "opp_synthetic_001" },
        observedAt: "2026-07-20T08:00:00.000Z",
        dataClassification: "internal",
        redactionStatus: "redacted",
        summary: "Synthetic evidence summary",
        evidenceRefs: ["evidence:meeting:synthetic:001"],
        contentHash: `sha256:${"a".repeat(64)}`,
      },
    });

    expect(artifact.workspaceId).toBe("workspace-server-derived");
    expect(artifact.providerId).toBe("qoderwork_cn");
    expect(artifact.providerArtifactRef).toBe("opaque:meeting:sha256:5a61");
    expect(artifact.actorRef).toBe("external-agent-connection:connection-server-derived");
    expect(artifact.declaredSideEffects).toEqual(["none"]);
    expect(artifact.governanceTrace?.workspaceId).toBe("workspace-server-derived");
    expect(JSON.stringify(artifact)).not.toContain("/Users/");

    const decision = evaluateExternalAgentArtifact(artifact, {
      expectedWorkspaceId: "workspace-server-derived",
      referenceTimeIso: "2026-07-20T09:00:00.000Z",
    });
    expect(decision.disposition).toBe("review_required");
    expect(decision.mayCreateMemoryCandidate).toBe(false);
    expect(decision.mayCreateMustPushCandidate).toBe(false);
  });

  it("marks drafts as created locally but never sent", () => {
    const artifact = buildQoderWorkExternalAgentArtifact({
      identity: IDENTITY,
      toolName: "propose_draft_artifact",
      receivedAt: "2026-07-20T09:00:00.000Z",
      proposal: {
        schemaVersion: "1.0",
        correlationRef: "corr_draft_001",
        idempotencyKey: "idem_draft_001",
        workPacketRef: "work-packet:synthetic-1",
        objectRef: { type: "opportunity", id: "opp_synthetic_001" },
        draftKind: "customer_follow_up",
        summary: "Synthetic follow-up draft for human review",
        evidenceRefs: ["evidence:meeting:synthetic:001"],
        contentHash: `sha256:${"a".repeat(64)}`,
        redactionStatus: "redacted",
      },
    });

    expect(artifact.artifactKind).toBe("draft_candidate");
    expect(artifact.declaredSideEffects).toEqual(["draft_created"]);
    expect(artifact.contentSummary).not.toMatch(/already sent|已发送/i);
  });
});
