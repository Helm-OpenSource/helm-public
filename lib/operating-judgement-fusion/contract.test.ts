import { describe, expect, it } from "vitest";

import { validateJudgementPacket } from "../expert-capability/validators";
import {
  assertAdviceOnlyJudgement,
  isOperatingJudgementObjectKind,
  OPERATING_JUDGEMENT_CONFIDENCE_BANDS,
  OPERATING_JUDGEMENT_OBJECT_KINDS,
  OPERATING_JUDGEMENT_SCHEMA_VERSION,
  toExpertOutput,
  type OperatingJudgement,
} from "./contract";

function makeJudgement(overrides: Partial<OperatingJudgement> = {}): OperatingJudgement {
  return {
    schemaVersion: OPERATING_JUDGEMENT_SCHEMA_VERSION,
    judgementId: "judgement-001",
    objectRef: "Deal:deal-17",
    objectKind: "Deal",
    disposition: "prepare_review_packet",
    headline: "Commitment risk rising while pacing slips; review before the next step.",
    commitmentClass: "advice",
    fusedSignalKeys: ["sig-a", "sig-b"],
    contributingFamilies: ["commitment", "risk"],
    evidenceRefs: ["crm-row-17", "meeting-note-05"],
    evidenceCoverage: { provided: 2, required: 3 },
    confidence: { band: "medium", score: 0.62, method: "deterministic_evidence_family_fusion" },
    conflictFlags: [],
    ruleTrace: [{ ruleId: "fuse.family-weight", effect: "risk dominates" }],
    humanReviewerRequired: true,
    forbiddenActionRefs: [],
    boundaryNote: "Advice-only fused judgement; human review required; no execution or writeback.",
    promotionTriggered: false,
    ...overrides,
  };
}

describe("operating-judgement-fusion contract", () => {
  it("exposes a stable schema version and the 6 signal-flow object kinds", () => {
    expect(OPERATING_JUDGEMENT_SCHEMA_VERSION).toBe("helm.operating-judgement-fusion.v1");
    expect([...OPERATING_JUDGEMENT_OBJECT_KINDS]).toEqual([
      "Deal",
      "Account",
      "Contact",
      "Meeting",
      "Commitment",
      "Workspace",
    ]);
    expect([...OPERATING_JUDGEMENT_CONFIDENCE_BANDS]).toEqual([
      "high",
      "medium",
      "low",
      "mixed",
      "unknown",
    ]);
  });

  it("guards object kinds at runtime", () => {
    expect(isOperatingJudgementObjectKind("Deal")).toBe(true);
    expect(isOperatingJudgementObjectKind("Lead")).toBe(false);
    expect(isOperatingJudgementObjectKind(null)).toBe(false);
  });

  it("accepts a well-formed advice-only judgement", () => {
    const result = assertAdviceOnlyJudgement(makeJudgement());
    expect(result).toEqual({ ok: true, errors: [] });
  });

  it.each([
    [
      "non-advice commitment class",
      { commitmentClass: "commitment" as OperatingJudgement["commitmentClass"] },
      "non_advice_commitment_class",
    ],
    [
      "human reviewer not required",
      { humanReviewerRequired: false as unknown as true },
      "human_reviewer_not_required",
    ],
    [
      "promotion triggered",
      { promotionTriggered: true as unknown as false },
      "promotion_triggered_present",
    ],
    [
      "forbidden action refs present",
      { forbiddenActionRefs: ["writeback_crm"] },
      "forbidden_action_refs_present",
    ],
    [
      "write/send/execute ref in evidence",
      { evidenceRefs: ["crm-row-17", "auto-send:queue"] },
      "write_send_execute_ref_present",
    ],
    [
      "action disposition prefix",
      { disposition: "auto_advance_stage" },
      "action_disposition_present",
    ],
    [
      "confidence score out of range",
      {
        confidence: {
          band: "high" as const,
          score: 1.4,
          method: "deterministic_evidence_family_fusion" as const,
        },
      },
      "confidence_score_out_of_range",
    ],
    [
      "non-deterministic confidence method",
      {
        confidence: {
          band: "high" as const,
          score: 0.9,
          method: "llm_ranking" as unknown as "deterministic_evidence_family_fusion",
        },
      },
      "non_deterministic_confidence_method",
    ],
    [
      "invalid object kind",
      { objectKind: "Lead" as unknown as OperatingJudgement["objectKind"] },
      "invalid_object_kind",
    ],
  ])("fails closed on %s", (_label, override, expectedError) => {
    const result = assertAdviceOnlyJudgement(makeJudgement(override));
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(expectedError);
  });

  it("toExpertOutput yields a packet that passes the expert-capability judgement-packet validator", () => {
    const expertOutput = toExpertOutput(makeJudgement());
    expect(expertOutput.expertRevisionId).toBe("judgement-001");
    expect(expertOutput.commitmentClass).toBe("advice");
    // Closed loop: the fused judgement, mapped to ExpertOutput, is a valid advice packet
    // in the existing held-out harness — proving shape compatibility, not a parallel system.
    expect(validateJudgementPacket(expertOutput)).toEqual({ ok: true, errors: [] });
  });
});
