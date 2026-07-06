import {
  ALLOWED_USES,
  KNOWLEDGE_USABLE_LEVELS,
  type AllowedUse,
  type KnowledgeCard,
  type KnowledgeReceiptEvidence,
  type KnowledgeReviewStatus,
  type KnowledgeSource,
  type KnowledgeUsableLevel,
} from "@/lib/company-memory/types";

// ---------------------------------------------------------------------------
// Company Memory governance — pure, deterministic, fail-closed functions.
//
// Every function here answers ONE question: given governed knowledge in some
// state, what is AI allowed to do with it? The answers always fail closed:
// missing owner, missing tenant, unknown allowed-use values, expiry, conflict,
// freeze, and un-reviewed content all collapse to the most restrictive
// outcome. `confidence` is deliberately ignored — it sorts and samples, it
// never raises a usable level. No IO, no randomness, no clock reads: callers
// pass `now` explicitly so every verdict is re-derivable for audit.
//
// This module grants no runtime authority. An L5 verdict here means "the
// knowledge side of an active reference is satisfiable", not "execute". The
// actual advance of any decision stays behind the decision/supervision gates.
// ---------------------------------------------------------------------------

// Canonical mapping from a declared use to the highest usable level that use
// can ever justify. This mapping covers the CLOSED set of allowed uses;
// everything else — missing, unknown, or future values not yet registered by
// an owner — maps to L0.
export const ALLOWED_USE_TO_USABLE_LEVEL: Record<AllowedUse, KnowledgeUsableLevel> = {
  search: "L1",
  advice: "L2",
  task_generation: "L3",
  shadow: "L4",
  active_reference: "L5",
};

const ALLOWED_USE_SET: ReadonlySet<string> = new Set(ALLOWED_USES);

export function usableLevelIndex(level: KnowledgeUsableLevel): number {
  return KNOWLEDGE_USABLE_LEVELS.indexOf(level);
}

export function compareUsableLevels(
  a: KnowledgeUsableLevel,
  b: KnowledgeUsableLevel,
): number {
  return usableLevelIndex(a) - usableLevelIndex(b);
}

export function minUsableLevel(
  a: KnowledgeUsableLevel,
  b: KnowledgeUsableLevel,
): KnowledgeUsableLevel {
  return compareUsableLevels(a, b) <= 0 ? a : b;
}

// What the governance state machine allows regardless of the card's declared
// usableLevel. reviewStatus and usableLevel are two independent axes: this
// cap expresses the review axis, and the effective level is always the MIN
// of both. `approved` caps at L5 because approval of content is necessary —
// but never sufficient — for higher levels.
const REVIEW_STATUS_LEVEL_CAP: Record<KnowledgeReviewStatus, KnowledgeUsableLevel> = {
  // Search / clustering only; must not enter AI advice.
  discovered: "L1",
  // May surface as "possibly relevant" advice, flagged un-reviewed; can never
  // back task generation or automation.
  candidate: "L2",
  // Under review: advice at most, no task generation.
  pending_review: "L2",
  approved: "L5",
  // Challenged by a receipt or staleness: downgrade to searchable until the
  // owner re-approves.
  needs_review: "L1",
  rejected: "L0",
  expired: "L0",
  frozen: "L0",
  // Conflicting knowledge must not back decisions until the owner resolves
  // the conflict; it stays findable so the conflict can be worked.
  conflict_detected: "L1",
  retired: "L0",
};

// Review statuses that terminate use outright (hard fail, not just a cap).
const BLOCKING_REVIEW_STATUSES: ReadonlySet<KnowledgeReviewStatus> = new Set([
  "rejected",
  "expired",
  "frozen",
  "retired",
]);

export type KnowledgeUseValidation = {
  allowed: boolean;
  // Highest level this source can justify for ANY use, after fail-closed
  // checks. L0 whenever anything about the declaration is untrustworthy.
  maxUsableLevel: KnowledgeUsableLevel;
  reasons: string[];
};

// Validates whether a knowledge SOURCE may back a requested use at all.
// Fail closed: missing owner, missing tenant, an empty allowed-use
// declaration, or ANY unknown allowed-use value poisons the whole source to
// L0 — an untrustworthy declaration is not a partially trustworthy one.
export function validateKnowledgeSourceForUse(
  source: KnowledgeSource,
  requestedUse: AllowedUse,
): KnowledgeUseValidation {
  const reasons: string[] = [];

  if (!source.ownerRef || source.ownerRef.trim() === "") {
    reasons.push("owner_missing");
  }
  if (!source.tenantRef || source.tenantRef.trim() === "") {
    reasons.push("tenant_missing");
  }
  if (source.allowedUse.length === 0) {
    reasons.push("allowed_use_missing");
  }

  const unknownUses = source.allowedUse.filter((use) => !ALLOWED_USE_SET.has(use));
  for (const unknown of unknownUses) {
    reasons.push(`allowed_use_unknown:${unknown}`);
  }

  if (reasons.length > 0) {
    return { allowed: false, maxUsableLevel: "L0", reasons };
  }

  let maxUsableLevel: KnowledgeUsableLevel = "L0";
  for (const use of source.allowedUse as readonly AllowedUse[]) {
    const mapped = ALLOWED_USE_TO_USABLE_LEVEL[use];
    if (compareUsableLevels(mapped, maxUsableLevel) > 0) {
      maxUsableLevel = mapped;
    }
  }

  if (!source.allowedUse.includes(requestedUse)) {
    return {
      allowed: false,
      maxUsableLevel,
      reasons: ["requested_use_not_declared"],
    };
  }

  return { allowed: true, maxUsableLevel, reasons: [] };
}

export type KnowledgeDecisionValidation = {
  allowed: boolean;
  // The level this card can actually support right now: min(usableLevel,
  // review-status cap), after hard fail-closed checks.
  effectiveLevel: KnowledgeUsableLevel;
  reasons: string[];
};

// Validates whether a knowledge CARD may back a decision at the requested
// action level. `context.now` enables the expiry check; omitting it never
// fails open — a card whose reviewStatus is `expired` is blocked regardless,
// and callers that can supply a clock should.
export function validateKnowledgeCardForDecision(
  card: KnowledgeCard,
  requestedActionLevel: KnowledgeUsableLevel,
  context?: { now?: string },
): KnowledgeDecisionValidation {
  const reasons: string[] = [];

  if (!card.ownerRef || card.ownerRef.trim() === "") {
    reasons.push("owner_missing");
  }
  if (!card.tenantRef || card.tenantRef.trim() === "") {
    reasons.push("tenant_missing");
  }
  if (BLOCKING_REVIEW_STATUSES.has(card.reviewStatus)) {
    reasons.push(`review_status_blocked:${card.reviewStatus}`);
  }
  if (
    context?.now &&
    card.expiryAt !== null &&
    Date.parse(card.expiryAt) <= Date.parse(context.now)
  ) {
    reasons.push("expired");
  }

  if (reasons.length > 0) {
    return { allowed: false, effectiveLevel: "L0", reasons };
  }

  const cap = REVIEW_STATUS_LEVEL_CAP[card.reviewStatus];
  const effectiveLevel = minUsableLevel(card.usableLevel, cap);
  const capReasons: string[] = [];

  if (compareUsableLevels(cap, card.usableLevel) < 0) {
    capReasons.push(`review_status_caps_level:${card.reviewStatus}`);
  }
  if (card.contradictionRefs.length > 0 && compareUsableLevels(requestedActionLevel, "L2") > 0) {
    // Conflicting knowledge may still inform low-stakes search/advice with
    // the conflict surfaced, but it can never back task generation, shadow,
    // or active decisions.
    return {
      allowed: false,
      effectiveLevel: minUsableLevel(effectiveLevel, "L2"),
      reasons: ["conflict_unresolved"],
    };
  }

  if (compareUsableLevels(effectiveLevel, requestedActionLevel) < 0) {
    return {
      allowed: false,
      effectiveLevel,
      reasons: [...capReasons, "usable_level_insufficient"],
    };
  }

  return { allowed: true, effectiveLevel, reasons: capReasons };
}

export type KnowledgePolicyContext = {
  // Per-source usable-level ceilings for every sourceRef on the card, e.g.
  // from validateKnowledgeSourceForUse(...).maxUsableLevel. The card fails
  // closed to the LOWEST source ceiling; an empty list means the provenance
  // is unknown, which is L0.
  sourceCeilings: readonly KnowledgeUsableLevel[];
  // Highest level the owner has explicitly approved for this card. L4/L5
  // require explicit owner (or dual-owner) approval — verified receipts help
  // a card qualify but can NEVER substitute for this gate.
  ownerApprovedLevel: KnowledgeUsableLevel;
  // Policy gate verdict for referencing this card at L5.
  policyGatePassed: boolean;
  // Whether a rollback path exists for actions that would cite this card.
  rollbackPathDefined: boolean;
  // Whether monitoring posture is in place for active references.
  monitoringInPlace: boolean;
};

export type KnowledgeUsableLevelDerivation = {
  level: KnowledgeUsableLevel;
  // Reason codes for every cap that pulled the level below L5.
  cappedBy: string[];
};

// Derives the usable level a card can hold given its review state, source
// ceilings, receipt evidence, and governance context. Deterministic and
// fail closed; `confidence` is intentionally never read.
export function deriveKnowledgeUsableLevel(
  card: KnowledgeCard,
  receipts: readonly KnowledgeReceiptEvidence[],
  policyContext: KnowledgePolicyContext,
): KnowledgeUsableLevelDerivation {
  const cappedBy: string[] = [];

  if (!card.ownerRef || card.ownerRef.trim() === "") {
    return { level: "L0", cappedBy: ["owner_missing"] };
  }
  if (!card.tenantRef || card.tenantRef.trim() === "") {
    return { level: "L0", cappedBy: ["tenant_missing"] };
  }
  if (BLOCKING_REVIEW_STATUSES.has(card.reviewStatus)) {
    return { level: "L0", cappedBy: [`review_status_blocked:${card.reviewStatus}`] };
  }

  let level: KnowledgeUsableLevel = "L5";

  const reviewCap = REVIEW_STATUS_LEVEL_CAP[card.reviewStatus];
  if (compareUsableLevels(reviewCap, level) < 0) {
    level = reviewCap;
    cappedBy.push(`review_status_cap:${card.reviewStatus}`);
  }

  if (policyContext.sourceCeilings.length === 0) {
    return { level: "L0", cappedBy: [...cappedBy, "source_ceilings_missing"] };
  }
  const sourceFloor = policyContext.sourceCeilings.reduce<KnowledgeUsableLevel>(
    (lowest, ceiling) => minUsableLevel(lowest, ceiling),
    "L5",
  );
  if (compareUsableLevels(sourceFloor, level) < 0) {
    level = sourceFloor;
    cappedBy.push("source_allowed_use_cap");
  }

  // Receipt evidence. A card contradicted by a verified failure or an owner
  // rejection cannot stay above advice-support; it belongs in review.
  const hasContradictingReceipt = receipts.some(
    (receipt) => receipt.outcome === "verified_failure" || receipt.outcome === "rejected",
  );
  if (hasContradictingReceipt && compareUsableLevels("L2", level) < 0) {
    level = "L2";
    cappedBy.push("receipt_contradiction");
  }

  // L4+ (shadow and active reference) requires verified receipt history.
  // Self-reported receipts never count.
  const hasVerifiedSupport = receipts.some(
    (receipt) => receipt.outcome === "verified_success",
  );
  if (!hasVerifiedSupport && compareUsableLevels("L3", level) < 0) {
    level = "L3";
    cappedBy.push("verified_receipt_missing");
  }

  // Conflict knowledge cannot climb past advice until resolved.
  if (card.contradictionRefs.length > 0 && compareUsableLevels("L2", level) < 0) {
    level = "L2";
    cappedBy.push("conflict_unresolved");
  }

  // L3 (task generation) needs a complete card: scope and expiry defined.
  if (compareUsableLevels("L2", level) < 0) {
    if (card.applicableScope.length === 0) {
      level = "L2";
      cappedBy.push("applicable_scope_missing");
    } else if (card.expiryAt === null) {
      level = "L2";
      cappedBy.push("expiry_missing");
    }
  }

  // Owner gate for L4/L5: receipts and structure make a card ELIGIBLE, but
  // only explicit owner approval raises it past L3. Levels up to L3 ride on
  // the approved review status; L4/L5 need the dedicated approval.
  if (compareUsableLevels(level, "L3") > 0) {
    const ownerCap =
      compareUsableLevels(policyContext.ownerApprovedLevel, "L3") > 0
        ? policyContext.ownerApprovedLevel
        : ("L3" as KnowledgeUsableLevel);
    if (compareUsableLevels(ownerCap, level) < 0) {
      level = ownerCap;
      cappedBy.push("owner_approval_required");
    }
  }

  // L5 additionally requires policy gate, rollback path, and monitoring.
  if (level === "L5") {
    if (!policyContext.policyGatePassed) {
      level = "L4";
      cappedBy.push("policy_gate_failed");
    } else if (!policyContext.rollbackPathDefined) {
      level = "L4";
      cappedBy.push("rollback_path_missing");
    } else if (!policyContext.monitoringInPlace) {
      level = "L4";
      cappedBy.push("monitoring_missing");
    }
  }

  return { level, cappedBy };
}

export type ActiveReferenceContext = {
  ownerApproval: boolean;
  // Owner decision 2026-07-07 (requirements §20 Q2): L5 active reference
  // requires DUAL owner approval — two distinct owner identities (e.g. the
  // customer owner and the delivery owner). Fewer than two distinct refs
  // blocks, regardless of the ownerApproval flag.
  ownerApprovalRefs: readonly string[];
  policyGatePassed: boolean;
  receiptGatePassed: boolean;
  rollbackPathDefined: boolean;
  monitoringInPlace: boolean;
  now?: string;
};

export type ActiveReferenceVerdict = {
  allowed: boolean;
  blockedBy: string[];
};

// The full L5 gate: active reference requires an approved L5 card AND owner
// approval AND policy gate AND receipt gate AND rollback path AND monitoring.
// Any missing piece blocks. Note this still only allows the knowledge to be
// REFERENCED by governed automation; it is not an execution authorization,
// not an outbound-send permission, and not a high-risk write permission.
export function isKnowledgeActiveReferenceAllowed(
  card: KnowledgeCard,
  context: ActiveReferenceContext,
): ActiveReferenceVerdict {
  const blockedBy: string[] = [];

  if (!card.ownerRef || card.ownerRef.trim() === "") {
    blockedBy.push("owner_missing");
  }
  if (!card.tenantRef || card.tenantRef.trim() === "") {
    blockedBy.push("tenant_missing");
  }
  if (card.reviewStatus !== "approved") {
    blockedBy.push(`review_status_not_approved:${card.reviewStatus}`);
  }
  if (card.usableLevel !== "L5") {
    blockedBy.push("usable_level_not_l5");
  }
  if (card.contradictionRefs.length > 0) {
    blockedBy.push("conflict_unresolved");
  }
  if (
    context.now &&
    card.expiryAt !== null &&
    Date.parse(card.expiryAt) <= Date.parse(context.now)
  ) {
    blockedBy.push("expired");
  }
  if (!context.ownerApproval) {
    blockedBy.push("owner_approval_missing");
  }
  const distinctOwnerApprovers = new Set(
    context.ownerApprovalRefs.map((ref) => ref.trim()).filter((ref) => ref !== ""),
  );
  if (distinctOwnerApprovers.size < 2) {
    blockedBy.push("dual_owner_approval_missing");
  }
  if (!context.policyGatePassed) {
    blockedBy.push("policy_gate_failed");
  }
  if (!context.receiptGatePassed) {
    blockedBy.push("receipt_gate_failed");
  }
  if (!context.rollbackPathDefined) {
    blockedBy.push("rollback_path_missing");
  }
  if (!context.monitoringInPlace) {
    blockedBy.push("monitoring_missing");
  }

  return { allowed: blockedBy.length === 0, blockedBy };
}

export const KNOWLEDGE_HEALTH_STATES = [
  "healthy",
  "review_due",
  "expired",
  "conflict",
  "frozen",
  "owner_missing",
  "unreviewed",
] as const;

export type KnowledgeHealthState = (typeof KNOWLEDGE_HEALTH_STATES)[number];

export type KnowledgeHealthSignal = {
  cardRef: string;
  health: KnowledgeHealthState;
  // Health signals only ever recommend review-side actions: downgrade,
  // review, or freeze review. They never recommend upgrades or execution.
  recommendedAction:
    | "none"
    | "schedule_review"
    | "downgrade_and_review"
    | "owner_review"
    | "freeze_review";
};

const REVIEW_DUE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

// Derives a deterministic health signal for a card at a given instant.
// Priority order: frozen > conflict > expired > owner gap > un-reviewed >
// review due > healthy. Stale or expired knowledge can only yield a
// downgrade / review recommendation — never a level increase.
export function deriveKnowledgeHealthSignal(
  card: KnowledgeCard,
  now: string,
): KnowledgeHealthSignal {
  const nowMs = Date.parse(now);

  if (card.reviewStatus === "frozen") {
    return { cardRef: card.cardId, health: "frozen", recommendedAction: "freeze_review" };
  }
  if (card.reviewStatus === "conflict_detected" || card.contradictionRefs.length > 0) {
    return { cardRef: card.cardId, health: "conflict", recommendedAction: "owner_review" };
  }
  const expiredByClock = card.expiryAt !== null && Date.parse(card.expiryAt) <= nowMs;
  if (card.reviewStatus === "expired" || expiredByClock) {
    return {
      cardRef: card.cardId,
      health: "expired",
      recommendedAction: "downgrade_and_review",
    };
  }
  if (!card.ownerRef || card.ownerRef.trim() === "") {
    return { cardRef: card.cardId, health: "owner_missing", recommendedAction: "owner_review" };
  }
  if (
    card.reviewStatus === "discovered" ||
    card.reviewStatus === "candidate" ||
    card.reviewStatus === "pending_review" ||
    card.reviewStatus === "needs_review"
  ) {
    return { cardRef: card.cardId, health: "unreviewed", recommendedAction: "schedule_review" };
  }
  if (card.expiryAt !== null && Date.parse(card.expiryAt) - nowMs <= REVIEW_DUE_WINDOW_MS) {
    return { cardRef: card.cardId, health: "review_due", recommendedAction: "schedule_review" };
  }
  return { cardRef: card.cardId, health: "healthy", recommendedAction: "none" };
}
