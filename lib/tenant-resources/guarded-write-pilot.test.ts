import { describe, expect, it } from "vitest";
import type { TenantResourceEvidenceDetail } from "@/lib/tenant-resources/evidence-detail";
import { buildTenantResourceGuardedWritePilotReadouts } from "@/lib/tenant-resources/guarded-write-pilot";
import type { TenantResourceGuardedWriteEvaluation } from "@/lib/tenant-resources/guarded-write-evaluation";

function buildDetail(
  status: TenantResourceEvidenceDetail["manualProof"]["lifecycle"]["status"],
): TenantResourceEvidenceDetail {
  return {
    resource: {
      resourceKey: "crm_import:pilot",
      resourceName: "CRM Import",
      provider: "crm_import",
    },
    manualProof: {
      lifecycle: {
        status,
        actionRef: "settings-resource-evidence:crm_import:pilot",
        proof:
          status === "accepted"
            ? {
                proofId: "proof-1",
                status: "ACCEPTED",
                evidenceRefs: ["proof:1"],
                failureReason: null,
              }
            : null,
      },
    },
  } as TenantResourceEvidenceDetail;
}

const evaluation: TenantResourceGuardedWriteEvaluation = {
  generatedAt: "2026-04-25T00:00:00.000Z",
  totalResources: 1,
  eligibleForDesignReviewResourceKeys: ["crm_import:pilot"],
  requiresReviewResourceKeys: [],
  blockedResourceKeys: [],
  items: [
    {
      resourceKey: "crm_import:pilot",
      resourceName: "CRM Import",
      provider: "crm_import",
      status: "eligible_for_design_review",
      canProceedToDesignReview: true,
      evidenceStatus: "usable_for_judgement",
      manualProofStatus: "accepted",
      fieldGapSummaryStatus: "clear",
      extensionAdoptionStatus: "not_applicable",
      extensionDependencyCount: 0,
      policyExternalWriteBack: "separate_guarded_evaluation_required",
      blockers: [],
      nextReviewStep:
        "Proceed only to guarded-write design review; do not create a write route in this stage.",
    },
  ],
  boundaryNotes: [],
};

describe("tenant resource guarded write pilot readout", () => {
  it("becomes requestable only after accepted proof plus eligible evaluation", () => {
    const readouts = buildTenantResourceGuardedWritePilotReadouts({
      evidenceDetails: [buildDetail("accepted")],
      guardedWriteEvaluation: evaluation,
      records: [],
    });

    expect(readouts[0]).toMatchObject({
      resourceKey: "crm_import:pilot",
      status: "requestable",
      requestable: true,
      proofAccepted: true,
    });
  });

  it("prefers persisted pilot record status over requestable posture", () => {
    const readouts = buildTenantResourceGuardedWritePilotReadouts({
      evidenceDetails: [buildDetail("accepted")],
      guardedWriteEvaluation: evaluation,
      records: [
        {
          pilotId: "pilot-1",
          resourceKey: "crm_import:pilot",
          resourceName: "CRM Import",
          provider: "crm_import",
          actionRef: "settings-resource-evidence:crm_import:pilot",
          proofId: "proof-1",
          status: "APPROVED",
          requestedBy: "Operator",
          requestedAt: "2026-04-25T00:00:00.000Z",
          reviewedBy: "Reviewer",
          reviewedAt: "2026-04-25T01:00:00.000Z",
          acknowledgedBy: null,
          acknowledgedAt: null,
          evidenceRefs: ["proof:1"],
          note: null,
        },
      ],
    });

    expect(readouts[0]).toMatchObject({
      status: "approved",
      requestable: false,
      pilotId: "pilot-1",
    });
  });
});
