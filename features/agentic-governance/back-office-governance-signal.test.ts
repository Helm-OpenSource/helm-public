import { describe, expect, it } from "vitest";
import {
  BACK_OFFICE_GOVERNANCE_FIXTURES,
  buildBackOfficeGovernanceReadoutPacket,
  evaluateBackOfficeGovernanceSignal,
  runBackOfficeGovernanceEval,
} from "./back-office-governance-signal";

describe("agentic governance back-office signal guard", () => {
  it("accepts process evidence only for review packet attachment", () => {
    const decision = evaluateBackOfficeGovernanceSignal({
      signalId: "process",
      workspaceId: "workspace_agentic_governance_fixture",
      sourceSystem: "salesforce",
      kind: "process_evidence",
      objectRef: { type: "opportunity", id: "opp_redacted" },
      ownerRef: "owner_sales_ops",
      risk: "medium",
      evidenceRefs: ["sf_case_redacted"],
      declaredExternalEffect: "none",
      boundaryDecision: "review_packet_only",
      boundaryNote: "Review packet only; no source-system write.",
    });

    expect(decision.disposition).toBe("accept_for_review_packet");
    expect(decision.mayAttachToReviewPacket).toBe(true);
    expect(decision.officialWriteAllowed).toBe(false);
    expect(decision.reasonCodes).toContain("accepted_process_evidence");
  });

  it("rejects accepted-looking signals without owner or evidence", () => {
    const missingOwner = evaluateBackOfficeGovernanceSignal({
      signalId: "missing-owner",
      workspaceId: "workspace_agentic_governance_fixture",
      sourceSystem: "hubspot",
      kind: "operating_gap",
      ownerRef: "",
      risk: "high",
      evidenceRefs: ["hubspot_redacted"],
      declaredExternalEffect: "none",
      boundaryDecision: "must_push_candidate_only",
      boundaryNote: "Missing owner should reject.",
    });
    const missingEvidence = evaluateBackOfficeGovernanceSignal({
      signalId: "missing-evidence",
      workspaceId: "workspace_agentic_governance_fixture",
      sourceSystem: "hubspot",
      kind: "operating_gap",
      ownerRef: "owner_revops",
      risk: "high",
      evidenceRefs: [],
      declaredExternalEffect: "none",
      boundaryDecision: "must_push_candidate_only",
      boundaryNote: "Missing evidence should reject.",
    });

    expect(missingOwner.disposition).toBe("reject");
    expect(missingOwner.reasonCodes).toContain("missing_owner");
    expect(missingEvidence.disposition).toBe("reject");
    expect(missingEvidence.reasonCodes).toContain("missing_evidence");
  });

  it("quarantines payment, approval and CRM write intents", () => {
    const decision = evaluateBackOfficeGovernanceSignal({
      signalId: "payment",
      workspaceId: "workspace_agentic_governance_fixture",
      sourceSystem: "manual_fixture",
      kind: "pre_approval_reminder",
      objectRef: { type: "invoice", id: "invoice_redacted" },
      ownerRef: "owner_finance",
      risk: "high",
      evidenceRefs: ["invoice_redacted"],
      declaredExternalEffect: "payment_execute",
      boundaryDecision: "review_packet_only",
      boundaryNote: "Payment execution is forbidden.",
    });

    expect(decision.disposition).toBe("quarantine");
    expect(decision.reasonCodes).toContain("execution_intent_forbidden");
    expect(decision.autoSettlementAllowed).toBe(false);
  });

  it("passes the offline back-office fixture gate without granting execution authority", () => {
    const summary = runBackOfficeGovernanceEval();

    expect(summary.totalSignals).toBeGreaterThanOrEqual(7);
    expect(summary.expectedMatches).toBe(summary.totalSignals);
    expect(summary.acceptedWithoutOwner).toBe(0);
    expect(summary.acceptedWithoutEvidence).toBe(0);
    expect(summary.acceptedWithoutBoundaryNote).toBe(0);
    expect(summary.officialWriteAllowed).toBe(0);
    expect(summary.autoApprovalAllowed).toBe(0);
    expect(summary.autoSettlementAllowed).toBe(0);
    expect(summary.silentCrmWriteAllowed).toBe(0);
    expect(summary.readoutItemCount).toBeGreaterThanOrEqual(3);
    expect(summary.readoutItemsWithoutOwner).toBe(0);
    expect(summary.readoutItemsWithoutEvidence).toBe(0);
    expect(summary.readoutExecutionAuthorityLeak).toBe(0);
    expect(summary.readoutAcceptedDecisionMismatch).toBe(0);
    expect(summary.overallPassed).toBe(true);
  });

  it("keeps accepted-signal counters paired after rejected signals are filtered out", () => {
    const summary = runBackOfficeGovernanceEval([
      BACK_OFFICE_GOVERNANCE_FIXTURES[3],
      BACK_OFFICE_GOVERNANCE_FIXTURES[0],
    ]);

    expect(summary.expectedMatches).toBe(2);
    expect(summary.acceptedWithoutOwner).toBe(0);
    expect(summary.acceptedWithoutEvidence).toBe(0);
    expect(summary.acceptedWithoutBoundaryNote).toBe(0);
    expect(summary.readoutItemCount).toBe(1);
    expect(summary.readoutAcceptedDecisionMismatch).toBe(0);
    expect(summary.overallPassed).toBe(true);
  });

  it("keeps readout continuity when mixed-workspace signals are quarantined", () => {
    const summary = runBackOfficeGovernanceEval([
      BACK_OFFICE_GOVERNANCE_FIXTURES[0],
      {
        ...BACK_OFFICE_GOVERNANCE_FIXTURES[1],
        signalId: "bo_cross_workspace",
        workspaceId: "workspace_other",
        expectedDisposition: "quarantine",
      },
    ], "workspace_agentic_governance_fixture");

    expect(summary.expectedMatches).toBe(2);
    expect(summary.decisions[1]?.disposition).toBe("quarantine");
    expect(summary.readoutItemCount).toBe(1);
    expect(summary.readoutAcceptedDecisionMismatch).toBe(0);
    expect(summary.overallPassed).toBe(true);
  });

  it("builds a bounded readout packet without source-system execution authority", () => {
    const packet = buildBackOfficeGovernanceReadoutPacket(BACK_OFFICE_GOVERNANCE_FIXTURES);

    expect(packet.workspaceId).toBe("workspace_agentic_governance_fixture");
    expect(packet.generatedFromSignalCount).toBe(BACK_OFFICE_GOVERNANCE_FIXTURES.length);
    expect(packet.reviewPacketItems).toHaveLength(1);
    expect(packet.mustPushCandidateItems).toHaveLength(1);
    expect(packet.reportReadoutItems).toHaveLength(1);
    expect(packet.rejectedCount).toBe(2);
    expect(packet.quarantinedCount).toBe(2);
    expect(packet.officialWriteAllowed).toBe(0);
    expect(packet.autoApprovalAllowed).toBe(0);
    expect(packet.autoSettlementAllowed).toBe(0);
    expect(packet.silentCrmWriteAllowed).toBe(0);

    for (const item of packet.items) {
      expect(item.ownerRef.trim()).not.toBe("");
      expect(item.evidenceRefs.length).toBeGreaterThan(0);
      expect(item.boundaryNote.trim()).not.toBe("");
      expect(item.actionAuthority).toBe("none");
    }
  });
});
