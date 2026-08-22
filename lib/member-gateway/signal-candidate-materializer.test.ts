import { describe, expect, it } from "vitest";

import { detectPIIInOutput } from "@/lib/llm/output-pii-scrubber";
import { memberAuthoredCandidateText } from "@/lib/member-gateway/signal-candidate-materializer";
import type { MemberWorkSignalCandidateArtifact } from "@/lib/member-gateway/signal-candidate";

function makeArtifact(
  overrides: Partial<MemberWorkSignalCandidateArtifact> = {},
): MemberWorkSignalCandidateArtifact {
  return {
    schemaVersion: 1,
    taint: "untrusted",
    evaluationUseProhibited: true,
    promotionAllowed: false,
    signalReceiptRef: "receipt-1",
    workspaceRef: "workspace-1",
    memberRef: "member-1",
    deviceRegistrationRef: "device-1",
    clientId: "workbuddy-desktop",
    policyRef: "signal-policy-1",
    policyVersion: 1,
    kind: "progress",
    projectedSummary: "跟进节奏正常",
    projectedDetail: "本周两次触达。",
    linkEvidence: [],
    relatedEvidenceRefs: ["evidence-1"],
    objectAnchor: { resolved: false, objectRef: "case-42", objectVersion: 1 },
    submittedAt: "2026-08-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("memberAuthoredCandidateText", () => {
  it("excludes system identifiers so id-shaped digit runs can never trip the PII scan", () => {
    // A generated workspace/member id can legitimately contain an
    // eleven-digit run shaped like a Chinese mobile number. That must
    // never poison the candidate: identifiers are not member-authored
    // text and are excluded from the scanned surface.
    const text = memberAuthoredCandidateText(
      makeArtifact({
        workspaceRef: "ws-13800138000",
        memberRef: "member-13800138000",
        signalReceiptRef: "receipt-13800138000",
      }),
    );
    expect(text).not.toContain("13800138000");
    expect(text).not.toContain("member-13800138000");
    expect(detectPIIInOutput(text).detected).toBe(false);
  });

  it("still scans member-authored surfaces: body, evidence refs, and link tokens", () => {
    const bodyHit = memberAuthoredCandidateText(
      makeArtifact({ projectedDetail: "回电 13800138000 联系" }),
    );
    expect(detectPIIInOutput(bodyHit).detected).toBe(true);

    const refHit = memberAuthoredCandidateText(
      makeArtifact({ relatedEvidenceRefs: ["evidence-13800138000"] }),
    );
    expect(detectPIIInOutput(refHit).detected).toBe(true);
  });
});
