// lib/member-gateway/signal.ts
// Member work-signal contract (spec §5 candidate_write, §6.2, §9). Pure
// judgment only: no IO, no store, no clock — callers supply instants. A
// work signal is ALWAYS candidate evidence with an untrusted taint; nothing
// in this module can promote it to fact, and dispatch stays inexpressible.

import { parseInstant } from "@/lib/caio-governance/contract";
import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";
import { validateMemberPrincipal } from "@/lib/member-gateway/contract";
import type { ContractValidation } from "@/lib/member-gateway/contract";
import type {
  MemberPrincipal,
  MemberReadSurfaceDecision,
} from "@/lib/member-gateway/types";

export const MEMBER_WORK_SIGNAL_KINDS = [
  "progress",
  "blocker",
  "customer_signal",
] as const;

export type MemberWorkSignalKind = (typeof MEMBER_WORK_SIGNAL_KINDS)[number];

// Frozen taint marking (spec §9): member upstream content is always
// untrusted input to any reasoning context and the marking must survive
// every layer.
export const MEMBER_SIGNAL_TAINT = "untrusted" as const;

// §9 limits: field length, link count, and reference count are contract
// values, not runtime configuration.
export const MEMBER_SIGNAL_SUMMARY_MAX_CHARS = 500;
export const MEMBER_SIGNAL_DETAIL_MAX_CHARS = 4000;
export const MEMBER_SIGNAL_MAX_LINKS = 3;
export const MEMBER_SIGNAL_MAX_EVIDENCE_REFS = 10;

// Mirrors the CEO-loop governed-mutation MAX_CHALLENGE_TTL_MS: a member
// signal challenge may never live longer than five minutes.
export const MEMBER_SIGNAL_CHALLENGE_TTL_CAP_MS = 5 * 60_000;

// Flat by construction: the §9 nesting-depth cap is enforced structurally —
// there is nothing nested to bound.
export type MemberWorkSignalPayload = {
  kind: MemberWorkSignalKind;
  summary: string;
  detail: string;
  relatedEvidenceRefs: readonly string[];
};

export type MemberWorkSignalDraft = {
  principal: MemberPrincipal;
  objectRef: string;
  objectVersion: number;
  payload: MemberWorkSignalPayload;
};

// One-time prepare/submit challenge (spec §6.2): bound to workspace,
// member, object, version, payload hash, and an expiry window.
export type MemberWorkSignalChallenge = {
  challengeRef: string;
  workspaceRef: string;
  memberRef: string;
  objectRef: string;
  objectVersion: number;
  payloadHash: string;
  issuedAt: string;
  expiresAt: string;
};

export type MemberWorkSignalSubmission = {
  challenge: MemberWorkSignalChallenge;
  principal: MemberPrincipal;
  payload: MemberWorkSignalPayload;
  // The member's read-surface decision for the target object: a signal may
  // only reference an object the member is authorized to read (§9
  // over-privilege reference check).
  surface: MemberReadSurfaceDecision;
  submittedAt: string;
  // Non-null when the store already recorded a consumption for this
  // challenge; the judgment rejects reuse.
  priorConsumptionRef: string | null;
};

// Append-only candidate receipt (spec §5/§6.2). candidate/taint are frozen
// literal types: a well-typed receipt cannot claim to be fact or trusted.
export type MemberWorkSignalReceipt = {
  receiptId: string;
  workspaceRef: string;
  memberRef: string;
  deviceRegistrationRef: string;
  clientId: string;
  objectRef: string;
  objectVersion: number;
  kind: MemberWorkSignalKind;
  payloadHash: string;
  policyRef: string;
  policyVersion: number;
  submittedAt: string;
  candidate: true;
  taint: typeof MEMBER_SIGNAL_TAINT;
  // Superseding correction chain (spec §6.2): a correction is a NEW receipt
  // referencing the one it replaces; history is never rewritten.
  supersedesReceiptRef: string | null;
};

function hasRef(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// Case-insensitive scheme match: HTTPS:// linkifies just like https://.
// Protocol-less links (www.x, //host) are deliberately not counted here —
// the runtime malicious-content check (spec §9-6) is a separate layer.
function countLinks(text: string): number {
  return (text.match(/https?:\/\//gi) ?? []).length;
}

// Note: relatedEvidenceRefs order is hash-significant — submit must resend
// refs in prepare order or the challenge hash will not match.
export function hashMemberWorkSignalPayload(
  payload: MemberWorkSignalPayload,
): string {
  return sha256(canonicalJson(payload));
}

export function validateMemberWorkSignalDraft(
  draft: MemberWorkSignalDraft,
): ContractValidation {
  const errors = [...validateMemberPrincipal(draft.principal).errors];
  if (!hasRef(draft.objectRef)) {
    errors.push("signal_object_ref_missing");
  }
  if (!Number.isInteger(draft.objectVersion) || draft.objectVersion < 1) {
    errors.push("signal_object_version_invalid");
  }
  const { payload } = draft;
  if (!MEMBER_WORK_SIGNAL_KINDS.includes(payload.kind)) {
    errors.push("signal_kind_unknown");
  }
  if (!hasRef(payload.summary)) {
    errors.push("signal_summary_missing");
  } else if (payload.summary.length > MEMBER_SIGNAL_SUMMARY_MAX_CHARS) {
    errors.push("signal_summary_too_long");
  }
  if (payload.detail.length > MEMBER_SIGNAL_DETAIL_MAX_CHARS) {
    errors.push("signal_detail_too_long");
  }
  if (
    countLinks(payload.summary) + countLinks(payload.detail) >
    MEMBER_SIGNAL_MAX_LINKS
  ) {
    errors.push("signal_links_exceeded");
  }
  if (payload.relatedEvidenceRefs.length > MEMBER_SIGNAL_MAX_EVIDENCE_REFS) {
    errors.push("signal_evidence_refs_exceeded");
  }
  if (!payload.relatedEvidenceRefs.every((ref) => hasRef(ref))) {
    errors.push("signal_evidence_ref_invalid");
  }
  return { valid: errors.length === 0, errors };
}

export function judgeMemberWorkSignalChallenge(
  challenge: MemberWorkSignalChallenge,
): ContractValidation {
  const errors: string[] = [];
  if (!hasRef(challenge.challengeRef)) {
    errors.push("challenge_ref_missing");
  }
  if (!hasRef(challenge.workspaceRef) || !hasRef(challenge.memberRef)) {
    errors.push("challenge_principal_binding_missing");
  }
  if (!hasRef(challenge.objectRef)) {
    errors.push("challenge_object_binding_missing");
  }
  if (
    !Number.isInteger(challenge.objectVersion) ||
    challenge.objectVersion < 1
  ) {
    errors.push("challenge_object_version_invalid");
  }
  if (!hasRef(challenge.payloadHash)) {
    errors.push("challenge_payload_hash_missing");
  }
  const issuedAtMs = parseInstant(challenge.issuedAt);
  const expiresAtMs = parseInstant(challenge.expiresAt);
  if (issuedAtMs === null || expiresAtMs === null) {
    errors.push("challenge_instant_invalid");
  } else {
    if (expiresAtMs <= issuedAtMs) {
      errors.push("challenge_window_invalid");
    } else if (expiresAtMs - issuedAtMs > MEMBER_SIGNAL_CHALLENGE_TTL_CAP_MS) {
      errors.push("challenge_ttl_exceeds_cap");
    }
  }
  return { valid: errors.length === 0, errors };
}

// Submission judgment (spec §6.2/§9). Fail-closed: the challenge is
// one-time (any recorded prior consumption rejects), the payload must hash
// to the prepared payloadHash, and the target object must be inside the
// member's authorized read surface. This judges only what it is given —
// the store layer owns actually recording consumption atomically.
// Expiry is exclusive (submittedAt >= expiresAt rejects): one tick
// stricter than the CEO-loop governed-mutation window, deliberately —
// member upstream is the less-trusted surface.
export function judgeMemberWorkSignalSubmission(
  submission: MemberWorkSignalSubmission,
): ContractValidation {
  const errors = [
    ...judgeMemberWorkSignalChallenge(submission.challenge).errors,
  ];
  const { challenge, principal } = submission;
  if (
    principal.workspaceRef !== challenge.workspaceRef ||
    principal.memberRef !== challenge.memberRef
  ) {
    errors.push("challenge_binding_mismatch");
  }
  errors.push(
    ...validateMemberWorkSignalDraft({
      principal,
      objectRef: challenge.objectRef,
      objectVersion: challenge.objectVersion,
      payload: submission.payload,
    }).errors,
  );
  if (
    hashMemberWorkSignalPayload(submission.payload) !== challenge.payloadHash
  ) {
    errors.push("challenge_payload_hash_mismatch");
  }
  const submittedAtMs = parseInstant(submission.submittedAt);
  const issuedAtMs = parseInstant(challenge.issuedAt);
  const expiresAtMs = parseInstant(challenge.expiresAt);
  if (submittedAtMs === null) {
    errors.push("submission_instant_invalid");
  } else if (issuedAtMs !== null && expiresAtMs !== null) {
    if (submittedAtMs < issuedAtMs) {
      errors.push("submission_before_issue");
    } else if (submittedAtMs >= expiresAtMs) {
      errors.push("challenge_expired");
    }
  }
  if (submission.priorConsumptionRef !== null) {
    errors.push("challenge_already_consumed");
  }
  if (!submission.surface.allowed) {
    errors.push("signal_object_not_authorized");
  }
  return { valid: errors.length === 0, errors };
}

export type SupersedingSignalJudgmentInput = {
  prior: MemberWorkSignalReceipt;
  next: MemberWorkSignalReceipt;
  // Non-null when the store already recorded a correction for `prior`;
  // a receipt can be superseded at most once (corrections chain linearly).
  priorAlreadySupersededBy: string | null;
};

// Correction judgment (spec §6.2): a correction is a NEW receipt that
// references and supersedes the old one. History is append-only — nothing
// here mutates or deletes the prior receipt.
// Both receipts are assumed well-formed store rows (the store/M2b layer
// owns that); this judgment only rules on the correction relationship,
// and objectVersion may legitimately differ across a correction chain.
export function judgeSupersedingSignalReceipt(
  input: SupersedingSignalJudgmentInput,
): ContractValidation {
  const errors: string[] = [];
  const { prior, next } = input;
  if (next.receiptId === prior.receiptId) {
    errors.push("supersedes_self_reference");
  }
  if (next.supersedesReceiptRef !== prior.receiptId) {
    errors.push("supersedes_ref_mismatch");
  }
  if (
    next.workspaceRef !== prior.workspaceRef ||
    next.memberRef !== prior.memberRef ||
    next.objectRef !== prior.objectRef
  ) {
    errors.push("supersedes_scope_mismatch");
  }
  if (input.priorAlreadySupersededBy !== null) {
    errors.push("receipt_already_superseded");
  }
  const priorMs = parseInstant(prior.submittedAt);
  const nextMs = parseInstant(next.submittedAt);
  if (priorMs === null || nextMs === null || nextMs <= priorMs) {
    errors.push("supersedes_order_invalid");
  }
  return { valid: errors.length === 0, errors };
}
