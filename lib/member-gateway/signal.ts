// lib/member-gateway/signal.ts
// Member work-signal contract (spec §5 candidate_write, §6.2, §9). Pure
// judgment only: no IO, no store, no clock — callers supply instants. A
// work signal is ALWAYS candidate evidence with an untrusted taint; nothing
// in this module can promote it to fact, and dispatch stays inexpressible.

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

function countLinks(text: string): number {
  return (text.match(/https?:\/\//g) ?? []).length;
}

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
