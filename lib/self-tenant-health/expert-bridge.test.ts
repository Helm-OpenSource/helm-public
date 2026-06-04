import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { EvalCasePromotion } from "@/lib/expert-capability/validators";
import {
  validateEvalCasePromotion,
  validateFeedbackRecord,
  validateJudgementPacket,
} from "@/lib/expert-capability/validators";
import {
  assertSelfTenantHealthBridgeInputSafe,
  buildSelfTenantHealthJudgementPacket,
} from "@/lib/self-tenant-health/expert-bridge";
import type {
  TenantHealthDashboardRow,
  TenantHealthState,
} from "@/lib/self-tenant-health/types";

function row(overrides: Partial<TenantHealthDashboardRow> = {}): TenantHealthDashboardRow {
  return {
    tenantAlias: "tenant_synthetic_001",
    windowStart: "2026-06-01T00:00:00.000Z",
    windowEnd: "2026-06-30T23:59:59.999Z",
    candidateCount: 8,
    validityPassCount: 6,
    validityFailCount: 2,
    duplicateCount: 1,
    staleCount: 0,
    contradictoryCount: 0,
    crossTenantBlockedCount: 0,
    unsafeBoundaryCount: 0,
    reviewRequiredCount: 4,
    reviewedCount: 4,
    acceptedCount: 3,
    rejectedCount: 1,
    downgradedCount: 0,
    quarantinedCount: 0,
    llmCallCount: 6,
    llmSuccessCount: 6,
    llmFallbackCount: 0,
    costBucket: "cny_0_100",
    budgetState: "ok",
    healthState: "green",
    primarySourceType: "ask_helm",
    supportReasonCodes: [],
    ...overrides,
  };
}

describe("self-tenant health expert bridge", () => {
  it("builds an advice-only JudgementPacket from a safe synthetic dashboard row", () => {
    const packet = buildSelfTenantHealthJudgementPacket({
      row: row({
        healthState: "blocked",
        unsafeBoundaryCount: 1,
        supportReasonCodes: ["boundary_incident"],
      }),
      caseId: "self-tenant-monthly-synthetic-001",
      inputSnapshotRef: "snapshot:self-tenant-monthly-synthetic-001@1",
    });

    expect(packet).toMatchObject({
      expertRevisionId: "org-health-deterministic-reference-v0",
      disposition: "flag_self_tenant_boundary_incident",
      commitmentClass: "advice",
      humanReviewerRequired: true,
      forbiddenActionRefs: [],
    });
    expect(packet.boundaryNote).toContain("非绩效结论");
    expect(packet.evidenceRefs).toEqual(
      expect.arrayContaining([
        "evidence:self-tenant-health-state:blocked",
        "evidence:self-tenant-reason:boundary_incident",
      ]),
    );
    expect(validateJudgementPacket(packet).ok).toBe(true);
  });

  it.each([
    ["green", "record_self_tenant_health_green"],
    ["watch", "watch_self_tenant_health"],
    ["risk", "flag_self_tenant_health_risk"],
    ["blocked", "flag_self_tenant_review_backlog_blocked"],
  ] as Array<[TenantHealthState, string]>)(
    "maps %s health state to a stable non-action disposition",
    (healthState, disposition) => {
      const packet = buildSelfTenantHealthJudgementPacket({
        row: row({
          healthState,
          reviewRequiredCount: healthState === "blocked" ? 3 : 1,
          reviewedCount: healthState === "blocked" ? 1 : 1,
          supportReasonCodes:
            healthState === "blocked" ? ["review_coverage_gap"] : [],
        }),
        caseId: `self-tenant-${healthState}`,
        inputSnapshotRef: `snapshot:self-tenant-${healthState}@1`,
      });

      expect(packet.disposition).toBe(disposition);
      expect(packet.commitmentClass).toBe("advice");
      expect(packet.forbiddenActionRefs).toEqual([]);
      expect(packet.disposition).not.toMatch(/^(auto_|execute_|send_|writeback_|approve_)/);
    },
  );

  it("fails closed when a row carries raw or private projection fields", () => {
    expect(() =>
      assertSelfTenantHealthBridgeInputSafe({
        ...row(),
        workspaceId: "workspace_private",
      }),
    ).toThrow(/workspaceId/);

    expect(() =>
      assertSelfTenantHealthBridgeInputSafe({
        ...row(),
        inputSummary: "raw private note",
      }),
    ).toThrow(/inputSummary/);

    expect(() =>
      assertSelfTenantHealthBridgeInputSafe({
        ...row(),
        primarySourceType: "private_customer_adapter",
      }),
    ).toThrow(/primarySourceType/);
  });
});

describe("self-tenant feedback and promotion guard reuse", () => {
  it("validates a human-authored FeedbackRecord and rejects unsafe variants", () => {
    expect(
      validateFeedbackRecord({
        feedbackId: "fb-self-tenant-001",
        caseId: "self-tenant-monthly-synthetic-001",
        targetPacketHash: "sha256:packet",
        correctionType: "edit",
        correctionReasonCode: "commitment_wording",
        correctionNote: "将承诺措辞改回 review-first 建议。",
        authorId: "reviewer-alias-01",
        createdAt: "2026-06-04T04:00:00Z",
      }).ok,
    ).toBe(true);

    expect(
      validateFeedbackRecord({
        feedbackId: "fb-bad",
        caseId: "self-tenant-monthly-synthetic-001",
        targetPacketHash: "",
        correctionType: "edit",
        correctionReasonCode: "not_a_reason",
        correctionNote: "please execute writeback for 13800000000",
        authorId: "",
        createdAt: "not-a-date",
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        "missing_target_packet_hash",
        "invalid_correction_reason_code",
        "missing_author_id",
        "invalid_created_at",
        "forbidden_feedback_text_present",
      ]),
    );
  });

  it("reuses EvalCasePromotion for self-tenant operational promotion and quarantines HR sources", () => {
    const operational: EvalCasePromotion = {
      promotionId: "promo-self-tenant-001",
      sourceCaseId: "self-tenant-monthly-synthetic-001",
      sourceSensitivityClass: "operational",
      scannerResult: { hits: 0 },
      humanSignOffBy: "deid-reviewer-alias-01",
      humanSignOffAt: "2026-06-04T04:15:00Z",
      publicEligible: true,
      walledFromPerformanceEval: true,
      quarantineReason: null,
    };
    expect(validateEvalCasePromotion(operational).ok).toBe(true);

    expect(
      validateEvalCasePromotion({
        ...operational,
        sourceSensitivityClass: "hr_performance",
      }).errors,
    ).toContain("public_eligible_non_operational_source");

    expect(
      validateEvalCasePromotion({
        ...operational,
        promotionId: "promo-self-tenant-hr-quarantine",
        sourceSensitivityClass: "hr_performance",
        scannerResult: { hits: 1 },
        humanSignOffBy: null,
        humanSignOffAt: null,
        publicEligible: false,
        quarantineReason: "hr_performance_source_excluded",
      }).ok,
    ).toBe(true);
  });

  it("keeps the synthetic monthly diagnosis fixture on the existing contract path", () => {
    const fixturePath = path.resolve(
      process.cwd(),
      "templates",
      "expert-capability",
      "packs",
      "self-tenant-monthly-diagnosis.sample.json",
    );
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
      row: TenantHealthDashboardRow;
      judgementPacket: ReturnType<typeof buildSelfTenantHealthJudgementPacket>;
      feedbackRecord: Parameters<typeof validateFeedbackRecord>[0];
      evalCasePromotion: EvalCasePromotion;
    };

    assertSelfTenantHealthBridgeInputSafe(fixture.row);
    expect(validateJudgementPacket(fixture.judgementPacket).ok).toBe(true);
    expect(validateFeedbackRecord(fixture.feedbackRecord).ok).toBe(true);
    expect(validateEvalCasePromotion(fixture.evalCasePromotion).ok).toBe(true);
  });
});
