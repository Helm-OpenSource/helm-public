// lib/member-gateway/signal-candidate.ts
// Member signal candidate contract (spec §5.1, M2c Task 1, owner rulings
// 2026-08-20). Pure judgment and projection only: no IO, no store, no
// clock — callers supply instants and the resolved/unresolved object
// anchor. A candidate artifact is a PARALLEL, review-required artifact
// type — it reuses ArtifactBundle/ArtifactReview typed discrimination
// (artifactType + reviewPosture + systemOfRecordWrite:false), never a new
// table. Nothing in this module can promote a candidate to fact or grant
// anything: taint/evaluationUseProhibited/promotionAllowed are frozen
// literals baked into the artifact shape itself.

import { parseInstant } from "@/lib/caio-governance/contract";
import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";
import type { ContractValidation } from "@/lib/member-gateway/contract";
import { MEMBER_WORK_SIGNAL_KINDS } from "@/lib/member-gateway/signal";
import type { MemberWorkSignalKind } from "@/lib/member-gateway/signal";

// Frozen discrimination (spec §5.1 ruling 1): the parallel artifact type
// reuses ArtifactBundle/ArtifactReview — there is no new kind column, only
// these two literal strings plus systemOfRecordWrite:false.
export const MEMBER_SIGNAL_CANDIDATE_ARTIFACT_TYPE =
  "member_work_signal_candidate.json" as const;

export const MEMBER_SIGNAL_CANDIDATE_REVIEW_POSTURE =
  "member_work_signal_candidate_review_required" as const;

// Discriminated object anchor (spec §5.1 ruling 4): a signal that cannot be
// resolved to a known ObjectType still remains reviewable — it just keeps
// carrying its original opaque ref instead of a resolved type/id pair.
// objectType is a plain string, deliberately not bound to a Prisma enum —
// same style as the proposal-side objectRef schema.
export type MemberSignalCandidateObjectAnchor =
  | { resolved: true; objectType: string; objectId: string }
  | { resolved: false; objectRef: string; objectVersion: number };

export type MemberWorkSignalCandidateLinkEvidence = {
  token: string;
  evidenceRef: string;
};

// spec §5.1 ruling 2: taint/evaluationUseProhibited/promotionAllowed are
// literal-typed so a well-typed candidate cannot claim to be trusted or
// promotable. spec §5.1 ruling 3: projectedSummary/projectedDetail are
// de-linked — the original URLs live only in the signal receipt, never in
// this artifact's body.
export type MemberWorkSignalCandidateArtifact = {
  schemaVersion: 1;
  taint: "untrusted";
  evaluationUseProhibited: true;
  promotionAllowed: false;
  signalReceiptRef: string;
  workspaceRef: string;
  memberRef: string;
  deviceRegistrationRef: string;
  clientId: string;
  policyRef: string;
  policyVersion: number;
  kind: MemberWorkSignalKind;
  projectedSummary: string;
  projectedDetail: string;
  linkEvidence: readonly MemberWorkSignalCandidateLinkEvidence[];
  relatedEvidenceRefs: readonly string[];
  objectAnchor: MemberSignalCandidateObjectAnchor;
  submittedAt: string;
};

// The subset of a MemberWorkSignalReceipt this projection actually needs —
// deliberately not the full receipt type, so this module does not couple
// to fields (payloadHash, candidate, supersedesReceiptRef, objectRef/
// objectVersion) that are the store/materializer layer's concern.
export type MemberSignalCandidateReceiptInput = {
  signalReceiptRef: string;
  workspaceRef: string;
  memberRef: string;
  deviceRegistrationRef: string;
  clientId: string;
  policyRef: string;
  policyVersion: number;
  kind: MemberWorkSignalKind;
  submittedAt: string;
};

export type ProjectSignalToCandidateInput = {
  receipt: MemberSignalCandidateReceiptInput;
  payload: {
    summary: string;
    detail: string;
    relatedEvidenceRefs: readonly string[];
  };
  objectAnchor: MemberSignalCandidateObjectAnchor;
};

function hasRef(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// Case-insensitive, greedy-to-whitespace link match (spec §5.1 ruling 3).
// Deliberately broader than signal.ts's countLinks (which only detects the
// scheme prefix to enforce the ≤3 count) — this pattern must capture the
// FULL url text so it can be excised from the body.
const LINK_PATTERN = /https?:\/\/\S+/gi;

// Pure de-linked projection (spec §5.1 ruling 3). A single running counter
// spans summary THEN detail — link numbering is per-artifact, not
// per-field. No links means linkEvidence is empty and both fields pass
// through unchanged. Each token is opaque; the only place the original URL
// text survives is the signal receipt, which this function never sees.
//
// Spoofing note: this function does not (and cannot) detect a member
// payload that already contains a hand-crafted literal "[link-evidence:N]"
// string of its own — that is validateMemberWorkSignalCandidateArtifact's
// job (it rejects any body whose "[link-evidence:" occurrence count does
// not equal linkEvidence.length). Callers MUST treat that rejection as a
// hard stop surfaced back to the member, not a silent strip-and-continue —
// the member has to fix the text and resubmit a new signal.
export function projectSignalToCandidate(
  input: ProjectSignalToCandidateInput,
): MemberWorkSignalCandidateArtifact {
  const linkEvidence: MemberWorkSignalCandidateLinkEvidence[] = [];
  let counter = 0;
  const replaceLinks = (text: string): string =>
    text.replace(LINK_PATTERN, () => {
      counter += 1;
      const token = `[link-evidence:${counter}]`;
      linkEvidence.push({
        token,
        evidenceRef: `link-evidence:${input.receipt.signalReceiptRef}:${counter}`,
      });
      return token;
    });
  const projectedSummary = replaceLinks(input.payload.summary);
  const projectedDetail = replaceLinks(input.payload.detail);
  return {
    schemaVersion: 1,
    taint: "untrusted",
    evaluationUseProhibited: true,
    promotionAllowed: false,
    signalReceiptRef: input.receipt.signalReceiptRef,
    workspaceRef: input.receipt.workspaceRef,
    memberRef: input.receipt.memberRef,
    deviceRegistrationRef: input.receipt.deviceRegistrationRef,
    clientId: input.receipt.clientId,
    policyRef: input.receipt.policyRef,
    policyVersion: input.receipt.policyVersion,
    kind: input.receipt.kind,
    projectedSummary,
    projectedDetail,
    linkEvidence,
    relatedEvidenceRefs: input.payload.relatedEvidenceRefs,
    objectAnchor: input.objectAnchor,
    submittedAt: input.receipt.submittedAt,
  };
}

// Third deliberate copy of the persistable-text safety pattern — see
// lib/llm/governed-candidate-materializer.ts and
// lib/governed-intelligence/capability-closeout-materializer.ts:40-41 for
// the first two. Kept as a private, byte-identical copy rather than
// hoisted into a shared lib/llm module: hoisting would pull this
// zero-zod, member-gateway-owned module across the llm-candidate gate
// boundary it must deliberately stay outside of.
const UNSAFE_PERSISTED_TEXT_PATTERN =
  /\bhttps?:\/\/|\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/|\b(?:password|secret|token|api[_-]?key|credential)\s*[:=]/i;

// Full-invariant validation (spec §5.1). Re-parsed and re-checked on every
// read (write, review, promote) per module convention — a corrupt or
// tampered artifact is always rejected, never trusted from a prior
// validation pass.
export function validateMemberWorkSignalCandidateArtifact(
  artifact: MemberWorkSignalCandidateArtifact,
): ContractValidation {
  const errors: string[] = [];
  if (artifact.schemaVersion !== 1) {
    errors.push("candidate_schema_version_invalid");
  }
  if (artifact.taint !== "untrusted") {
    errors.push("candidate_taint_missing");
  }
  if (
    artifact.evaluationUseProhibited !== true ||
    artifact.promotionAllowed !== false
  ) {
    errors.push("candidate_literals_invalid");
  }
  const requiredRefs = [
    artifact.signalReceiptRef,
    artifact.workspaceRef,
    artifact.memberRef,
    artifact.deviceRegistrationRef,
    artifact.clientId,
    artifact.policyRef,
  ];
  if (!requiredRefs.every((ref) => hasRef(ref))) {
    errors.push("candidate_ref_missing");
  }
  if (!Number.isInteger(artifact.policyVersion) || artifact.policyVersion < 1) {
    errors.push("candidate_policy_version_invalid");
  }
  if (!MEMBER_WORK_SIGNAL_KINDS.includes(artifact.kind)) {
    errors.push("candidate_kind_unknown");
  }
  if (!hasRef(artifact.projectedSummary)) {
    errors.push("candidate_summary_missing");
  }
  // title-free: unlike the closeout precedent this artifact carries no
  // title field, so the safety scan covers exactly summary + detail.
  // Named "unsafe_text" (not "link_bearing"): the shared pattern matches
  // links AND db connection schemes AND credential markers, not just links.
  const body = `${artifact.projectedSummary}\n${artifact.projectedDetail}`;
  if (UNSAFE_PERSISTED_TEXT_PATTERN.test(body)) {
    errors.push("candidate_body_unsafe_text");
  }
  if (
    !artifact.linkEvidence.every(
      (entry) =>
        hasRef(entry.token) &&
        hasRef(entry.evidenceRef) &&
        body.includes(entry.token),
    )
  ) {
    errors.push("candidate_link_evidence_invalid");
  }
  // Anti-spoofing (Minor 4): every real token is produced ONLY by
  // projectSignalToCandidate, one per replaced link, so a well-formed body
  // contains exactly linkEvidence.length occurrences of the token marker.
  // A member payload that hand-crafts extra literal "[link-evidence:N]"
  // text (never emitted by projection) inflates this count without a
  // matching linkEvidence entry — reject it rather than let a member fake
  // an evidence citation that was never produced by de-linking.
  const linkEvidenceTokenOccurrences = (
    body.match(/\[link-evidence:/g) ?? []
  ).length;
  if (linkEvidenceTokenOccurrences !== artifact.linkEvidence.length) {
    errors.push("candidate_link_evidence_invalid");
  }
  if (!artifact.relatedEvidenceRefs.every((ref) => hasRef(ref))) {
    errors.push("candidate_evidence_ref_invalid");
  }
  const { objectAnchor } = artifact;
  if (objectAnchor.resolved) {
    if (!hasRef(objectAnchor.objectType) || !hasRef(objectAnchor.objectId)) {
      errors.push("candidate_anchor_invalid");
    }
  } else if (
    !hasRef(objectAnchor.objectRef) ||
    !Number.isInteger(objectAnchor.objectVersion) ||
    objectAnchor.objectVersion < 1
  ) {
    errors.push("candidate_anchor_invalid");
  }
  if (parseInstant(artifact.submittedAt) === null) {
    errors.push("candidate_instant_invalid");
  }
  return { valid: errors.length === 0, errors };
}

// Deterministic content hash (spec §5.1 / expert-capability hashing
// convention): sha256 over the canonical (key-sorted) JSON serialization,
// so equal artifacts hash equally regardless of field order.
export function computeMemberWorkSignalCandidateContentHash(
  artifact: MemberWorkSignalCandidateArtifact,
): string {
  return sha256(canonicalJson(artifact));
}
