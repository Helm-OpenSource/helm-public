import { describe, expect, it } from "vitest";

import { sha256 } from "@/lib/expert-capability/hashing";
import { syntheticEvent } from "@/lib/operating-judgement-fusion/fixtures";
import { adaptOperatingSignalFlowEvent } from "@/lib/operating-harness/legacy-adapter";
import {
  computeBoundaryCounts,
  computeOperatingHarnessQualityMetrics,
} from "@/lib/operating-harness/metrics";
import { projectOperatingSignalState } from "@/lib/operating-harness/state-projector";
import {
  syntheticBusinessObjectAlias,
  syntheticEvalCasePromotion,
  syntheticEvidenceRef,
  syntheticFeedbackRecord,
  syntheticJudgementPacket,
  syntheticSignalEvent,
} from "./fixtures";
import { validateSignalEvent } from "./validators";

const LEGACY_CAPTURED_AT = "2026-06-17T00:05:00.000Z";

function syntheticWorkspaceBinding(
  overrides: Partial<{
    legacyWorkspaceId: string;
    tenantScopeRef: string;
    sourceEnvelopeRef: string;
  }> = {},
) {
  return {
    legacyWorkspaceId: "ws-1",
    tenantScopeRef: "tenant:synthetic-1",
    sourceEnvelopeRef: "source-envelope:synthetic-17",
    ...overrides,
  };
}

describe("operating harness derived state", () => {
  it("derives state deterministically from canonical object presence", () => {
    const input = {
      signalEvent: syntheticSignalEvent(),
      evidenceRefs: [syntheticEvidenceRef()],
      businessObjectAlias: syntheticBusinessObjectAlias(),
      judgementPacket: syntheticJudgementPacket(),
      feedbackRecord: syntheticFeedbackRecord(),
      evalCasePromotion: syntheticEvalCasePromotion(),
    };

    const first = projectOperatingSignalState(input);
    const replay = projectOperatingSignalState(structuredClone(input));

    expect(first).toEqual(replay);
    expect(first.state).toBe("LEARNING_CANDIDATE");
  });

  it("derives missing evidence and unresolved alias without reading legacy state", () => {
    expect(
      projectOperatingSignalState({
        signalEvent: syntheticSignalEvent({ evidenceRefs: [] }),
        evidenceRefs: [],
        businessObjectAlias: null,
        judgementPacket: null,
        feedbackRecord: null,
        evalCasePromotion: null,
      }).state,
    ).toBe("MISSING_EVIDENCE");

    expect(
      projectOperatingSignalState({
        signalEvent: syntheticSignalEvent({ businessObjectAliasRef: null }),
        evidenceRefs: [syntheticEvidenceRef()],
        businessObjectAlias: null,
        judgementPacket: null,
        feedbackRecord: null,
        evalCasePromotion: null,
      }).state,
    ).toBe("UNRESOLVED_SOURCE");
  });

  it("derives linked, review-pending, and human-decided states from object presence", () => {
    const base = {
      signalEvent: syntheticSignalEvent(),
      evidenceRefs: [syntheticEvidenceRef()],
      businessObjectAlias: syntheticBusinessObjectAlias(),
      evalCasePromotion: null,
    };

    expect(
      projectOperatingSignalState({
        ...base,
        judgementPacket: null,
        feedbackRecord: null,
      }).state,
    ).toBe("LINKED");
    expect(
      projectOperatingSignalState({
        ...base,
        judgementPacket: syntheticJudgementPacket(),
        feedbackRecord: null,
      }).state,
    ).toBe("REVIEW_PENDING");
    expect(
      projectOperatingSignalState({
        ...base,
        judgementPacket: syntheticJudgementPacket(),
        feedbackRecord: syntheticFeedbackRecord(),
      }).state,
    ).toBe("HUMAN_DECIDED");
  });

  it("quarantines invalid promotion and feedback-to-packet bindings", () => {
    const projection = projectOperatingSignalState({
      signalEvent: syntheticSignalEvent(),
      evidenceRefs: [syntheticEvidenceRef()],
      businessObjectAlias: syntheticBusinessObjectAlias(),
      judgementPacket: syntheticJudgementPacket(),
      feedbackRecord: syntheticFeedbackRecord({ targetPacketHash: sha256("another packet") }),
      evalCasePromotion: syntheticEvalCasePromotion({
        publicEligible: false,
        quarantineReason: "manual_review",
      }),
    });

    expect(projection.state).toBe("QUARANTINED");
    expect(projection.reasons).toEqual(
      expect.arrayContaining(["feedback_packet_hash_mismatch", "eval_case_not_public_eligible"]),
    );
  });

  it("quarantines cross-tenant evidence and orphaned review artifacts", () => {
    const crossTenant = projectOperatingSignalState({
      signalEvent: syntheticSignalEvent(),
      evidenceRefs: [syntheticEvidenceRef({ tenantScopeRef: "tenant:synthetic-2" })],
      businessObjectAlias: syntheticBusinessObjectAlias(),
      judgementPacket: null,
      feedbackRecord: null,
      evalCasePromotion: null,
    });
    expect(crossTenant.state).toBe("QUARANTINED");
    expect(crossTenant.reasons).toContain(
      "evidence_tenant_scope_mismatch:evidence:crm-row-17",
    );

    const orphaned = projectOperatingSignalState({
      signalEvent: syntheticSignalEvent(),
      evidenceRefs: [syntheticEvidenceRef()],
      businessObjectAlias: syntheticBusinessObjectAlias(),
      judgementPacket: null,
      feedbackRecord: syntheticFeedbackRecord(),
      evalCasePromotion: null,
    });
    expect(orphaned.state).toBe("QUARANTINED");
    expect(orphaned.reasons).toContain("review_artifact_without_judgement");
  });

  it("quarantines a cross-tenant alias and promotion without feedback", () => {
    const crossTenantAlias = projectOperatingSignalState({
      signalEvent: syntheticSignalEvent(),
      evidenceRefs: [syntheticEvidenceRef()],
      businessObjectAlias: syntheticBusinessObjectAlias({
        tenantScopeRef: "tenant:synthetic-2",
      }),
      judgementPacket: null,
      feedbackRecord: null,
      evalCasePromotion: null,
    });
    expect(crossTenantAlias.state).toBe("QUARANTINED");
    expect(crossTenantAlias.reasons).toContain(
      "business_object_alias_tenant_scope_mismatch",
    );

    const orphanPromotion = projectOperatingSignalState({
      signalEvent: syntheticSignalEvent(),
      evidenceRefs: [syntheticEvidenceRef()],
      businessObjectAlias: syntheticBusinessObjectAlias(),
      judgementPacket: syntheticJudgementPacket(),
      feedbackRecord: null,
      evalCasePromotion: syntheticEvalCasePromotion(),
    });
    expect(orphanPromotion.state).toBe("QUARANTINED");
    expect(orphanPromotion.reasons).toContain("promotion_without_feedback");
  });

  it("does not promote defer feedback into a learning candidate", () => {
    const projection = projectOperatingSignalState({
      signalEvent: syntheticSignalEvent(),
      evidenceRefs: [syntheticEvidenceRef()],
      businessObjectAlias: syntheticBusinessObjectAlias(),
      judgementPacket: syntheticJudgementPacket(),
      feedbackRecord: syntheticFeedbackRecord({ correctionType: "defer" }),
      evalCasePromotion: syntheticEvalCasePromotion(),
    });

    expect(projection.state).toBe("QUARANTINED");
    expect(projection.reasons).toContain("feedback_not_eval_eligible:defer");
  });

  it("keeps deferred feedback review-pending when no promotion was attempted", () => {
    const projection = projectOperatingSignalState({
      signalEvent: syntheticSignalEvent(),
      evidenceRefs: [syntheticEvidenceRef()],
      businessObjectAlias: syntheticBusinessObjectAlias(),
      judgementPacket: syntheticJudgementPacket(),
      feedbackRecord: syntheticFeedbackRecord({ correctionType: "defer" }),
      evalCasePromotion: null,
    });

    expect(projection.state).toBe("REVIEW_PENDING");
    expect(projection.reasons).toContain("human_review_deferred");
  });

  it("quarantines a restamped evidence receipt that conflicts with the signal root", () => {
    const projection = projectOperatingSignalState({
      signalEvent: syntheticSignalEvent(),
      evidenceRefs: [
        syntheticEvidenceRef({
          sourceSnapshotHash: sha256("different but internally valid snapshot"),
        }),
      ],
      businessObjectAlias: syntheticBusinessObjectAlias(),
      judgementPacket: null,
      feedbackRecord: null,
      evalCasePromotion: null,
    });

    expect(projection.state).toBe("QUARANTINED");
    expect(projection.reasons).toContain("signal_evidence_root_hash_mismatch");
  });

  it("quarantines duplicate supplied evidence receipts", () => {
    const evidence = syntheticEvidenceRef();
    const projection = projectOperatingSignalState({
      signalEvent: syntheticSignalEvent(),
      evidenceRefs: [evidence, structuredClone(evidence)],
      businessObjectAlias: syntheticBusinessObjectAlias(),
      judgementPacket: null,
      feedbackRecord: null,
      evalCasePromotion: null,
    });

    expect(projection.state).toBe("QUARANTINED");
    expect(projection.reasons).toContain(
      "duplicate_supplied_evidence_ref:evidence:crm-row-17",
    );
  });

  it("quarantines downstream artifacts created before evidence or object linking is ready", () => {
    const beforeEvidence = projectOperatingSignalState({
      signalEvent: syntheticSignalEvent({ evidenceRefs: ["evidence:missing"] }),
      evidenceRefs: [],
      businessObjectAlias: syntheticBusinessObjectAlias(),
      judgementPacket: syntheticJudgementPacket(),
      feedbackRecord: null,
      evalCasePromotion: null,
    });
    expect(beforeEvidence.state).toBe("QUARANTINED");
    expect(beforeEvidence.reasons).toContain("downstream_artifact_before_evidence_ready");

    const beforeLink = projectOperatingSignalState({
      signalEvent: syntheticSignalEvent({ businessObjectAliasRef: null }),
      evidenceRefs: [syntheticEvidenceRef()],
      businessObjectAlias: null,
      judgementPacket: syntheticJudgementPacket(),
      feedbackRecord: null,
      evalCasePromotion: null,
    });
    expect(beforeLink.state).toBe("QUARANTINED");
    expect(beforeLink.reasons).toContain(
      "downstream_artifact_before_business_object_link",
    );
  });

  it("does not report a missing feedback error when no promotion was attempted", () => {
    const projection = projectOperatingSignalState({
      signalEvent: syntheticSignalEvent(),
      evidenceRefs: [syntheticEvidenceRef()],
      businessObjectAlias: syntheticBusinessObjectAlias(),
      judgementPacket: syntheticJudgementPacket({
        signalEventRefs: ["signal:another-event"],
      }),
      feedbackRecord: null,
      evalCasePromotion: null,
    });

    expect(projection.state).toBe("QUARANTINED");
    expect(projection.reasons).toContain("judgement_signal_ref_mismatch");
    expect(projection.reasons).not.toContain("promotion_without_feedback");
  });

  it("rejects judgement evidence that is not attached to the signal", () => {
    const projection = projectOperatingSignalState({
      signalEvent: syntheticSignalEvent(),
      evidenceRefs: [
        syntheticEvidenceRef(),
        syntheticEvidenceRef({ evidenceRef: "evidence:unattached" }),
      ],
      businessObjectAlias: syntheticBusinessObjectAlias(),
      judgementPacket: syntheticJudgementPacket({
        evidenceRefs: ["evidence:unattached"],
      }),
      feedbackRecord: null,
      evalCasePromotion: null,
    });

    expect(projection.state).toBe("QUARANTINED");
    expect(projection.reasons).toContain(
      "judgement_evidence_ref_not_attached_to_signal:evidence:unattached",
    );
  });

  it("rejects duplicate signal evidence references", () => {
    const validation = validateSignalEvent(
      syntheticSignalEvent({
        evidenceRefs: ["evidence:crm-row-17", "evidence:crm-row-17"],
      }),
    );

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("duplicate_signal_evidence_ref");
  });

  it("pins alias, judgement, feedback, and promotion relationship mismatch reasons", () => {
    const base = {
      signalEvent: syntheticSignalEvent(),
      evidenceRefs: [syntheticEvidenceRef()],
      businessObjectAlias: syntheticBusinessObjectAlias(),
      judgementPacket: syntheticJudgementPacket(),
      feedbackRecord: syntheticFeedbackRecord(),
      evalCasePromotion: syntheticEvalCasePromotion(),
    };
    const cases = [
      {
        input: {
          ...base,
          businessObjectAlias: syntheticBusinessObjectAlias({ aliasRef: "object:other" }),
        },
        reason: "business_object_alias_ref_mismatch",
      },
      {
        input: {
          ...base,
          judgementPacket: syntheticJudgementPacket({
            businessObjectAliasRef: "object:other",
          }),
        },
        reason: "judgement_business_object_alias_mismatch",
      },
      {
        input: {
          ...base,
          feedbackRecord: syntheticFeedbackRecord({ caseId: "signal:other" }),
        },
        reason: "feedback_signal_case_mismatch",
      },
      {
        input: {
          ...base,
          evalCasePromotion: syntheticEvalCasePromotion({ sourceCaseId: "signal:other" }),
        },
        reason: "promotion_signal_case_mismatch",
      },
    ];

    for (const { input, reason } of cases) {
      const projection = projectOperatingSignalState(input);
      expect(projection.state).toBe("QUARANTINED");
      expect(projection.reasons).toContain(reason);
    }
  });
});

describe("operating harness legacy adapter", () => {
  it("maps legacy flow input without copying its lifecycle state", () => {
    const legacy = syntheticEvent({
      transitionFrom: "LINKED",
      transitionTo: "JUDGED",
      currentBlockerType: "review_backlog",
      evidenceRefs: ["evidence:crm-row-17"],
    });

    const adapted = adaptOperatingSignalFlowEvent({
      event: legacy,
      workspaceBinding: syntheticWorkspaceBinding(),
      capturedAt: LEGACY_CAPTURED_AT,
      evidenceRefs: [syntheticEvidenceRef()],
      businessObjectAlias: syntheticBusinessObjectAlias({
        sourceObjectAliasRefs: ["Deal:deal-17"],
      }),
    });

    expect(validateSignalEvent(adapted.signalEvent).ok).toBe(true);
    expect(adapted.signalEvent).not.toHaveProperty("transitionFrom");
    expect(adapted.signalEvent).not.toHaveProperty("transitionTo");
    expect(adapted.signalEvent).not.toHaveProperty("currentBlockerType");
    expect(adapted.signalEvent.observedAt).toBe(legacy.occurredAt);
    expect(adapted.signalEvent.capturedAt).toBe(LEGACY_CAPTURED_AT);
    expect(adapted.legacyWorkspaceBinding).toEqual(syntheticWorkspaceBinding());
    expect(adapted.ignoredLegacyState).toEqual({
      transitionFrom: "LINKED",
      transitionTo: "JUDGED",
      currentBlockerType: "review_backlog",
    });
  });

  it("fails closed when a referenced evidence snapshot is not supplied", () => {
    expect(() =>
      adaptOperatingSignalFlowEvent({
        event: syntheticEvent({ evidenceRefs: ["evidence:missing"] }),
        workspaceBinding: syntheticWorkspaceBinding(),
        capturedAt: LEGACY_CAPTURED_AT,
        evidenceRefs: [],
        businessObjectAlias: syntheticBusinessObjectAlias(),
      }),
    ).toThrow("missing_canonical_evidence_ref:evidence:missing");
  });

  it("fails closed on cross-tenant evidence or a mismatched legacy object alias", () => {
    const legacy = syntheticEvent({ evidenceRefs: ["evidence:crm-row-17"] });

    expect(() =>
      adaptOperatingSignalFlowEvent({
        event: legacy,
        workspaceBinding: syntheticWorkspaceBinding(),
        capturedAt: LEGACY_CAPTURED_AT,
        evidenceRefs: [syntheticEvidenceRef({ tenantScopeRef: "tenant:synthetic-2" })],
        businessObjectAlias: syntheticBusinessObjectAlias({
          sourceObjectAliasRefs: ["Deal:deal-17"],
        }),
      }),
    ).toThrow("evidence_tenant_scope_mismatch:evidence:crm-row-17");

    expect(() =>
      adaptOperatingSignalFlowEvent({
        event: legacy,
        workspaceBinding: syntheticWorkspaceBinding(),
        capturedAt: LEGACY_CAPTURED_AT,
        evidenceRefs: [syntheticEvidenceRef()],
        businessObjectAlias: syntheticBusinessObjectAlias(),
      }),
    ).toThrow("legacy_object_alias_mismatch:Deal:deal-17");
  });

  it("fails closed on workspace-binding mismatch and unsafe legacy boundaries", () => {
    const alias = syntheticBusinessObjectAlias({
      sourceObjectAliasRefs: ["Deal:deal-17"],
    });

    expect(() =>
      adaptOperatingSignalFlowEvent({
        event: syntheticEvent({ evidenceRefs: ["evidence:crm-row-17"] }),
        workspaceBinding: syntheticWorkspaceBinding({ legacyWorkspaceId: "ws-2" }),
        capturedAt: LEGACY_CAPTURED_AT,
        evidenceRefs: [syntheticEvidenceRef()],
        businessObjectAlias: alias,
      }),
    ).toThrow("legacy_workspace_binding_mismatch:ws-1");

    const boundaryInput = {
      workspaceBinding: syntheticWorkspaceBinding(),
      capturedAt: LEGACY_CAPTURED_AT,
      evidenceRefs: [syntheticEvidenceRef({ evidenceRef: "crm-row-17" })],
      businessObjectAlias: alias,
    };
    expect(() =>
      adaptOperatingSignalFlowEvent({
        ...boundaryInput,
        event: syntheticEvent({ redactionStatus: "raw_blocked" }),
      }),
    ).toThrow("raw_blocked_legacy_signal_forbidden");
    expect(() =>
      adaptOperatingSignalFlowEvent({
        ...boundaryInput,
        event: syntheticEvent({ crossTenantProjection: true }),
      }),
    ).toThrow("cross_tenant_legacy_signal_forbidden");
    expect(() =>
      adaptOperatingSignalFlowEvent({
        ...boundaryInput,
        event: syntheticEvent(),
        capturedAt: "2026-06-16T23:59:59.000Z",
      }),
    ).toThrow("legacy_signal_captured_before_observed");
  });

  it("fails closed on cross-tenant aliases and missing or mismatched object kinds", () => {
    const legacy = syntheticEvent({ evidenceRefs: ["evidence:crm-row-17"] });
    const base = {
      event: legacy,
      workspaceBinding: syntheticWorkspaceBinding(),
      capturedAt: LEGACY_CAPTURED_AT,
      evidenceRefs: [syntheticEvidenceRef()],
    };

    expect(() =>
      adaptOperatingSignalFlowEvent({
        ...base,
        businessObjectAlias: syntheticBusinessObjectAlias({
          tenantScopeRef: "tenant:synthetic-2",
          sourceObjectAliasRefs: ["Deal:deal-17"],
        }),
      }),
    ).toThrow("business_object_alias_tenant_scope_mismatch");

    expect(() =>
      adaptOperatingSignalFlowEvent({ ...base, businessObjectAlias: null }),
    ).toThrow("legacy_object_requires_business_object_alias");

    expect(() =>
      adaptOperatingSignalFlowEvent({
        ...base,
        businessObjectAlias: syntheticBusinessObjectAlias({
          objectKind: "account",
          sourceObjectAliasRefs: ["Deal:deal-17"],
        }),
      }),
    ).toThrow("legacy_object_kind_mismatch:Deal");
  });
});

describe("operating harness quality metrics", () => {
  it("separates blocked boundary attempts from escaped incidents", () => {
    expect(computeBoundaryCounts(["none", "blocked_attempt", "escaped_incident"])).toEqual({
      boundaryAttemptCount: 2,
      boundaryIncidentCount: 1,
    });
    expect(computeBoundaryCounts(["blocked_attempt"])).toEqual({
      boundaryAttemptCount: 1,
      boundaryIncidentCount: 0,
    });
  });

  it("rejects unknown boundary outcomes and internally inconsistent counts", () => {
    expect(() => computeBoundaryCounts(["unknown" as never])).toThrow(
      "invalid_boundary_outcome:unknown",
    );
    expect(() =>
      computeOperatingHarnessQualityMetrics({
        expectedRelevantSignalCount: 1,
        matchedRelevantSignalCount: 2,
        acceptedSignalCount: 2,
        requiredEvidenceCount: 1,
        independentlySupportedEvidenceCount: 1,
        requiredReviewCount: 1,
        completedReviewCount: 1,
        boundaryOutcomes: [],
        candidateHeldoutScore: 0.8,
        baselineHeldoutScore: 0.7,
        eligibleEditRejectFeedbackCount: 1,
        promotedEvalCaseCount: 1,
      }),
    ).toThrow("matched_relevant_signal_count_exceeds_expected");
  });

  it("computes the seven canonical metrics without an aggregate vanity score", () => {
    const report = computeOperatingHarnessQualityMetrics({
      expectedRelevantSignalCount: 10,
      matchedRelevantSignalCount: 8,
      acceptedSignalCount: 9,
      requiredEvidenceCount: 20,
      independentlySupportedEvidenceCount: 18,
      requiredReviewCount: 8,
      completedReviewCount: 8,
      boundaryOutcomes: ["none", "blocked_attempt"],
      candidateHeldoutScore: 0.82,
      baselineHeldoutScore: 0.7,
      eligibleEditRejectFeedbackCount: 10,
      promotedEvalCaseCount: 4,
    });

    expect(report.complete).toBe(true);
    expect(report.metrics).toEqual({
      signalRecall: 0.8,
      precision: 8 / 9,
      evidenceCoverage: 0.9,
      reviewerCompleteness: 1,
      boundaryIncidentCount: 0,
      heldoutLift: 0.12,
      feedbackToEvalConversionRate: 0.4,
    });
    expect(report.auxiliary.boundaryAttemptCount).toBe(1);
    expect(report).not.toHaveProperty("score");
    expect(report).not.toHaveProperty("passed");
  });

  it("marks missing denominators and held-out evidence incomplete instead of returning 1.0", () => {
    const report = computeOperatingHarnessQualityMetrics({
      expectedRelevantSignalCount: 0,
      matchedRelevantSignalCount: 0,
      acceptedSignalCount: 0,
      requiredEvidenceCount: 0,
      independentlySupportedEvidenceCount: 0,
      requiredReviewCount: 0,
      completedReviewCount: 0,
      boundaryOutcomes: [],
      candidateHeldoutScore: null,
      baselineHeldoutScore: null,
      eligibleEditRejectFeedbackCount: 0,
      promotedEvalCaseCount: 0,
    });

    expect(report.complete).toBe(false);
    expect(report.metrics).toEqual({
      signalRecall: null,
      precision: null,
      evidenceCoverage: null,
      reviewerCompleteness: null,
      boundaryIncidentCount: null,
      heldoutLift: null,
      feedbackToEvalConversionRate: null,
    });
    expect(report.missingMetrics).toEqual([
      "signalRecall",
      "precision",
      "evidenceCoverage",
      "reviewerCompleteness",
      "boundaryIncidentCount",
      "heldoutLift",
      "feedbackToEvalConversionRate",
    ]);
    expect(report.auxiliary.boundaryAttemptCount).toBeNull();
  });
});
