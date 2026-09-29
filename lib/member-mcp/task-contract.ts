// lib/member-mcp/task-contract.ts
// Member MCP P2 contract: the work an owner dispatched to a member, and the
// member's report on it. Pure judgment only: no IO, no clock.
//
// Aligned with the Stage 1 dispatch chain (PR #426, owner ruling 2026-09-29:
// the "no dispatch to members" boundary is lifted, CAIO only suggests):
// - a member's tasks are exactly the Stage 1 work packets whose owner command
//   names them as executor (`executionTargetRef === "user:<id>"`), read with
//   listWorkPacketsAssignedToMember — the same set /caio/my-work shows. No
//   second task model exists here;
// - a member's report on a packet is an untrusted candidate work signal
//   anchored to the packet's ActionItem, so it surfaces in /approvals next to
//   the packet. It writes no ExecutionReceipt and changes no task state: a
//   packet closes only through the Stage 1 chain (private execution result
//   ingress, receipt verification and terminal reconciliation), and a receipt
//   written ahead of that chain would make it refuse the governed result.

import type { MemberWorkSignalKind, MemberWorkSignalPayload } from "@/lib/member-gateway/signal";
import { canonicalJson } from "@/lib/expert-capability/hashing";

export const MEMBER_TASK_REPORT_OUTCOMES = ["done", "partly_done", "blocked", "not_started"] as const;
export type MemberTaskReportOutcome = (typeof MEMBER_TASK_REPORT_OUTCOMES)[number];

export const MEMBER_TASK_REPORT_OUTCOME_LABELS: Record<MemberTaskReportOutcome, string> = {
  done: "已完成",
  partly_done: "部分完成",
  blocked: "受阻",
  not_started: "未开始",
};

// Frozen work-signal kinds are reused, not extended.
const OUTCOME_SIGNAL_KIND: Record<MemberTaskReportOutcome, MemberWorkSignalKind> = {
  done: "progress",
  partly_done: "progress",
  blocked: "blocker",
  not_started: "blocker",
};

export const MEMBER_TASK_REPORT_BLOCK_OPEN = "```helm-task-report/v1";
export const MEMBER_TASK_ACTION_TAKEN_MAX = 200;
export const MEMBER_TASK_NOTE_MAX = 2000;
export const MEMBER_TASK_MAX_EVIDENCE_REFS = 10;

// Evidence refs are opaque `<kind>:<id>` references, never URLs or free text.
const EVIDENCE_REF_PATTERN = /^[a-z][a-z0-9_-]{0,39}:[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/;
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export type MemberTaskReportInput = {
  taskRef: string;
  outcome: MemberTaskReportOutcome;
  actionTaken: string;
  evidenceRefs: string[];
  note: string;
};

export function validateMemberTaskReport(input: MemberTaskReportInput): string | null {
  if (!(MEMBER_TASK_REPORT_OUTCOMES as readonly string[]).includes(input.outcome)) return "outcome_unknown";
  const actionTaken = input.actionTaken.trim();
  if (!actionTaken || actionTaken.length > MEMBER_TASK_ACTION_TAKEN_MAX || CONTROL_CHARACTERS.test(actionTaken)) {
    return "action_taken_invalid";
  }
  if (input.note.length > MEMBER_TASK_NOTE_MAX || CONTROL_CHARACTERS.test(input.note)) return "note_invalid";
  if (input.evidenceRefs.length > MEMBER_TASK_MAX_EVIDENCE_REFS) return "too_many_evidence_refs";
  if (new Set(input.evidenceRefs).size !== input.evidenceRefs.length) return "duplicate_evidence_ref";
  if (input.evidenceRefs.some((ref) => !EVIDENCE_REF_PATTERN.test(ref) || /^https?:/i.test(ref))) {
    return "evidence_ref_invalid";
  }
  return null;
}

export function memberTaskObjectRef(actionItemId: string) {
  return `action-item:${actionItemId}`;
}

// Deterministic: the same input gives the same payload, so the challenge hash
// taken at prepare matches at submit. The structured block is member-authored
// and stays untrusted candidate evidence; the member's evidence refs ride
// inside it (not as store-level relatedEvidenceRefs, which would need a
// per-ref authorization surface the member MCP does not have).
export function buildMemberTaskReportPayload(input: {
  report: MemberTaskReportInput;
  taskTitle: string;
  decisionRef: string;
}): MemberWorkSignalPayload {
  const block = canonicalJson({
    taskRef: input.report.taskRef,
    decisionRef: input.decisionRef,
    outcome: input.report.outcome,
    actionTaken: input.report.actionTaken.trim(),
    evidenceRefs: input.report.evidenceRefs,
  });
  const note = input.report.note.trim();
  return {
    kind: OUTCOME_SIGNAL_KIND[input.report.outcome],
    summary: `任务回报·${MEMBER_TASK_REPORT_OUTCOME_LABELS[input.report.outcome]}：${input.taskTitle}`.slice(0, 500),
    detail: `${MEMBER_TASK_REPORT_BLOCK_OPEN}\n${block}\n\`\`\`${note ? `\n${note}` : ""}`,
    relatedEvidenceRefs: [],
  };
}
