/**
 * Mobile Command Read Model Adapter
 *
 * Aggregates Must Push items from existing dashboard / operating / approvals / memory / resource readout data sources.
 * Phase 2: Read Model Adapter - uses real data sources instead of mock data.
 *
 * Reference: docs/product/HELM_MOBILE_COMMAND_SURFACE_REQUIREMENTS_V1.md
 */

import { format } from "date-fns";
import type { WorkspaceClass, WorkspaceRole } from "@prisma/client";
import { db } from "@/lib/db";
import { BusinessAdvancementInvariantViolationError } from "@/lib/business-advancement/invariant-guards";
import {
  resolveThinReadModelAdvancementCandidatesWithFallback,
  type ThinReadModelAdvancementCandidate,
} from "@/features/business-advancement/runtime/thin-read-model-adapter";
import type {
  MustPushItem,
  MustPushOutcomeCheckpointStatus,
  MustPushOutcomeLedgerPosture,
  MustPushOutcomeReviewCue,
  MustPushOutcomeLedgerSummary,
  MustPushSeverity,
  MustPushType,
} from "../types";

const DEFAULT_MUST_PUSH_LIMIT = 4;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const OVERDUE_OPPORTUNITY_QUERY_LIMIT = 5;
const HIGH_RISK_OPPORTUNITY_QUERY_LIMIT = 3;
const APPROVAL_TASK_QUERY_LIMIT = 3;
const POST_MEETING_QUERY_LIMIT = 3;
const WAITING_THREAD_QUERY_LIMIT = 3;
const TENANT_RESOURCE_ISSUE_LIMIT = 3;

// Keep producer scores deterministic. Final ordering is still governed by severity and type boosts below.
const OVERDUE_SCORE_BASE = 95;
const OVERDUE_CRITICAL_AFTER_DAYS = 7;
const CRITICAL_RISK_SCORE = 85;
const HIGH_RISK_SCORE = 65;
const APPROVAL_REVIEW_SCORE = 80;
const MEETING_FOLLOW_UP_SCORE = 60;
const CUSTOMER_WAITING_SCORE = 75;
const CRITICAL_RESOURCE_SCORE = 90;
const RESOURCE_REVIEW_SCORE = 55;

/**
 * Mobile Command Read Model
 *
 * Returns aggregated Must Push items for the mobile first screen.
 */
export interface MobileCommandReadModel {
  mustPushItems: MustPushItem[];
  totalCount: number;
  foldedCount: number;
  hasCriticalFolded: boolean;
  reviewCount: number;
  outcomeCheckpointCount: number;
  outcomeLedger: MustPushOutcomeLedgerSummary;
  todaySummary: string;
}

export interface GetMobileCommandReadModelInput {
  workspaceId: string;
  actorUserId?: string | null;
  membershipRole?: WorkspaceRole | null;
  workspaceClass?: WorkspaceClass | null;
  limit?: number;
  now?: Date;
  english?: boolean;
}

/**
 * Get Must Push items for the mobile first screen.
 *
 * Aggregates from 6 sources:
 * 1. overdue_commitment - opportunities past due date
 * 2. blocked_decision - pending approvals
 * 3. stalled_opportunity - high risk opportunities
 * 4. meeting_follow_up - post-meeting action items
 * 5. customer_waiting - waiting email threads
 * 6. proof_or_review_required - tenant resource issues
 */
export async function getMobileCommandReadModel(
  input: GetMobileCommandReadModelInput,
): Promise<MobileCommandReadModel> {
  const now = input.now ?? new Date();
  const english = input.english ?? false;

  // Phase 3 runtime adoption probe (launch plan §三 Week 3 #20). The probe
  // runs BEFORE the read-first aggregation. With the runtime adoption flag
  // off (default), the helper returns `null` and we silently fall through
  // to read-first — behaviour identical to pre-Phase-3 main.
  //
  // When `BUSINESS_ADVANCEMENT_RUNTIME_ENABLED` is flipped on AND the
  // workspace is in the allowlist AND the production query path lands
  // (post-Required-Reviewer-approval), this probe will return concrete
  // ThinReadModelAdvancementCandidate[] which a follow-up PR maps onto
  // `MustPushItem[]`. The mapping is intentionally NOT done here today —
  // it requires the deterministic ranking implementation, which depends
  // on the 6 hard prerequisites and reviewer approval.
  //
  // An invariant violation propagates from the helper and aborts; the
  // caller (currently the /mobile entry) catches Phase 3 violations at
  // the route boundary so oncall sees the alarm and can flip the flag.
  let phase3Candidates: readonly ThinReadModelAdvancementCandidate[] | null = null;
  try {
    phase3Candidates = await resolveThinReadModelAdvancementCandidatesWithFallback({
      workspaceId: input.workspaceId,
    });
  } catch (error) {
    if (error instanceof BusinessAdvancementInvariantViolationError) {
      // Surface to caller; oncall must observe + flip the flag.
      throw error;
    }
    // Defensive: any other error keeps mobile surface usable on read-first.
    phase3Candidates = null;
  }
  // Today: phase3Candidates is `null` in production. Keep this read for
  // future wiring + linting (no-unused-vars).
  void phase3Candidates;

  // Load all data sources in parallel. Each source is wrapped in a
  // per-source safe fallback: a schema/DB/extension failure in any single
  // source must NOT collapse the entire mobile surface to the route-level
  // loading recovery (P0 prod issue, 2026-05-11). The BusinessAdvancement
  // invariant guard above is the only thing allowed to bubble.
  const [
    overdueOpportunities,
    highRiskOpportunities,
    pendingApprovals,
    postMeetingItems,
    waitingOnUsThreads,
    tenantResourceIssues,
  ] = await Promise.all([
    safeLoadMobileSource("overdue_commitment", () =>
      loadOverdueOpportunities(input.workspaceId, now, english),
    ),
    safeLoadMobileSource("stalled_opportunity", () =>
      loadHighRiskOpportunities(input.workspaceId, now, english),
    ),
    safeLoadMobileSource("blocked_decision", () =>
      loadPendingApprovals(input.workspaceId, english),
    ),
    safeLoadMobileSource("meeting_follow_up", () =>
      loadPostMeetingItems(input.workspaceId, now, english),
    ),
    safeLoadMobileSource("customer_waiting", () =>
      loadWaitingEmailThreads(input.workspaceId, english),
    ),
    safeLoadMobileSource("proof_or_review_required", () =>
      loadTenantResourceIssues({
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        membershipRole: input.membershipRole,
        workspaceClass: input.workspaceClass,
        english,
      }),
    ),
  ]);

  // Convert all sources to MustPushItem format
  const allItems: MustPushItem[] = [
    ...overdueOpportunities,
    ...highRiskOpportunities,
    ...pendingApprovals,
    ...postMeetingItems,
    ...waitingOnUsThreads,
    ...tenantResourceIssues,
  ];

  return buildMobileCommandReadModelFromItems(
    allItems,
    input.limit ?? DEFAULT_MUST_PUSH_LIMIT,
    english,
  );
}

export function buildMobileCommandReadModelFromItems(
  items: MustPushItem[],
  limit = DEFAULT_MUST_PUSH_LIMIT,
  english = false,
): MobileCommandReadModel {
  const itemsWithOutcomeCheckpoints = items.map((item) =>
    ensureOutcomeCheckpoint(item, english),
  );
  const rankedItems = rankMustPushItems(itemsWithOutcomeCheckpoints);
  const totalCount = rankedItems.length;
  const displayItems = rankedItems.slice(0, limit);
  const foldedItems = rankedItems.slice(limit);
  const foldedCount = foldedItems.length;
  const hasCriticalFolded = foldedItems.some(
    (item) => item.severity === "critical" || item.type === "customer_waiting",
  );
  const reviewCount = items.filter(
    (item) => item.type === "blocked_decision" || item.boundaryNote?.type === "review_required",
  ).length;
  const outcomeCheckpointCount = displayItems.filter(
    (item) => item.outcomeCheckpoint !== undefined,
  ).length;
  const outcomeLedger = buildOutcomeLedger(displayItems, english);

  // Generate today summary
  const todaySummary = generateTodaySummary(displayItems, english);

  return {
    mustPushItems: displayItems,
    totalCount,
    foldedCount,
    hasCriticalFolded,
    reviewCount,
    outcomeCheckpointCount,
    outcomeLedger,
    todaySummary,
  };
}

/**
 * Wrap a single mobile Must Push source loader so a transient
 * schema/extension/DB failure inside one source returns `[]` instead of
 * rejecting the parent Promise.all and leaving /mobile pinned on the
 * app-level loading recovery.
 *
 * BusinessAdvancementInvariantViolationError is intentionally NOT caught —
 * it remains the single signal oncall watches before flipping the runtime
 * flag (see comment above the Phase 3 probe).
 */
export async function safeLoadMobileSource<T>(
  sourceName: string,
  loader: () => Promise<T[]>,
): Promise<T[]> {
  try {
    return await loader();
  } catch (error) {
    if (error instanceof BusinessAdvancementInvariantViolationError) {
      throw error;
    }
    console.error(
      `[mobile-command-read-model] source ${sourceName} failed; degrading to empty list`,
      error,
    );
    return [];
  }
}

/**
 * Load overdue opportunities (overdue_commitment source).
 */
async function loadOverdueOpportunities(
  workspaceId: string,
  now: Date,
  english: boolean,
): Promise<MustPushItem[]> {
  const opportunities = await db.opportunity.findMany({
    where: {
      workspaceId,
      stage: { notIn: ["DONE", "LOST"] },
      dueDate: { lt: now },
    },
    include: { company: true, owner: true },
    orderBy: { dueDate: "asc" },
    take: OVERDUE_OPPORTUNITY_QUERY_LIMIT,
  });

  return opportunities
    .filter((opp): opp is typeof opp & { dueDate: Date } => opp.dueDate !== null)
    .map((opp) => {
      const staleDays = elapsedWholeDays(opp.dueDate, now);
      const targetName = opp.company?.name ?? opp.title;
      const dayCount = formatDayCount(staleDays, english);
      const dueDate = formatMobileDate(opp.dueDate, english);

      return {
        id: `overdue-opp-${opp.id}`,
        type: "overdue_commitment",
        title: english
          ? `${targetName} renewal is ${dayCount} overdue`
          : `${targetName} 续约已逾期 ${dayCount}`,
        reason: english
          ? `Commitment was due by ${dueDate}; review the next step before any customer-facing follow-up.`
          : `承诺在 ${dueDate} 前发送续约方案，客户已多次催问进度。`,
        primaryAction: {
          label: english ? "Open opportunity" : "打开机会",
          href: `/opportunities?opportunityId=${opp.id}`,
          mode: "open_object",
        },
        boundaryNote: {
          type: "suggestion_not_commitment",
          message: english
            ? "Review before making any customer commitment."
            : "先复核，再对客户承诺。",
        },
        severity: staleDays > OVERDUE_CRITICAL_AFTER_DAYS ? "critical" : "high",
        score: OVERDUE_SCORE_BASE - staleDays,
      };
    });
}

/**
 * Load high risk opportunities (stalled_opportunity source).
 */
async function loadHighRiskOpportunities(
  workspaceId: string,
  now: Date,
  english: boolean,
): Promise<MustPushItem[]> {
  const opportunities = await db.opportunity.findMany({
    where: {
      workspaceId,
      stage: { notIn: ["DONE", "LOST"] },
      riskLevel: { in: ["HIGH", "CRITICAL"] },
      // Exclude overdue (already handled)
      OR: [{ dueDate: null }, { dueDate: { gte: now } }],
    },
    include: { company: true, owner: true },
    orderBy: [{ riskLevel: "desc" }, { priorityScore: "desc" }],
    take: HIGH_RISK_OPPORTUNITY_QUERY_LIMIT,
  });

  return opportunities.map((opp) => {
    const isCritical = opp.riskLevel === "CRITICAL";
    const updatedAt = opp.updatedAt ?? opp.createdAt;
    const staleDays = elapsedWholeDays(updatedAt, now);
    const targetName = opp.company?.name ?? opp.title;
    const dayCount = formatDayCount(staleDays, english);

    return {
      id: `stalled-opp-${opp.id}`,
      type: "stalled_opportunity",
      title: english
        ? `${targetName} opportunity has stalled for ${dayCount}`
        : `${targetName} 机会停滞 ${dayCount}`,
      reason: english
        ? isCritical
          ? "Marked as critical risk; review evidence before committing to an external next step."
          : "No new follow-up is visible after the last touchpoint; restore the operating rhythm."
        : isCritical
          ? "已标注关键风险，竞争对手可能已在接触。"
          : "上次会议后没有新的跟进动作，建议恢复节奏。",
      primaryAction: {
        label: english ? "Open opportunity" : "打开机会",
        href: `/opportunities?opportunityId=${opp.id}`,
        mode: "open_object",
      },
      boundaryNote: {
        type: "suggestion_not_commitment",
        message: english
          ? "This suggests restoring momentum; it does not commit a deal outcome."
          : "建议恢复节奏，不承诺成交结果。",
      },
      severity: isCritical ? "critical" : "medium",
      score: isCritical ? CRITICAL_RISK_SCORE : HIGH_RISK_SCORE,
    };
  });
}

/**
 * Load pending approvals (blocked_decision source).
 */
async function loadPendingApprovals(workspaceId: string, english: boolean): Promise<MustPushItem[]> {
  const tasks = await db.approvalTask.findMany({
    where: {
      workspaceId,
      status: "PENDING",
    },
    include: {
      actionItem: {
        include: {
          opportunity: { include: { company: true } },
          contact: true,
          meeting: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: APPROVAL_TASK_QUERY_LIMIT,
  });

  return tasks.map((task) => {
    const targetName =
      task.actionItem.opportunity?.company?.name ??
      task.actionItem.contact?.name ??
      task.actionItem.meeting?.title ??
      (english ? "Action item" : "待办事项");

    return {
      id: `approval-${task.id}`,
      type: "blocked_decision",
      title: english ? `${targetName} needs your review` : `${targetName} 需要你复核`,
      reason:
        task.actionItem.description ??
        (english
          ? "Helm suggested an action; it needs review before execution."
          : "系统建议了一个行动，需要你确认后再执行。"),
      primaryAction: {
        label: english ? "Open review" : "进入复核",
        href: "/approvals",
        mode: "open_review",
      },
      boundaryNote: {
        type: "review_required",
        message: english
          ? "Helm can prepare review material, but cannot approve or send."
          : "只能准备复核材料，不能直接批准或发送。",
      },
      severity: "high",
      score: APPROVAL_REVIEW_SCORE,
    };
  });
}

/**
 * Load post-meeting action items (meeting_follow_up source).
 */
async function loadPostMeetingItems(
  workspaceId: string,
  now: Date,
  english: boolean,
): Promise<MustPushItem[]> {
  const items = await db.actionItem.findMany({
    where: {
      workspaceId,
      meetingId: { not: null },
      status: { in: ["PENDING_APPROVAL", "MANUAL"] },
    },
    include: {
      meeting: true,
      opportunity: { include: { company: true } },
      contact: true,
    },
    orderBy: { dueDate: "asc" },
    take: POST_MEETING_QUERY_LIMIT,
  });

  return items.map((item) => {
    const targetName =
      item.meeting?.title ??
      item.opportunity?.company?.name ??
      item.contact?.name ??
      (english ? "Follow-up" : "跟进");

    return {
      id: `meeting-followup-${item.id}`,
      type: "meeting_follow_up",
      title: english ? `${targetName} needs meeting follow-up` : `${targetName} 会后待跟进`,
      reason:
        item.title ??
        (english
          ? "The meeting is over; action items and owners need review."
          : "会议已结束，需要整理行动项和负责人。"),
      primaryAction: {
        label: english ? "View meeting" : "查看会议",
        href: item.meetingId ? `/meetings/${item.meetingId}` : "/meetings",
        mode: "open_object",
      },
      boundaryNote: {
        type: "suggestion_not_commitment",
        message: english
          ? "Helm can prepare a follow-up draft; external sending still requires review."
          : "可以准备跟进草稿，对外发送仍需复核。",
      },
      severity: item.dueDate && item.dueDate < now ? "high" : "medium",
      score: MEETING_FOLLOW_UP_SCORE,
    };
  });
}

/**
 * Load waiting email threads (customer_waiting source).
 */
async function loadWaitingEmailThreads(workspaceId: string, english: boolean): Promise<MustPushItem[]> {
  const threads = await db.emailThread.findMany({
    where: {
      workspaceId,
      status: "WAITING_US",
    },
    include: {
      company: true,
      contact: true,
    },
    orderBy: { updatedAt: "desc" },
    take: WAITING_THREAD_QUERY_LIMIT,
  });

  return threads.map((thread) => {
    const targetName = thread.company?.name ?? thread.contact?.name ?? (english ? "Customer" : "客户");

    return {
      id: `waiting-thread-${thread.id}`,
      type: "customer_waiting",
      title: english ? `${targetName} is waiting for a reply` : `${targetName} 等待回复`,
      reason: english
        ? "The customer sent a follow-up; review before replying."
        : "客户已发送后续消息，需要尽快回应。",
      primaryAction: {
        label: english ? "Open inbox" : "查看收件箱",
        href: "/inbox",
        mode: "open_page",
      },
      boundaryNote: {
        type: "review_required",
        message: english
          ? "Helm can surface the waiting state, but does not send replies automatically."
          : "可以提示等待状态，不自动发送回复。",
      },
      severity: "high",
      score: CUSTOMER_WAITING_SCORE,
    };
  });
}

/**
 * Load tenant resource issues (proof_or_review_required source).
 */
async function loadTenantResourceIssues(input: {
  workspaceId: string;
  actorUserId?: string | null;
  membershipRole?: WorkspaceRole | null;
  workspaceClass?: WorkspaceClass | null;
  english: boolean;
}): Promise<MustPushItem[]> {
  // Load tenant resource operating impact to find issues
  const { getWorkspaceTenantResourceOperatingImpactReadout } =
    await import("@/lib/tenant-resources/workspace-operating-impact-query");

  const readout = await getWorkspaceTenantResourceOperatingImpactReadout({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    membershipRole: input.membershipRole,
    workspaceClass: input.workspaceClass,
    english: input.english,
  });

  // Filter for critical/high severity items that need attention
  const itemsNeedingAttention = readout.impactItems.filter(
    (item) =>
      item.severity === "critical" ||
      item.severity === "high" ||
      item.proofRequired === true ||
      item.followThroughStatus === "blocked",
  );

  return itemsNeedingAttention.slice(0, TENANT_RESOURCE_ISSUE_LIMIT).map((item, index) => ({
    id: `resource-issue-${index}`,
    type: "proof_or_review_required" as MustPushType,
    title: item.nextActionTitle ?? (input.english ? "Resource needs review" : "资源需要关注"),
    reason:
      item.summary ??
      (input.english ? "Add proof or complete review before advancing." : "需要补充凭证或进行复核。"),
    primaryAction: {
      label: input.english ? "Add proof" : "补充凭证",
      href: item.href ?? "/settings",
      mode: "open_page",
    },
    boundaryNote: {
      type: "review_required",
      message: input.english
        ? "Adding proof or entering review does not mean the external write succeeded."
        : "补证据 / 进入复核，不代表外部写入成功。",
    },
    severity: item.severity === "critical" ? ("critical" as MustPushSeverity) : ("medium" as MustPushSeverity),
    score: item.severity === "critical" ? CRITICAL_RESOURCE_SCORE : RESOURCE_REVIEW_SCORE,
  }));
}

/**
 * Deterministic ranking for Must Push items.
 *
 * Sort order:
 * 1. severity: critical > high > medium > low
 * 2. customer waiting: true > false
 * 3. blocked decision: true > false
 * 4. score (higher > lower)
 */
function rankMustPushItems(items: MustPushItem[]): MustPushItem[] {
  const severityOrder: Record<MustPushSeverity, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  return [...items].sort((a, b) => {
    // Primary sort by severity
    const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
    if (severityDiff !== 0) return severityDiff;

    // Secondary sort by customer waiting
    const aCustomerWaiting = a.type === "customer_waiting";
    const bCustomerWaiting = b.type === "customer_waiting";
    if (aCustomerWaiting && !bCustomerWaiting) return -1;
    if (!aCustomerWaiting && bCustomerWaiting) return 1;

    // Tertiary sort by blocked decision
    const aBlocked = a.type === "blocked_decision";
    const bBlocked = b.type === "blocked_decision";
    if (aBlocked && !bBlocked) return -1;
    if (!aBlocked && bBlocked) return 1;

    // Final sort by score
    return b.score - a.score;
  });
}

const OUTCOME_CHECKPOINT_COPY: Record<
  MustPushType,
  {
    zh: { dueHint: string; expectedSignal: string };
    en: { dueHint: string; expectedSignal: string };
  }
> = {
  overdue_commitment: {
    zh: {
      dueHint: "72 小时内回看",
      expectedSignal: "复核后的下一步姿态、客户回应或降级原因",
    },
    en: {
      dueHint: "Check again within 72h",
      expectedSignal: "Reviewed next-step posture, customer response, or downgrade reason",
    },
  },
  blocked_decision: {
    zh: {
      dueHint: "本工作日内回看",
      expectedSignal: "复核结果、需要补充的证据或阻塞原因",
    },
    en: {
      dueHint: "Check again today",
      expectedSignal: "Review result, missing evidence, or blocker reason",
    },
  },
  stalled_opportunity: {
    zh: {
      dueHint: "72 小时内回看",
      expectedSignal: "机会是否恢复节奏、被降级或继续阻塞",
    },
    en: {
      dueHint: "Check again within 72h",
      expectedSignal: "Whether momentum resumed, downgraded, or stayed blocked",
    },
  },
  meeting_follow_up: {
    zh: {
      dueHint: "下一个工作日前回看",
      expectedSignal: "行动项归属、客户反馈或待复核草稿状态",
    },
    en: {
      dueHint: "Check before next workday",
      expectedSignal: "Action owner, customer response, or draft review posture",
    },
  },
  customer_waiting: {
    zh: {
      dueHint: "24 小时内回看",
      expectedSignal: "客户等待状态是否解除、是否需要升级复核",
    },
    en: {
      dueHint: "Check again within 24h",
      expectedSignal: "Whether the waiting state cleared or needs review escalation",
    },
  },
  proof_or_review_required: {
    zh: {
      dueHint: "证据补齐后回看",
      expectedSignal: "证据是否可用、是否进入复核或继续缺口",
    },
    en: {
      dueHint: "Check after evidence is added",
      expectedSignal: "Whether evidence is usable, enters review, or remains incomplete",
    },
  },
};

function ensureOutcomeCheckpoint(item: MustPushItem, english: boolean): MustPushItem {
  const itemId = encodeURIComponent(item.id);
  const defaultReviewHref = `/approvals?source=mobile&itemId=${itemId}&posture=outcome_review`;

  if (item.outcomeCheckpoint) {
    const sanitized = normalizeSafeOutcomeReviewHref(item.outcomeCheckpoint.reviewHref);
    if (sanitized !== null) return item;
    return {
      ...item,
      outcomeCheckpoint: {
        ...item.outcomeCheckpoint,
        reviewHref: defaultReviewHref,
      },
    };
  }

  const copy = english ? OUTCOME_CHECKPOINT_COPY[item.type].en : OUTCOME_CHECKPOINT_COPY[item.type].zh;

  return {
    ...item,
    outcomeCheckpoint: {
      label: english ? "Outcome check" : "结果回收",
      dueHint: copy.dueHint,
      expectedSignal: copy.expectedSignal,
      reviewHref: defaultReviewHref,
      status: "not_collected",
    },
  };
}

function buildOutcomeLedger(
  items: MustPushItem[],
  english: boolean,
): MustPushOutcomeLedgerSummary {
  const ledgerItems = items.flatMap((item) => {
    const checkpoint = item.outcomeCheckpoint;
    if (!checkpoint) return [];

    const reviewHref = normalizeSafeOutcomeReviewHref(checkpoint.reviewHref);
    const boundaryNote = english
      ? "Outcome review is evidence collection only; Helm does not confirm external results from this surface."
      : "只回收结果信号，不自动确认结果或写回外部系统。";

    return [
      {
        id: `outcome::${item.id}`,
        mustPushId: item.id,
        title: item.title,
        type: item.type,
        severity: item.severity,
        checkpointStatus: checkpoint.status,
        posture: resolveOutcomeLedgerPosture(checkpoint.status),
        dueHint: checkpoint.dueHint,
        expectedSignal: checkpoint.expectedSignal,
        reviewHref,
        boundaryNote,
      },
    ];
  });

  const dueCount = ledgerItems.filter(
    (item) => item.posture === "collect_signal" || item.posture === "review_due",
  ).length;
  const reviewPendingCount = ledgerItems.filter(
    (item) => item.posture === "review_due",
  ).length;
  const blockedCount = ledgerItems.filter((item) => item.posture === "blocked").length;
  const nextReviewHref =
    ledgerItems.find(
      (item) =>
        item.reviewHref &&
        (item.posture === "review_due" || item.posture === "collect_signal"),
    )?.reviewHref ?? null;
  const reviewCue =
    ledgerItems
      .map((item) => buildOutcomeReviewCue(item, english))
      .find((cue): cue is MustPushOutcomeReviewCue => cue !== null) ?? null;

  return {
    items: ledgerItems,
    dueCount,
    reviewPendingCount,
    blockedCount,
    nextReviewHref,
    reviewCue,
    summary: buildOutcomeLedgerSummary({
      dueCount,
      reviewPendingCount,
      blockedCount,
      itemCount: ledgerItems.length,
      english,
    }),
    boundaryNote: english
      ? "Outcome ledger only surfaces the next review; it does not confirm outcomes, write external systems, or commit customer results."
      : "结果回收台账只提示下一次复核，不自动确认结果、写回外部系统或承诺客户结果。",
  };
}

function resolveOutcomeLedgerPosture(
  status: MustPushOutcomeCheckpointStatus,
): MustPushOutcomeLedgerPosture {
  switch (status) {
    case "review_pending":
      return "review_due";
    case "accepted":
    case "downgraded":
      return "accepted";
    case "blocked":
      return "blocked";
    case "not_collected":
      return "collect_signal";
  }
}

function buildOutcomeLedgerSummary(input: {
  dueCount: number;
  reviewPendingCount: number;
  blockedCount: number;
  itemCount: number;
  english: boolean;
}): string {
  if (input.itemCount === 0) {
    return input.english ? "No outcome checks today" : "今天没有结果回收项";
  }
  if (input.reviewPendingCount > 0) {
    return input.english
      ? `${input.reviewPendingCount} outcome check${input.reviewPendingCount === 1 ? "" : "s"} pending`
      : `${input.reviewPendingCount} 项结果待复核`;
  }
  if (input.dueCount > 0) {
    return input.english
      ? `${input.dueCount} outcome signal${input.dueCount === 1 ? "" : "s"} to collect`
      : `${input.dueCount} 项结果待回收`;
  }
  if (input.blockedCount > 0) {
    return input.english
      ? `${input.blockedCount} outcome check${input.blockedCount === 1 ? "" : "s"} blocked`
      : `${input.blockedCount} 项结果回收受阻`;
  }
  return input.english ? "Outcome checks reviewed" : "结果回收已复核";
}

function buildOutcomeReviewCue(
  item: {
    mustPushId: string;
    posture: MustPushOutcomeLedgerPosture;
    dueHint: string;
    expectedSignal: string;
  },
  english: boolean,
): MustPushOutcomeReviewCue | null {
  if (item.posture === "accepted") return null;

  if (english) {
    const question =
      item.posture === "blocked"
        ? "What blocker prevents this outcome from being reviewed?"
        : item.posture === "review_due"
          ? "Is the collected signal enough to close, downgrade, or escalate this item?"
          : "Has the expected outcome signal appeared yet?";

    return {
      mustPushId: item.mustPushId,
      question,
      evidenceToCheck: [
        `Timing: ${item.dueHint}`,
        `Expected signal: ${item.expectedSignal}`,
        "Latest internal notes, review packets, or linked object history",
      ],
      allowedDecisions: [
        "Keep collecting signal",
        "Move to manual review",
        "Downgrade or mark blocked",
      ],
      boundaryNote:
        "This cue prepares a human review only; it does not close the item or confirm external success.",
    };
  }

  const question =
    item.posture === "blocked"
      ? "是什么阻塞了这次结果复核？"
      : item.posture === "review_due"
        ? "已回收的信号是否足以关闭、降级或升级这件事？"
        : "预期的结果信号是否已经出现？";

  return {
    mustPushId: item.mustPushId,
    question,
    evidenceToCheck: [
      `时间要求：${item.dueHint}`,
      `预期信号：${item.expectedSignal}`,
      "最近的内部记录、复核包或关联对象历史",
    ],
    allowedDecisions: ["继续回收信号", "进入人工复核", "降级或标记阻塞"],
    boundaryNote: "这个提示只准备人工复核，不自动关闭事项或确认外部成功。",
  };
}

function normalizeSafeOutcomeReviewHref(href: string): string | null {
  if (!href.startsWith("/") || href.startsWith("//")) return null;
  if (href.startsWith("/api/")) return null;
  if (href.includes("\\")) return null;
  if (/[\x00-\x1F\x7F]/.test(href)) return null;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(href)) return null;
  return href;
}

/**
 * Generate today's summary from top Must Push items.
 */
function generateTodaySummary(items: MustPushItem[], english: boolean): string {
  if (items.length === 0) {
    return english ? "No urgent items today" : "今天没有紧急事项";
  }

  const primary = items[0];

  // Extract key info from primary item
  const targetMatch = primary.title.match(/^([^\s]+)/);
  const target = targetMatch ? targetMatch[1] : "事项";

  switch (primary.type) {
    case "overdue_commitment":
      return english ? `Start with ${target}'s overdue commitment today` : `今天先处理 ${target} 逾期事项`;
    case "blocked_decision":
      return english ? `Review ${target} first today` : `今天先复核 ${target}`;
    case "customer_waiting":
      return english ? `Reply to ${target} first today` : `今天先回复 ${target}`;
    case "stalled_opportunity":
      return english ? `Advance ${target} first today` : `今天先推进 ${target}`;
    case "meeting_follow_up":
      return english ? `Finish ${target}'s meeting follow-up first today` : `今天先完成 ${target} 会后跟进`;
    case "proof_or_review_required":
      return english ? `Complete ${target}'s proof or review first today` : `今天先补齐 ${target}`;
    default:
      return english ? `Handle ${target} first today` : `今天先处理 ${target}`;
  }
}

function elapsedWholeDays(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

function formatDayCount(days: number, english: boolean): string {
  if (!english) {
    return `${days} 天`;
  }

  return `${days} ${days === 1 ? "day" : "days"}`;
}

function formatMobileDate(date: Date, english: boolean): string {
  return format(date, english ? "MMM d" : "M月d日");
}
