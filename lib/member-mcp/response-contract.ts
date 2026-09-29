// lib/member-mcp/response-contract.ts
// Member MCP P1b contract: responding to CAIO prompts by ASYNCHRONOUS
// REGISTRATION (owner ruling 2026-09-29). Pure: no IO, no clock.
//
// Why asynchronous: the Member Gateway response store validates protected
// responses (refuse / pause / appeal) with lib/caio-governance, and nothing
// reachable from an app route may depend on that module (authority firewall,
// scripts/check-caio-terminology.ts). So the online MCP route only takes the
// member's two-step confirmation and records the confirmed response in
// MemberPromptResponseInbox; scripts/member-prompt-response-worker.ts
// registers it through the store and writes the outcome back.
//
// This module must stay firewall-clean: it may not import prompt.ts,
// prompt-store.service or prompt-response-store.service. The response kinds
// below are therefore a local closed set; a unit test pins them as a subset
// of MEMBER_PROMPT_RESPONSE_KINDS.

import { canonicalJson } from "@/lib/expert-capability/hashing";
import type { MemberWorkSignalPayload } from "@/lib/member-gateway/signal";

// commitment_confirm is deliberately absent: it is an authority-bearing
// action that needs an external authorization triple no member client holds.
export const MEMBER_MCP_RESPONSE_KINDS = [
  "acknowledge",
  "refuse",
  "pause",
  "appeal",
  "progress_report",
  "free_text_answer",
] as const;

export type MemberMcpResponseKind = (typeof MEMBER_MCP_RESPONSE_KINDS)[number];

export const MEMBER_MCP_PROTECTED_RESPONSE_KINDS = ["refuse", "pause", "appeal"] as const;
export const MEMBER_MCP_CANDIDATE_RESPONSE_KINDS = ["progress_report", "free_text_answer"] as const;

export function isProtectedResponseKind(kind: string): kind is "refuse" | "pause" | "appeal" {
  return (MEMBER_MCP_PROTECTED_RESPONSE_KINDS as readonly string[]).includes(kind);
}

export function isCandidateResponseKind(kind: string): kind is "progress_report" | "free_text_answer" {
  return (MEMBER_MCP_CANDIDATE_RESPONSE_KINDS as readonly string[]).includes(kind);
}

export const MEMBER_MCP_RESPONSE_LABELS: Record<MemberMcpResponseKind, string> = {
  acknowledge: "已知悉",
  refuse: "拒绝",
  pause: "暂停",
  appeal: "申诉",
  progress_report: "进展汇报",
  free_text_answer: "回答",
};

export const MEMBER_MCP_RESPONSE_TEXT_MAX_CHARS = 2000;

// The member-confirmed response. promptVersion is the prompt version the
// member saw when preparing; the processor records against the prompt's
// current version and keeps this one as provenance.
export type MemberPromptResponseIntent = {
  promptRef: string;
  promptVersion: number;
  kind: MemberMcpResponseKind;
  text: string;
};

// Every kind except acknowledge needs text: refuse/pause/appeal need a reason
// (the governance contract requires one) and answers need content.
export function validateResponseText(
  kind: MemberMcpResponseKind,
  text: string,
): string | null {
  if (text.length > MEMBER_MCP_RESPONSE_TEXT_MAX_CHARS) return "text_too_long";
  if (kind !== "acknowledge" && text.trim().length === 0) {
    return isProtectedResponseKind(kind) ? "reason_required" : "text_required";
  }
  return null;
}

// The member's two-step confirmation reuses the generic one-time challenge
// the work-signal store issues (MemberWorkSignalChallenge). The intent is
// carried as the canonical JSON detail of a signal-shaped payload; this
// challenge only binds the member's confirmation and is never redeemed as a
// work signal. Its object is a response-intake object, not the prompt, so it
// can never be confused with the store-side challenge the processor issues.
export function memberResponseChallengeObjectRef(promptRef: string) {
  return `member-prompt-response:${promptRef}`;
}

export function memberResponseConfirmationPayload(
  intent: MemberPromptResponseIntent,
): MemberWorkSignalPayload {
  return {
    kind: "progress",
    summary: `回应提问·${MEMBER_MCP_RESPONSE_LABELS[intent.kind]}`,
    detail: canonicalJson(intent),
    relatedEvidenceRefs: [],
  };
}

// Deterministic ids: a retried submit or a rerun of the processor lands on
// the same rows instead of creating duplicates.
export function memberResponseInboxId(memberChallengeRef: string) {
  return `mmcp-inbox:${memberChallengeRef}`;
}
export function memberResponseReceiptId(inboxId: string) {
  return `mmcp-response:${inboxId}`;
}
export function memberResponseSignalReceiptId(inboxId: string) {
  return `mmcp-response-signal:${inboxId}`;
}
export function memberResponseTransitionReceiptId(inboxId: string, step: "deliver" | "unsnooze" | "respond") {
  return `mmcp-response-${step}:${inboxId}`;
}

export const MEMBER_RESPONSE_INBOX_STATUSES = ["received", "registered", "rejected", "held"] as const;
export type MemberResponseInboxStatus = (typeof MEMBER_RESPONSE_INBOX_STATUSES)[number];

// Closed set of terminal rejection / hold codes written by the processor.
// store_rejected carries the store's own reasons in lastErrorDetail.
export const MEMBER_RESPONSE_OUTCOME_CODES = [
  "prompt_not_found",
  "prompt_not_addressed_to_member",
  "prompt_closed",
  "prompt_expired",
  "store_rejected",
  "mandate_missing",
  "processor_exhausted",
  "payload_corrupt",
  // Candidate responses whose work signal is already recorded (and kept, with
  // its reviewable candidate) but whose prompt can no longer take this answer.
  "signal_recorded_prompt_closed",
  "prompt_already_answered",
] as const;
export type MemberResponseOutcomeCode = (typeof MEMBER_RESPONSE_OUTCOME_CODES)[number];

export const MEMBER_RESPONSE_MAX_ATTEMPTS = 5;

// Retry backoff after the given (1-based) attempt: 1m, 2m, 4m ... capped at
// 30m. Rows waiting for a CAIO mandate or retrying a transient failure move
// to the back of the queue instead of blocking newer responses.
export const MEMBER_RESPONSE_BACKOFF_BASE_MS = 60_000;
export const MEMBER_RESPONSE_BACKOFF_CAP_MS = 30 * 60_000;
export function memberResponseRetryDelayMs(attempts: number): number {
  const exponent = Math.max(0, Math.min(attempts, 16) - 1);
  return Math.min(MEMBER_RESPONSE_BACKOFF_CAP_MS, MEMBER_RESPONSE_BACKOFF_BASE_MS * 2 ** exponent);
}

export function parseStoredResponseIntent(json: string): MemberPromptResponseIntent | null {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.promptRef !== "string" ||
    typeof record.promptVersion !== "number" ||
    !Number.isInteger(record.promptVersion) ||
    typeof record.kind !== "string" ||
    !(MEMBER_MCP_RESPONSE_KINDS as readonly string[]).includes(record.kind) ||
    typeof record.text !== "string"
  ) {
    return null;
  }
  return {
    promptRef: record.promptRef,
    promptVersion: record.promptVersion,
    kind: record.kind as MemberMcpResponseKind,
    text: record.text,
  };
}
