import { describe, expect, it } from "vitest";
import {
  deriveKnowledgeHealthSignal,
  deriveKnowledgeUsableLevel,
  isKnowledgeActiveReferenceAllowed,
  validateKnowledgeCardForDecision,
  validateKnowledgeSourceForUse,
  type ActiveReferenceContext,
  type KnowledgePolicyContext,
} from "@/lib/company-memory/governance";
import type {
  KnowledgeCard,
  KnowledgeReceiptEvidence,
  KnowledgeSource,
} from "@/lib/company-memory/types";

const NOW = "2026-07-07T00:00:00.000Z";
const FUTURE = "2027-01-01T00:00:00.000Z";
const PAST = "2026-01-01T00:00:00.000Z";

function buildSource(overrides: Partial<KnowledgeSource> = {}): KnowledgeSource {
  return {
    sourceId: "source-1",
    sourceType: "document",
    tenantRef: "tenant-synthetic-1",
    ownerRef: "owner-1",
    originRef: "origin-1",
    legalBasisRef: "legal-1",
    sensitivityLevel: "internal",
    allowedUse: ["search", "advice"],
    freshnessPolicy: null,
    retentionPolicyRef: null,
    createdAt: PAST,
    updatedAt: PAST,
    ...overrides,
  };
}

function buildCard(overrides: Partial<KnowledgeCard> = {}): KnowledgeCard {
  return {
    cardId: "card-1",
    tenantRef: "tenant-synthetic-1",
    sourceRefs: ["source-1"],
    knowledgeType: "sop",
    title: "Synthetic SOP",
    summary: "A synthetic SOP card for contract tests",
    structuredPayload: null,
    applicableScope: ["scope-synthetic"],
    ownerRef: "owner-1",
    reviewStatus: "approved",
    usableLevel: "L3",
    confidence: "medium",
    evidenceRefs: ["evidence-1"],
    contradictionRefs: [],
    expiryAt: FUTURE,
    version: 1,
    ...overrides,
  };
}

function buildPolicyContext(
  overrides: Partial<KnowledgePolicyContext> = {},
): KnowledgePolicyContext {
  return {
    sourceCeilings: ["L5"],
    ownerApprovedLevel: "L3",
    policyGatePassed: true,
    rollbackPathDefined: true,
    monitoringInPlace: true,
    ...overrides,
  };
}

const VERIFIED_RECEIPTS: KnowledgeReceiptEvidence[] = [
  { receiptRef: "receipt-1", outcome: "verified_success" },
  { receiptRef: "receipt-2", outcome: "verified_success" },
];

describe("validateKnowledgeSourceForUse", () => {
  it("fails closed to L0 when allowedUse is missing", () => {
    const result = validateKnowledgeSourceForUse(
      buildSource({ allowedUse: [] }),
      "search",
    );
    expect(result.allowed).toBe(false);
    expect(result.maxUsableLevel).toBe("L0");
    expect(result.reasons).toContain("allowed_use_missing");
  });

  it("fails closed to L0 when any allowedUse value is unknown", () => {
    const result = validateKnowledgeSourceForUse(
      buildSource({ allowedUse: ["search", "future_mode"] }),
      "search",
    );
    expect(result.allowed).toBe(false);
    expect(result.maxUsableLevel).toBe("L0");
    expect(result.reasons).toContain("allowed_use_unknown:future_mode");
  });

  it("fails closed when owner or tenant is missing", () => {
    const noOwner = validateKnowledgeSourceForUse(buildSource({ ownerRef: null }), "search");
    expect(noOwner.allowed).toBe(false);
    expect(noOwner.maxUsableLevel).toBe("L0");
    expect(noOwner.reasons).toContain("owner_missing");

    const noTenant = validateKnowledgeSourceForUse(
      buildSource({ tenantRef: "  " }),
      "search",
    );
    expect(noTenant.allowed).toBe(false);
    expect(noTenant.reasons).toContain("tenant_missing");
  });

  it("denies a use that was never declared, even on a healthy source", () => {
    const result = validateKnowledgeSourceForUse(buildSource(), "active_reference");
    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("requested_use_not_declared");
    // The source itself still tops out at the highest declared use (advice).
    expect(result.maxUsableLevel).toBe("L2");
  });

  it("allows a declared use and reports the declared ceiling", () => {
    const result = validateKnowledgeSourceForUse(buildSource(), "advice");
    expect(result.allowed).toBe(true);
    expect(result.maxUsableLevel).toBe("L2");
    expect(result.reasons).toEqual([]);
  });
});

describe("validateKnowledgeCardForDecision", () => {
  it("candidate knowledge cannot support an active decision", () => {
    const card = buildCard({ reviewStatus: "candidate", usableLevel: "L5" });
    const result = validateKnowledgeCardForDecision(card, "L5", { now: NOW });
    expect(result.allowed).toBe(false);
    // Candidate caps at L2 regardless of the claimed usable level.
    expect(result.effectiveLevel).toBe("L2");
  });

  it("candidate knowledge cannot generate an active task (L3)", () => {
    const card = buildCard({ reviewStatus: "candidate", usableLevel: "L3" });
    const result = validateKnowledgeCardForDecision(card, "L3", { now: NOW });
    expect(result.allowed).toBe(false);
  });

  it("expired knowledge fails closed even when the status was not yet updated", () => {
    const card = buildCard({ expiryAt: PAST });
    const result = validateKnowledgeCardForDecision(card, "L2", { now: NOW });
    expect(result.allowed).toBe(false);
    expect(result.effectiveLevel).toBe("L0");
    expect(result.reasons).toContain("expired");
  });

  it("frozen and rejected knowledge fail closed outright", () => {
    for (const reviewStatus of ["frozen", "rejected"] as const) {
      const result = validateKnowledgeCardForDecision(
        buildCard({ reviewStatus, usableLevel: "L5" }),
        "L1",
        { now: NOW },
      );
      expect(result.allowed).toBe(false);
      expect(result.effectiveLevel).toBe("L0");
      expect(result.reasons).toContain(`review_status_blocked:${reviewStatus}`);
    }
  });

  it("conflict knowledge cannot back a high-risk (task or above) decision", () => {
    const card = buildCard({
      contradictionRefs: ["card-conflicting"],
      usableLevel: "L4",
    });
    const result = validateKnowledgeCardForDecision(card, "L4", { now: NOW });
    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("conflict_unresolved");
  });

  it("conflict_detected review status caps the card to searchable", () => {
    const card = buildCard({ reviewStatus: "conflict_detected", usableLevel: "L4" });
    const result = validateKnowledgeCardForDecision(card, "L2", { now: NOW });
    expect(result.allowed).toBe(false);
    expect(result.effectiveLevel).toBe("L1");
  });

  it("an approved L2 card supports advice but not task generation", () => {
    const card = buildCard({ usableLevel: "L2" });
    expect(validateKnowledgeCardForDecision(card, "L2", { now: NOW }).allowed).toBe(true);
    expect(validateKnowledgeCardForDecision(card, "L3", { now: NOW }).allowed).toBe(false);
    expect(validateKnowledgeCardForDecision(card, "L5", { now: NOW }).allowed).toBe(false);
  });

  it("fails closed when the card is missing owner or tenant", () => {
    const result = validateKnowledgeCardForDecision(
      buildCard({ ownerRef: null, tenantRef: null }),
      "L1",
      { now: NOW },
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons).toEqual(
      expect.arrayContaining(["owner_missing", "tenant_missing"]),
    );
  });
});

describe("deriveKnowledgeUsableLevel", () => {
  it("verified receipts help a card qualify but never bypass the owner gate", () => {
    const card = buildCard({ usableLevel: "L5" });
    // Owner only approved up to L3: receipts alone cannot push past it.
    const gated = deriveKnowledgeUsableLevel(card, VERIFIED_RECEIPTS, buildPolicyContext());
    expect(gated.level).toBe("L3");
    expect(gated.cappedBy).toContain("owner_approval_required");

    // With explicit owner approval and all L5 gates, the same evidence
    // supports L5.
    const approved = deriveKnowledgeUsableLevel(
      card,
      VERIFIED_RECEIPTS,
      buildPolicyContext({ ownerApprovedLevel: "L5" }),
    );
    expect(approved.level).toBe("L5");
  });

  it("owner approval without verified receipts cannot reach shadow or active", () => {
    const selfReported: KnowledgeReceiptEvidence[] = [
      { receiptRef: "receipt-3", outcome: "self_reported_only" },
    ];
    const result = deriveKnowledgeUsableLevel(
      buildCard({ usableLevel: "L5" }),
      selfReported,
      buildPolicyContext({ ownerApprovedLevel: "L5" }),
    );
    expect(result.level).toBe("L3");
    expect(result.cappedBy).toContain("verified_receipt_missing");
  });

  it("L5 requires policy gate, rollback path, and monitoring", () => {
    const card = buildCard({ usableLevel: "L5" });
    for (const gap of [
      { override: { policyGatePassed: false }, reason: "policy_gate_failed" },
      { override: { rollbackPathDefined: false }, reason: "rollback_path_missing" },
      { override: { monitoringInPlace: false }, reason: "monitoring_missing" },
    ] as const) {
      const result = deriveKnowledgeUsableLevel(
        card,
        VERIFIED_RECEIPTS,
        buildPolicyContext({ ownerApprovedLevel: "L5", ...gap.override }),
      );
      expect(result.level).toBe("L4");
      expect(result.cappedBy).toContain(gap.reason);
    }
  });

  it("a contradicting receipt caps the card to advice-support", () => {
    const receipts: KnowledgeReceiptEvidence[] = [
      { receiptRef: "receipt-1", outcome: "verified_success" },
      { receiptRef: "receipt-4", outcome: "rejected" },
    ];
    const result = deriveKnowledgeUsableLevel(
      buildCard({ usableLevel: "L5" }),
      receipts,
      buildPolicyContext({ ownerApprovedLevel: "L5" }),
    );
    expect(result.level).toBe("L2");
    expect(result.cappedBy).toContain("receipt_contradiction");
  });

  it("fails closed to the lowest source ceiling", () => {
    const result = deriveKnowledgeUsableLevel(
      buildCard({ usableLevel: "L5" }),
      VERIFIED_RECEIPTS,
      buildPolicyContext({ ownerApprovedLevel: "L5", sourceCeilings: ["L5", "L1"] }),
    );
    expect(result.level).toBe("L1");
    expect(result.cappedBy).toContain("source_allowed_use_cap");
  });

  it("fails closed to L0 when source ceilings are missing entirely", () => {
    const result = deriveKnowledgeUsableLevel(
      buildCard(),
      VERIFIED_RECEIPTS,
      buildPolicyContext({ sourceCeilings: [] }),
    );
    expect(result.level).toBe("L0");
    expect(result.cappedBy).toContain("source_ceilings_missing");
  });

  it("confidence never raises the derived level", () => {
    const lowConfidence = deriveKnowledgeUsableLevel(
      buildCard({ confidence: "low", usableLevel: "L5" }),
      VERIFIED_RECEIPTS,
      buildPolicyContext(),
    );
    const highConfidence = deriveKnowledgeUsableLevel(
      buildCard({ confidence: "high", usableLevel: "L5" }),
      VERIFIED_RECEIPTS,
      buildPolicyContext(),
    );
    expect(highConfidence.level).toBe(lowConfidence.level);
    expect(highConfidence.cappedBy).toEqual(lowConfidence.cappedBy);
  });

  it("candidate review status caps the derived level at advice-support", () => {
    const result = deriveKnowledgeUsableLevel(
      buildCard({ reviewStatus: "candidate", usableLevel: "L5" }),
      VERIFIED_RECEIPTS,
      buildPolicyContext({ ownerApprovedLevel: "L5" }),
    );
    expect(result.level).toBe("L2");
    expect(result.cappedBy).toContain("review_status_cap:candidate");
  });
});

describe("isKnowledgeActiveReferenceAllowed", () => {
  const fullContext: ActiveReferenceContext = {
    ownerApproval: true,
    policyGatePassed: true,
    receiptGatePassed: true,
    rollbackPathDefined: true,
    monitoringInPlace: true,
    now: NOW,
  };

  it("allows an approved L5 card only when every gate is satisfied", () => {
    const card = buildCard({ usableLevel: "L5" });
    expect(isKnowledgeActiveReferenceAllowed(card, fullContext).allowed).toBe(true);
  });

  it("blocks when any of the five gates is missing", () => {
    const card = buildCard({ usableLevel: "L5" });
    for (const gap of [
      { override: { ownerApproval: false }, reason: "owner_approval_missing" },
      { override: { policyGatePassed: false }, reason: "policy_gate_failed" },
      { override: { receiptGatePassed: false }, reason: "receipt_gate_failed" },
      { override: { rollbackPathDefined: false }, reason: "rollback_path_missing" },
      { override: { monitoringInPlace: false }, reason: "monitoring_missing" },
    ] as const) {
      const verdict = isKnowledgeActiveReferenceAllowed(card, {
        ...fullContext,
        ...gap.override,
      });
      expect(verdict.allowed).toBe(false);
      expect(verdict.blockedBy).toContain(gap.reason);
    }
  });

  it("blocks candidate, expired, and conflicted cards regardless of context", () => {
    const candidate = isKnowledgeActiveReferenceAllowed(
      buildCard({ reviewStatus: "candidate", usableLevel: "L5" }),
      fullContext,
    );
    expect(candidate.allowed).toBe(false);
    expect(candidate.blockedBy).toContain("review_status_not_approved:candidate");

    const expired = isKnowledgeActiveReferenceAllowed(
      buildCard({ usableLevel: "L5", expiryAt: PAST }),
      fullContext,
    );
    expect(expired.allowed).toBe(false);
    expect(expired.blockedBy).toContain("expired");

    const conflicted = isKnowledgeActiveReferenceAllowed(
      buildCard({ usableLevel: "L5", contradictionRefs: ["card-2"] }),
      fullContext,
    );
    expect(conflicted.allowed).toBe(false);
    expect(conflicted.blockedBy).toContain("conflict_unresolved");
  });
});

describe("deriveKnowledgeHealthSignal", () => {
  it("stale or expired knowledge only yields a downgrade / review signal", () => {
    const expiredByClock = deriveKnowledgeHealthSignal(buildCard({ expiryAt: PAST }), NOW);
    expect(expiredByClock.health).toBe("expired");
    expect(expiredByClock.recommendedAction).toBe("downgrade_and_review");

    const expiredByStatus = deriveKnowledgeHealthSignal(
      buildCard({ reviewStatus: "expired" }),
      NOW,
    );
    expect(expiredByStatus.health).toBe("expired");
    expect(expiredByStatus.recommendedAction).toBe("downgrade_and_review");
  });

  it("flags frozen, conflicted, owner-less, and un-reviewed cards", () => {
    expect(deriveKnowledgeHealthSignal(buildCard({ reviewStatus: "frozen" }), NOW)).toEqual({
      cardRef: "card-1",
      health: "frozen",
      recommendedAction: "freeze_review",
    });
    expect(
      deriveKnowledgeHealthSignal(buildCard({ contradictionRefs: ["card-2"] }), NOW).health,
    ).toBe("conflict");
    expect(deriveKnowledgeHealthSignal(buildCard({ ownerRef: null }), NOW).health).toBe(
      "owner_missing",
    );
    expect(
      deriveKnowledgeHealthSignal(buildCard({ reviewStatus: "needs_review" }), NOW).health,
    ).toBe("unreviewed");
  });

  it("reports review_due inside the review window and healthy otherwise", () => {
    const soon = new Date(Date.parse(NOW) + 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(deriveKnowledgeHealthSignal(buildCard({ expiryAt: soon }), NOW).health).toBe(
      "review_due",
    );
    expect(deriveKnowledgeHealthSignal(buildCard(), NOW).health).toBe("healthy");
  });
});
