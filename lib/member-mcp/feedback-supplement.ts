import "server-only";

// Member MCP P3a: a CAIO review supplement that tells the review how much
// member feedback arrived in the window, by type — counts only.
//
// Boundary (member gateway spec §5.1/§9/§12): member-authored content is
// untrusted and evaluationUseProhibited, and untrusted uplink content must not
// enter an external provider's context. So nothing derived from the content of
// a signal or field report leaves this module — no summaries, no text, and no
// member-reported metric values. What leaves is volume by kind, which is
// metadata about the uplink channel, aggregated over the whole workspace and
// never per person. Metric values and source-reliability statistics are a
// separate owner decision.
//
// Protected responses (refuse / pause / appeal) are deliberately not counted:
// they must never become a signal about the people raising them.
//
// Unknown is null, never 0: a failed read must not look like a quiet window.

import type { CaioInferenceSupplementPort } from "@/lib/caio-inference/input-builder";
import { db } from "@/lib/db";
import { MEMBER_WORK_SIGNAL_KINDS } from "@/lib/member-gateway/signal";
import {
  MEMBER_FIELD_REPORT_BLOCK_OPEN,
  MEMBER_FIELD_REPORT_KINDS,
  type MemberFieldReportKind,
} from "@/lib/member-mcp/tools";
import { safeParseJson } from "@/lib/utils";

export const MEMBER_FEEDBACK_SUPPLEMENT_KEY = "member.feedback.summary";
export const MEMBER_FEEDBACK_SUPPLEMENT_ENABLED_ENV = "HELM_CAIO_MEMBER_FEEDBACK_SUPPLEMENT_ENABLED";
const MAX_RECEIPTS = 5000;

export const MEMBER_FEEDBACK_COUNT_KEYS = [
  "signals_total",
  ...MEMBER_WORK_SIGNAL_KINDS.map((kind) => `signals_${kind}` as const),
  "field_reports_total",
  ...MEMBER_FIELD_REPORT_KINDS.map((kind) => `field_reports_${kind}` as const),
  "reporting_members",
] as const;

export type MemberFeedbackCountKey = (typeof MEMBER_FEEDBACK_COUNT_KEYS)[number];

export function isMemberFeedbackSupplementEnabled(env: Readonly<Record<string, string | undefined>> = process.env) {
  return env[MEMBER_FEEDBACK_SUPPLEMENT_ENABLED_ENV] === "true";
}

// Reads only the kind of a field report from its structured block. A block
// that does not parse, or names an unknown kind, is counted as a plain signal:
// the block is member-authored and could be forged inside an ordinary signal,
// which is harmless here because only its kind is read, and only to count it.
export function fieldReportKindOf(detail: string): MemberFieldReportKind | null {
  if (!detail.startsWith(`${MEMBER_FIELD_REPORT_BLOCK_OPEN}\n`)) return null;
  const end = detail.indexOf("\n```", MEMBER_FIELD_REPORT_BLOCK_OPEN.length);
  if (end < 0) return null;
  const block = safeParseJson<unknown>(detail.slice(MEMBER_FIELD_REPORT_BLOCK_OPEN.length + 1, end), null);
  const kind = block && typeof block === "object" ? (block as { kind?: unknown }).kind : null;
  return typeof kind === "string" && (MEMBER_FIELD_REPORT_KINDS as readonly string[]).includes(kind)
    ? (kind as MemberFieldReportKind)
    : null;
}

export type MemberFeedbackReceiptView = {
  id: string;
  memberRef: string;
  kind: string;
  payloadJson: string;
  supersedesReceiptRef: string | null;
};

export function unknownMemberFeedbackCounts(): Record<MemberFeedbackCountKey, null> {
  return Object.fromEntries(MEMBER_FEEDBACK_COUNT_KEYS.map((key) => [key, null])) as Record<MemberFeedbackCountKey, null>;
}

// Pure projection. A receipt that another receipt in the window supersedes is
// dropped, so a correction counts once.
export function projectMemberFeedbackCounts(
  receipts: readonly MemberFeedbackReceiptView[],
): Record<MemberFeedbackCountKey, number> {
  const superseded = new Set(receipts.map((receipt) => receipt.supersedesReceiptRef).filter((ref): ref is string => Boolean(ref)));
  const counts = Object.fromEntries(MEMBER_FEEDBACK_COUNT_KEYS.map((key) => [key, 0])) as Record<MemberFeedbackCountKey, number>;
  const members = new Set<string>();
  for (const receipt of receipts) {
    if (superseded.has(receipt.id)) continue;
    members.add(receipt.memberRef);
    const payload = safeParseJson<{ detail?: unknown }>(receipt.payloadJson, {});
    const reportKind = typeof payload.detail === "string" ? fieldReportKindOf(payload.detail) : null;
    if (reportKind) {
      counts.field_reports_total += 1;
      counts[`field_reports_${reportKind}`] += 1;
      continue;
    }
    counts.signals_total += 1;
    if ((MEMBER_WORK_SIGNAL_KINDS as readonly string[]).includes(receipt.kind)) {
      counts[`signals_${receipt.kind as (typeof MEMBER_WORK_SIGNAL_KINDS)[number]}`] += 1;
    }
  }
  counts.reporting_members = members.size;
  return counts;
}

export type MemberFeedbackReceiptReader = (input: {
  workspaceId: string;
  windowStart: Date;
  windowEnd: Date;
  limit: number;
}) => Promise<MemberFeedbackReceiptView[]>;

const defaultReader: MemberFeedbackReceiptReader = ({ workspaceId, windowStart, windowEnd, limit }) =>
  db.memberWorkSignalReceipt.findMany({
    where: { workspaceId, submittedAt: { gte: windowStart, lt: windowEnd } },
    select: { id: true, memberRef: true, kind: true, payloadJson: true, supersedesReceiptRef: true },
    orderBy: { submittedAt: "asc" },
    take: limit,
  });

// Default off: with the switch unset the port contributes nothing, so wiring
// it into a tenant's review supplements changes no input until it is enabled.
export function createMemberFeedbackSupplement(
  read: MemberFeedbackReceiptReader = defaultReader,
  env: Readonly<Record<string, string | undefined>> = process.env,
): CaioInferenceSupplementPort {
  return async ({ workspaceId, windowStart, windowEnd }) => {
    if (!isMemberFeedbackSupplementEnabled(env)) return [];
    try {
      const receipts = await read({ workspaceId, windowStart, windowEnd, limit: MAX_RECEIPTS + 1 });
      // A truncated window would read as a whole-window count; report unknown instead.
      if (receipts.length > MAX_RECEIPTS) {
        return [{ key: MEMBER_FEEDBACK_SUPPLEMENT_KEY, counts: unknownMemberFeedbackCounts() }];
      }
      return [{ key: MEMBER_FEEDBACK_SUPPLEMENT_KEY, counts: projectMemberFeedbackCounts(receipts) }];
    } catch {
      return [{ key: MEMBER_FEEDBACK_SUPPLEMENT_KEY, counts: unknownMemberFeedbackCounts() }];
    }
  };
}
