// lib/member-gateway/signal-candidate.test.ts
import { describe, expect, it } from "vitest";

import {
  MEMBER_SIGNAL_CANDIDATE_ARTIFACT_TYPE,
  MEMBER_SIGNAL_CANDIDATE_REVIEW_POSTURE,
  computeMemberWorkSignalCandidateContentHash,
  projectSignalToCandidate,
  validateMemberWorkSignalCandidateArtifact,
} from "@/lib/member-gateway/signal-candidate";
import type {
  MemberSignalCandidateObjectAnchor,
  MemberSignalCandidateReceiptInput,
  MemberWorkSignalCandidateArtifact,
  ProjectSignalToCandidateInput,
} from "@/lib/member-gateway/signal-candidate";

function makeReceipt(
  overrides: Partial<MemberSignalCandidateReceiptInput> = {},
): MemberSignalCandidateReceiptInput {
  return {
    signalReceiptRef: "receipt-1",
    workspaceRef: "workspace-1",
    memberRef: "member-1",
    deviceRegistrationRef: "device-1",
    clientId: "workbuddy-desktop",
    policyRef: "signal-policy-1",
    policyVersion: 1,
    kind: "progress",
    submittedAt: "2026-08-19T00:00:00Z",
    ...overrides,
  };
}

const resolvedAnchor: MemberSignalCandidateObjectAnchor = {
  resolved: true,
  objectType: "Case",
  objectId: "case-42",
};

const unresolvedAnchor: MemberSignalCandidateObjectAnchor = {
  resolved: false,
  objectRef: "opaque-ref-1",
  objectVersion: 3,
};

function makeProjectionInput(
  overrides: Partial<ProjectSignalToCandidateInput> = {},
): ProjectSignalToCandidateInput {
  return {
    receipt: makeReceipt(),
    payload: {
      summary: "客户已确认还款意向",
      detail: "电话沟通 20 分钟,确认周五前处理。",
      relatedEvidenceRefs: ["evidence-1"],
    },
    objectAnchor: resolvedAnchor,
    ...overrides,
  };
}

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
    projectedSummary: "客户已确认还款意向",
    projectedDetail: "电话沟通 20 分钟,确认周五前处理。",
    linkEvidence: [],
    relatedEvidenceRefs: ["evidence-1"],
    objectAnchor: resolvedAnchor,
    submittedAt: "2026-08-19T00:00:00Z",
    ...overrides,
  };
}

describe("frozen literals", () => {
  it("freezes the artifact type and review posture strings", () => {
    expect(MEMBER_SIGNAL_CANDIDATE_ARTIFACT_TYPE).toBe(
      "member_work_signal_candidate.json",
    );
    expect(MEMBER_SIGNAL_CANDIDATE_REVIEW_POSTURE).toBe(
      "member_work_signal_candidate_review_required",
    );
  });
});

describe("projectSignalToCandidate", () => {
  it("passes text through unchanged when there are no links", () => {
    const artifact = projectSignalToCandidate(makeProjectionInput());
    expect(artifact.projectedSummary).toBe("客户已确认还款意向");
    expect(artifact.projectedDetail).toBe(
      "电话沟通 20 分钟,确认周五前处理。",
    );
    expect(artifact.linkEvidence).toEqual([]);
  });

  it("replaces a mixed-case HTTPS link in the summary with a numbered token", () => {
    const artifact = projectSignalToCandidate(
      makeProjectionInput({
        payload: {
          summary: "详情见 HTTPS://Example.com/case/42",
          detail: "无更多信息。",
          relatedEvidenceRefs: [],
        },
      }),
    );
    expect(artifact.projectedSummary).toBe("详情见 [link-evidence:1]");
    expect(artifact.projectedDetail).toBe("无更多信息。");
    expect(artifact.linkEvidence).toEqual([
      {
        token: "[link-evidence:1]",
        evidenceRef: "link-evidence:receipt-1:1",
      },
    ]);
  });

  it("numbers multiple links with a single running counter across summary and detail", () => {
    const artifact = projectSignalToCandidate(
      makeProjectionInput({
        payload: {
          summary:
            "参考 http://a.example.com/1 和 https://b.example.com/2 两条链接",
          detail: "补充材料在 HTTP://c.example.com/3",
          relatedEvidenceRefs: [],
        },
      }),
    );
    expect(artifact.projectedSummary).toBe(
      "参考 [link-evidence:1] 和 [link-evidence:2] 两条链接",
    );
    expect(artifact.projectedDetail).toBe("补充材料在 [link-evidence:3]");
    expect(artifact.linkEvidence).toEqual([
      {
        token: "[link-evidence:1]",
        evidenceRef: "link-evidence:receipt-1:1",
      },
      {
        token: "[link-evidence:2]",
        evidenceRef: "link-evidence:receipt-1:2",
      },
      {
        token: "[link-evidence:3]",
        evidenceRef: "link-evidence:receipt-1:3",
      },
    ]);
  });

  it("carries the signalReceiptRef into every linkEvidence evidenceRef", () => {
    const artifact = projectSignalToCandidate(
      makeProjectionInput({
        receipt: makeReceipt({ signalReceiptRef: "receipt-xyz" }),
        payload: {
          summary: "见 https://example.com/a",
          detail: "见 https://example.com/b",
          relatedEvidenceRefs: [],
        },
      }),
    );
    expect(
      artifact.linkEvidence.every((entry) =>
        entry.evidenceRef.startsWith("link-evidence:receipt-xyz:"),
      ),
    ).toBe(true);
  });

  it("carries through refs, kind, and the object anchor verbatim", () => {
    const artifact = projectSignalToCandidate(
      makeProjectionInput({
        receipt: makeReceipt({ kind: "blocker" }),
        objectAnchor: unresolvedAnchor,
      }),
    );
    expect(artifact.schemaVersion).toBe(1);
    expect(artifact.taint).toBe("untrusted");
    expect(artifact.evaluationUseProhibited).toBe(true);
    expect(artifact.promotionAllowed).toBe(false);
    expect(artifact.kind).toBe("blocker");
    expect(artifact.objectAnchor).toEqual(unresolvedAnchor);
    expect(artifact.relatedEvidenceRefs).toEqual(["evidence-1"]);
  });
});

describe("validateMemberWorkSignalCandidateArtifact", () => {
  it("accepts a well-formed resolved-anchor artifact", () => {
    const result = validateMemberWorkSignalCandidateArtifact(makeArtifact());
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("accepts a well-formed unresolved-anchor artifact", () => {
    const result = validateMemberWorkSignalCandidateArtifact(
      makeArtifact({ objectAnchor: unresolvedAnchor }),
    );
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("accepts an artifact whose body carries a linkEvidence token", () => {
    const result = validateMemberWorkSignalCandidateArtifact(
      makeArtifact({
        projectedSummary: "详情见 [link-evidence:1]",
        linkEvidence: [
          {
            token: "[link-evidence:1]",
            evidenceRef: "link-evidence:receipt-1:1",
          },
        ],
      }),
    );
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("rejects a schema version other than 1", () => {
    const result = validateMemberWorkSignalCandidateArtifact(
      makeArtifact({ schemaVersion: 2 as 1 }),
    );
    expect(result.errors).toContain("candidate_schema_version_invalid");
  });

  it("rejects a missing/altered taint", () => {
    const result = validateMemberWorkSignalCandidateArtifact(
      makeArtifact({ taint: "trusted" as "untrusted" }),
    );
    expect(result.errors).toContain("candidate_taint_missing");
  });

  it("rejects flipped evaluationUseProhibited/promotionAllowed literals", () => {
    const result = validateMemberWorkSignalCandidateArtifact(
      makeArtifact({
        evaluationUseProhibited: false as true,
        promotionAllowed: true as false,
      }),
    );
    expect(result.errors).toContain("candidate_literals_invalid");
  });

  it("rejects a blank required ref", () => {
    const result = validateMemberWorkSignalCandidateArtifact(
      makeArtifact({ workspaceRef: "  " }),
    );
    expect(result.errors).toContain("candidate_ref_missing");
  });

  it("rejects an invalid policy version", () => {
    const result = validateMemberWorkSignalCandidateArtifact(
      makeArtifact({ policyVersion: 0 }),
    );
    expect(result.errors).toContain("candidate_policy_version_invalid");
  });

  it("rejects an unknown kind", () => {
    const result = validateMemberWorkSignalCandidateArtifact(
      makeArtifact({ kind: "unknown_kind" as "progress" }),
    );
    expect(result.errors).toContain("candidate_kind_unknown");
  });

  it("rejects a missing summary", () => {
    const result = validateMemberWorkSignalCandidateArtifact(
      makeArtifact({ projectedSummary: "" }),
    );
    expect(result.errors).toContain("candidate_summary_missing");
  });

  it("rejects a link-bearing body", () => {
    const result = validateMemberWorkSignalCandidateArtifact(
      makeArtifact({ projectedDetail: "见 https://example.com/leak" }),
    );
    expect(result.errors).toContain("candidate_body_unsafe_text");
  });

  it("rejects a credential-style body via the persistable-text pattern", () => {
    const result = validateMemberWorkSignalCandidateArtifact(
      makeArtifact({ projectedDetail: "api_key: sk-abc123" }),
    );
    expect(result.errors).toContain("candidate_body_unsafe_text");
  });

  it("rejects linkEvidence with a blank token", () => {
    const result = validateMemberWorkSignalCandidateArtifact(
      makeArtifact({
        linkEvidence: [{ token: "", evidenceRef: "link-evidence:receipt-1:1" }],
      }),
    );
    expect(result.errors).toContain("candidate_link_evidence_invalid");
  });

  it("rejects linkEvidence with a blank evidenceRef", () => {
    const result = validateMemberWorkSignalCandidateArtifact(
      makeArtifact({
        linkEvidence: [{ token: "[link-evidence:1]", evidenceRef: "" }],
      }),
    );
    expect(result.errors).toContain("candidate_link_evidence_invalid");
  });

  it("rejects linkEvidence whose token does not appear in the body", () => {
    const result = validateMemberWorkSignalCandidateArtifact(
      makeArtifact({
        linkEvidence: [
          {
            token: "[link-evidence:9]",
            evidenceRef: "link-evidence:receipt-1:9",
          },
        ],
      }),
    );
    expect(result.errors).toContain("candidate_link_evidence_invalid");
  });

  it("rejects a blank relatedEvidenceRefs entry", () => {
    const result = validateMemberWorkSignalCandidateArtifact(
      makeArtifact({ relatedEvidenceRefs: ["evidence-1", "  "] }),
    );
    expect(result.errors).toContain("candidate_evidence_ref_invalid");
  });

  it("rejects a resolved anchor with a blank objectType/objectId", () => {
    const result = validateMemberWorkSignalCandidateArtifact(
      makeArtifact({
        objectAnchor: { resolved: true, objectType: "", objectId: "case-1" },
      }),
    );
    expect(result.errors).toContain("candidate_anchor_invalid");
  });

  it("rejects an unresolved anchor with a blank objectRef", () => {
    const result = validateMemberWorkSignalCandidateArtifact(
      makeArtifact({
        objectAnchor: { resolved: false, objectRef: "", objectVersion: 1 },
      }),
    );
    expect(result.errors).toContain("candidate_anchor_invalid");
  });

  it("rejects an unresolved anchor with objectVersion < 1", () => {
    const result = validateMemberWorkSignalCandidateArtifact(
      makeArtifact({
        objectAnchor: {
          resolved: false,
          objectRef: "opaque-ref-1",
          objectVersion: 0,
        },
      }),
    );
    expect(result.errors).toContain("candidate_anchor_invalid");
  });

  it("rejects an invalid submittedAt instant", () => {
    const result = validateMemberWorkSignalCandidateArtifact(
      makeArtifact({ submittedAt: "not-an-instant" }),
    );
    expect(result.errors).toContain("candidate_instant_invalid");
  });

  it("rejects a projected artifact whose text contains a member-crafted fake link-evidence token", () => {
    // One real URL yields exactly one real linkEvidence entry
    // ("[link-evidence:1]"); the member's own text also hand-crafts a
    // second, never-projected "[link-evidence:9]" string. The body now
    // contains TWO "[link-evidence:" occurrences but only ONE linkEvidence
    // entry — the spoofed token must be rejected, not silently accepted.
    const artifact = projectSignalToCandidate(
      makeProjectionInput({
        payload: {
          summary: "看似证据 [link-evidence:9] 但见 https://example.com/real",
          detail: "无更多信息。",
          relatedEvidenceRefs: [],
        },
      }),
    );
    expect(artifact.linkEvidence).toHaveLength(1);
    const result = validateMemberWorkSignalCandidateArtifact(artifact);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("candidate_link_evidence_invalid");
  });
});

describe("computeMemberWorkSignalCandidateContentHash", () => {
  it("is deterministic for the same content", () => {
    const artifact = makeArtifact();
    const hash1 = computeMemberWorkSignalCandidateContentHash(artifact);
    const hash2 = computeMemberWorkSignalCandidateContentHash({ ...artifact });
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^sha256:/);
  });

  it("is sensitive to content changes", () => {
    const artifact = makeArtifact();
    const changed = makeArtifact({ projectedSummary: "changed summary" });
    expect(
      computeMemberWorkSignalCandidateContentHash(artifact),
    ).not.toBe(computeMemberWorkSignalCandidateContentHash(changed));
  });

  it("is insensitive to field order (canonical JSON)", () => {
    const artifact = makeArtifact();
    const reordered: MemberWorkSignalCandidateArtifact = {
      submittedAt: artifact.submittedAt,
      objectAnchor: artifact.objectAnchor,
      relatedEvidenceRefs: artifact.relatedEvidenceRefs,
      linkEvidence: artifact.linkEvidence,
      projectedDetail: artifact.projectedDetail,
      projectedSummary: artifact.projectedSummary,
      kind: artifact.kind,
      policyVersion: artifact.policyVersion,
      policyRef: artifact.policyRef,
      clientId: artifact.clientId,
      deviceRegistrationRef: artifact.deviceRegistrationRef,
      memberRef: artifact.memberRef,
      workspaceRef: artifact.workspaceRef,
      signalReceiptRef: artifact.signalReceiptRef,
      promotionAllowed: artifact.promotionAllowed,
      evaluationUseProhibited: artifact.evaluationUseProhibited,
      taint: artifact.taint,
      schemaVersion: artifact.schemaVersion,
    };
    expect(
      computeMemberWorkSignalCandidateContentHash(artifact),
    ).toBe(computeMemberWorkSignalCandidateContentHash(reordered));
  });
});
