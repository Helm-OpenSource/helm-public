/**
 * Helm Business Advancement — Phase 2 Signal -> Must Push Adapter
 *
 * Planning-only adapter. It converts Phase 1A fixtures plus Phase 1B
 * feasibility rows into candidate Must Push items for offline evaluation.
 *
 * Not a runtime extractor, not an API, not a DB reader, not a page adapter,
 * not an execution authority.
 */

import type {
  AdvancementSignalFixture,
  AllowedActionVerb,
  BlockedActionType,
  MustPushItem,
  OwnerSuggestion,
  ReviewPosture,
  ReviewRequiredAction,
  RiskLevel,
  SignalType,
} from "./contracts";
import type {
  FeasibilityStatus,
  FixtureFeasibilityRow,
} from "./read-model-feasibility";

export type MustPushAdapterStatus = "active" | "deferred";

export type MustPushDeferReason =
  | "future_only"
  | "blocked_boundary"
  | "feasibility_mismatch";

export interface MustPushActiveCandidate {
  readonly status: "active";
  readonly fixtureId: string;
  readonly feasibilityStatus: Exclude<FeasibilityStatus, "future_only">;
  readonly item: MustPushItem;
}

export interface MustPushDeferredCandidate {
  readonly status: "deferred";
  readonly fixtureId: string;
  readonly feasibilityStatus: FeasibilityStatus;
  readonly reason: MustPushDeferReason;
  readonly boundaryNote: string;
  readonly sourceSummary: string;
}

export type MustPushAdapterResult =
  | MustPushActiveCandidate
  | MustPushDeferredCandidate;

export interface MustPushAdapterSummary {
  readonly total: number;
  readonly active: number;
  readonly deferred: number;
  readonly topItems: readonly MustPushItem[];
  readonly results: readonly MustPushAdapterResult[];
}

const RISK_BY_SIGNAL: Record<SignalType, RiskLevel> = {
  blocked_decision: "high",
  overdue_commitment: "high",
  resource_evidence_gap: "high",
  customer_waiting: "high",
  stalled_opportunity: "medium",
  stalled_case: "medium",
  kpi_anomaly: "medium",
  repeated_intent: "medium",
  boundary_hit: "high",
  abandoned_high_confidence_answer: "medium",
};

const RISK_RANK: Record<RiskLevel, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const POSTURE_RANK: Record<ReviewPosture, number> = {
  human_owner_required: 0,
  review_required: 1,
  read_only: 2,
  blocked: 99,
};

const SIGNAL_RANK: Record<SignalType, number> = {
  blocked_decision: 0,
  overdue_commitment: 1,
  customer_waiting: 2,
  resource_evidence_gap: 3,
  stalled_opportunity: 4,
  stalled_case: 5,
  kpi_anomaly: 6,
  repeated_intent: 7,
  abandoned_high_confidence_answer: 8,
  boundary_hit: 99,
};

const FEASIBILITY_RANK: Record<FeasibilityStatus, number> = {
  current_read_model_supported: 0,
  requires_thin_projection: 1,
  future_only: 99,
};

export function buildMustPushAdapterResults(
  fixtures: readonly AdvancementSignalFixture[],
  feasibilityRows: readonly FixtureFeasibilityRow[]
): readonly MustPushAdapterResult[] {
  const feasibilityByFixtureId = new Map(
    feasibilityRows.map((row) => [row.fixtureId, row])
  );

  return fixtures.map((fixture, index) => {
    const feasibility = feasibilityByFixtureId.get(fixture.fixtureId);
    if (!feasibility) {
      return {
        status: "deferred",
        fixtureId: fixture.fixtureId,
        feasibilityStatus: "future_only",
        reason: "feasibility_mismatch",
        boundaryNote:
          "缺少 read-model feasibility row，不能生成 Must Push 候选。",
        sourceSummary: fixture.sourceScenario,
      } satisfies MustPushDeferredCandidate;
    }

    return adaptFixtureToMustPushCandidate(fixture, feasibility, index);
  });
}

export function adaptFixtureToMustPushCandidate(
  fixture: AdvancementSignalFixture,
  feasibility: FixtureFeasibilityRow,
  fixtureOrder: number
): MustPushAdapterResult {
  if (feasibility.feasibilityStatus === "future_only") {
    return {
      status: "deferred",
      fixtureId: fixture.fixtureId,
      feasibilityStatus: feasibility.feasibilityStatus,
      reason: "future_only",
      boundaryNote: fixture.expectedBoundaryNote,
      sourceSummary: feasibility.evidenceRationale,
    };
  }

  if (fixture.expectedReviewPosture === "blocked") {
    return {
      status: "deferred",
      fixtureId: fixture.fixtureId,
      feasibilityStatus: feasibility.feasibilityStatus,
      reason: "blocked_boundary",
      boundaryNote: fixture.expectedBoundaryNote,
      sourceSummary: feasibility.boundaryRationale,
    };
  }

  const riskLevel = RISK_BY_SIGNAL[fixture.signalType];
  const sortKey = buildDeterministicSortKey({
    fixture,
    feasibilityStatus: feasibility.feasibilityStatus,
    riskLevel,
    fixtureOrder,
  });

  return {
    status: "active",
    fixtureId: fixture.fixtureId,
    feasibilityStatus: feasibility.feasibilityStatus,
    item: {
      itemId: `must-push:${fixture.fixtureId}`,
      title: fixture.expectedMustPushTitle,
      reason: fixture.sourceScenario,
      evidenceRefs: fixture.evidenceRefs,
      primaryAction: buildSafePrimaryAction(fixture.expectedReviewPosture),
      boundaryNote: fixture.expectedBoundaryNote,
      reviewPosture: fixture.expectedReviewPosture,
      sourceSummary: feasibility.evidenceRationale,
      riskLevel,
      sortKey,
      ownerSuggestion: buildOwnerSuggestion(
        fixture.signalType,
        fixture.expectedReviewPosture,
        fixture.objectRef.objectType,
      ),
    },
  };
}

export function selectTopMustPushItems(
  results: readonly MustPushAdapterResult[],
  limit = 5
): readonly MustPushItem[] {
  return results
    .filter((result): result is MustPushActiveCandidate => result.status === "active")
    .map((result) => result.item)
    .sort(compareMustPushItems)
    .slice(0, limit);
}

export function summarizeMustPushAdapter(
  fixtures: readonly AdvancementSignalFixture[],
  feasibilityRows: readonly FixtureFeasibilityRow[],
  limit = 5
): MustPushAdapterSummary {
  const results = buildMustPushAdapterResults(fixtures, feasibilityRows);
  const topItems = selectTopMustPushItems(results, limit);
  const active = results.filter((result) => result.status === "active").length;

  return {
    total: results.length,
    active,
    deferred: results.length - active,
    topItems,
    results,
  };
}

export function compareMustPushItems(
  left: MustPushItem,
  right: MustPushItem
): number {
  return (
    left.sortKey - right.sortKey ||
    left.itemId.localeCompare(right.itemId)
  );
}

function buildDeterministicSortKey(input: {
  readonly fixture: AdvancementSignalFixture;
  readonly feasibilityStatus: Exclude<FeasibilityStatus, "future_only">;
  readonly riskLevel: RiskLevel;
  readonly fixtureOrder: number;
}): number {
  const stableFixtureRank = parseStableFixtureRank(input.fixture.fixtureId);
  const risk = RISK_RANK[input.riskLevel] * 100_000;
  const posture = POSTURE_RANK[input.fixture.expectedReviewPosture] * 10_000;
  const signal = SIGNAL_RANK[input.fixture.signalType] * 100;
  const feasibility = FEASIBILITY_RANK[input.feasibilityStatus] * 10;

  return risk + posture + signal + feasibility + stableFixtureRank;
}

function buildSafePrimaryAction(reviewPosture: ReviewPosture): string {
  if (reviewPosture === "human_owner_required") {
    return "打开相关对象，分派负责人并提交复核";
  }

  if (reviewPosture === "review_required") {
    return "打开相关对象，复核证据并确认下一步负责人";
  }

  return "打开相关对象，查看证据和边界";
}

const OWNER_ROLE_BY_SIGNAL: Record<SignalType, string> = {
  blocked_decision: "审批负责人",
  overdue_commitment: "动作项负责人",
  resource_evidence_gap: "资源/证据负责人",
  customer_waiting: "客户负责人",
  stalled_opportunity: "机会负责人",
  stalled_case: "工单负责人",
  kpi_anomaly: "指标负责人",
  repeated_intent: "客户负责人",
  boundary_hit: "复核负责人",
  abandoned_high_confidence_answer: "客户负责人",
};

const SIGNAL_RATIONALE_LABEL: Record<SignalType, string> = {
  blocked_decision: "决策受阻信号",
  overdue_commitment: "动作项超期信号",
  resource_evidence_gap: "证据缺口信号",
  customer_waiting: "客户等待信号",
  stalled_opportunity: "机会停滞信号",
  stalled_case: "工单停滞信号",
  kpi_anomaly: "指标异常信号",
  repeated_intent: "重复意向信号",
  boundary_hit: "边界命中信号",
  abandoned_high_confidence_answer: "高置信度答复未跟进信号",
};

function buildOwnerSuggestion(
  signalType: SignalType,
  reviewPosture: ReviewPosture,
  objectType: string,
): OwnerSuggestion {
  const role = OWNER_ROLE_BY_SIGNAL[signalType];
  const signalLabel = SIGNAL_RATIONALE_LABEL[signalType];
  const postureClause =
    reviewPosture === "human_owner_required"
      ? "需先指派负责人再复核"
      : "由该角色复核证据并确认下一步";

  return {
    role,
    rationale: `${signalLabel}（来源对象：${objectType}）：${postureClause}（建议性，仅作复核线索）。`,
  };
}

function parseStableFixtureRank(fixtureId: string): number {
  const match = fixtureId.match(/(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : 999;
}

const BLOCKED_ACTION_BY_SIGNAL: Record<SignalType, BlockedActionType> = {
  blocked_decision: "approval_commit",
  overdue_commitment: "approval_commit",
  resource_evidence_gap: "official_write",
  customer_waiting: "outbound_send",
  stalled_opportunity: "ownership_change",
  stalled_case: "ownership_change",
  kpi_anomaly: "policy_exception",
  repeated_intent: "outbound_send",
  boundary_hit: "policy_exception",
  abandoned_high_confidence_answer: "outbound_send",
};

const ESCALATION_PATH_BY_SIGNAL: Record<SignalType, readonly string[]> = {
  blocked_decision: ["审批负责人", "业务负责人", "试点负责人"],
  overdue_commitment: ["动作项负责人", "客户负责人", "试点负责人"],
  resource_evidence_gap: ["资源/证据负责人", "运营负责人", "试点负责人"],
  customer_waiting: ["客户负责人", "销售经理", "试点负责人"],
  stalled_opportunity: ["机会负责人", "销售经理", "试点负责人"],
  stalled_case: ["工单负责人", "服务经理", "试点负责人"],
  kpi_anomaly: ["指标负责人", "运营负责人", "试点负责人"],
  repeated_intent: ["客户负责人", "销售经理", "试点负责人"],
  boundary_hit: ["复核负责人", "合规/风险负责人", "试点负责人"],
  abandoned_high_confidence_answer: ["客户负责人", "销售经理", "试点负责人"],
};

const SAFE_VERB_BY_POSTURE: Record<Exclude<ReviewPosture, "read_only">, AllowedActionVerb> = {
  review_required: "review",
  human_owner_required: "assign",
  blocked: "review",
};

/**
 * Build a planning-only ReviewRequiredAction for any candidate whose posture
 * is not read_only. Each field is derived deterministically from the fixture;
 * no LLM input, no execution authority, no auto write.
 */
export function buildReviewRequiredActionFromFixture(
  fixture: AdvancementSignalFixture,
): ReviewRequiredAction | undefined {
  if (fixture.expectedReviewPosture === "read_only") {
    return undefined;
  }

  const reviewPosture = fixture.expectedReviewPosture;
  const escalationPath = ESCALATION_PATH_BY_SIGNAL[fixture.signalType];
  const blockedActionType = BLOCKED_ACTION_BY_SIGNAL[fixture.signalType];
  const requiredReviewerRole = escalationPath[0];
  const signalLabel = SIGNAL_RATIONALE_LABEL[fixture.signalType];

  return {
    actionId: `review-required:${fixture.fixtureId}`,
    linkedSignalId: fixture.fixtureId,
    actionType: SAFE_VERB_BY_POSTURE[reviewPosture],
    description: `打开 ${fixture.objectRef.displayName}，复核证据并确认下一步负责人。`,
    ownerRequired: reviewPosture === "human_owner_required",
    boundaryNote: fixture.expectedBoundaryNote,
    reviewPosture,
    requiredReviewerRole,
    reason: `${signalLabel}：${fixture.sourceScenario}`,
    evidenceRefs: fixture.evidenceRefs,
    blockedActionType,
    escalationPath,
  };
}
