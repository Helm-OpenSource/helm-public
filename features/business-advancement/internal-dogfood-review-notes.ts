/**
 * Helm Business Advancement — internal dogfooding review notes packet.
 *
 * Pure review-note evaluator for OPC-stage internal dogfooding. It converts
 * manual reviewer notes over a disabled internal dogfood packet into a founder
 * review summary.
 *
 * It is NOT production query adoption, NOT a runtime adapter, NOT a DB reader,
 * NOT an API, NOT a page integration, NOT a schema change, NOT an official
 * write path, and NOT automated execution authority.
 */

import {
  INTERNAL_DOGFOOD_PACKET_RULE_VERSION,
  INTERNAL_DOGFOOD_PACKET_RUNTIME_ADOPTION,
  POSITIVE_INTERNAL_DOGFOOD_PACKET_INPUT,
  buildInternalDogfoodPacket,
  type InternalDogfoodCandidateGroup,
  type InternalDogfoodPacket,
} from "./internal-dogfood-packet";

export const INTERNAL_DOGFOOD_REVIEW_NOTES_RULE_VERSION =
  "business-advancement-internal-dogfood-review-notes/v1" as const;

export const INTERNAL_DOGFOOD_REVIEW_NOTES_POSTURE =
  "Manual-Review-Notes-Only" as const;

export const INTERNAL_DOGFOOD_REVIEW_NOTES_RUNTIME_ADOPTION = "No-Go" as const;

export type InternalDogfoodReviewNotesDecision =
  | "Ready-For-Founder-Review"
  | "Blocked";

export type InternalDogfoodReviewLens =
  | "engineering"
  | "product"
  | "security"
  | "operations"
  | "data_protection";

export type InternalDogfoodReviewVerdict =
  | "accept_for_internal_dogfood"
  | "revise_threshold"
  | "missing_evidence"
  | "false_positive"
  | "stop";

export type InternalDogfoodReviewNextStep =
  | "continue_disabled_internal_dogfood"
  | "revise_packet"
  | "return_to_calibration"
  | "stop";

export type InternalDogfoodFounderRecommendation =
  | "Continue-Disabled-Internal-Dogfooding"
  | "Revise-Before-Next-Internal-Dogfood"
  | "Stop-And-Return-To-Calibration"
  | "Blocked";

export type InternalDogfoodFamilyId = InternalDogfoodCandidateGroup["familyId"];

export interface InternalDogfoodReviewContext {
  readonly reviewId: string;
  readonly preparedBy: string;
  readonly preparedAtIso: string;
}

export interface InternalDogfoodReviewNote {
  readonly noteId: string;
  readonly reviewerLens: InternalDogfoodReviewLens;
  readonly reviewerId: string;
  readonly reviewedAtIso: string;
  readonly familyId: InternalDogfoodFamilyId;
  readonly verdict: InternalDogfoodReviewVerdict;
  readonly evidenceRefs: readonly string[];
  readonly notes: string;
  readonly recommendedNextStep: InternalDogfoodReviewNextStep;
}

export interface InternalDogfoodReviewNotesInput {
  readonly reviewContext: InternalDogfoodReviewContext;
  readonly packet: InternalDogfoodPacket;
  readonly notes: readonly InternalDogfoodReviewNote[];
}

export interface InternalDogfoodReviewNotesJsonInput {
  readonly reviewContext: InternalDogfoodReviewContext;
  readonly notes: readonly InternalDogfoodReviewNote[];
}

export interface InternalDogfoodReviewNotesCheck {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
  readonly blocker?: string;
}

export interface InternalDogfoodReviewLensCoverage {
  readonly lens: InternalDogfoodReviewLens;
  readonly covered: boolean;
  readonly noteCount: number;
}

export interface InternalDogfoodReviewFamilyCoverage {
  readonly familyId: InternalDogfoodFamilyId;
  readonly required: boolean;
  readonly covered: boolean;
  readonly includedCount: number;
  readonly noteCount: number;
}

export interface InternalDogfoodReviewMetrics {
  readonly totalNotes: number;
  readonly acceptCount: number;
  readonly falsePositiveCount: number;
  readonly missingEvidenceCount: number;
  readonly thresholdConcernCount: number;
  readonly stopCount: number;
}

export interface InternalDogfoodReviewNotesPacket {
  readonly ruleVersion: typeof INTERNAL_DOGFOOD_REVIEW_NOTES_RULE_VERSION;
  readonly posture: typeof INTERNAL_DOGFOOD_REVIEW_NOTES_POSTURE;
  readonly runtimeAdoption: typeof INTERNAL_DOGFOOD_REVIEW_NOTES_RUNTIME_ADOPTION;
  readonly sourcePacketRuleVersion: typeof INTERNAL_DOGFOOD_PACKET_RULE_VERSION;
  readonly sourcePacketRuntimeAdoption: typeof INTERNAL_DOGFOOD_PACKET_RUNTIME_ADOPTION;
  readonly decision: InternalDogfoodReviewNotesDecision;
  readonly founderRecommendation: InternalDogfoodFounderRecommendation;
  readonly productionQueryAdoptionAllowed: false;
  readonly runtimeIntegrationAllowed: false;
  readonly publicTrialAllowed: false;
  readonly reviewContext: InternalDogfoodReviewContext;
  readonly sourcePacketId: string;
  readonly lensCoverage: readonly InternalDogfoodReviewLensCoverage[];
  readonly familyCoverage: readonly InternalDogfoodReviewFamilyCoverage[];
  readonly metrics: InternalDogfoodReviewMetrics;
  readonly checks: readonly InternalDogfoodReviewNotesCheck[];
  readonly blockers: readonly string[];
  readonly founderReviewSummary: string;
  readonly boundaryNotes: readonly string[];
}

export const REQUIRED_INTERNAL_DOGFOOD_REVIEW_LENSES = [
  "engineering",
  "product",
  "security",
  "operations",
  "data_protection",
] as const satisfies readonly InternalDogfoodReviewLens[];

export const INTERNAL_DOGFOOD_REVIEW_NOTES_BOUNDARIES = [
  "Review notes do not approve production query adoption.",
  "Review notes do not approve runtime integration, API, page behavior, schema, or mobile read-model changes.",
  "Review notes do not create official write, customer-facing send, approval, payment, or automated execution authority.",
  "Any request for production data must return to redacted real-data calibration and required reviewer approval.",
] as const;

export const DEFAULT_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT: InternalDogfoodReviewNotesInput =
  {
    reviewContext: {
      reviewId: "ba-internal-dogfood-review-default",
      preparedBy: "",
      preparedAtIso: "",
    },
    packet: buildInternalDogfoodPacket(),
    notes: [],
  };

export const POSITIVE_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT: InternalDogfoodReviewNotesInput =
  {
    reviewContext: {
      reviewId: "ba-internal-dogfood-review-2026-04-30",
      preparedBy: "codex",
      preparedAtIso: "2026-04-30T00:00:00.000Z",
    },
    packet: buildInternalDogfoodPacket(POSITIVE_INTERNAL_DOGFOOD_PACKET_INPUT),
    notes: [
      buildPositiveNote("engineering", "TPQR-001", "ba-dogfood-note-001"),
      buildPositiveNote("product", "TPQR-003", "ba-dogfood-note-002"),
      buildPositiveNote("security", "TPQR-004", "ba-dogfood-note-003"),
      buildPositiveNote("operations", "TPQR-004", "ba-dogfood-note-004"),
      buildPositiveNote("data_protection", "TPQR-001", "ba-dogfood-note-005"),
    ],
  };

export function buildInternalDogfoodReviewNotesInputFromJson(
  value: unknown,
  sourcePacket: InternalDogfoodPacket = buildInternalDogfoodPacket(
    POSITIVE_INTERNAL_DOGFOOD_PACKET_INPUT,
  ),
): InternalDogfoodReviewNotesInput {
  assertJsonInputShape(value);
  return {
    reviewContext: value.reviewContext,
    packet: sourcePacket,
    notes: value.notes,
  };
}

export function buildInternalDogfoodReviewNotesPacket(
  input: InternalDogfoodReviewNotesInput = DEFAULT_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT,
): InternalDogfoodReviewNotesPacket {
  const lensCoverage = buildLensCoverage(input.notes);
  const familyCoverage = buildFamilyCoverage(input.packet.candidateGroups, input.notes);
  const metrics = buildMetrics(input.notes);
  const checks = buildChecks(input, lensCoverage, familyCoverage, metrics);
  const blockers = checks.flatMap((check) =>
    check.pass || !check.blocker ? [] : [check.blocker],
  );
  const decision: InternalDogfoodReviewNotesDecision =
    blockers.length === 0 ? "Ready-For-Founder-Review" : "Blocked";
  const founderRecommendation = buildFounderRecommendation(decision, metrics);

  return {
    ruleVersion: INTERNAL_DOGFOOD_REVIEW_NOTES_RULE_VERSION,
    posture: INTERNAL_DOGFOOD_REVIEW_NOTES_POSTURE,
    runtimeAdoption: INTERNAL_DOGFOOD_REVIEW_NOTES_RUNTIME_ADOPTION,
    sourcePacketRuleVersion: INTERNAL_DOGFOOD_PACKET_RULE_VERSION,
    sourcePacketRuntimeAdoption: INTERNAL_DOGFOOD_PACKET_RUNTIME_ADOPTION,
    decision,
    founderRecommendation,
    productionQueryAdoptionAllowed: false,
    runtimeIntegrationAllowed: false,
    publicTrialAllowed: false,
    reviewContext: input.reviewContext,
    sourcePacketId: input.packet.operatorContext.packetId,
    lensCoverage,
    familyCoverage,
    metrics,
    checks,
    blockers,
    founderReviewSummary: buildFounderReviewSummary(decision, founderRecommendation, metrics),
    boundaryNotes: [...INTERNAL_DOGFOOD_REVIEW_NOTES_BOUNDARIES],
  };
}

function buildPositiveNote(
  reviewerLens: InternalDogfoodReviewLens,
  familyId: InternalDogfoodFamilyId,
  noteId: string,
): InternalDogfoodReviewNote {
  return {
    noteId,
    reviewerLens,
    reviewerId: `${reviewerLens}-reviewer`,
    reviewedAtIso: "2026-04-30T00:00:00.000Z",
    familyId,
    verdict: "accept_for_internal_dogfood",
    evidenceRefs: [`internal-dogfood-packet:${familyId}`],
    notes:
      "Candidate group is acceptable for disabled internal dogfooding review only; no production adoption is approved.",
    recommendedNextStep: "continue_disabled_internal_dogfood",
  };
}

function buildLensCoverage(
  notes: readonly InternalDogfoodReviewNote[],
): InternalDogfoodReviewLensCoverage[] {
  return REQUIRED_INTERNAL_DOGFOOD_REVIEW_LENSES.map((lens) => {
    const noteCount = notes.filter((note) => note.reviewerLens === lens).length;
    return { lens, covered: noteCount > 0, noteCount };
  });
}

function buildFamilyCoverage(
  groups: readonly InternalDogfoodCandidateGroup[],
  notes: readonly InternalDogfoodReviewNote[],
): InternalDogfoodReviewFamilyCoverage[] {
  return groups.map((group) => {
    const required = group.includedCount > 0;
    const noteCount = notes.filter((note) => note.familyId === group.familyId).length;
    return {
      familyId: group.familyId,
      required,
      covered: !required || noteCount > 0,
      includedCount: group.includedCount,
      noteCount,
    };
  });
}

function buildMetrics(
  notes: readonly InternalDogfoodReviewNote[],
): InternalDogfoodReviewMetrics {
  return {
    totalNotes: notes.length,
    acceptCount: countVerdict(notes, "accept_for_internal_dogfood"),
    falsePositiveCount: countVerdict(notes, "false_positive"),
    missingEvidenceCount: countVerdict(notes, "missing_evidence"),
    thresholdConcernCount: countVerdict(notes, "revise_threshold"),
    stopCount: countVerdict(notes, "stop"),
  };
}

function countVerdict(
  notes: readonly InternalDogfoodReviewNote[],
  verdict: InternalDogfoodReviewVerdict,
): number {
  return notes.filter((note) => note.verdict === verdict).length;
}

function buildChecks(
  input: InternalDogfoodReviewNotesInput,
  lensCoverage: readonly InternalDogfoodReviewLensCoverage[],
  familyCoverage: readonly InternalDogfoodReviewFamilyCoverage[],
  metrics: InternalDogfoodReviewMetrics,
): InternalDogfoodReviewNotesCheck[] {
  return [
    checkReviewContext(input.reviewContext),
    checkSourcePacket(input.packet),
    checkLensCoverage(lensCoverage),
    checkFamilyCoverage(familyCoverage),
    checkNoteQuality(input.notes),
    checkNoStopRecommendation(metrics),
  ];
}

function checkReviewContext(
  context: InternalDogfoodReviewContext,
): InternalDogfoodReviewNotesCheck {
  const strictIso = isStrictUtcIso(context.preparedAtIso);
  const pass =
    context.reviewId.trim().length > 0 &&
    context.preparedBy.trim().length > 0 &&
    strictIso;

  return {
    name: "review_context_present",
    pass,
    detail: pass
      ? `Review ${context.reviewId} prepared by ${context.preparedBy} at ${context.preparedAtIso}.`
      : `Review context incomplete: reviewId=${context.reviewId || "<missing>"} preparedBy=${context.preparedBy || "<missing>"} strictIso=${String(strictIso)}.`,
    blocker: pass
      ? undefined
      : "Internal dogfood review notes require reviewId, preparer, and strict UTC timestamp.",
  };
}

function checkSourcePacket(packet: InternalDogfoodPacket): InternalDogfoodReviewNotesCheck {
  const pass =
    packet.decision === "Ready-For-Internal-Dogfooding" &&
    packet.runtimeAdoption === "No-Go" &&
    packet.productionQueryAdoptionAllowed === false &&
    packet.runtimeIntegrationAllowed === false &&
    packet.publicTrialAllowed === false;

  return {
    name: "source_packet_ready_and_safe",
    pass,
    detail: pass
      ? `Source packet ${packet.operatorContext.packetId} is ready for disabled internal dogfooding and keeps production/runtime/public trial blocked.`
      : `Source packet unsafe or blocked: decision=${packet.decision}, runtime=${packet.runtimeAdoption}, production=${String(packet.productionQueryAdoptionAllowed)}, runtimeIntegration=${String(packet.runtimeIntegrationAllowed)}, publicTrial=${String(packet.publicTrialAllowed)}.`,
    blocker: pass
      ? undefined
      : "Review notes require a Ready-For-Internal-Dogfooding source packet that still blocks production/runtime/public trial.",
  };
}

function checkLensCoverage(
  coverage: readonly InternalDogfoodReviewLensCoverage[],
): InternalDogfoodReviewNotesCheck {
  const missing = coverage.filter((item) => !item.covered).map((item) => item.lens);
  const pass = missing.length === 0;

  return {
    name: "required_review_lenses_covered",
    pass,
    detail: pass
      ? `All required lenses covered: ${coverage.map((item) => `${item.lens}:${item.noteCount}`).join(", ")}.`
      : `Missing review lenses: ${missing.join(", ")}.`,
    blocker: pass
      ? undefined
      : "Internal dogfood review notes must cover engineering, product, security, operations, and data_protection lenses.",
  };
}

function checkFamilyCoverage(
  coverage: readonly InternalDogfoodReviewFamilyCoverage[],
): InternalDogfoodReviewNotesCheck {
  const missing = coverage
    .filter((item) => item.required && !item.covered)
    .map((item) => item.familyId);
  const pass = missing.length === 0;

  return {
    name: "candidate_families_covered",
    pass,
    detail: pass
      ? `Required candidate families covered: ${coverage.map((item) => `${item.familyId}:${item.noteCount}`).join(", ")}.`
      : `Missing candidate-family notes: ${missing.join(", ")}.`,
    blocker: pass
      ? undefined
      : "Every candidate group with included rows must have at least one review note.",
  };
}

function checkNoteQuality(
  notes: readonly InternalDogfoodReviewNote[],
): InternalDogfoodReviewNotesCheck {
  const invalidCount = notes.filter((note) => !isValidNote(note)).length;
  const pass = notes.length > 0 && invalidCount === 0;

  return {
    name: "review_notes_structured",
    pass,
    detail: pass
      ? `Structured review notes present: total=${notes.length}.`
      : `Structured review notes issue: total=${notes.length}, invalid=${invalidCount}.`,
    blocker: pass
      ? undefined
      : "Review notes must include reviewer identity, strict UTC timestamp, evidence refs, notes, and an allowed next step.",
  };
}

function checkNoStopRecommendation(
  metrics: InternalDogfoodReviewMetrics,
): InternalDogfoodReviewNotesCheck {
  const pass = metrics.stopCount === 0;

  return {
    name: "no_stop_recommendation",
    pass,
    detail: pass
      ? "No reviewer requested stop."
      : `Stop recommendations present: ${metrics.stopCount}.`,
    blocker: pass
      ? undefined
      : "A stop recommendation blocks founder-review readiness and returns the line to calibration or packet revision.",
  };
}

function isValidNote(note: InternalDogfoodReviewNote): boolean {
  return (
    note.noteId.trim().length > 0 &&
    note.reviewerId.trim().length > 0 &&
    isStrictUtcIso(note.reviewedAtIso) &&
    note.evidenceRefs.length > 0 &&
    note.evidenceRefs.every((ref) => ref.trim().length > 0) &&
    note.notes.trim().length > 0 &&
    isNextStepCompatibleWithVerdict(note.verdict, note.recommendedNextStep)
  );
}

function isNextStepCompatibleWithVerdict(
  verdict: InternalDogfoodReviewVerdict,
  nextStep: InternalDogfoodReviewNextStep,
): boolean {
  if (verdict === "stop") {
    return nextStep === "stop" || nextStep === "return_to_calibration";
  }
  if (verdict === "accept_for_internal_dogfood") {
    return nextStep === "continue_disabled_internal_dogfood";
  }
  return nextStep === "revise_packet" || nextStep === "return_to_calibration";
}

function buildFounderRecommendation(
  decision: InternalDogfoodReviewNotesDecision,
  metrics: InternalDogfoodReviewMetrics,
): InternalDogfoodFounderRecommendation {
  if (decision === "Blocked") {
    return metrics.stopCount > 0 ? "Stop-And-Return-To-Calibration" : "Blocked";
  }
  const hasRevisionSignals =
    metrics.falsePositiveCount > 0 ||
    metrics.missingEvidenceCount > 0 ||
    metrics.thresholdConcernCount > 0;
  return hasRevisionSignals
    ? "Revise-Before-Next-Internal-Dogfood"
    : "Continue-Disabled-Internal-Dogfooding";
}

function buildFounderReviewSummary(
  decision: InternalDogfoodReviewNotesDecision,
  recommendation: InternalDogfoodFounderRecommendation,
  metrics: InternalDogfoodReviewMetrics,
): string {
  if (decision === "Blocked") {
    return "Internal dogfood review notes are blocked; do not proceed beyond review-only preparation.";
  }
  return `Internal dogfood review notes are ready for founder review with recommendation=${recommendation}; notes=${metrics.totalNotes}, falsePositive=${metrics.falsePositiveCount}, missingEvidence=${metrics.missingEvidenceCount}, thresholdConcern=${metrics.thresholdConcernCount}.`;
}

function isStrictUtcIso(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  return new Date(value).toISOString() === value;
}

function assertJsonInputShape(
  value: unknown,
): asserts value is InternalDogfoodReviewNotesJsonInput {
  if (!isRecord(value)) {
    throw new Error("Review notes JSON input must be an object.");
  }
  const forbiddenKey = findForbiddenJsonKey(value);
  if (forbiddenKey) {
    throw new Error(`Review notes JSON input must not include authority key: ${forbiddenKey}.`);
  }
  if (!isReviewContext(value.reviewContext)) {
    throw new Error("Review notes JSON input has invalid reviewContext.");
  }
  if (!Array.isArray(value.notes)) {
    throw new Error("Review notes JSON input requires notes array.");
  }
  for (const [index, note] of value.notes.entries()) {
    if (!isReviewNote(note)) {
      throw new Error(`Review notes JSON input has invalid note at index ${index}.`);
    }
  }
}

function findForbiddenJsonKey(value: Record<string, unknown>): string | null {
  const forbidden = [
    "packet",
    "productionQueryAdoptionAllowed",
    "runtimeIntegrationAllowed",
    "publicTrialAllowed",
    "officialWriteAllowed",
    "autoExecutionAllowed",
  ];
  return forbidden.find((key) => Object.prototype.hasOwnProperty.call(value, key)) ?? null;
}

function isReviewContext(value: unknown): value is InternalDogfoodReviewContext {
  return (
    isRecord(value) &&
    typeof value.reviewId === "string" &&
    typeof value.preparedBy === "string" &&
    typeof value.preparedAtIso === "string"
  );
}

function isReviewNote(value: unknown): value is InternalDogfoodReviewNote {
  return (
    isRecord(value) &&
    typeof value.noteId === "string" &&
    isReviewLens(value.reviewerLens) &&
    typeof value.reviewerId === "string" &&
    typeof value.reviewedAtIso === "string" &&
    isFamilyId(value.familyId) &&
    isVerdict(value.verdict) &&
    Array.isArray(value.evidenceRefs) &&
    value.evidenceRefs.every((ref) => typeof ref === "string") &&
    typeof value.notes === "string" &&
    isNextStep(value.recommendedNextStep)
  );
}

function isReviewLens(value: unknown): value is InternalDogfoodReviewLens {
  return (
    value === "engineering" ||
    value === "product" ||
    value === "security" ||
    value === "operations" ||
    value === "data_protection"
  );
}

function isFamilyId(value: unknown): value is InternalDogfoodFamilyId {
  return value === "TPQR-001" || value === "TPQR-003" || value === "TPQR-004";
}

function isVerdict(value: unknown): value is InternalDogfoodReviewVerdict {
  return (
    value === "accept_for_internal_dogfood" ||
    value === "revise_threshold" ||
    value === "missing_evidence" ||
    value === "false_positive" ||
    value === "stop"
  );
}

function isNextStep(value: unknown): value is InternalDogfoodReviewNextStep {
  return (
    value === "continue_disabled_internal_dogfood" ||
    value === "revise_packet" ||
    value === "return_to_calibration" ||
    value === "stop"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
