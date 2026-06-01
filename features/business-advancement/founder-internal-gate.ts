/**
 * Helm Business Advancement — Founder-led internal gate.
 *
 * This is an OPC-stage decision aggregator. It allows only disabled internal
 * dogfooding preparation when the founder decision packet, P0 release hygiene,
 * Phase 3N prototype review, and five review lenses are all present.
 *
 * It is NOT production query adoption, NOT a runtime adapter, NOT a DB reader,
 * NOT an API, NOT a page integration, NOT a schema change, NOT an official
 * write path, and NOT automated execution authority.
 */

import {
  PHASE3N_INTERNAL_PROTOTYPE_REVIEW_POSTURE,
  PHASE3N_RUNTIME_ADOPTION_POSTURE,
  evaluatePhase3nInternalPrototypeReview,
  type Phase3nEvaluationResult,
} from "./phase3n-internal-prototype-review";
import {
  ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_RUNTIME_ADOPTION,
  DEFAULT_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT,
  evaluateAskHelmInteractionRuntimeAdoptionGate,
  type AskHelmInteractionRuntimeAdoptionReviewPacket,
} from "./ask-helm-interaction-runtime-adoption-gate";
import {
  DEFAULT_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT,
  PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_RUNTIME_ADOPTION,
  evaluateProductionQueryAdoptionApprovalGate,
  type ProductionQueryAdoptionApprovalGateResult,
} from "./production-query-adoption-approval-gate";

export const FOUNDER_INTERNAL_GATE_RULE_VERSION =
  "founder-internal-gate/v1" as const;

export const FOUNDER_INTERNAL_GATE_POSTURE = "OPC-Internal-Only" as const;

export const FOUNDER_INTERNAL_GATE_RUNTIME_ADOPTION = "No-Go" as const;

export type FounderInternalGateDecision =
  | "Go-For-Disabled-Internal-Dogfooding"
  | "Revise";

export interface FounderDecisionPacketEvidence {
  readonly founderApproved: boolean;
  readonly approverRole: "Founder" | "Owner";
  readonly decisionPacketPath: string;
  readonly approvedAtIso: string;
  readonly evidenceNotes: string;
}

export interface PublicReleaseHygieneEvidence {
  readonly publicReleaseGuardPassed: boolean;
  readonly closeoutReportPath: string;
  readonly scannedFileCount: number;
  readonly blockerCount: number;
}

export interface FounderInternalReviewLensCoverage {
  readonly engineering: boolean;
  readonly product: boolean;
  readonly security: boolean;
  readonly operations: boolean;
  readonly dataProtection: boolean;
}

export interface FounderInternalScopeProof {
  readonly disabledByDefault: boolean;
  readonly reservedOrInternalOnly: boolean;
  readonly noProductionQueryChange: boolean;
  readonly noSchemaChange: boolean;
  readonly noApiRouteChange: boolean;
  readonly noPageBehaviorChange: boolean;
  readonly noOfficialWrite: boolean;
  readonly noAutoExecution: boolean;
  readonly rollbackOwnerPresent: boolean;
}

export interface FounderInternalGateInput {
  readonly founderDecision: FounderDecisionPacketEvidence;
  readonly publicReleaseHygiene: PublicReleaseHygieneEvidence;
  readonly reviewLenses: FounderInternalReviewLensCoverage;
  readonly internalScope: FounderInternalScopeProof;
  readonly phase3nReview: Phase3nEvaluationResult;
  readonly productionQueryGate: ProductionQueryAdoptionApprovalGateResult;
  readonly askHelmRuntimeGate: AskHelmInteractionRuntimeAdoptionReviewPacket;
}

export interface FounderInternalGateCheck {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
  readonly blocker?: string;
}

export interface FounderInternalGateResult {
  readonly ruleVersion: typeof FOUNDER_INTERNAL_GATE_RULE_VERSION;
  readonly posture: typeof FOUNDER_INTERNAL_GATE_POSTURE;
  readonly runtimeAdoption: typeof FOUNDER_INTERNAL_GATE_RUNTIME_ADOPTION;
  readonly decision: FounderInternalGateDecision;
  readonly productionQueryAdoptionAllowed: false;
  readonly runtimeIntegrationAllowed: false;
  readonly publicTrialAllowed: false;
  readonly checks: readonly FounderInternalGateCheck[];
  readonly blockers: readonly string[];
  readonly allowedNextStep: string;
  readonly forbiddenWork: readonly string[];
}

export const FOUNDER_INTERNAL_GATE_FORBIDDEN_WORK = [
  "Do not modify data/queries.ts",
  "Do not modify the mobile read model",
  "Do not add or modify Prisma schema or migrations",
  "Do not add app route or API route authority",
  "Do not enable production query adoption",
  "Do not persist Ask Helm conversation history",
  "Do not create official write, auto-send, auto-approve, auto-pay, auto-execute, or auto-commit authority",
  "Do not bypass redacted real-data calibration, required reviewer approval, privacy review, or public trial evidence gates",
] as const;

const DISABLED_INTERNAL_NEXT_STEP =
  "Proceed with disabled-by-default internal dogfooding preparation only. Keep production query adoption, runtime integration, public trial, official write, and auto-execution blocked.";

const REVISE_NEXT_STEP =
  "Resolve founder packet, release hygiene, review-lens, or disabled-scope blockers before any internal dogfooding preparation continues.";

export const DEFAULT_FOUNDER_INTERNAL_GATE_INPUT: FounderInternalGateInput = {
  founderDecision: {
    founderApproved: false,
    approverRole: "Founder",
    decisionPacketPath:
      "docs/_planning/HELM_FOUNDER_DECISION_PACKET_P0_RELEASE_AND_ADVANCEMENT.md",
    approvedAtIso: "",
    evidenceNotes: "",
  },
  publicReleaseHygiene: {
    publicReleaseGuardPassed: false,
    closeoutReportPath: "docs/reviews/HELM_P0_PUBLIC_RELEASE_HYGIENE_CLOSEOUT.md",
    scannedFileCount: 0,
    blockerCount: 1,
  },
  reviewLenses: {
    engineering: true,
    product: true,
    security: true,
    operations: true,
    dataProtection: true,
  },
  internalScope: {
    disabledByDefault: true,
    reservedOrInternalOnly: true,
    noProductionQueryChange: true,
    noSchemaChange: true,
    noApiRouteChange: true,
    noPageBehaviorChange: true,
    noOfficialWrite: true,
    noAutoExecution: true,
    rollbackOwnerPresent: true,
  },
  phase3nReview: evaluatePhase3nInternalPrototypeReview(),
  productionQueryGate: evaluateProductionQueryAdoptionApprovalGate(
    DEFAULT_PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_INPUT,
  ),
  askHelmRuntimeGate: evaluateAskHelmInteractionRuntimeAdoptionGate(
    DEFAULT_ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_INPUT,
  ),
};

export const POSITIVE_FOUNDER_INTERNAL_GATE_INPUT: FounderInternalGateInput = {
  ...DEFAULT_FOUNDER_INTERNAL_GATE_INPUT,
  founderDecision: {
    founderApproved: true,
    approverRole: "Founder",
    decisionPacketPath:
      "docs/_planning/HELM_FOUNDER_DECISION_PACKET_P0_RELEASE_AND_ADVANCEMENT.md",
    approvedAtIso: "2026-04-30T00:00:00.000Z",
    evidenceNotes:
      "Founder approved disabled internal dogfooding preparation after P0 release hygiene closeout. Production adoption remains blocked.",
  },
  publicReleaseHygiene: {
    publicReleaseGuardPassed: true,
    closeoutReportPath: "docs/reviews/HELM_P0_PUBLIC_RELEASE_HYGIENE_CLOSEOUT.md",
    scannedFileCount: 2913,
    blockerCount: 0,
  },
};

export function evaluateFounderInternalGate(
  input: FounderInternalGateInput = DEFAULT_FOUNDER_INTERNAL_GATE_INPUT,
): FounderInternalGateResult {
  const checks = buildFounderInternalGateChecks(input);
  const blockers = checks.flatMap((check) =>
    check.pass || !check.blocker ? [] : [check.blocker],
  );
  const decision: FounderInternalGateDecision =
    blockers.length === 0 ? "Go-For-Disabled-Internal-Dogfooding" : "Revise";

  return {
    ruleVersion: FOUNDER_INTERNAL_GATE_RULE_VERSION,
    posture: FOUNDER_INTERNAL_GATE_POSTURE,
    runtimeAdoption: FOUNDER_INTERNAL_GATE_RUNTIME_ADOPTION,
    decision,
    productionQueryAdoptionAllowed: false,
    runtimeIntegrationAllowed: false,
    publicTrialAllowed: false,
    checks,
    blockers,
    allowedNextStep:
      decision === "Go-For-Disabled-Internal-Dogfooding"
        ? DISABLED_INTERNAL_NEXT_STEP
        : REVISE_NEXT_STEP,
    forbiddenWork: [...FOUNDER_INTERNAL_GATE_FORBIDDEN_WORK],
  };
}

function buildFounderInternalGateChecks(
  input: FounderInternalGateInput,
): FounderInternalGateCheck[] {
  return [
    checkFounderDecision(input.founderDecision),
    checkPublicReleaseHygiene(input.publicReleaseHygiene),
    checkReviewLenses(input.reviewLenses),
    checkInternalScope(input.internalScope),
    checkPhase3nReview(input.phase3nReview),
    checkProductionQueryGate(input.productionQueryGate),
    checkAskHelmRuntimeGate(input.askHelmRuntimeGate),
  ];
}

function checkFounderDecision(
  evidence: FounderDecisionPacketEvidence,
): FounderInternalGateCheck {
  const strictIso = isStrictUtcIso(evidence.approvedAtIso);
  const pass =
    evidence.founderApproved &&
    evidence.decisionPacketPath.length > 0 &&
    strictIso &&
    evidence.evidenceNotes.trim().length > 0;

  return {
    name: "founder_decision_packet_approved",
    pass,
    detail: pass
      ? `Founder decision packet approved by ${evidence.approverRole} at ${evidence.approvedAtIso}.`
      : `Founder approval incomplete: approved=${String(evidence.founderApproved)} path=${evidence.decisionPacketPath || "<missing>"} strictIso=${String(strictIso)} notes=${String(evidence.evidenceNotes.trim().length > 0)}.`,
    blocker: pass
      ? undefined
      : "Founder decision packet must be explicitly approved with strict UTC timestamp and evidence notes.",
  };
}

function checkPublicReleaseHygiene(
  evidence: PublicReleaseHygieneEvidence,
): FounderInternalGateCheck {
  const pass =
    evidence.publicReleaseGuardPassed &&
    evidence.blockerCount === 0 &&
    evidence.scannedFileCount > 0 &&
    evidence.closeoutReportPath.length > 0;

  return {
    name: "public_release_hygiene_closed",
    pass,
    detail: pass
      ? `Public-release guard passed: scannedFileCount=${evidence.scannedFileCount}, blockerCount=0, closeout=${evidence.closeoutReportPath}.`
      : `Public-release hygiene incomplete: passed=${String(evidence.publicReleaseGuardPassed)} scanned=${evidence.scannedFileCount} blockers=${evidence.blockerCount}.`,
    blocker: pass
      ? undefined
      : "P0 public-release hygiene must be closed before Business Advancement internal dogfooding preparation continues.",
  };
}

function checkReviewLenses(
  lenses: FounderInternalReviewLensCoverage,
): FounderInternalGateCheck {
  const missing = Object.entries(lenses)
    .filter(([, covered]) => !covered)
    .map(([name]) => name);
  const pass = missing.length === 0;

  return {
    name: "five_review_lenses_covered",
    pass,
    detail: pass
      ? "Engineering, Product, Security, Operations, and Data Protection review lenses are covered in the founder-led packet."
      : `Missing review lenses: ${missing.join(", ")}.`,
    blocker: pass
      ? undefined
      : "Founder-led internal gate must cover all five required review lenses.",
  };
}

function checkInternalScope(
  scope: FounderInternalScopeProof,
): FounderInternalGateCheck {
  const entries = Object.entries(scope);
  const failed = entries.filter(([, value]) => value !== true).map(([key]) => key);
  const pass = failed.length === 0;

  return {
    name: "internal_scope_disabled_read_only",
    pass,
    detail: pass
      ? "Internal scope is disabled-by-default, internal-only, read-only, rollback-owned, and free of schema/API/page/official-write/auto-execution changes."
      : `Internal scope failed: ${failed.join(", ")}.`,
    blocker: pass
      ? undefined
      : "Internal dogfooding preparation must stay disabled, internal-only, read-only, and rollback-owned.",
  };
}

function checkPhase3nReview(
  review: Phase3nEvaluationResult,
): FounderInternalGateCheck {
  const pass =
    review.allPass &&
    review.internalPrototypeReviewPosture ===
      PHASE3N_INTERNAL_PROTOTYPE_REVIEW_POSTURE &&
    review.runtimeAdoptionPosture === PHASE3N_RUNTIME_ADOPTION_POSTURE;

  return {
    name: "phase3n_internal_prototype_review_complete",
    pass,
    detail: pass
      ? `Phase 3N review complete: ${review.passedCount}/${review.totalChecks} checks passed; runtime adoption remains ${review.runtimeAdoptionPosture}.`
      : `Phase 3N review incomplete: allPass=${String(review.allPass)} posture=${review.internalPrototypeReviewPosture} runtime=${review.runtimeAdoptionPosture}.`,
    blocker: pass
      ? undefined
      : "Phase 3N internal prototype review must pass before founder-led internal dogfooding preparation.",
  };
}

function checkProductionQueryGate(
  gate: ProductionQueryAdoptionApprovalGateResult,
): FounderInternalGateCheck {
  const pass =
    gate.runtimeAdoption === PRODUCTION_QUERY_ADOPTION_APPROVAL_GATE_RUNTIME_ADOPTION &&
    gate.productionAdoptionAllowed === false &&
    gate.runtimeIntegrationAllowed === false;

  return {
    name: "production_query_adoption_remains_blocked",
    pass,
    detail: pass
      ? `Production query gate remains ${gate.runtimeAdoption}; decision=${gate.decision}; productionAdoptionAllowed=false; runtimeIntegrationAllowed=false.`
      : `Production query gate unsafe: runtime=${gate.runtimeAdoption}, productionAllowed=${String(gate.productionAdoptionAllowed)}, runtimeAllowed=${String(gate.runtimeIntegrationAllowed)}.`,
    blocker: pass
      ? undefined
      : "Production query adoption and runtime integration must remain blocked in the founder internal gate.",
  };
}

function checkAskHelmRuntimeGate(
  gate: AskHelmInteractionRuntimeAdoptionReviewPacket,
): FounderInternalGateCheck {
  const pass =
    gate.runtimeAdoption ===
      ASK_HELM_INTERACTION_RUNTIME_ADOPTION_GATE_RUNTIME_ADOPTION &&
    gate.productionAdoptionAllowed === false &&
    gate.runtimeIntegrationAllowed === false;

  return {
    name: "ask_helm_runtime_adoption_remains_blocked",
    pass,
    detail: pass
      ? `Ask Helm runtime gate remains ${gate.runtimeAdoption}; decision=${gate.decision}; productionAdoptionAllowed=false; runtimeIntegrationAllowed=false.`
      : `Ask Helm runtime gate unsafe: runtime=${gate.runtimeAdoption}, productionAllowed=${String(gate.productionAdoptionAllowed)}, runtimeAllowed=${String(gate.runtimeIntegrationAllowed)}.`,
    blocker: pass
      ? undefined
      : "Ask Helm runtime adoption must remain blocked in the founder internal gate.",
  };
}

function isStrictUtcIso(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  return new Date(value).toISOString() === value;
}
