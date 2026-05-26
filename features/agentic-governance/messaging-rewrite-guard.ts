/**
 * Helm Agentic Governance — Messaging Rewrite Guard
 *
 * Offline copy guard for agentic / autonomous / execution wording. It is a
 * lint-style evaluator, not a runtime rewrite service or claim publisher.
 */

export type MessagingCopySurface =
  | "customer_facing"
  | "internal_doc"
  | "requirements"
  | "boundary_doc"
  | "competitor_differentiation";

export type MessagingGuardDecision =
  | "allow"
  | "allow_with_boundary_context"
  | "rewrite_required"
  | "reject";

export type MessagingGuardReasonCode =
  | "approved_positioning"
  | "boundary_context"
  | "customer_facing_sensitive_term"
  | "customer_facing_missing_boundary_note"
  | "forbidden_positioning_overclaim"
  | "runtime_rewrite_not_allowed";

export interface MessagingCopyCandidate {
  readonly id: string;
  readonly surface: MessagingCopySurface;
  readonly text: string;
  readonly hasBoundaryNote: boolean;
  readonly runtimePathChanged: boolean;
  readonly expectedDecision?: MessagingGuardDecision;
  readonly source?: "fixture" | "document_scan";
  readonly sourcePath?: string;
  readonly lineNumber?: number;
}

export interface MessagingCopyDocument {
  readonly id: string;
  readonly path: string;
  readonly surface: MessagingCopySurface;
  readonly content: string;
}

export interface MessagingGuardResult {
  readonly id: string;
  readonly decision: MessagingGuardDecision;
  readonly reasonCodes: readonly MessagingGuardReasonCode[];
  readonly boundaryNoteRequired: boolean;
  readonly rewriteSuggestions: readonly string[];
}

export interface MessagingRewriteGuardEval {
  readonly totalCandidates: number;
  readonly expectedMatches: number;
  readonly acceptedForbiddenPositioning: number;
  readonly acceptedCustomerFacingSensitiveWithoutBoundary: number;
  readonly runtimeRewriteAttempted: number;
  readonly rewriteRequired: number;
  readonly rejected: number;
  readonly documentCandidatesScanned: number;
  readonly documentRewriteRequired: number;
  readonly documentRejected: number;
  readonly results: readonly MessagingGuardResult[];
  readonly overallPassed: boolean;
}

const FORBIDDEN_POSITIONING_PATTERNS = [
  /\bagent\s+os\b/i,
  /\bautonomous\s+workforce\b/i,
  /\bworkflow\s*\/\s*orchestration\s+platform\b/i,
  /\bworkflow\s+platform\b/i,
  /\borchestration\s+platform\b/i,
];

const CUSTOMER_FACING_SENSITIVE_PATTERNS = [
  /\bagentic\b/i,
  /\bautonomous\b/i,
  /\bexecution\b/i,
];

const APPROVED_POSITIONING_REPLACEMENTS = [
  "经营推进控制台",
  "judgement layer",
  "review-first business advancement surface",
];

const BOUNDARY_NOTE_PATTERNS = [
  /\bnot\b/i,
  /\bno[-\s]/i,
  /\bnever\b/i,
  /\bforbid/i,
  /\bboundary\b/i,
  /\breview[-\s]first\b/i,
  /\bcandidate[-\s]only\b/i,
  /\bno-go\b/i,
  /不是/,
  /不做/,
  /不授权/,
  /不得/,
  /不允许/,
  /禁止/,
  /只读/,
  /人工/,
  /复核/,
  /边界/,
];

export const MESSAGING_REWRITE_GUARD_FIXTURES: readonly MessagingCopyCandidate[] = [
  {
    id: "approved_cn_positioning",
    surface: "customer_facing",
    text: "Helm 是经营推进控制台，把今天必须由人拍板的事放到第一屏。",
    hasBoundaryNote: true,
    runtimePathChanged: false,
    expectedDecision: "allow",
  },
  {
    id: "agentic_customer_copy_with_boundary",
    surface: "customer_facing",
    text: "Helm exposes an agentic judgement layer for reviewed business advancement.",
    hasBoundaryNote: true,
    runtimePathChanged: false,
    expectedDecision: "allow_with_boundary_context",
  },
  {
    id: "agentic_customer_copy_without_boundary",
    surface: "customer_facing",
    text: "Helm brings agentic execution to every revenue workflow.",
    hasBoundaryNote: false,
    runtimePathChanged: false,
    expectedDecision: "rewrite_required",
  },
  {
    id: "agent_os_overclaim",
    surface: "customer_facing",
    text: "Helm is the agent OS for autonomous workforce execution.",
    hasBoundaryNote: false,
    runtimePathChanged: false,
    expectedDecision: "reject",
  },
  {
    id: "workflow_platform_boundary_doc",
    surface: "boundary_doc",
    text: "Helm is not a workflow/orchestration platform or autonomous workforce.",
    hasBoundaryNote: true,
    runtimePathChanged: false,
    expectedDecision: "allow_with_boundary_context",
  },
  {
    id: "competitor_difference",
    surface: "competitor_differentiation",
    text: "Unlike an autonomous workforce pitch, Helm stays review-first and decision-first.",
    hasBoundaryNote: true,
    runtimePathChanged: false,
    expectedDecision: "allow_with_boundary_context",
  },
  {
    id: "runtime_rewrite_attempt",
    surface: "internal_doc",
    text: "Add a runtime rewrite service that changes production customer-facing claims.",
    hasBoundaryNote: true,
    runtimePathChanged: true,
    expectedDecision: "reject",
  },
];

export function buildMessagingCopyCandidatesFromDocuments(
  documents: readonly MessagingCopyDocument[],
): readonly MessagingCopyCandidate[] {
  return documents.flatMap((document) => {
    const lines = document.content.split(/\r?\n/);
    return lines.flatMap((line, index) => {
      if (!hasSensitiveMessagingTerm(line)) return [];

      const context = [
        lines[index - 1] ?? "",
        line,
        lines[index + 1] ?? "",
      ].join("\n");

      return [{
        id: `${document.id}:${index + 1}`,
        surface: document.surface,
        text: line,
        hasBoundaryNote:
          document.surface !== "customer_facing" || hasBoundaryNoteContext(context),
        runtimePathChanged: false,
        source: "document_scan" as const,
        sourcePath: document.path,
        lineNumber: index + 1,
      }];
    });
  });
}

export function evaluateMessagingCopyCandidate(
  candidate: MessagingCopyCandidate,
): MessagingGuardResult {
  const reasonCodes = new Set<MessagingGuardReasonCode>();
  const hasForbiddenPositioning = FORBIDDEN_POSITIONING_PATTERNS.some((pattern) =>
    pattern.test(candidate.text),
  );
  const hasCustomerFacingSensitiveTerm = CUSTOMER_FACING_SENSITIVE_PATTERNS.some((pattern) =>
    pattern.test(candidate.text),
  );
  const boundaryContext =
    candidate.surface === "boundary_doc" ||
    candidate.surface === "competitor_differentiation" ||
    candidate.surface === "requirements";

  if (candidate.runtimePathChanged) {
    reasonCodes.add("runtime_rewrite_not_allowed");
    return buildMessagingGuardResult(candidate, "reject", reasonCodes);
  }

  if (hasForbiddenPositioning && (!boundaryContext || !candidate.hasBoundaryNote)) {
    reasonCodes.add("forbidden_positioning_overclaim");
    return buildMessagingGuardResult(candidate, "reject", reasonCodes);
  }

  if (hasForbiddenPositioning && boundaryContext && candidate.hasBoundaryNote) {
    reasonCodes.add("boundary_context");
    return buildMessagingGuardResult(candidate, "allow_with_boundary_context", reasonCodes);
  }

  if (candidate.surface === "customer_facing" && hasCustomerFacingSensitiveTerm) {
    reasonCodes.add("customer_facing_sensitive_term");
    if (!candidate.hasBoundaryNote) {
      reasonCodes.add("customer_facing_missing_boundary_note");
      return buildMessagingGuardResult(candidate, "rewrite_required", reasonCodes);
    }
    reasonCodes.add("boundary_context");
    return buildMessagingGuardResult(candidate, "allow_with_boundary_context", reasonCodes);
  }

  reasonCodes.add("approved_positioning");
  return buildMessagingGuardResult(candidate, "allow", reasonCodes);
}

export function runMessagingRewriteGuardEval(
  candidates: readonly MessagingCopyCandidate[] = MESSAGING_REWRITE_GUARD_FIXTURES,
): MessagingRewriteGuardEval {
  const results = candidates.map(evaluateMessagingCopyCandidate);
  const expectedMatches = results.filter((result, index) =>
    candidates[index]?.expectedDecision === undefined
      ? true
      : result.decision === candidates[index]?.expectedDecision,
  ).length;
  const acceptedForbiddenPositioning = results.filter((result, index) => {
    const candidate = candidates[index];
    return (
      candidate !== undefined &&
      FORBIDDEN_POSITIONING_PATTERNS.some((pattern) => pattern.test(candidate.text)) &&
      candidate.surface === "customer_facing" &&
      (result.decision === "allow" || result.decision === "allow_with_boundary_context")
    );
  }).length;
  const acceptedCustomerFacingSensitiveWithoutBoundary = results.filter((result, index) => {
    const candidate = candidates[index];
    return (
      candidate !== undefined &&
      candidate.surface === "customer_facing" &&
      !candidate.hasBoundaryNote &&
      CUSTOMER_FACING_SENSITIVE_PATTERNS.some((pattern) => pattern.test(candidate.text)) &&
      (result.decision === "allow" || result.decision === "allow_with_boundary_context")
    );
  }).length;
  const runtimeRewriteAttempted = results.filter((result) =>
    result.reasonCodes.includes("runtime_rewrite_not_allowed"),
  ).length;
  const rewriteRequired = results.filter((result) => result.decision === "rewrite_required").length;
  const rejected = results.filter((result) => result.decision === "reject").length;
  const documentResults = results.filter((result, index) =>
    candidates[index]?.source === "document_scan",
  );
  const documentRewriteRequired = documentResults.filter((result) =>
    result.decision === "rewrite_required",
  ).length;
  const documentRejected = documentResults.filter((result) => result.decision === "reject").length;

  return {
    totalCandidates: candidates.length,
    expectedMatches,
    acceptedForbiddenPositioning,
    acceptedCustomerFacingSensitiveWithoutBoundary,
    runtimeRewriteAttempted,
    rewriteRequired,
    rejected,
    documentCandidatesScanned: documentResults.length,
    documentRewriteRequired,
    documentRejected,
    results,
    overallPassed:
      expectedMatches === candidates.length &&
      acceptedForbiddenPositioning === 0 &&
      acceptedCustomerFacingSensitiveWithoutBoundary === 0 &&
      runtimeRewriteAttempted === 1 &&
      documentRewriteRequired === 0 &&
      documentRejected === 0,
  };
}

function hasSensitiveMessagingTerm(text: string): boolean {
  return (
    FORBIDDEN_POSITIONING_PATTERNS.some((pattern) => pattern.test(text)) ||
    CUSTOMER_FACING_SENSITIVE_PATTERNS.some((pattern) => pattern.test(text))
  );
}

function hasBoundaryNoteContext(text: string): boolean {
  return BOUNDARY_NOTE_PATTERNS.some((pattern) => pattern.test(text));
}

function buildMessagingGuardResult(
  candidate: MessagingCopyCandidate,
  decision: MessagingGuardDecision,
  reasonCodes: Set<MessagingGuardReasonCode>,
): MessagingGuardResult {
  return {
    id: candidate.id,
    decision,
    reasonCodes: [...reasonCodes],
    boundaryNoteRequired:
      decision === "rewrite_required" || decision === "allow_with_boundary_context",
    rewriteSuggestions:
      decision === "allow" || decision === "allow_with_boundary_context"
        ? []
        : APPROVED_POSITIONING_REPLACEMENTS,
  };
}
