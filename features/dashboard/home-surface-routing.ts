import {
  APPROVAL_PAGE_ANCHORS,
  MEMORY_PAGE_ANCHORS,
  buildSectionHref,
} from "@/lib/presentation/page-section-anchors";
import type { GoalDrivenHomeModel } from "@/lib/operating-system/goal-driven-home";
import type { WorkspaceFirstLoopModel } from "@/lib/operating-system/first-loop";
import type {
  DashboardHomeWorkEntryCard,
  DashboardHomeWorkEntryModel,
} from "@/features/dashboard/home-work-entry";
import type { DashboardSetupFirstLoopHandoffModel } from "@/features/dashboard/setup-first-loop-handoff";

// DESIGN.md §7.2: every routing card must state its boundary so the
// recommendation/commitment line stays explicit at the surface choice level.
export type DashboardHomeSurfaceRoutingCard = {
  id: "detail" | "approvals" | "memory";
  surface: "detail" | "approvals" | "memory";
  title: string;
  focus: string;
  summary: string;
  boundary: string;
  href: string;
  ctaLabel: string;
};

export type DashboardHomeSurfaceRoutingModel = {
  title: string;
  summary: string;
  cards: [
    DashboardHomeSurfaceRoutingCard,
    DashboardHomeSurfaceRoutingCard,
    DashboardHomeSurfaceRoutingCard,
  ];
};

type BuildDashboardHomeSurfaceRoutingInput = {
  english: boolean;
  workEntry: DashboardHomeWorkEntryModel;
  firstLoopModel: WorkspaceFirstLoopModel;
  goalDrivenHome: GoalDrivenHomeModel;
  setupFirstLoopHandoff: DashboardSetupFirstLoopHandoffModel | null;
};

type HrefCandidate = {
  label: string;
  summary: string;
  href: string;
};

function appendHomeSurfaceEntry(
  href: string,
  kind: DashboardHomeSurfaceRoutingCard["surface"],
  focus: string,
) {
  const [base, hash = ""] = href.split("#");
  const [pathname, query = ""] = base.split("?");
  const searchParams = new URLSearchParams(query);
  searchParams.set("entry", `home-surface-${kind}`);
  searchParams.set("focus", focus);
  const nextQuery = searchParams.toString();

  return `${pathname}${nextQuery ? `?${nextQuery}` : ""}${hash ? `#${hash}` : ""}`;
}

function isRouteHref(href: string, pathname: string) {
  return (
    href === pathname ||
    href.startsWith(`${pathname}/`) ||
    href.startsWith(`${pathname}?`) ||
    href.startsWith(`${pathname}#`)
  );
}

function isHomeOrOverviewHref(href: string) {
  return (
    isRouteHref(href, "/dashboard") ||
    isRouteHref(href, "/operating") ||
    isRouteHref(href, "/reports")
  );
}

function isApprovalsHref(href: string) {
  return isRouteHref(href, "/approvals");
}

function isMemoryHref(href: string) {
  return isRouteHref(href, "/memory");
}

function isDetailLikeHref(href: string) {
  return !isHomeOrOverviewHref(href) && !isApprovalsHref(href) && !isMemoryHref(href);
}

function getDetailHrefRank(href: string) {
  if (isRouteHref(href, "/opportunities")) {
    return 0;
  }

  if (isRouteHref(href, "/meetings")) {
    return 1;
  }

  if (isRouteHref(href, "/companies")) {
    return 2;
  }

  if (isRouteHref(href, "/contacts")) {
    return 3;
  }

  return 4;
}

function cardToCandidate(card: DashboardHomeWorkEntryCard | undefined | null): HrefCandidate | null {
  if (!card) {
    return null;
  }

  return {
    label: card.title,
    summary: card.nextStep,
    href: card.href,
  };
}

function pickDetailCandidate(input: BuildDashboardHomeSurfaceRoutingInput): HrefCandidate {
  const setupFirstLoopCandidate =
    input.setupFirstLoopHandoff && isDetailLikeHref(input.setupFirstLoopHandoff.signal.href)
      ? {
          label: input.setupFirstLoopHandoff.signal.label,
          summary: input.setupFirstLoopHandoff.signal.summary,
          href: input.setupFirstLoopHandoff.signal.href,
        }
      : null;

  if (setupFirstLoopCandidate) {
    return setupFirstLoopCandidate;
  }

  const detailCandidates = [
    ...input.workEntry.topWorkItems
      .filter((item) => isDetailLikeHref(item.href))
      .map((item) => cardToCandidate(item))
      .filter((item): item is HrefCandidate => Boolean(item)),
    isDetailLikeHref(input.firstLoopModel.firstSignal.href)
      ? {
          label: input.firstLoopModel.firstSignal.label,
          summary: input.firstLoopModel.firstSignal.summary,
          href: input.firstLoopModel.firstSignal.href,
        }
      : null,
    ...input.goalDrivenHome.topJudgements
      .filter((item) => isDetailLikeHref(item.href))
      .map((item) => ({
        label: item.label,
        summary: item.hint,
        href: item.href,
      })),
    ...input.goalDrivenHome.immediateActions
      .filter((item) => isDetailLikeHref(item.href))
      .map((item) => ({
        label: item.label,
        summary: item.hint,
        href: item.href,
      })),
  ]
    .filter((item): item is HrefCandidate => Boolean(item))
    .map((item, index) => ({
      candidate: item,
      index,
      rank: getDetailHrefRank(item.href),
    }))
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }

      return left.index - right.index;
    });

  const candidate = detailCandidates[0]?.candidate ?? null;

  return (
    candidate ?? {
      label: input.english ? "Current work detail" : "当前工作详情",
      summary: input.english
        ? "Open the current object or chain to read why it matters now, what changed, and what handling paths remain open."
        : "打开当前对象或推进链，读清楚它为什么现在重要、刚发生了什么，以及还剩哪些处理路径。",
      href: input.firstLoopModel.firstSignal.href,
    }
  );
}

function buildDetailCard(
  input: BuildDashboardHomeSurfaceRoutingInput,
): DashboardHomeSurfaceRoutingCard {
  const candidate = pickDetailCandidate(input);

  return {
    id: "detail",
    surface: "detail",
    title: input.english ? "Open detail to decide the handling path" : "进详情页决定怎么处理",
    focus: candidate.label,
    summary: input.english
      ? `Open detail for "${candidate.label}" to read the state, evidence and handling options before choosing the next move.`
      : `去详情页看“${candidate.label}”的状态、证据和处理选项，再决定下一步怎么走。`,
    boundary: input.english
      ? "Detail surfaces state and evidence only — it does not commit anything externally."
      : "详情页只展示状态与证据 — 不构成对外承诺。",
    href: appendHomeSurfaceEntry(candidate.href, "detail", candidate.label),
    ctaLabel: input.english ? "Open detail" : "打开详情页",
  };
}

function buildApprovalsCard(
  input: BuildDashboardHomeSurfaceRoutingInput,
): DashboardHomeSurfaceRoutingCard {
  const focusItem = input.workEntry.reviewItems[0];
  const pendingCount = input.workEntry.reviewItems.length;

  return {
    id: "approvals",
    surface: "approvals",
    title: input.english ? "Open approvals for boundary review" : "进复核与边界做边界复核",
    focus:
      focusItem?.title ??
      input.firstLoopModel.reviewCheckpoint.label,
    summary: focusItem
      ? input.english
        ? `Home flags ${pendingCount} item${pendingCount === 1 ? "" : "s"} that need your review. Use Approvals to decide why "${focusItem.title}" is held, what evidence matters, and whether to approve, revise or defer it.`
        : `当前有 ${pendingCount} 条事项待你复核。去复核与边界判断“${focusItem.title}”为什么被拦住、该看哪些证据，以及应该通过、改写还是延后。`
      : input.english
        ? "Home can tell you that review pressure exists, but boundary-sensitive action still belongs in Approvals."
        : "当前有复核压力；真正的边界敏感动作仍然应该在复核与边界里处理。",
    boundary:
      focusItem?.boundary ??
      (input.english
        ? "Approvals is where review-before-commitment stays explicit."
        : "复核与边界是先复核再承诺保持显式的位置。"),
    href: appendHomeSurfaceEntry(
      focusItem?.href ?? buildSectionHref("/approvals", APPROVAL_PAGE_ANCHORS.preview),
      "approvals",
      focusItem?.title ?? input.firstLoopModel.reviewCheckpoint.label,
    ),
    ctaLabel: input.english ? "Open approvals" : "打开复核与边界",
  };
}

function buildMemoryCard(
  input: BuildDashboardHomeSurfaceRoutingInput,
): DashboardHomeSurfaceRoutingCard {
  const memoryAnchor =
    input.firstLoopModel.memoryWriteBack.status === "done"
      ? MEMORY_PAGE_ANCHORS.auditReplay
      : MEMORY_PAGE_ANCHORS.timeline;

  const evidenceHint =
    input.goalDrivenHome.evidenceEntries[0]?.label ??
    input.goalDrivenHome.helmDid[0]?.label ??
    input.firstLoopModel.memoryWriteBack.label;

  return {
    id: "memory",
    surface: "memory",
    title: input.english ? "Open memory for stable context and replay" : "进经营记忆看稳定上下文与回放",
    focus: evidenceHint,
    summary:
      input.firstLoopModel.memoryWriteBack.status === "done"
        ? input.english
          ? "Home should not turn into a memory browser. Use Memory to replay what already became stable, inspect corrections, and reuse that context in the next move."
          : "去经营记忆回看哪些内容已经稳定、哪些被修正，以及这些上下文如何继续影响下一步。"
        : input.english
          ? "When the move is still fresh, use Memory to write the result back, leave the decision trace readable, and make the next visit restart from context."
          : "当这条动作还很新时，去经营记忆把结果写回去，留下可读的决策痕迹，并让下次进入能直接从上下文继续。",
    boundary: input.english
      ? "Memory owns durable state, correction and replay. Home only routes you there."
      : "经营记忆负责稳定状态、修正和回放。",
    href: appendHomeSurfaceEntry(
      buildSectionHref("/memory", memoryAnchor),
      "memory",
      evidenceHint,
    ),
    ctaLabel: input.english ? "Open memory" : "打开经营记忆",
  };
}

export function buildDashboardHomeSurfaceRouting(
  input: BuildDashboardHomeSurfaceRoutingInput,
): DashboardHomeSurfaceRoutingModel {
  return {
    title: input.english
      ? "Open the right work surface"
      : "打开对应的工作入口",
    summary: input.english
      ? "Detail handles state and evidence, Approvals handles boundary review, and Memory holds stable state, correction and replay."
      : "详情页处理状态与证据，复核与边界处理边界复核，经营记忆承担稳定状态、修正和回放。",
    cards: [
      buildDetailCard(input),
      buildApprovalsCard(input),
      buildMemoryCard(input),
    ],
  };
}
