export const ASK_HELM_SIGNAL_TYPES = [
  "risk",
  "blocker",
  "opportunity",
  "commitment_at_risk",
  "customer_waiting",
  "customer_feedback",
  "delivery_issue",
  "internal_handoff",
  "other",
] as const;

export type AskHelmSignalType = (typeof ASK_HELM_SIGNAL_TYPES)[number];

export const ASK_HELM_SIGNAL_URGENCIES = [
  "low",
  "normal",
  "high",
  "critical",
] as const;

export type AskHelmSignalUrgency = (typeof ASK_HELM_SIGNAL_URGENCIES)[number];

export const ASK_HELM_SIGNAL_RELATED_OBJECT_TYPES = [
  "contact",
  "company",
  "opportunity",
  "meeting",
] as const;

export type AskHelmSignalRelatedObjectType =
  (typeof ASK_HELM_SIGNAL_RELATED_OBJECT_TYPES)[number];

export type AskHelmSignalReviewPosture = "review_required";

export const ASK_HELM_SIGNAL_BOUNDARY_NOTE =
  "这是经营信号复核候选：不会自动外发、不会自动承诺、不会自动生成 Must Push；先由人工复核，才会进入正式经营推进。";

export const ASK_HELM_SIGNAL_CANDIDATE_TARGET_TYPE = "AskHelmSignalCandidate";
export const ASK_HELM_SIGNAL_CANDIDATE_ACTION_TYPE =
  "ASK_HELM_SIGNAL_CANDIDATE_SUBMITTED";

export type AskHelmSignalCandidateRelatedObject = {
  type: AskHelmSignalRelatedObjectType;
  id: string;
};

export type AskHelmSignalCandidatePayload = {
  source: "ask_helm";
  sourceQuery: string;
  summary: string;
  signalType: AskHelmSignalType;
  urgency: AskHelmSignalUrgency;
  evidenceNote: string;
  boundaryNote: string;
  reviewPosture: AskHelmSignalReviewPosture;
  createdByUserId: string;
  workspaceId: string;
  relatedObject?: AskHelmSignalCandidateRelatedObject;
};

export type AskHelmSignalCandidateInput = {
  workspaceId: string;
  createdByUserId: string;
  sourceQuery?: string | null;
  summary: string;
  signalType?: string | null;
  urgency?: string | null;
  evidenceNote?: string | null;
  relatedObject?: {
    type?: string | null;
    id?: string | null;
  } | null;
};

const EMAIL_PATTERN =
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+/g;

// Phone-like sequences: optional +country code then 7+ digits possibly broken
// by spaces/dashes/parens, plus a CN mobile fast-path. Conservative on
// alphanum boundaries to avoid eating object IDs that just contain digits.
const PHONE_PATTERNS: RegExp[] = [
  /\+\d{1,3}[\s-]?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}/g,
  /(?<!\d)1[3-9]\d{9}(?!\d)/g,
  /(?<!\d)\d{3,4}[-\s]\d{7,8}(?!\d)/g,
];

const MAX_SUMMARY_LENGTH = 600;
const MAX_EVIDENCE_LENGTH = 1200;
const MAX_QUERY_LENGTH = 500;

export class AskHelmSignalCandidateError extends Error {
  readonly code: "empty_summary" | "missing_workspace" | "missing_user";

  constructor(code: AskHelmSignalCandidateError["code"], message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "AskHelmSignalCandidateError";
  }
}

export function redactAskHelmSignalText(text: string | null | undefined): string {
  if (!text) return "";
  let redacted = text.replace(EMAIL_PATTERN, "[redacted-email]");
  for (const pattern of PHONE_PATTERNS) {
    redacted = redacted.replace(pattern, "[redacted-phone]");
  }
  return redacted;
}

export function normalizeAskHelmSignalType(value: unknown): AskHelmSignalType {
  if (typeof value !== "string") return "other";
  const normalized = value.trim().toLowerCase();
  if ((ASK_HELM_SIGNAL_TYPES as readonly string[]).includes(normalized)) {
    return normalized as AskHelmSignalType;
  }
  return "other";
}

export function normalizeAskHelmSignalUrgency(
  value: unknown,
): AskHelmSignalUrgency {
  if (typeof value !== "string") return "normal";
  const normalized = value.trim().toLowerCase();
  if ((ASK_HELM_SIGNAL_URGENCIES as readonly string[]).includes(normalized)) {
    return normalized as AskHelmSignalUrgency;
  }
  return "normal";
}

export function normalizeAskHelmSignalRelatedObjectType(
  value: unknown,
): AskHelmSignalRelatedObjectType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (
    (ASK_HELM_SIGNAL_RELATED_OBJECT_TYPES as readonly string[]).includes(
      normalized,
    )
  ) {
    return normalized as AskHelmSignalRelatedObjectType;
  }
  return null;
}

function clampText(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

export function buildAskHelmSignalCandidatePayload(
  input: AskHelmSignalCandidateInput,
): AskHelmSignalCandidatePayload {
  if (!input.workspaceId?.trim()) {
    throw new AskHelmSignalCandidateError("missing_workspace");
  }
  if (!input.createdByUserId?.trim()) {
    throw new AskHelmSignalCandidateError("missing_user");
  }

  const trimmedSummary = input.summary?.trim() ?? "";
  if (!trimmedSummary) {
    throw new AskHelmSignalCandidateError("empty_summary");
  }

  const summary = clampText(
    redactAskHelmSignalText(trimmedSummary),
    MAX_SUMMARY_LENGTH,
  );
  const evidenceNote = clampText(
    redactAskHelmSignalText((input.evidenceNote ?? "").trim()),
    MAX_EVIDENCE_LENGTH,
  );
  const sourceQuery = clampText(
    redactAskHelmSignalText((input.sourceQuery ?? "").trim()),
    MAX_QUERY_LENGTH,
  );

  const relatedType = normalizeAskHelmSignalRelatedObjectType(
    input.relatedObject?.type,
  );
  const relatedId = input.relatedObject?.id?.trim();
  const relatedObject =
    relatedType && relatedId ? { type: relatedType, id: relatedId } : undefined;

  return {
    source: "ask_helm",
    sourceQuery,
    summary,
    signalType: normalizeAskHelmSignalType(input.signalType),
    urgency: normalizeAskHelmSignalUrgency(input.urgency),
    evidenceNote,
    boundaryNote: ASK_HELM_SIGNAL_BOUNDARY_NOTE,
    reviewPosture: "review_required",
    createdByUserId: input.createdByUserId,
    workspaceId: input.workspaceId,
    ...(relatedObject ? { relatedObject } : {}),
  };
}
