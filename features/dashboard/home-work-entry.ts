import {
  APPROVAL_PAGE_ANCHORS,
  buildSectionHref,
} from "@/lib/presentation/page-section-anchors";
import type { GoalDrivenHomeModel } from "@/lib/operating-system/goal-driven-home";
import type { WorkspaceFirstLoopModel } from "@/lib/operating-system/first-loop";
import { formatSeededBusinessCopy } from "@/lib/presentation/seeded-business-copy";
import type { DashboardSetupFirstLoopHandoffModel } from "@/features/dashboard/setup-first-loop-handoff";

export type DashboardHomeWorkEntryState =
  | "empty-new"
  | "first-loop"
  | "returning-active"
  | "review-heavy";

// DESIGN.md §7.2 requires every judgement-first card to carry boundary
// language. `boundary` is non-nullable; builders that historically returned
// `null` must now state the boundary explicitly (recommendation-only,
// internal-queue, blocker-view, etc.) so the recommendation/commitment line
// stays visible at a glance.
export type DashboardHomeWorkEntryCard = {
  id: string;
  title: string;
  subject: string;
  statusLabel: string;
  nextStep: string;
  boundary: string;
  href: string;
  ctaLabel: string;
  /** Opaque, already-redacted evidence reference for system-derived work. */
  evidenceRef?: string | undefined;
  tracking?:
    | {
        sourceArea: "dashboard-work-entry";
        eventKind: "primary-action-opened" | "anchor-resumed";
        stepId: WorkspaceFirstLoopModel["primaryAction"]["stepId"];
      }
    | undefined;
};

function defaultBoundary(
  english: boolean,
  kind:
    | "first-loop-non-review"
    | "goal-driven"
    | "assignment"
    | "resume-implicit"
    | "blocker",
): string {
  switch (kind) {
    case "first-loop-non-review":
      return english
        ? "Loop step only — any external commitment still goes through review."
        : "只是推进步骤 — 任何对外承诺仍要走复核。";
    case "goal-driven":
      return english
        ? "Recommendation only — does not commit anything externally."
        : "仅建议 — 不构成对外承诺。";
    case "assignment":
      return english
        ? "Internal queue — no customer-facing send."
        : "内部队列 — 不会对外发送。";
    case "resume-implicit":
      return english
        ? "Resumes prior context — does not change external state."
        : "继续之前的上下文 — 不改变对外状态。";
    case "blocker":
      return english
        ? "Blocker view — no automatic action; you decide next step."
        : "阻塞视图 — 不会自动处理；下一步由你决定。";
  }
}

export type DashboardCaseAssignmentActionPreview = {
  id: string;
  title: string;
  description: string | null;
};

export type DashboardHomeWorkEntryModel = {
  canReviewGovernedActions: boolean;
  /**
   * A role can retain governed-review permission without owning the workspace-wide
   * review queue on its dedicated home. Undefined preserves the generic Core home.
   */
  showCrossRoleReviewQueue?: boolean | undefined;
  state: DashboardHomeWorkEntryState;
  topWorkItems: DashboardHomeWorkEntryCard[];
  reviewItems: DashboardHomeWorkEntryCard[];
  /** Pending review total from a count query; reviewItems is capped at 3. */
  pendingReviewCount?: number | undefined;
  reviewItemsArePrimary: boolean;
  assignmentItems: DashboardHomeWorkEntryCard[];
  resumeItem: DashboardHomeWorkEntryCard;
  blockerItems: DashboardHomeWorkEntryCard[];
  /** Role-routed system anomalies projected into suggestion-only work. */
  roleAnomalyItems?: DashboardHomeWorkEntryCard[] | undefined;
};

export type DashboardHomeSecondaryVisibility = {
  showPriorityContext: boolean;
  showSystemContext: boolean;
  showSurfaceRouting: boolean;
};

type PendingApprovalPreview = {
  id: string;
  status: string;
  reasoning: string | null;
  actionItem: {
    title: string;
    opportunity: { id: string; title: string } | null;
    contact: { id: string; name: string } | null;
    meeting: { id: string; title: string | null } | null;
  };
};

type BuildDashboardHomeWorkEntryInput = {
  english: boolean;
  canReviewGovernedActions: boolean;
  firstLoopModel: WorkspaceFirstLoopModel;
  goalDrivenHome: GoalDrivenHomeModel;
  pendingApprovals: PendingApprovalPreview[];
  /** Real pending approval count; `pendingApprovals` is a capped preview. */
  pendingApprovalCount?: number;
  assignmentItems?: DashboardCaseAssignmentActionPreview[];
  setupFirstLoopHandoff: DashboardSetupFirstLoopHandoffModel | null;
};

function getState(
  input: BuildDashboardHomeWorkEntryInput,
): DashboardHomeWorkEntryState {
  if (input.setupFirstLoopHandoff || input.firstLoopModel.completedCount <= 1) {
    return "empty-new";
  }

  if (
    (input.canReviewGovernedActions &&
      input.pendingApprovals.length >= 3) ||
    (input.canReviewGovernedActions &&
      input.pendingApprovals.length > 0 &&
      input.firstLoopModel.primaryAction.stepId === "review")
  ) {
    return "review-heavy";
  }

  if (input.firstLoopModel.stage !== "anchor") {
    return "first-loop";
  }

  return "returning-active";
}

function truncate(input: string | null | undefined, max = 160) {
  const value = (input ?? "").trim();
  if (!value) {
    return "";
  }

  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, max - 1).trimEnd()}…`;
}

function dedupeCards(cards: DashboardHomeWorkEntryCard[], limit: number) {
  const seen = new Set<string>();
  const result: DashboardHomeWorkEntryCard[] = [];

  for (const card of cards) {
    const key = `${card.href}::${card.title}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(card);
    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

function isGovernedReviewHref(href: string) {
  const pathname = href.split(/[?#]/, 1)[0];
  return pathname === "/approvals" || pathname.startsWith("/approvals/");
}

function buildFirstLoopPrimaryCard(
  input: BuildDashboardHomeWorkEntryInput,
): DashboardHomeWorkEntryCard {
  const primary = input.firstLoopModel.primaryAction;
  return {
    id: `primary-${primary.stepId}`,
    title: formatSeededBusinessCopy(primary.label, input.english),
    subject: formatSeededBusinessCopy(
      input.setupFirstLoopHandoff?.signal.label ??
        input.firstLoopModel.firstSignal.label,
      input.english,
    ),
    statusLabel:
      primary.stepId === "review"
        ? input.english
          ? "Needs review"
          : "待你复核"
        : primary.stepId === "anchor"
          ? input.english
            ? "Resume"
            : "继续推进"
          : input.english
            ? "Top work item"
            : "当前最重要事项",
    nextStep: formatSeededBusinessCopy(primary.summary, input.english),
    boundary:
      primary.stepId === "review" || primary.stepId === "write-back"
        ? formatSeededBusinessCopy(input.firstLoopModel.boundary, input.english)
        : defaultBoundary(input.english, "first-loop-non-review"),
    href: primary.href,
    ctaLabel: formatSeededBusinessCopy(primary.ctaLabel, input.english),
    tracking: {
      sourceArea: "dashboard-work-entry",
      eventKind:
        primary.stepId === "anchor"
          ? "anchor-resumed"
          : "primary-action-opened",
      stepId: primary.stepId,
    },
  };
}

function buildGoalDrivenCard(
  item: GoalDrivenHomeModel["immediateActions"][number],
  english: boolean,
  index: number,
): DashboardHomeWorkEntryCard {
  return {
    id: `goal-${index}-${item.href}`,
    title: formatSeededBusinessCopy(item.label, english),
    subject: english
      ? "Current chain or owner-visible move"
      : "当前推进链或负责人可见动作",
    statusLabel: english ? "Ready now" : "现在可推进",
    nextStep: formatSeededBusinessCopy(item.hint, english),
    boundary: defaultBoundary(english, "goal-driven"),
    href: item.href,
    ctaLabel: english ? "Open work item" : "打开事项",
  };
}

function buildReviewItem(
  task: PendingApprovalPreview,
  english: boolean,
  index: number,
): DashboardHomeWorkEntryCard {
  const subject =
    task.actionItem.contact?.name ??
    task.actionItem.opportunity?.title ??
    task.actionItem.meeting?.title ??
    (english ? "Needs confirmation" : "需确认动作");
  return {
    id: `approval-${task.id}-${index}`,
    title: formatSeededBusinessCopy(task.actionItem.title, english),
    subject: formatSeededBusinessCopy(subject, english),
    statusLabel: english ? "Needs your review" : "待你复核",
    nextStep:
      formatSeededBusinessCopy(truncate(task.reasoning), english) ||
      (english
        ? "Confirm whether to approve, rewrite or hand it off."
        : "先确认这条动作该通过、改写还是转人工。"),
    boundary: english
      ? "This move needs your confirmation before it can continue."
      : "这条动作需要你确认后才能继续。",
    href: buildSectionHref(
      `/approvals?approvalId=${task.id}`,
      APPROVAL_PAGE_ANCHORS.preview,
    ),
    ctaLabel: english ? "Review now" : "现在复核",
  };
}

function buildReviewFallback(
  input: BuildDashboardHomeWorkEntryInput,
): DashboardHomeWorkEntryCard[] {
  const review = input.firstLoopModel.reviewCheckpoint;
  if (
    review.status !== "ready" &&
    input.firstLoopModel.primaryAction.stepId !== "review"
  ) {
    return [];
  }

  return [
    {
      id: `review-fallback-${review.id}`,
      title: formatSeededBusinessCopy(review.label, input.english),
      subject: formatSeededBusinessCopy(
        input.firstLoopModel.firstSignal.label,
        input.english,
      ),
      statusLabel: input.english ? "Needs your review" : "待你复核",
      nextStep: formatSeededBusinessCopy(review.summary, input.english),
      boundary: formatSeededBusinessCopy(
        input.firstLoopModel.boundary,
        input.english,
      ),
      href: review.href,
      ctaLabel: input.english ? "Open review" : "打开复核",
      tracking: {
        sourceArea: "dashboard-work-entry",
        eventKind: "primary-action-opened",
        stepId: "review",
      },
    },
  ];
}

function buildAssignmentActionCard(
  item: DashboardCaseAssignmentActionPreview,
  english: boolean,
  index: number,
): DashboardHomeWorkEntryCard {
  return {
    id: `case-assignment-action-${item.id}-${index}`,
    title: item.title,
    subject: english ? "My pending action item" : "我的待推进事项",
    statusLabel: english ? "Pending action" : "待推进",
    nextStep:
      truncate(item.description) ||
      (english
        ? "This assignment batch is already condensed into your next move."
        : "这批分案已经收成你下一步要做的动作。"),
    boundary: defaultBoundary(english, "assignment"),
    href: "/dashboard#employee-assignment-actions",
    ctaLabel: english ? "Open pending action items" : "查看待推进事项",
  };
}

function buildResumeCard(
  input: BuildDashboardHomeWorkEntryInput,
): DashboardHomeWorkEntryCard {
  const readback = input.firstLoopModel.returnReadback;
  return {
    id: `resume-${readback.mode}`,
    title: formatSeededBusinessCopy(readback.label, input.english),
    subject: formatSeededBusinessCopy(
      input.setupFirstLoopHandoff?.signal.label ??
        input.firstLoopModel.firstSignal.label,
      input.english,
    ),
    statusLabel: input.english ? "Resume / continue" : "继续推进",
    nextStep: formatSeededBusinessCopy(readback.summary, input.english),
    boundary:
      readback.mode === "explicit"
        ? input.english
          ? "Resume should reopen the saved work, not restart from scanning the whole workspace."
          : "回访应该直接重开保存的工作，而不是重新扫全场。"
        : defaultBoundary(input.english, "resume-implicit"),
    href: readback.href,
    ctaLabel: formatSeededBusinessCopy(readback.ctaLabel, input.english),
    tracking:
      readback.href === input.firstLoopModel.primaryAction.href &&
      input.firstLoopModel.primaryAction.stepId === "anchor"
        ? {
            sourceArea: "dashboard-work-entry",
            eventKind: "anchor-resumed",
            stepId: "anchor",
          }
        : undefined,
  };
}

function buildRoleWorkFallbackCard(
  english: boolean,
): DashboardHomeWorkEntryCard {
  return {
    id: "resume-role-work-fallback",
    title: english ? "Open current role work" : "打开本角色当前工作",
    subject: english ? "Current role work" : "本角色当前工作",
    statusLabel: english ? "Resume role work" : "继续本角色工作",
    nextStep: english
      ? "Return to the current role workspace and continue from available work."
      : "回到当前角色工位，从可处理的工作继续。",
    boundary: english
      ? "Navigation does not grant review or execution authority."
      : "导航不授予复核或执行权限。",
    href: "/dashboard#role-workspace",
    ctaLabel: english ? "Open role work" : "打开角色工位",
  };
}

function buildBlockerCard(
  item: GoalDrivenHomeModel["topBlockers"][number],
  english: boolean,
  index: number,
): DashboardHomeWorkEntryCard {
  return {
    id: `blocker-${index}-${item.href}`,
    title: formatSeededBusinessCopy(item.label, english),
    subject: english ? "Current blocker" : "当前卡点",
    statusLabel: english ? "Blocked" : "卡住",
    nextStep: formatSeededBusinessCopy(item.hint, english),
    boundary: defaultBoundary(english, "blocker"),
    href: item.href,
    ctaLabel: english ? "Open blocker" : "查看卡点",
  };
}

export function getDashboardHomeSecondaryVisibility(
  state: DashboardHomeWorkEntryState,
): DashboardHomeSecondaryVisibility {
  switch (state) {
    case "empty-new":
      return {
        showPriorityContext: false,
        showSystemContext: false,
        showSurfaceRouting: false,
      };
    case "first-loop":
      return {
        showPriorityContext: true,
        showSystemContext: false,
        showSurfaceRouting: true,
      };
    case "review-heavy":
      return {
        showPriorityContext: true,
        showSystemContext: false,
        showSurfaceRouting: true,
      };
    case "returning-active":
      return {
        showPriorityContext: true,
        showSystemContext: true,
        showSurfaceRouting: true,
      };
  }
}

export function buildDashboardHomeWorkEntry(
  input: BuildDashboardHomeWorkEntryInput,
): DashboardHomeWorkEntryModel {
  const state = getState(input);
  const reviewItems = dedupeCards(
    !input.canReviewGovernedActions
      ? []
      : input.pendingApprovals.length
      ? input.pendingApprovals
          .slice(0, 3)
          .map((task, index) => buildReviewItem(task, input.english, index))
      : buildReviewFallback(input),
    3,
  );
  const assignmentItems = dedupeCards(
    (input.assignmentItems ?? []).map((item, index) =>
      buildAssignmentActionCard(item, input.english, index),
    ),
    3,
  );
  const canPresentFirstLoopPrimary =
    input.canReviewGovernedActions ||
    input.firstLoopModel.primaryAction.stepId !== "review";

  const topWorkCandidates: DashboardHomeWorkEntryCard[] = [
    ...(!input.canReviewGovernedActions
      ? input.goalDrivenHome.roleHandoffs.map((item, index) =>
          buildGoalDrivenCard(item, input.english, index + 20),
        )
      : []),
    ...(canPresentFirstLoopPrimary
      ? [buildFirstLoopPrimaryCard(input)]
      : []),
    ...assignmentItems,
    ...input.goalDrivenHome.immediateActions.map((item, index) =>
      buildGoalDrivenCard(item, input.english, index),
    ),
    ...input.goalDrivenHome.topJudgements.map((item, index) =>
      buildGoalDrivenCard(item, input.english, index + 10),
    ),
  ].filter(
    (item) =>
      input.canReviewGovernedActions || !isGovernedReviewHref(item.href),
  );

  if (state === "review-heavy" && reviewItems.length) {
    topWorkCandidates.unshift(...reviewItems);
  }
  const topWorkItems = dedupeCards(topWorkCandidates, 3);
  const reviewItemIds = new Set(reviewItems.map((item) => item.id));
  const reviewItemsArePrimary =
    state === "review-heavy" &&
    reviewItems.length > 0 &&
    topWorkItems.length > 0 &&
    topWorkItems.every((item) => reviewItemIds.has(item.id));
  const rawResumeItem = buildResumeCard(input);
  const roleSafeResumeItem =
    !input.canReviewGovernedActions &&
    isGovernedReviewHref(rawResumeItem.href)
      ? topWorkItems[0]
        ? {
            ...topWorkItems[0],
            id: `resume-role-work-${topWorkItems[0].id}`,
            statusLabel: input.english ? "Resume role work" : "继续本角色工作",
          }
        : buildRoleWorkFallbackCard(input.english)
      : rawResumeItem;

  return {
    canReviewGovernedActions: input.canReviewGovernedActions,
    showCrossRoleReviewQueue: input.canReviewGovernedActions,
    state,
    topWorkItems,
    reviewItems,
    pendingReviewCount: input.canReviewGovernedActions
      ? input.pendingApprovalCount
      : undefined,
    reviewItemsArePrimary,
    assignmentItems,
    resumeItem: roleSafeResumeItem,
    blockerItems: dedupeCards(
      input.goalDrivenHome.topBlockers
        .map((item, index) => buildBlockerCard(item, input.english, index))
        .filter(
          (item) =>
            input.canReviewGovernedActions ||
            !isGovernedReviewHref(item.href),
        ),
      2,
    ),
    roleAnomalyItems: [],
  };
}
