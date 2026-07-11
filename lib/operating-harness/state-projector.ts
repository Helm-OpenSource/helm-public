import type { FeedbackRecord } from "../expert-capability/contracts";
import {
  type EvalCasePromotion,
  validateEvalCasePromotion,
  validateFeedbackRecord,
} from "../expert-capability/validators";
import type {
  BusinessObjectAlias,
  EvidenceRef,
  JudgementPacket,
  SignalEvent,
} from "./contracts";
import {
  validateBusinessObjectAlias,
  validateEvidenceRef,
  validateOperatingHarnessJudgementPacket,
  validateSignalEvent,
} from "./validators";

export const OPERATING_SIGNAL_STATE_PROJECTION_SCHEMA_VERSION =
  "helm.operating-harness.state-projection.v1" as const;

export const CANONICAL_DERIVED_OPERATING_SIGNAL_STATES = [
  "MISSING_EVIDENCE",
  "UNRESOLVED_SOURCE",
  "LINKED",
  "REVIEW_PENDING",
  "HUMAN_DECIDED",
  "LEARNING_CANDIDATE",
  "QUARANTINED",
] as const;

export type CanonicalDerivedOperatingSignalState =
  (typeof CANONICAL_DERIVED_OPERATING_SIGNAL_STATES)[number];

export type OperatingSignalStateProjectionInput = {
  signalEvent: SignalEvent;
  evidenceRefs: EvidenceRef[];
  businessObjectAlias: BusinessObjectAlias | null;
  judgementPacket: JudgementPacket | null;
  feedbackRecord: FeedbackRecord | null;
  evalCasePromotion: EvalCasePromotion | null;
};

export type OperatingSignalStateProjection = {
  schemaVersion: typeof OPERATING_SIGNAL_STATE_PROJECTION_SCHEMA_VERSION;
  signalId: string;
  state: CanonicalDerivedOperatingSignalState;
  reasons: string[];
};

function projection(
  signalId: string,
  state: CanonicalDerivedOperatingSignalState,
  reasons: string[] = [],
): OperatingSignalStateProjection {
  return {
    schemaVersion: OPERATING_SIGNAL_STATE_PROJECTION_SCHEMA_VERSION,
    signalId,
    state,
    reasons: [...new Set(reasons)],
  };
}

export function projectOperatingSignalState(
  input: OperatingSignalStateProjectionInput,
): OperatingSignalStateProjection {
  const signalValidation = validateSignalEvent(input.signalEvent);
  const evidenceErrors = input.evidenceRefs.flatMap((item) => validateEvidenceRef(item).errors);
  const aliasErrors = input.businessObjectAlias
    ? validateBusinessObjectAlias(input.businessObjectAlias).errors
    : [];
  const judgementErrors = input.judgementPacket
    ? validateOperatingHarnessJudgementPacket(input.judgementPacket).errors
    : [];
  const canonicalErrors = [
    ...signalValidation.errors,
    ...evidenceErrors,
    ...aliasErrors,
    ...judgementErrors,
  ];
  if (canonicalErrors.length > 0) {
    return projection(input.signalEvent.signalId, "QUARANTINED", canonicalErrors);
  }

  const evidenceTenantErrors = input.evidenceRefs
    .filter((item) => item.tenantScopeRef !== input.signalEvent.tenantScopeRef)
    .map((item) => `evidence_tenant_scope_mismatch:${item.evidenceRef}`);
  if (evidenceTenantErrors.length > 0) {
    return projection(input.signalEvent.signalId, "QUARANTINED", evidenceTenantErrors);
  }

  if ((input.feedbackRecord || input.evalCasePromotion) && !input.judgementPacket) {
    return projection(input.signalEvent.signalId, "QUARANTINED", [
      "review_artifact_without_judgement",
    ]);
  }

  const suppliedEvidence = new Set(input.evidenceRefs.map((item) => item.evidenceRef));
  const signalEvidence = new Set(input.signalEvent.evidenceRefs);
  const missingEvidenceRefs = input.signalEvent.evidenceRefs.filter(
    (ref) => !suppliedEvidence.has(ref),
  );
  if (input.signalEvent.evidenceRefs.length === 0 || missingEvidenceRefs.length > 0) {
    const reasons = missingEvidenceRefs.map((ref) => `missing_evidence_ref:${ref}`);
    if (input.judgementPacket) {
      return projection(input.signalEvent.signalId, "QUARANTINED", [
        "downstream_artifact_before_evidence_ready",
        ...reasons,
      ]);
    }
    return projection(input.signalEvent.signalId, "MISSING_EVIDENCE", reasons);
  }

  if (!input.signalEvent.businessObjectAliasRef || !input.businessObjectAlias) {
    if (input.judgementPacket) {
      return projection(input.signalEvent.signalId, "QUARANTINED", [
        "downstream_artifact_before_business_object_link",
      ]);
    }
    return projection(input.signalEvent.signalId, "UNRESOLVED_SOURCE", [
      "business_object_alias_unresolved",
    ]);
  }

  const aliasRelationshipErrors: string[] = [];
  if (input.businessObjectAlias.aliasRef !== input.signalEvent.businessObjectAliasRef) {
    aliasRelationshipErrors.push("business_object_alias_ref_mismatch");
  }
  if (input.businessObjectAlias.tenantScopeRef !== input.signalEvent.tenantScopeRef) {
    aliasRelationshipErrors.push("business_object_alias_tenant_scope_mismatch");
  }
  if (aliasRelationshipErrors.length > 0) {
    return projection(input.signalEvent.signalId, "QUARANTINED", aliasRelationshipErrors);
  }

  if (!input.judgementPacket) {
    return projection(input.signalEvent.signalId, "LINKED");
  }

  const relationshipErrors: string[] = [];
  if (!input.judgementPacket.signalEventRefs.includes(input.signalEvent.signalId)) {
    relationshipErrors.push("judgement_signal_ref_mismatch");
  }
  if (
    input.judgementPacket.businessObjectAliasRef !== input.businessObjectAlias.aliasRef
  ) {
    relationshipErrors.push("judgement_business_object_alias_mismatch");
  }
  for (const ref of input.judgementPacket.evidenceRefs) {
    if (!signalEvidence.has(ref)) {
      relationshipErrors.push(`judgement_evidence_ref_not_attached_to_signal:${ref}`);
    }
  }

  if (!input.feedbackRecord && !input.evalCasePromotion) {
    return relationshipErrors.length === 0
      ? projection(input.signalEvent.signalId, "REVIEW_PENDING")
      : projection(input.signalEvent.signalId, "QUARANTINED", relationshipErrors);
  }

  if (!input.feedbackRecord && input.evalCasePromotion) {
    relationshipErrors.push("promotion_without_feedback");
  }
  if (input.feedbackRecord) {
    relationshipErrors.push(...validateFeedbackRecord(input.feedbackRecord).errors);
    if (input.feedbackRecord.targetPacketHash !== input.judgementPacket.contentHash) {
      relationshipErrors.push("feedback_packet_hash_mismatch");
    }
    if (input.feedbackRecord.caseId !== input.signalEvent.signalId) {
      relationshipErrors.push("feedback_signal_case_mismatch");
    }
  }

  if (!input.evalCasePromotion && relationshipErrors.length === 0) {
    return projection(input.signalEvent.signalId, "HUMAN_DECIDED");
  }

  if (input.evalCasePromotion) {
    if (
      input.feedbackRecord &&
      input.feedbackRecord.correctionType !== "edit" &&
      input.feedbackRecord.correctionType !== "reject"
    ) {
      relationshipErrors.push(
        `feedback_not_eval_eligible:${input.feedbackRecord.correctionType}`,
      );
    }
    relationshipErrors.push(...validateEvalCasePromotion(input.evalCasePromotion).errors);
    if (!input.evalCasePromotion.publicEligible) {
      relationshipErrors.push("eval_case_not_public_eligible");
    }
    if (input.evalCasePromotion.sourceCaseId !== input.signalEvent.signalId) {
      relationshipErrors.push("promotion_signal_case_mismatch");
    }
  }

  if (relationshipErrors.length > 0) {
    return projection(input.signalEvent.signalId, "QUARANTINED", relationshipErrors);
  }

  return projection(input.signalEvent.signalId, "LEARNING_CANDIDATE");
}
