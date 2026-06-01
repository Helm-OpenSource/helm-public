/**
 * Helm Business Advancement — founder decision gate for internal dogfooding.
 *
 * Pure decision aggregator that consumes internal dogfood review notes and a
 * founder decision record. It can only approve the next disabled internal
 * dogfood iteration.
 *
 * It is NOT production query adoption, NOT a runtime adapter, NOT a DB reader,
 * NOT an API, NOT a page integration, NOT a schema change, NOT an official
 * write path, and NOT automated execution authority.
 */

import {
  INTERNAL_DOGFOOD_REVIEW_NOTES_RULE_VERSION,
  INTERNAL_DOGFOOD_REVIEW_NOTES_RUNTIME_ADOPTION,
  POSITIVE_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT,
  buildInternalDogfoodReviewNotesPacket,
  type InternalDogfoodFounderRecommendation,
  type InternalDogfoodReviewNotesPacket,
} from "./internal-dogfood-review-notes";

export const INTERNAL_DOGFOOD_FOUNDER_DECISION_RULE_VERSION =
  "business-advancement-internal-dogfood-founder-decision/v1" as const;

export const INTERNAL_DOGFOOD_FOUNDER_DECISION_POSTURE =
  "Founder-Decision-For-Disabled-Internal-Dogfood" as const;

export const INTERNAL_DOGFOOD_FOUNDER_DECISION_RUNTIME_ADOPTION = "No-Go" as const;

export type InternalDogfoodFounderDecision =
  | "Approve-Next-Disabled-Internal-Dogfood-Iteration"
  | "Revise-Before-Next-Iteration"
  | "Stop-And-Return-To-Calibration"
  | "Blocked";

export interface InternalDogfoodFounderDecisionRecord {
  readonly founderApproved: boolean;
  readonly approverRole: "Founder" | "Owner";
  readonly decisionPacketPath: string;
  readonly approvedAtIso: string;
  readonly approvedRecommendation: InternalDogfoodFounderRecommendation;
  readonly evidenceNotes: string;
}

export interface InternalDogfoodFounderDecisionInput {
  readonly founderDecision: InternalDogfoodFounderDecisionRecord;
  readonly reviewNotesPacket: InternalDogfoodReviewNotesPacket;
}

export interface InternalDogfoodFounderDecisionCheck {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
  readonly blocker?: string;
}

export interface InternalDogfoodFounderDecisionPacket {
  readonly ruleVersion: typeof INTERNAL_DOGFOOD_FOUNDER_DECISION_RULE_VERSION;
  readonly posture: typeof INTERNAL_DOGFOOD_FOUNDER_DECISION_POSTURE;
  readonly runtimeAdoption: typeof INTERNAL_DOGFOOD_FOUNDER_DECISION_RUNTIME_ADOPTION;
  readonly reviewNotesRuleVersion: typeof INTERNAL_DOGFOOD_REVIEW_NOTES_RULE_VERSION;
  readonly reviewNotesRuntimeAdoption: typeof INTERNAL_DOGFOOD_REVIEW_NOTES_RUNTIME_ADOPTION;
  readonly decision: InternalDogfoodFounderDecision;
  readonly productionQueryAdoptionAllowed: false;
  readonly runtimeIntegrationAllowed: false;
  readonly publicTrialAllowed: false;
  readonly founderDecision: InternalDogfoodFounderDecisionRecord;
  readonly sourceReviewId: string;
  readonly sourceReviewRecommendation: InternalDogfoodFounderRecommendation;
  readonly checks: readonly InternalDogfoodFounderDecisionCheck[];
  readonly blockers: readonly string[];
  readonly allowedNextStep: string;
  readonly forbiddenWork: readonly string[];
}

export const INTERNAL_DOGFOOD_FOUNDER_DECISION_FORBIDDEN_WORK = [
  "Do not modify data/queries.ts",
  "Do not modify the mobile read model",
  "Do not add or modify Prisma schema or migrations",
  "Do not add app route or API route authority",
  "Do not enable production query adoption",
  "Do not enable runtime integration or public trial",
  "Do not create official write, auto-send, auto-approve, auto-pay, auto-execute, or auto-commit authority",
  "Do not bypass redacted real-data calibration or independent reviewer approval for production data.",
] as const;

export const DEFAULT_INTERNAL_DOGFOOD_FOUNDER_DECISION_INPUT: InternalDogfoodFounderDecisionInput =
  {
    founderDecision: {
      founderApproved: false,
      approverRole: "Founder",
      decisionPacketPath:
        "docs/_planning/HELM_FOUNDER_DECISION_PACKET_P0_RELEASE_AND_ADVANCEMENT.md",
      approvedAtIso: "",
      approvedRecommendation: "Blocked",
      evidenceNotes: "",
    },
    reviewNotesPacket: buildInternalDogfoodReviewNotesPacket(),
  };

export const POSITIVE_INTERNAL_DOGFOOD_FOUNDER_DECISION_INPUT: InternalDogfoodFounderDecisionInput =
  {
    founderDecision: {
      founderApproved: true,
      approverRole: "Founder",
      decisionPacketPath:
        "docs/_planning/HELM_FOUNDER_DECISION_PACKET_P0_RELEASE_AND_ADVANCEMENT.md",
      approvedAtIso: "2026-04-30T00:00:00.000Z",
      approvedRecommendation: "Continue-Disabled-Internal-Dogfooding",
      evidenceNotes:
        "Founder approves another disabled internal dogfood iteration after reviewing structured review notes. Production/runtime/public trial remain blocked.",
    },
    reviewNotesPacket: buildInternalDogfoodReviewNotesPacket(
      POSITIVE_INTERNAL_DOGFOOD_REVIEW_NOTES_INPUT,
    ),
  };

export function evaluateInternalDogfoodFounderDecision(
  input: InternalDogfoodFounderDecisionInput = DEFAULT_INTERNAL_DOGFOOD_FOUNDER_DECISION_INPUT,
): InternalDogfoodFounderDecisionPacket {
  const checks = buildChecks(input);
  const blockers = checks.flatMap((check) =>
    check.pass || !check.blocker ? [] : [check.blocker],
  );
  const decision = buildDecision(input, blockers);

  return {
    ruleVersion: INTERNAL_DOGFOOD_FOUNDER_DECISION_RULE_VERSION,
    posture: INTERNAL_DOGFOOD_FOUNDER_DECISION_POSTURE,
    runtimeAdoption: INTERNAL_DOGFOOD_FOUNDER_DECISION_RUNTIME_ADOPTION,
    reviewNotesRuleVersion: INTERNAL_DOGFOOD_REVIEW_NOTES_RULE_VERSION,
    reviewNotesRuntimeAdoption: INTERNAL_DOGFOOD_REVIEW_NOTES_RUNTIME_ADOPTION,
    decision,
    productionQueryAdoptionAllowed: false,
    runtimeIntegrationAllowed: false,
    publicTrialAllowed: false,
    founderDecision: input.founderDecision,
    sourceReviewId: input.reviewNotesPacket.reviewContext.reviewId,
    sourceReviewRecommendation: input.reviewNotesPacket.founderRecommendation,
    checks,
    blockers,
    allowedNextStep: buildAllowedNextStep(decision),
    forbiddenWork: [...INTERNAL_DOGFOOD_FOUNDER_DECISION_FORBIDDEN_WORK],
  };
}

function buildChecks(
  input: InternalDogfoodFounderDecisionInput,
): InternalDogfoodFounderDecisionCheck[] {
  return [
    checkReviewNotesPacket(input.reviewNotesPacket),
    checkFounderDecisionRecord(input.founderDecision),
    checkFounderMatchesReviewRecommendation(input),
  ];
}

function checkReviewNotesPacket(
  packet: InternalDogfoodReviewNotesPacket,
): InternalDogfoodFounderDecisionCheck {
  const pass =
    packet.decision === "Ready-For-Founder-Review" &&
    packet.runtimeAdoption === "No-Go" &&
    packet.productionQueryAdoptionAllowed === false &&
    packet.runtimeIntegrationAllowed === false &&
    packet.publicTrialAllowed === false;

  return {
    name: "review_notes_ready_and_safe",
    pass,
    detail: pass
      ? `Review notes ${packet.reviewContext.reviewId} are ready for founder review and keep production/runtime/public trial blocked.`
      : `Review notes unsafe or blocked: decision=${packet.decision}, runtime=${packet.runtimeAdoption}, production=${String(packet.productionQueryAdoptionAllowed)}, runtimeIntegration=${String(packet.runtimeIntegrationAllowed)}, publicTrial=${String(packet.publicTrialAllowed)}.`,
    blocker: pass
      ? undefined
      : "Founder decision requires Ready-For-Founder-Review notes that still block production/runtime/public trial.",
  };
}

function checkFounderDecisionRecord(
  record: InternalDogfoodFounderDecisionRecord,
): InternalDogfoodFounderDecisionCheck {
  const strictIso = isStrictUtcIso(record.approvedAtIso);
  const pass =
    record.founderApproved &&
    record.decisionPacketPath.trim().length > 0 &&
    strictIso &&
    record.evidenceNotes.trim().length > 0 &&
    record.approvedRecommendation !== "Blocked";

  return {
    name: "founder_decision_record_complete",
    pass,
    detail: pass
      ? `Founder decision approved by ${record.approverRole} at ${record.approvedAtIso} for ${record.approvedRecommendation}.`
      : `Founder decision incomplete: approved=${String(record.founderApproved)} path=${record.decisionPacketPath || "<missing>"} strictIso=${String(strictIso)} recommendation=${record.approvedRecommendation} notes=${String(record.evidenceNotes.trim().length > 0)}.`,
    blocker: pass
      ? undefined
      : "Founder decision record must approve a non-blocked recommendation with strict UTC timestamp, path, and evidence notes.",
  };
}

function checkFounderMatchesReviewRecommendation(
  input: InternalDogfoodFounderDecisionInput,
): InternalDogfoodFounderDecisionCheck {
  const pass =
    input.founderDecision.approvedRecommendation ===
    input.reviewNotesPacket.founderRecommendation;

  return {
    name: "founder_decision_matches_review_summary",
    pass,
    detail: pass
      ? `Founder decision matches review recommendation ${input.reviewNotesPacket.founderRecommendation}.`
      : `Founder decision ${input.founderDecision.approvedRecommendation} does not match review recommendation ${input.reviewNotesPacket.founderRecommendation}.`,
    blocker: pass
      ? undefined
      : "Founder decision must explicitly approve the same recommendation produced by the review notes packet.",
  };
}

function buildDecision(
  input: InternalDogfoodFounderDecisionInput,
  blockers: readonly string[],
): InternalDogfoodFounderDecision {
  if (blockers.length > 0) {
    return "Blocked";
  }
  switch (input.reviewNotesPacket.founderRecommendation) {
    case "Continue-Disabled-Internal-Dogfooding":
      return "Approve-Next-Disabled-Internal-Dogfood-Iteration";
    case "Revise-Before-Next-Internal-Dogfood":
      return "Revise-Before-Next-Iteration";
    case "Stop-And-Return-To-Calibration":
      return "Stop-And-Return-To-Calibration";
    case "Blocked":
      return "Blocked";
  }
}

function buildAllowedNextStep(decision: InternalDogfoodFounderDecision): string {
  switch (decision) {
    case "Approve-Next-Disabled-Internal-Dogfood-Iteration":
      return "Run the next disabled internal dogfood iteration only; keep production query adoption, runtime integration, public trial, official write, and auto-execution blocked.";
    case "Revise-Before-Next-Iteration":
      return "Revise the dogfood packet or thresholds before the next disabled internal iteration.";
    case "Stop-And-Return-To-Calibration":
      return "Stop internal dogfooding and return to calibration or packet redesign.";
    case "Blocked":
      return "Resolve review-note or founder-decision blockers before any internal dogfood iteration continues.";
  }
}

function isStrictUtcIso(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  return new Date(value).toISOString() === value;
}
