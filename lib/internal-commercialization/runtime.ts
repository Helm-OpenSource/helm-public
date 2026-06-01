import type {
  InternalCommercializationChannelGateLevel,
  InternalCommercializationDecision,
  InternalCommercializationLifecycleState,
  InternalCommercializationOfferStage,
  InternalCommercializationReviewSafeAction,
  InternalCommercializationRun,
} from "@prisma/client";
import { db } from "@/lib/db";
import { safeParseJson } from "@/lib/utils";

export type InternalCommercializationLifecycleRunView = {
  id: string;
  lifecycleRunId: string;
  providerAliasId: string;
  title: string;
  currentState: string;
  currentStateLabel: string;
  nextState: string | null;
  nextStateLabel: string | null;
  decision: string;
  decisionLabel: string;
  expectedOfferStage: string | null;
  expectedOfferStageLabel: string | null;
  nextAction: string;
  ownerAlias: string;
  reviewerAlias: string | null;
  customerOpportunityAliasIds: string[];
  evidenceRefs: string[];
  requiredEvidenceKinds: string[];
  riskTags: string[];
  channelGateLevel: InternalCommercializationChannelGateLevel;
  outcomeWindowHours: number;
  reviewStaleHours: number;
  safeSampleAvailable: boolean;
  acceptedReviewFirst: boolean;
  requiresReview: boolean;
  channelAssessmentRequired: boolean;
  boundaryIncidentCount: number;
  updatedAtIso: string;
};

export type InternalCommercializationLifecycleReadout = {
  title: string;
  summary: string;
  boundary: string;
  truncated: boolean;
  counts: {
    totalRunCount: number;
    positiveRunCount: number;
    watchOrNoGoCount: number;
    dailyTop3Count: number;
    diagnosisCount: number;
    trialCount: number;
    pilotCount: number;
    closeoutCount: number;
    channelGateCount: number;
    staleReviewCount: number;
    boundaryIncidentCount: number;
  };
  stageBuckets: Array<{
    id: string;
    label: string;
    count: number;
  }>;
  topWorkItems: InternalCommercializationLifecycleRunView[];
  boundaryChecks: Array<{
    id: string;
    label: string;
    ok: boolean;
    count: number;
  }>;
  runs: InternalCommercializationLifecycleRunView[];
};

const positiveDecisionWeights: Record<InternalCommercializationDecision, number> = {
  PREPARE_CLOSEOUT: 92,
  PREPARE_PILOT: 86,
  PREPARE_TRIAL: 80,
  PREPARE_DIAGNOSIS: 72,
  WATCH_ONLY: 22,
  NO_GO: 12,
};

function parseStringArray(value: string) {
  const parsed = safeParseJson<unknown>(value, []);
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string")
    : [];
}

function stateLabel(
  state: InternalCommercializationLifecycleState | null,
  english: boolean,
) {
  if (!state) return null;

  const labels: Record<InternalCommercializationLifecycleState, string> = {
    CANDIDATE_POOL: english ? "Candidate pool" : "候选池",
    DAILY_TOP3_SELECTED: english ? "Daily Top 3" : "Daily Top 3",
    DIAGNOSIS_PACKET_PREPARED: english ? "Diagnosis packet" : "诊断包已准备",
    DIAGNOSIS_REVIEWED: english ? "Diagnosis reviewed" : "诊断已复核",
    TRIAL_SCOPE_PREPARED: english ? "7-day trial scope" : "7 天试跑范围",
    TRIAL_RUNNING: english ? "7-day trial running" : "7 天试跑中",
    TRIAL_CLOSEOUT_READY: english ? "Trial closeout" : "试跑复盘待审",
    PILOT_SCOPE_PREPARED: english ? "4-week pilot scope" : "4 周试点范围",
    PILOT_RUNNING: english ? "4-week pilot running" : "4 周试点中",
    PILOT_CLOSEOUT_READY: english ? "Pilot closeout" : "试点复盘待审",
    CLOSEOUT_REPORT_PREPARED: english ? "Closeout report" : "复盘报告候选",
    CHANNEL_GATE_ASSESSED: english ? "Channel gate" : "客户转渠道判断",
    NEXT_CYCLE_SELECTED: english ? "Next cycle selected" : "下一轮候选",
    DATA_BOUNDARY_REVIEW_REQUIRED: english
      ? "Data boundary review"
      : "数据边界复核",
    PAUSED: english ? "Paused" : "暂停",
  };

  return labels[state];
}

function decisionLabel(
  decision: InternalCommercializationDecision,
  english: boolean,
) {
  const labels: Record<InternalCommercializationDecision, string> = {
    PREPARE_DIAGNOSIS: english ? "Prepare diagnosis" : "准备诊断",
    PREPARE_TRIAL: english ? "Prepare 7-day trial" : "准备 7 天试跑",
    PREPARE_PILOT: english ? "Prepare 4-week pilot" : "准备 4 周试点",
    PREPARE_CLOSEOUT: english ? "Prepare closeout" : "准备复盘",
    NO_GO: english ? "No-Go" : "No-Go",
    WATCH_ONLY: english ? "Watch only" : "只观察",
  };

  return labels[decision];
}

function offerStageLabel(
  stage: InternalCommercializationOfferStage | null,
  english: boolean,
) {
  if (!stage) return null;

  const labels: Record<InternalCommercializationOfferStage, string> = {
    DIAGNOSIS_1H: english ? "1-hour diagnosis" : "1 小时诊断",
    TRIAL_7D: english ? "7-day operating trial" : "7 天经营试跑",
    PILOT_4W: english ? "4-week co-creation pilot" : "4 周共创试点",
    CLOSEOUT_REPORT: english ? "Closeout report" : "复盘报告",
  };

  return labels[stage];
}

function reviewSafeActionLabel(
  action: InternalCommercializationReviewSafeAction,
  english: boolean,
) {
  const labels: Record<InternalCommercializationReviewSafeAction, string> = {
    PREPARE_DIAGNOSIS_BRIEF_FOR_REVIEW: english
      ? "Prepare diagnosis brief for review"
      : "准备诊断 brief，等待复核",
    PREPARE_TRIAL_SCOPE_DRAFT_FOR_REVIEW: english
      ? "Prepare 7-day trial scope for review"
      : "准备 7 天试跑范围草稿，等待复核",
    PREPARE_PILOT_SCOPE_PACKET_FOR_REVIEW: english
      ? "Prepare 4-week pilot scope packet for review"
      : "准备 4 周试点 scope packet，等待复核",
    PREPARE_CLOSEOUT_REPORT_CANDIDATE_FOR_REVIEW: english
      ? "Prepare closeout report candidate for review"
      : "准备复盘报告候选，等待复核",
    DOWNGRADE_OR_PAUSE: english
      ? "Downgrade or pause with reason"
      : "降级或暂停，并记录原因",
  };

  return labels[action];
}

function boundaryIncidentCount(run: InternalCommercializationRun) {
  return [
    run.helmDirectCustomerContactAllowed,
    run.externalSideEffectAllowed,
    run.officialCommitmentAllowed,
    run.publicClaimAllowed,
    run.customerVisibleWithoutReview,
    run.rawPiiIncluded,
  ].filter(Boolean).length;
}

function toRunView(
  run: InternalCommercializationRun,
  english: boolean,
): InternalCommercializationLifecycleRunView {
  return {
    id: run.id,
    lifecycleRunId: run.lifecycleRunId,
    providerAliasId: run.providerAliasId,
    title: run.title,
    currentState: run.currentState,
    currentStateLabel: stateLabel(run.currentState, english) ?? run.currentState,
    nextState: run.nextState,
    nextStateLabel: stateLabel(run.nextState, english),
    decision: run.decision,
    decisionLabel: decisionLabel(run.decision, english),
    expectedOfferStage: run.expectedOfferStage,
    expectedOfferStageLabel: offerStageLabel(run.expectedOfferStage, english),
    nextAction: reviewSafeActionLabel(run.nextAction, english),
    ownerAlias: run.ownerAlias,
    reviewerAlias: run.reviewerAlias,
    customerOpportunityAliasIds: parseStringArray(run.customerOpportunityAliasIds),
    evidenceRefs: parseStringArray(run.evidenceRefs),
    requiredEvidenceKinds: parseStringArray(run.requiredEvidenceKinds),
    riskTags: parseStringArray(run.riskTags),
    channelGateLevel: run.channelGateLevel,
    outcomeWindowHours: run.outcomeWindowHours,
    reviewStaleHours: run.reviewStaleHours,
    safeSampleAvailable: run.safeSampleAvailable,
    acceptedReviewFirst: run.acceptedReviewFirst,
    requiresReview: run.requiresReview,
    channelAssessmentRequired: run.channelAssessmentRequired,
    boundaryIncidentCount: boundaryIncidentCount(run),
    updatedAtIso: run.updatedAt.toISOString(),
  };
}

function countByStage(
  runs: InternalCommercializationRun[],
  predicate: (state: InternalCommercializationLifecycleState) => boolean,
) {
  return runs.filter((run) => predicate(run.currentState)).length;
}

export function buildInternalCommercializationLifecycleReadout({
  runs,
  english,
  truncated = false,
}: {
  runs: InternalCommercializationRun[];
  english: boolean;
  truncated?: boolean;
}): InternalCommercializationLifecycleReadout {
  const views = runs.map((run) => toRunView(run, english));
  const positiveRunCount = runs.filter(
    (run) => !["NO_GO", "WATCH_ONLY"].includes(run.decision),
  ).length;
  const watchOrNoGoCount = runs.length - positiveRunCount;
  const boundaryIncidents = views.reduce(
    (sum, run) => sum + run.boundaryIncidentCount,
    0,
  );
  const staleReviewCount = runs.filter((run) => run.reviewStaleHours > 72).length;
  const topWorkItems = [...views]
    .sort((left, right) => {
      const leftWeight =
        positiveDecisionWeights[left.decision as InternalCommercializationDecision] ?? 0;
      const rightWeight =
        positiveDecisionWeights[right.decision as InternalCommercializationDecision] ?? 0;
      if (leftWeight !== rightWeight) return rightWeight - leftWeight;
      return right.updatedAtIso.localeCompare(left.updatedAtIso);
    })
    .slice(0, 3);

  const counts = {
    totalRunCount: runs.length,
    positiveRunCount,
    watchOrNoGoCount,
    dailyTop3Count: countByStage(
      runs,
      (state) => state === "DAILY_TOP3_SELECTED",
    ),
    diagnosisCount: countByStage(
      runs,
      (state) =>
        state === "DIAGNOSIS_PACKET_PREPARED" ||
        state === "DIAGNOSIS_REVIEWED",
    ),
    trialCount: countByStage(
      runs,
      (state) =>
        state === "TRIAL_SCOPE_PREPARED" ||
        state === "TRIAL_RUNNING" ||
        state === "TRIAL_CLOSEOUT_READY",
    ),
    pilotCount: countByStage(
      runs,
      (state) =>
        state === "PILOT_SCOPE_PREPARED" ||
        state === "PILOT_RUNNING" ||
        state === "PILOT_CLOSEOUT_READY",
    ),
    closeoutCount: countByStage(
      runs,
      (state) => state === "CLOSEOUT_REPORT_PREPARED",
    ),
    channelGateCount: countByStage(
      runs,
      (state) =>
        state === "CHANNEL_GATE_ASSESSED" ||
        state === "NEXT_CYCLE_SELECTED",
    ),
    staleReviewCount,
    boundaryIncidentCount: boundaryIncidents,
  };

  return {
    title: english
      ? "Internal commercialization lifecycle"
      : "自身商业化经营闭环",
    summary: english
      ? "AI service providers are managed as alias-only commercialization runs: candidate pool, Daily Top 3, diagnosis, 7-day trial, 4-week pilot, closeout and channel gate."
      : "把 AI 服务商作为 alias-only 经营对象，管理候选池、Daily Top 3、诊断、7 天试跑、4 周试点、复盘和客户转渠道判断。",
    boundary: english
      ? "Read-only reserved-workspace board. Helm prepares review packets and next actions; it does not contact customers, auto-send, silently write CRM, quote, contract, publish claims or run workflows."
      : "这是 Helm 自留工作区的只读经营看板。Helm 只准备复核包和下一步建议，不直接触客、不自动外发、不静默写 CRM、不自动报价/签约/发布 claim，也不触发 workflow。",
    truncated,
    counts,
    stageBuckets: [
      { id: "top3", label: "Daily Top 3", count: counts.dailyTop3Count },
      {
        id: "diagnosis",
        label: english ? "Diagnosis" : "诊断",
        count: counts.diagnosisCount,
      },
      {
        id: "trial",
        label: english ? "7-day trial" : "7 天试跑",
        count: counts.trialCount,
      },
      {
        id: "pilot",
        label: english ? "4-week pilot" : "4 周试点",
        count: counts.pilotCount,
      },
      {
        id: "closeout",
        label: english ? "Closeout" : "复盘",
        count: counts.closeoutCount,
      },
      {
        id: "channel",
        label: english ? "Channel gate" : "渠道判断",
        count: counts.channelGateCount,
      },
    ],
    topWorkItems,
    boundaryChecks: [
      {
        id: "direct-customer-contact",
        label: english ? "No direct customer contact" : "不越过服务商直接触客",
        ok: runs.every((run) => !run.helmDirectCustomerContactAllowed),
        count: runs.filter((run) => run.helmDirectCustomerContactAllowed).length,
      },
      {
        id: "external-side-effect",
        label: english ? "No external side effect" : "不产生外部副作用",
        ok: runs.every((run) => !run.externalSideEffectAllowed),
        count: runs.filter((run) => run.externalSideEffectAllowed).length,
      },
      {
        id: "commitment",
        label: english ? "No official commitment" : "不产生正式承诺",
        ok: runs.every((run) => !run.officialCommitmentAllowed),
        count: runs.filter((run) => run.officialCommitmentAllowed).length,
      },
      {
        id: "raw-pii",
        label: english ? "Alias-only / no raw PII" : "仅别名 / 无原始 PII",
        ok: runs.every((run) => !run.rawPiiIncluded),
        count: runs.filter((run) => run.rawPiiIncluded).length,
      },
    ],
    runs: views,
  };
}

export async function getInternalCommercializationLifecycleReadout(
  workspaceId: string,
  english: boolean,
) {
  const runs = await db.internalCommercializationRun.findMany({
    where: { workspaceId },
    orderBy: [{ updatedAt: "desc" }],
    take: 51,
  });

  return buildInternalCommercializationLifecycleReadout({
    runs: runs.slice(0, 50),
    english,
    truncated: runs.length > 50,
  });
}
