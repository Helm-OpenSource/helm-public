import type { TenantResourceEvidenceDetail } from "@/lib/tenant-resources/evidence-detail";
import type {
  TenantResourceGuardedWriteEvaluation,
  TenantResourceGuardedWriteEvaluationItem,
} from "@/lib/tenant-resources/guarded-write-evaluation";
import type { TenantResourceGuardedWritePilotRecord } from "@/lib/tenant-resources/guarded-write-pilot-runtime";

export type TenantResourceGuardedWritePilotReadoutStatus =
  | "not_requestable"
  | "requestable"
  | "pending_review"
  | "approved"
  | "rejected"
  | "acknowledged";

export type TenantResourceGuardedWritePilotReadout = {
  resourceKey: string;
  resourceName: string;
  provider: string;
  status: TenantResourceGuardedWritePilotReadoutStatus;
  requestable: boolean;
  proofAccepted: boolean;
  evaluationStatus:
    | TenantResourceGuardedWriteEvaluationItem["status"]
    | "missing";
  pilotId: string | null;
  proofId: string | null;
  note: string | null;
  nextAction: string;
  boundaryNotes: string[];
};

export function buildTenantResourceGuardedWritePilotReadouts(input: {
  evidenceDetails: TenantResourceEvidenceDetail[];
  guardedWriteEvaluation: TenantResourceGuardedWriteEvaluation;
  records: TenantResourceGuardedWritePilotRecord[];
}): TenantResourceGuardedWritePilotReadout[] {
  const evaluationByResourceKey = new Map(
    input.guardedWriteEvaluation.items.map((item) => [item.resourceKey, item]),
  );

  return input.evidenceDetails.map((detail) => {
    const evaluation =
      evaluationByResourceKey.get(detail.resource.resourceKey) ?? null;
    const latestRecord =
      input.records.find(
        (record) =>
          record.resourceKey === detail.resource.resourceKey &&
          record.actionRef === detail.manualProof.lifecycle.actionRef,
      ) ?? null;
    const proofAccepted = detail.manualProof.lifecycle.status === "accepted";
    const status = resolvePilotStatus({
      proofAccepted,
      evaluation,
      record: latestRecord,
    });

    return {
      resourceKey: detail.resource.resourceKey,
      resourceName: detail.resource.resourceName,
      provider: detail.resource.provider,
      status,
      requestable: status === "requestable" || status === "rejected",
      proofAccepted,
      evaluationStatus: evaluation?.status ?? "missing",
      pilotId: latestRecord?.pilotId ?? null,
      proofId: latestRecord?.proofId ?? detail.manualProof.lifecycle.proof?.proofId ?? null,
      note: latestRecord?.note ?? null,
      nextAction: buildNextAction(status, evaluation),
      boundaryNotes: [
        "guarded write pilot remains local-only and does not external-write",
        "approved pilot is not official success and still needs explicit acknowledgement",
        "pilot acknowledgement does not weaken recommendation / commitment or customer-visible boundaries",
      ],
    };
  });
}
function resolvePilotStatus(input: {
  proofAccepted: boolean;
  evaluation: TenantResourceGuardedWriteEvaluationItem | null;
  record: TenantResourceGuardedWritePilotRecord | null;
}): TenantResourceGuardedWritePilotReadoutStatus {
  if (input.record) {
    const recordStatusMap: Record<
      TenantResourceGuardedWritePilotRecord["status"],
      TenantResourceGuardedWritePilotReadoutStatus
    > = {
      PENDING_REVIEW: "pending_review",
      APPROVED: "approved",
      REJECTED: "rejected",
      ACKNOWLEDGED: "acknowledged",
    };
    return recordStatusMap[input.record.status];
  }

  if (
    input.proofAccepted &&
    input.evaluation?.status === "eligible_for_design_review"
  ) {
    return "requestable";
  }

  return "not_requestable";
}

function buildNextAction(
  status: TenantResourceGuardedWritePilotReadoutStatus,
  evaluation: TenantResourceGuardedWriteEvaluationItem | null,
) {
  if (status === "requestable") {
    return "Request the local guarded-write pilot only after accepted proof; do not external-write.";
  }
  if (status === "pending_review") {
    return "Keep the pilot in review. Approval here still does not create a real write route.";
  }
  if (status === "approved") {
    return "Record a local acknowledgement before treating the pilot as closed.";
  }
  if (status === "rejected") {
    return "Repair the pilot request or keep the resource on proof-only posture.";
  }
  if (status === "acknowledged") {
    return "Pilot closeout is local-only; any real guarded write still needs a later implementation slice.";
  }

  return `Pilot remains blocked until proof is accepted and evaluation is eligible${
    evaluation ? `: ${evaluation.nextReviewStep}` : "."
  }`;
}
