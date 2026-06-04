"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Paperclip,
  Plus,
  Rows3,
  Sparkles,
  Table2,
  Upload,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { RecommendationJudgementCard } from "@/components/recommendations/recommendation-judgement-card";
import { RecommendationFeedbackButtons } from "@/components/recommendations/recommendation-feedback-buttons";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { BlockerCard } from "@/components/shared/blocker-card";
import { CommitmentCard } from "@/components/shared/commitment-card";
import { CustomerAssetFocusStrip } from "@/components/shared/customer-asset-focus-strip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import {
  HomeSurfaceArrivalBanner,
  useHomeSurfaceArrival,
} from "@/components/shared/home-surface-arrival-banner";
import { PageHeader } from "@/components/shared/page-header";
import { ProactiveMechanismPanel } from "@/components/shared/proactive-mechanism-panel";
import { ReportingProtocolPanel } from "@/components/shared/reporting-protocol-panel";
import { RiskBadge } from "@/components/shared/risk-badge";
import { StageBadge } from "@/components/shared/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  opportunityTypeLabels,
  riskLabels,
  stageLabels,
} from "@/data/constants";
import { useConsoleStore } from "@/hooks/use-console-store";
import { buildOpportunityAssetHref } from "@/features/business-assets/hrefs";
import {
  formatOpportunityDateLabel,
  formatOpportunityRelativeLabel,
} from "@/features/opportunities/opportunity-date-labels";
import {
  getLocalizedOpportunityTypeLabels,
  getLocalizedRiskLabels,
  getLocalizedStageLabels,
} from "@/lib/i18n/labels";
import { getWorkspaceStory } from "@/lib/presentation/workspace-story";
import {
  MEMORY_PAGE_ANCHORS,
  OPPORTUNITY_PAGE_ANCHORS,
  buildMemoryItemAnchor,
  buildOpportunityItemAnchor,
  buildSectionHref,
  scrollToWindowHashTarget,
} from "@/lib/presentation/page-section-anchors";
import { buildBusinessLoopGapReadout } from "@/lib/presentation/business-loop-gap-readout";
import {
  createActiveReportProtocol,
  createProactiveCollaborationProtocol,
  createProactiveFlow,
} from "@/lib/presentation/proactive-mechanism";
import {
  cn,
  formatDateLabel,
  formatRelative,
  isOverdue,
  toDateTimeLocalInput,
  trimText,
} from "@/lib/utils";
import { createPageReportingProtocol } from "@/lib/presentation/reporting-protocol";
import {
  createEvidencePayloadGroups,
  createWorkerSkillResourcePageSupport,
} from "@/lib/worker-skill-resource/presentation";
import type { BusinessLoopGapSummary } from "@/lib/operating-system/operating-gap";
import {
  assignOpportunityOwnerAction,
  bulkUpdateOpportunitiesAction,
  createActionFromDingTalkSignalAction,
  generateOpportunityFollowUpAction,
  moveOpportunityStageAction,
  saveOpportunityAction,
} from "@/features/opportunities/actions";
import {
  formatOpportunityDisplayText,
  formatOpportunityGuidanceItems as _formatOpportunityGuidanceItems,
  formatOpportunityProactiveFlow,
  formatOpportunityReportingProtocol,
} from "@/features/opportunities/display-copy";
import { createActionFromRecommendationAction } from "@/features/recommendations/actions";
import { StartRecordingButton } from "@/features/conversation-capture/start-recording-button";

type OpportunityItem = {
  id: string;
  title: string;
  type: keyof typeof opportunityTypeLabels;
  stage: keyof typeof stageLabels;
  riskLevel: keyof typeof riskLabels;
  nextAction: string | null;
  dueDate: Date | null;
  lossReason: string | null;
  priorityScore: number;
  updatedAt: Date;
  company: { id: string; name: string } | null;
  contacts: Array<{ id: string; name: string }>;
  owner: { id: string; name: string } | null;
  actionItems: Array<{ id: string; status: string }>;
  memoryFacts: Array<{
    id: string;
    title: string;
    content: string;
    confidence: number;
    updatedAt: Date;
  }>;
  commitments: Array<{
    id: string;
    title: string;
    commitmentText: string;
    status: string;
    dueDate: Date | null;
    overdueFlag: boolean;
    sourceType: string;
    updatedAt: Date;
    ownerUser: { name: string } | null;
    relatedContact: { id: string; name: string } | null;
    relatedCompany: { id: string; name: string } | null;
    relatedOpportunity: { id: string; title: string } | null;
    relatedMeeting: { id: string; title: string } | null;
  }>;
  blockers: Array<{
    id: string;
    title: string;
    blockerText: string;
    status: string;
    severity: number;
    blockerType: string;
    firstSeenAt: Date;
    updatedAt: Date;
    relatedContact: { id: string; name: string } | null;
    relatedCompany: { id: string; name: string } | null;
    relatedOpportunity: { id: string; title: string } | null;
    relatedMeeting: { id: string; title: string } | null;
  }>;
  auditLogs: Array<{
    id: string;
    actionType: string;
    summary: string;
    targetId: string;
    relatedObjectId: string | null;
    sourcePage: string | null;
    createdAt: Date;
  }>;
  briefingSnapshot: {
    id: string;
    payload: {
      summary?: string;
      recommendedNextSteps?: string[];
    };
  } | null;
  dingtalkSignalSummary?: {
    totalSignals: number;
    byScope: Record<string, number>;
    convertedActionCount: number;
    pendingApprovalCount: number;
    recentSourceIds: string[];
    workProgress?: Array<{
      reportId: string;
      templateName: string | null;
      reporterName: string | null;
      reporterId: string | null;
      departmentName: string | null;
      createdAt: Date | null;
      modifiedAt: Date | null;
      completedWork: string | null;
      weeklySummary: string | null;
      nextWeekPlan: string | null;
      needHelp: string | null;
      sections: Array<{
        key: string | null;
        value: string;
      }>;
      previewText: string;
      sourceScope: string;
      sourceType: string;
      sourceId: string;
      sourceSummary: string;
    }>;
  };
  attachments: Array<{
    id: string;
    title: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    url: string;
    uploadedAt: Date;
    createdAt: Date;
  }>;
};

type OpportunitiesClientProps = {
  opportunities: OpportunityItem[];
  workspaceDingTalkWorkProgress: Array<{
    reportId: string;
    templateName: string | null;
    reporterName: string | null;
    reporterId: string | null;
    departmentName: string | null;
    createdAt: Date | null;
    modifiedAt: Date | null;
    completedWork: string | null;
    weeklySummary: string | null;
    nextWeekPlan: string | null;
    needHelp: string | null;
    sections: Array<{
      key: string | null;
      value: string;
    }>;
    previewText: string;
    sourceScope: string;
    sourceType: string;
    sourceId: string;
    sourceSummary: string;
  }>;
  companies: Array<{ id: string; name: string }>;
  memberships: Array<{ user: { id: string; name: string } }>;
  currentUserId: string;
  businessLoopGapSummary: BusinessLoopGapSummary;
  initialOpportunityId: string | null;
  initialFilters?: {
    preset?: "all" | "overdue" | "high-risk" | null;
    risk?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
    sort?: "priority" | "due" | "risk" | "updated" | null;
    mine?: boolean;
    overdue?: boolean;
    action?: "approval" | "unassigned" | "priority" | null;
  };
};

type RecommendationCard = {
  recommendationId: string;
  title: string;
  description: string;
  score: number;
  policyResult:
    | "SUGGEST_ONLY"
    | "REQUIRES_APPROVAL"
    | "AUTO_WITHIN_THRESHOLD"
    | "FORBIDDEN";
  explanation: string;
  supportingFactIds: string[];
  blockerIds: string[];
  commitmentIds: string[];
  whyNotAutoExecute?: string | null;
  recommendationPayload?: Record<string, unknown> | null;
  appliedPolicyRules?: Array<{
    name: string | null;
    mode:
      | "SUGGEST_ONLY"
      | "REQUIRES_APPROVAL"
      | "AUTO_WITHIN_THRESHOLD"
      | "FORBIDDEN"
      | null;
    reason: string;
  }>;
};

type DetailDraft = {
  id?: string;
  title: string;
  type: OpportunityItem["type"];
  stage: OpportunityItem["stage"];
  riskLevel: OpportunityItem["riskLevel"];
  nextAction: string;
  dueDate: string;
  companyId: string;
  ownerId: string;
  lossReason: string;
};

type OpportunitySummaryScope = "all" | "overdue" | "high-risk" | "mine";
type OpportunitySummaryConnection = {
  label: string;
  value: string;
  description: string;
  href: string;
  actionLabel?: string;
};
const OPPORTUNITIES_BOARD_DND_ID = "opportunities-board";

export function OpportunitiesClient({
  opportunities,
  workspaceDingTalkWorkProgress,
  companies,
  memberships,
  currentUserId,
  businessLoopGapSummary,
  initialOpportunityId,
  initialFilters,
}: OpportunitiesClientProps) {
  const _detailHomeArrival = useHomeSurfaceArrival("detail");
  const router = useRouter();
  const { locale, demoMode } = useWorkspaceUi();
  const english = locale === "en-US";
  const displayText = useCallback(
    (value: string) => formatOpportunityDisplayText(value, english),
    [english],
  );
  const displayOptionalText = (value: string | null | undefined) =>
    value ? displayText(value) : "";
  const dateLabel = (value: Date | string | null | undefined) =>
    formatOpportunityDateLabel(value, english, formatDateLabel);
  const relativeLabel = (value: Date | string | null | undefined) =>
    formatOpportunityRelativeLabel(value, english, formatRelative);
  const pageStory = getWorkspaceStory("opportunities", locale, demoMode);
  const typeLabels = getLocalizedOpportunityTypeLabels(locale);
  const stageLabelsByLocale = getLocalizedStageLabels(locale);
  const riskLabelsByLocale = getLocalizedRiskLabels(locale);
  const initialSummaryScope: OpportunitySummaryScope = initialFilters?.mine
    ? "mine"
    : initialFilters?.overdue || initialFilters?.preset === "overdue"
      ? "overdue"
      : initialFilters?.preset === "high-risk"
        ? "high-risk"
        : "all";
  const [pending, startTransition] = useTransition();
  const { opportunityView, setOpportunityView } = useConsoleStore();
  const [items, setItems] = useState(opportunities);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState(initialFilters?.risk ?? "all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState(
    initialFilters?.action ?? "all",
  );
  const [sortBy, setSortBy] = useState(
    initialFilters?.sort ??
      (initialSummaryScope === "high-risk"
        ? "risk"
        : initialSummaryScope === "overdue"
          ? "due"
          : "priority"),
  );
  const [summaryScope, setSummaryScope] =
    useState<OpportunitySummaryScope>(initialSummaryScope);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(Boolean(initialOpportunityId));
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [detailDraft, setDetailDraft] = useState<DetailDraft>(() =>
    createDraftFromOpportunity(
      opportunities.find((item) => item.id === initialOpportunityId),
      memberships[0]?.user.id,
    ),
  );
  const [recommendationState, setRecommendationState] = useState<{
    loading: boolean;
    recommendations: RecommendationCard[];
  }>({ loading: false, recommendations: [] });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const columns = useMemo(
    () =>
      Object.entries(stageLabelsByLocale) as Array<
        [OpportunityItem["stage"], string]
      >,
    [stageLabelsByLocale],
  );
  const actionFilterOptions = [
    { value: "all", label: english ? "All opportunities" : "全部机会" },
    {
      value: "approval",
      label: english ? "Has pending approval" : "有待审批动作",
    },
    {
      value: "unassigned",
      label: english ? "Unassigned owner" : "未分配负责人",
    },
    { value: "priority", label: english ? "High priority only" : "仅高优先级" },
  ] as const;

  useEffect(() => {
    setItems(opportunities);
  }, [opportunities]);

  useEffect(() => {
    if (!initialOpportunityId) return;
    const target = opportunities.find(
      (item) => item.id === initialOpportunityId,
    );
    if (!target) return;
    setDetailDraft(createDraftFromOpportunity(target, memberships[0]?.user.id));
    setQueuedFiles([]);
    setFileInputKey((value) => value + 1);
    setSheetOpen(true);
  }, [initialOpportunityId, memberships, opportunities]);

  useEffect(() => {
    const opportunityId = detailDraft.id;
    if (!opportunityId) {
      setRecommendationState({ loading: false, recommendations: [] });
      return;
    }

    let active = true;
    setRecommendationState((current) => ({ ...current, loading: true }));
    fetch(
      `/api/recommendations/next-actions?objectType=OPPORTUNITY&objectId=${opportunityId}&limit=4`,
      { cache: "no-store" },
    )
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        setRecommendationState({
          loading: false,
          recommendations: payload.success ? payload.data.recommendations : [],
        });
      })
      .catch(() => {
        if (!active) return;
        setRecommendationState({ loading: false, recommendations: [] });
      });

    return () => {
      active = false;
    };
  }, [detailDraft.id]);

  const summaryBase = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        !search ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.company?.name.toLowerCase().includes(search.toLowerCase()) ||
        item.contacts.some((contact) =>
          contact.name.toLowerCase().includes(search.toLowerCase()),
        );
      const matchType = typeFilter === "all" || item.type === typeFilter;
      const matchStage = stageFilter === "all" || item.stage === stageFilter;
      const matchRisk = riskFilter === "all" || item.riskLevel === riskFilter;
      const matchOwner =
        ownerFilter === "all" || item.owner?.id === ownerFilter;
      const matchAction =
        actionFilter === "all"
          ? true
          : actionFilter === "approval"
            ? item.actionItems.some(
                (actionItem) => actionItem.status === "PENDING_APPROVAL",
              )
            : actionFilter === "unassigned"
              ? !item.owner
              : actionFilter === "priority"
                ? item.priorityScore >= 80
                : true;
      return (
        matchSearch &&
        matchType &&
        matchStage &&
        matchRisk &&
        matchOwner &&
        matchAction
      );
    });
  }, [
    actionFilter,
    items,
    ownerFilter,
    riskFilter,
    search,
    stageFilter,
    typeFilter,
  ]);

  const filtered = useMemo(() => {
    const scoped = summaryBase.filter((item) => {
      if (summaryScope === "mine") {
        return item.owner?.id === currentUserId;
      }
      if (summaryScope === "overdue") {
        return isOverdue(item.dueDate);
      }
      if (summaryScope === "high-risk") {
        return item.riskLevel === "HIGH" || item.riskLevel === "CRITICAL";
      }
      return true;
    });

    return scoped.sort((left, right) => {
      if (sortBy === "due") {
        return (
          new Date(left.dueDate ?? 0).getTime() -
          new Date(right.dueDate ?? 0).getTime()
        );
      }
      if (sortBy === "risk") {
        return riskOrder[right.riskLevel] - riskOrder[left.riskLevel];
      }
      if (sortBy === "updated") {
        return (
          new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime()
        );
      }
      return right.priorityScore - left.priorityScore;
    });
  }, [currentUserId, sortBy, summaryBase, summaryScope]);

  const grouped = useMemo(
    () =>
      columns.reduce(
        (acc, [stage]) => {
          acc[stage] = filtered.filter((item) => item.stage === stage);
          return acc;
        },
        {} as Record<OpportunityItem["stage"], OpportunityItem[]>,
      ),
    [columns, filtered],
  );

  const activeOpportunity =
    items.find((item) => item.id === detailDraft.id) ?? null;
  const activeRecommendations: RecommendationCard[] = useMemo(() => {
    if (!activeOpportunity) return [];
    if (recommendationState.recommendations.length)
      return recommendationState.recommendations;

    const fallback: RecommendationCard[] = [];
    const overdueCommitment = activeOpportunity.commitments.find(
      (item) => item.overdueFlag,
    );

    if (overdueCommitment) {
      fallback.push({
        recommendationId: `fallback-overdue-${activeOpportunity.id}`,
        title: english
          ? `Resolve overdue commitment first: ${overdueCommitment.title}`
          : `先补齐已逾期承诺：${overdueCommitment.title}`,
        description: "",
        score: 72,
        policyResult: "REQUIRES_APPROVAL",
        explanation: english
          ? "Overdue commitment — pushed ahead of new work."
          : "机会当前存在逾期承诺，建议优先补齐。",
        supportingFactIds: [],
        blockerIds: [],
        commitmentIds: [overdueCommitment.id],
      });
    }

    if (activeOpportunity.blockers[0]) {
      fallback.push({
        recommendationId: `fallback-blocker-${activeOpportunity.id}`,
        title: english
          ? `Remove blocker first: ${activeOpportunity.blockers[0].title}`
          : `优先解除阻塞：${activeOpportunity.blockers[0].title}`,
        description: "",
        score: 68,
        policyResult: "SUGGEST_ONLY",
        explanation: english
          ? "The main blocker is still active, and downstream actions will keep slowing down until it is removed."
          : "主要阻塞仍未解除，后续动作会持续被拖慢。",
        supportingFactIds: [],
        blockerIds: [activeOpportunity.blockers[0].id],
        commitmentIds: [],
      });
    }

    if (activeOpportunity.nextAction) {
      fallback.push({
        recommendationId: `fallback-next-${activeOpportunity.id}`,
        title: displayText(
          english
            ? `Current system pick: ${activeOpportunity.nextAction}`
            : `当前建议先落下：${activeOpportunity.nextAction}`,
        ),
        description: "",
        score: 64,
        policyResult: "SUGGEST_ONLY",
        explanation: english
          ? "The current next step is still valid and can continue without changing direction."
          : "当前面板上的下一步仍然成立，可以继续推进。",
        supportingFactIds: [],
        blockerIds: [],
        commitmentIds: [],
      });
    }

    return fallback;
  }, [
    activeOpportunity,
    displayText,
    english,
    recommendationState.recommendations,
  ]);
  const primaryRecommendation = activeRecommendations[0] ?? null;
  const discouragedRecommendation =
    activeRecommendations.find(
      (item, index) =>
        index > 0 &&
        (item.policyResult === "FORBIDDEN" ||
          item.policyResult === "SUGGEST_ONLY" ||
          item.score <= (primaryRecommendation?.score ?? 100) - 12),
    ) ?? null;
  const secondaryRecommendations = activeRecommendations
    .slice(1, 3)
    .filter(
      (item) =>
        item.recommendationId !== discouragedRecommendation?.recommendationId,
    );
  const activeBriefingNextSteps = useMemo(() => {
    if (
      !Array.isArray(
        activeOpportunity?.briefingSnapshot?.payload.recommendedNextSteps,
      )
    ) {
      return [];
    }

    return activeOpportunity.briefingSnapshot.payload.recommendedNextSteps.filter(
      (item): item is string => typeof item === "string",
    );
  }, [activeOpportunity]);
  useEffect(() => {
    if (!sheetOpen || !detailDraft.id) {
      return;
    }

    const activeOpportunityHashTargets = activeOpportunity
      ? [
          ...Object.values(OPPORTUNITY_PAGE_ANCHORS),
          ...activeOpportunity.blockers.map((item) =>
            buildOpportunityItemAnchor("blocker", item.id),
          ),
          ...activeOpportunity.commitments.map((item) =>
            buildOpportunityItemAnchor("commitment", item.id),
          ),
          ...activeOpportunity.memoryFacts.map((item) =>
            buildOpportunityItemAnchor("memory-fact", item.id),
          ),
          ...activeBriefingNextSteps.map((_, index) =>
            buildOpportunityItemAnchor("briefing-step", index),
          ),
          ...(primaryRecommendation
            ? [
                buildOpportunityItemAnchor(
                  "recommendation",
                  primaryRecommendation.recommendationId,
                ),
              ]
            : []),
        ]
      : Object.values(OPPORTUNITY_PAGE_ANCHORS);

    scrollToWindowHashTarget(activeOpportunityHashTargets);
  }, [
    activeBriefingNextSteps,
    activeOpportunity,
    detailDraft.id,
    primaryRecommendation,
    sheetOpen,
  ]);
  const suggestedOrder = filtered.slice(0, 3);
  const activeCount = summaryBase.length;
  const overdueCount = summaryBase.filter((item) =>
    isOverdue(item.dueDate),
  ).length;
  const highRiskCount = summaryBase.filter(
    (item) => item.riskLevel === "HIGH" || item.riskLevel === "CRITICAL",
  ).length;
  const mineCount = summaryBase.filter(
    (item) => item.owner?.id === currentUserId,
  ).length;
  const scopeHeadline =
    summaryScope === "overdue"
      ? english
        ? `${overdueCount} overdue opportunities are asking for closure`
        : `当前有 ${overdueCount} 条逾期机会在等你收口`
      : summaryScope === "high-risk"
        ? english
          ? `${highRiskCount} high-risk opportunities need active handling`
          : `当前有 ${highRiskCount} 条高风险机会需要主动处理`
        : summaryScope === "mine"
          ? english
            ? `${mineCount} opportunities are currently owned by you`
            : `当前有 ${mineCount} 条机会归你负责`
          : english
            ? `${activeCount} opportunities are still in a live motion window`
            : `当前有 ${activeCount} 条机会仍处在可推进窗口`;
  const scopeSummary =
    summaryScope === "overdue"
      ? english
        ? "Deals already cooling. Each one has a next step."
        : "已经在降温的机会，每条都有下一步。"
      : summaryScope === "high-risk"
        ? english
          ? "Most likely to stall, slip, or turn into coordination drag — unless you act now."
          : "最可能卡住、掉单或变成协同负担——除非现在介入。"
        : summaryScope === "mine"
          ? english
            ? "Your slice. Push, delegate, or close — pick one for each."
            : "你的责任。每条挑一个：推、委派、收口。"
          : english
            ? "Live opportunities, ranked by what to act on first."
            : "还活着的机会，已按处理优先级排好。";
  const scopePrompt = suggestedOrder[0]
    ? english
      ? `Start with “${suggestedOrder[0].title}”, then decide whether the next two items need follow-up, owner change or a meeting.`
      : `先处理“${displayText(suggestedOrder[0].title)}”，再判断后面两条是该发起跟进、改负责人，还是安排会议。`
    : english
      ? "Loosen the filters, or create one."
      : "放宽筛选，或新建一条。";
  const opportunityOperatingFocus =
    suggestedOrder[0] ?? filtered[0] ?? items[0] ?? null;
  const opportunityOperatingTitle = opportunityOperatingFocus
    ? english
      ? `"${opportunityOperatingFocus.title}" is the strongest object to move first right now`
      : `“${displayText(opportunityOperatingFocus.title)}”是当前最值得先推进的机会对象`
    : english
      ? "The opportunity board still needs a real live object before it can rank the next move"
      : "机会面还需要先有真实活跃对象，才能给出可信排序";
  const opportunityOperatingSummary = opportunityOperatingFocus
    ? english
      ? `${opportunityOperatingFocus.company?.name ?? "No company"} · ${stageLabelsByLocale[opportunityOperatingFocus.stage]} · ${riskLabelsByLocale[opportunityOperatingFocus.riskLevel]}. The board should now tell you whether to push, review, delegate or cool this deal.`
      : `${opportunityOperatingFocus.company?.name ?? "未关联公司"} · ${stageLabelsByLocale[opportunityOperatingFocus.stage]} · ${riskLabelsByLocale[opportunityOperatingFocus.riskLevel]}。这张机会面现在应该直接告诉你：该推进、该复核、该委派，还是该收口。`
    : scopeSummary;
  const businessLoopGapReadout = buildBusinessLoopGapReadout({
    english,
    businessLoopGapSummary,
    fallbackHref: "/operating",
  });
  const primaryBusinessLoopGap = businessLoopGapReadout.primaryGap;
  const opportunityOperatingSnapshot = {
    objectState: opportunityOperatingFocus
      ? `${stageLabelsByLocale[opportunityOperatingFocus.stage]} · ${riskLabelsByLocale[opportunityOperatingFocus.riskLevel]} · ${opportunityOperatingFocus.owner?.name ?? (english ? "Unassigned owner" : "未分配负责人")}`
      : english
        ? "No active opportunity in the current scope"
        : "当前范围内还没有活跃机会",
    blocker: businessLoopGapReadout.blocker
      ? businessLoopGapReadout.blocker
      : opportunityOperatingFocus
        ? opportunityOperatingFocus.actionItems.some(
            (actionItem) => actionItem.status === "PENDING_APPROVAL",
          )
          ? english
            ? "A proposed move is already waiting for review, so the board should route you into approvals before stronger execution."
            : "当前已有动作在等待复核，这张机会面会把你送进审批中心，再考虑更强推进。"
          : opportunityOperatingFocus.riskLevel === "HIGH" ||
              opportunityOperatingFocus.riskLevel === "CRITICAL"
            ? english
              ? "This deal is in a high-risk band, so the move can be prepared and ranked, but still cannot be treated like autonomous execution."
              : "这条机会已经进入高风险带，所以动作可以先被准备和排序，但仍然不能被读成自动执行。"
            : english
              ? "No dominant blocker is visible beyond the current review posture."
              : "当前除了复核姿态之外，没有更强阻塞。"
        : english
          ? "No current boundary posture yet"
          : "当前还没有边界状态",
    pendingDecision:
      businessLoopGapReadout.pendingDecision ??
      (opportunityOperatingFocus
        ? displayOptionalText(primaryRecommendation?.title) ||
          displayOptionalText(opportunityOperatingFocus.nextAction) ||
          (english
            ? "Open the opportunity and confirm the next move."
            : "打开机会并确认下一步动作。")
        : scopePrompt),
    nextAction:
      businessLoopGapReadout.nextAction ??
      (suggestedOrder[0]
        ? english
          ? `Open “${suggestedOrder[0].title}” and confirm whether the next move is follow-up, owner change, or a meeting.`
          : `打开“${displayText(suggestedOrder[0].title)}”，确认下一步是跟进、改负责人还是安排会议。`
        : scopePrompt),
  };
  const opportunityOperatingConnections: OpportunitySummaryConnection[] =
    opportunityOperatingFocus
      ? [
          businessLoopGapReadout.connection
            ? {
                ...businessLoopGapReadout.connection,
                href: businessLoopGapReadout.connection.href ?? "/operating",
              }
            : undefined,
          opportunityOperatingFocus.company
            ? {
                label: english ? "Linked account" : "关联公司",
                value: opportunityOperatingFocus.company.name,
                description: english
                  ? "Open the company page to confirm whether account momentum still matches this deal."
                  : "打开公司页，确认账户级势能是否仍然支撑这条机会。",
                href: `/companies/${opportunityOperatingFocus.company.id}`,
                actionLabel: english ? "Open account" : "打开公司页",
              }
            : undefined,
          opportunityOperatingFocus.contacts[0]
            ? {
                label: english ? "Key contact" : "关键联系人",
                value: opportunityOperatingFocus.contacts[0].name,
                description: english
                  ? "Relationship heat on this contact will directly affect whether the next move should push or pause."
                  : "这位联系人的关系温度会直接影响下一步到底该推进还是按住。",
                href: `/contacts/${opportunityOperatingFocus.contacts[0].id}`,
                actionLabel: english ? "Open contact" : "打开联系人",
              }
            : undefined,
          opportunityOperatingFocus.actionItems.some(
            (actionItem) => actionItem.status === "PENDING_APPROVAL",
          )
            ? {
                label: english ? "Review handoff" : "复核去向",
                value: english
                  ? "Approvals are already holding the next move."
                  : "下一步动作已经进入审批等待复核。",
                description: english
                  ? "Use the formal review surface before pushing a stronger move here."
                  : "先经过正式复核，再回来推进更强动作。",
                href: "/approvals",
                actionLabel: english
                  ? "Open approvals"
                  : "打开复核队列",
              }
            : {
                label: english ? "Current loop" : "当前回路",
                value: english
                  ? "The next move can still stay inside the opportunity loop."
                  : "当前下一步仍然可以留在机会主回路里推进。",
                description: english
                  ? "Open the action workspace if you want to tighten the current next step."
                  : "如果要进一步收紧下一步，可直接打开动作处理区。",
                href: buildOpportunityDetailHref(
                  opportunityOperatingFocus.id,
                  OPPORTUNITY_PAGE_ANCHORS.actionWorkspace,
                ),
                actionLabel: english
                  ? "Open action workspace"
                  : "打开动作处理区",
              },
          opportunityOperatingFocus.memoryFacts[0]
            ? {
                label: english ? "Memory source" : "记忆依据",
                value: opportunityOperatingFocus.memoryFacts[0].title,
                description: trimText(
                  opportunityOperatingFocus.memoryFacts[0].content,
                  72,
                ),
                href: buildOpportunityMemoryHref(
                  opportunityOperatingFocus.id,
                  buildMemoryItemAnchor(
                    "fact",
                    opportunityOperatingFocus.memoryFacts[0].id,
                  ),
                ),
                actionLabel: english ? "Open memory" : "打开记忆依据",
              }
            : opportunityOperatingFocus.commitments[0]
              ? {
                  label: english ? "Commitment chain" : "承诺链",
                  value: opportunityOperatingFocus.commitments[0].title,
                  description: trimText(
                    opportunityOperatingFocus.commitments[0].commitmentText,
                    72,
                  ),
                  href: buildOpportunityMemoryHref(
                    opportunityOperatingFocus.id,
                    buildMemoryItemAnchor(
                      "commitment",
                      opportunityOperatingFocus.commitments[0].id,
                    ),
                  ),
                  actionLabel: english
                    ? "Open commitment"
                    : "打开承诺依据",
                }
              : opportunityOperatingFocus.blockers[0]
                ? {
                    label: english ? "Blocker source" : "阻塞依据",
                    value: opportunityOperatingFocus.blockers[0].title,
                    description: trimText(
                      opportunityOperatingFocus.blockers[0].blockerText,
                      72,
                    ),
                    href: buildOpportunityMemoryHref(
                      opportunityOperatingFocus.id,
                      buildMemoryItemAnchor(
                        "blocker",
                        opportunityOperatingFocus.blockers[0].id,
                      ),
                    ),
                    actionLabel: english
                      ? "Open blocker"
                      : "打开阻塞依据",
                  }
                : undefined,
        ].filter((item): item is OpportunitySummaryConnection => Boolean(item))
      : primaryBusinessLoopGap
        ? [
            {
              ...businessLoopGapReadout.connection!,
              href: businessLoopGapReadout.connection?.href ?? "/operating",
            },
          ]
        : [];
  const opportunityEvidenceFocus =
    activeOpportunity ?? suggestedOrder[0] ?? filtered[0] ?? items[0] ?? null;
  const opportunitiesContractSupport = createWorkerSkillResourcePageSupport({
    pageId: "opportunities",
    english,
    supplementalEvidenceGroups: opportunityEvidenceFocus
      ? buildOpportunityPayloadEvidenceGroups({
          opportunity: opportunityEvidenceFocus,
          primaryRecommendation:
            activeOpportunity?.id === opportunityEvidenceFocus.id
              ? primaryRecommendation
              : null,
          english,
        })
      : [],
    supplementalEvidenceSummary: [
      english
        ? `${overdueCount} overdue, ${highRiskCount} high-risk, ${mineCount} on you.`
        : `${overdueCount} 条逾期、${highRiskCount} 条高风险、${mineCount} 条归你。`,
      english
        ? "Open any one and you'll see its blockers, commitments and recent updates."
        : "点开任意一条，里面就能看到阻塞、承诺和最近变动。",
    ],
    supplementalLinks: [
      {
        label: english ? "Open memory timeline" : "打开记忆时间线",
        href: "/memory",
      },
      {
        label: english ? "Open approvals" : "打开审批中心",
        href: "/approvals",
      },
      {
        label: english ? "Open reports" : "打开周报",
        href: "/reports",
      },
    ],
  });
  const _opportunityGuidanceRecommendations = [
    opportunityOperatingFocus
      ? {
          title: english
            ? "Move the strongest live opportunity first"
            : "先推进当前最强的活跃机会",
          body: english
            ? `Start with "${opportunityOperatingFocus.title}" before scanning the rest of the board. This keeps the page acting like an operating surface instead of a passive pipeline list.`
            : `先处理“${displayText(opportunityOperatingFocus.title)}”，不要先扫完整个看板。这样这页才更像经营处理面，而不是被动机会清单。`,
          href: buildOpportunityDetailHref(opportunityOperatingFocus.id),
          meta: opportunityOperatingFocus.company?.name ?? undefined,
        }
      : {
          title: english
            ? "Create or unhide one live opportunity first"
            : "先创建或放开一条活跃机会",
          body: english
            ? "The board still needs a real live object before guidance and ranking can become credible."
            : "这张机会面还需要一条真实活跃对象，guidance 和排序才会变得可信。",
        },
    opportunityOperatingFocus?.actionItems.some(
      (actionItem) => actionItem.status === "PENDING_APPROVAL",
    )
      ? {
          title: english
            ? "Route stronger moves through approvals before pushing harder"
            : "更强动作先走审批，再继续推进",
          body: english
            ? "A stronger move is already waiting for review. Keep the decision path explicit before you escalate execution on the opportunity itself."
            : "当前已有更强动作在等待复核。先保持决策路径显性，再继续加大机会推进动作。",
          href: "/approvals",
          meta: english ? "Review-first boundary" : "复核优先边界",
        }
      : {
          title: english
            ? "Narrow the board before reading everything"
            : "先收窄看板，再看整盘",
          body: english
            ? "Switch to overdue, high-risk or mine before reviewing the whole queue. The page is most useful when it compresses the live worklist for you."
            : "先切到逾期、高风险或我的机会，再看整条队列。只有先把活跃工作清单压缩出来，这页才最有用。",
          meta:
            summaryScope === "all"
              ? english
                ? "Current scope: all live opportunities"
                : "当前范围：全部活跃机会"
              : scopeHeadline,
        },
    opportunityOperatingFocus?.memoryFacts[0]
      ? {
          title: english
            ? "Ground the next move in evidence, not board color"
            : "用证据而不是看板颜色决定下一步",
          body: english
            ? "Open the latest memory source before editing owner, stage or follow-up. Evidence should explain why the move is right now."
            : "先打开最近的记忆依据，再改负责人、阶段或跟进动作。证据要说明为什么现在要动。",
          href: buildOpportunityMemoryHref(
            opportunityOperatingFocus.id,
            buildMemoryItemAnchor(
              "fact",
              opportunityOperatingFocus.memoryFacts[0].id,
            ),
          ),
          meta: opportunityOperatingFocus.memoryFacts[0].title,
        }
      : {
          title: english
            ? "Refresh missing context before changing state"
            : "先补齐上下文，再调整对象状态",
          body: english
            ? "If the live object still lacks memory support, refresh the opportunity detail before promoting a stronger move."
            : "如果当前对象还缺少记忆支撑，先刷新机会细节，再提升更强动作。",
        },
  ].filter(
    (
      item,
    ): item is {
      title: string;
      body: string;
      href?: string;
      meta?: string;
    } => Boolean(item),
  );
  const _opportunityGuidanceReminders = [
    {
      title: english ? "Current scope" : "当前决策范围",
      body: scopeSummary,
      meta: scopeHeadline,
    },
    {
      title: english ? "Single next-step posture" : "单一步骤状态",
      body: scopePrompt,
      meta: english
        ? "Board should compress, not widen, attention"
        : "机会面应该压缩注意力，而不是继续摊开",
    },
  ];
  const opportunitiesProtocol = createPageReportingProtocol({
    pageJudgement: scopeHeadline,
    pageJudgementReason: scopeSummary,
    pageWhyItMatters: [
      summaryScope === "overdue"
        ? english
          ? "These deals are already cooling, so waiting longer costs both timing and attention."
          : "这些机会已经开始降温，再拖只会继续损失时间窗口和注意力。"
        : summaryScope === "high-risk"
          ? english
            ? "These deals are most likely to stall, slip or turn into coordination drag unless someone intervenes now."
            : "这些机会最容易卡住、掉单或拖成协同负担，所以现在必须介入。"
          : summaryScope === "mine"
            ? english
              ? "This slice is already narrowed to the items that currently belong to your personal operating responsibility."
              : "这个切片已经收窄到当前确实由你负责的经营事项。"
            : english
              ? "The live motion window is already ranked, so you do not need to rebuild urgency from raw stage rows."
              : "当前活跃推进窗口已经排好，你不需要再从原始阶段行里重建紧急度。",
      english
        ? `${filtered.length} opportunities in scope. Top one is the next call.`
        : `范围内 ${filtered.length} 条机会，最上面那条就是下一步该推的。`,
      english
        ? "Each card carries its blockers, commitments and latest update — open one to act."
        : "每张卡都带着阻塞、承诺和最近变动——点开就能动。",
    ],
    pageActionSummary: [
      english
        ? `${filtered.length} opportunities in scope, ranked by what moves first.`
        : `范围内 ${filtered.length} 条机会，已按"先推哪个"排好。`,
      english
        ? "Suggestions, blockers, commitments — all attached to the same card."
        : "建议、阻塞、承诺都挂在同一张卡上。",
    ],
    pageDecisionRequest: [
      english
        ? "Choose the one opportunity that deserves the first real move now."
        : "决定哪一条机会应该成为现在第一优先的真实动作。",
      english
        ? "Decide whether the next step should be follow-up, owner change, meeting or explicit de-prioritization."
        : "决定下一步到底是跟进、改负责人、安排会议，还是明确降级优先级。",
      english
        ? "Decide which visible items can wait without stealing attention from the first move."
        : "决定哪些仍需可见的事项可以暂缓，而不必继续抢走今天的主注意力。",
    ],
    pageNextAction: [
      {
        label: english ? "Open first opportunity" : "打开第一条机会",
        href: suggestedOrder[0]
          ? `/opportunities?opportunityId=${suggestedOrder[0].id}`
          : "/opportunities",
      },
      {
        label: english ? "Review approval-bound moves" : "查看需审批动作",
        href: "/approvals",
        variant: "secondary",
      },
      {
        label: english ? "Open memory evidence" : "打开记忆依据",
        href: suggestedOrder[0]
          ? `/memory?objectType=OPPORTUNITY&objectId=${suggestedOrder[0].id}`
          : "/memory",
        variant: "ghost",
      },
    ],
    pageBoundarySummary: [
      english
        ? "Suggests and pre-shapes the move. High-risk execution still goes through approval."
        : "给建议、预整形动作。高风险执行仍走审批。",
      english
        ? "Suggests; doesn't auto-execute."
        : "只给建议，不自动执行。",
    ],
    pageEvidenceSummary: opportunitiesContractSupport.pageEvidenceSummary,
    pageWorkerSummary: opportunitiesContractSupport.pageWorkerSummary,
    pageWorkerAssignments: opportunitiesContractSupport.pageWorkerAssignments,
    pageEscalationHint:
      highRiskCount > 0
        ? english
          ? "When the first move touches external trust or high-risk execution, move it into approvals before pushing harder."
          : "如果第一条动作触碰对外信任或高风险执行，就先把它送进审批，再继续推进。"
        : english
          ? "If the top item still feels ambiguous, open its detail sheet and read memory before inventing a new action."
          : "如果最前面的机会仍然模糊，就先开详情抽屉和记忆依据，不要急着重新发明动作。",
    pagePrioritySignal:
      summaryScope === "overdue"
        ? english
          ? "Cooling momentum is the dominant priority signal right now."
          : "当前最强的优先级信号是推进正在降温。"
        : summaryScope === "high-risk"
          ? english
            ? "Execution risk is outweighing raw pipeline volume right now."
            : "当前决定优先级的不是数量，而是执行风险。"
          : english
            ? "Ranking is based on the live motion window, not on static stage ownership."
            : "当前排序依据是活跃推进窗口，而不是静态阶段归属。",
    pageEvidenceLinks: opportunitiesContractSupport.pageEvidenceLinks,
    pageEvidenceGroups: opportunitiesContractSupport.pageEvidenceGroups,
  });
  const packageShapingCandidate =
    summaryBase.find(
      (item) =>
        (item.riskLevel === "LOW" || item.riskLevel === "MEDIUM") &&
        item.stage !== "LOST" &&
        item.stage !== "DONE",
    ) ??
    suggestedOrder[0] ??
    filtered[0] ??
    items[0] ??
    null;
  const packageShapingStageLabel = packageShapingCandidate
    ? stageLabelsByLocale[packageShapingCandidate.stage]
    : english
      ? "active stage"
      : "当前阶段";
  const packageShapingFlow = createProactiveFlow({
    flowId: "sales-delivery-package-window",
    flowTitle: english
      ? "Sales / delivery collaboration window"
      : "销售 / 交付协作窗口",
    triggerCondition: packageShapingCandidate
      ? english
        ? `${packageShapingCandidate.title} has moved into a ${packageShapingStageLabel} working window and should no longer be treated as a static pipeline row.`
        : `${packageShapingCandidate.title} 已进入“${packageShapingStageLabel}”工作窗口，不应再被当成静态 pipeline 行，而是一个需要协同推进的经营事项。`
      : english
        ? "No single opportunity is ready yet, so this space will wait for a live candidate before it raises a collaboration request."
        : "当前还没有单条机会准备好被抬成协作请求，所以这里会继续等待真实候选事项。",
    activeReport: createActiveReportProtocol({
      activeReportType: "event",
      activeReportSummary: packageShapingCandidate
        ? english
          ? `${packageShapingCandidate.title} is entering a proposal / package-shaping window`
          : `${packageShapingCandidate.title} 已进入提案 / 方案包整形窗口`
        : english
          ? "No proposal-shaping event is active yet"
          : "当前还没有进入提案整形窗口的事项",
      activeReportReason: packageShapingCandidate
        ? (packageShapingCandidate.briefingSnapshot?.payload.summary ??
          (english
            ? "This opportunity already has live stage change, current blockers, commitments and next-step context in one place."
            : "这条机会的阶段变化、当前卡点、承诺压力和下一步上下文已经收在同一处。"))
        : english
          ? "Once a real opportunity picks up a live shaping window, it should surface here first."
          : "一旦有真实机会进入整形窗口，它会先出现在这里。",
      activeReportPriority:
        packageShapingCandidate?.riskLevel === "HIGH" ||
        packageShapingCandidate?.riskLevel === "CRITICAL"
          ? "watch"
          : "operating",
      activeReportBoundary: [
        english
          ? "Follow-up, meeting and scope clarification can be pre-shaped here, but this still cannot turn into external commitment by itself."
          : "这里可以先整形跟进、会议和范围澄清，但这一步仍然不能自己变成对外承诺。",
        english
          ? "If risk rises or customer-facing language hardens, the next move still has to pass through approval."
          : "如果风险升高，或者对外措辞开始变硬，这一步仍然必须先经过审批。",
      ],
      activeReportDecisionRequest: english
        ? "Confirm whether this should move as a follow-up, a review meeting or an internal clarification first."
        : "确认这一步到底该先走跟进、评审会，还是先做内部澄清。",
      activeReportWorkerSummary: [
        english
          ? "Sales worker keeps the follow-up frame and ranking context current."
          : "销售执行会持续维护跟进框架和优先级上下文。",
        english
          ? "Delivery-facing clarification logic keeps boundary, dependency and next-step risk visible."
          : "交付澄清逻辑会持续把边界、依赖和下一步风险抬出来。",
      ],
      activeReportEvidenceSummary: [
        packageShapingCandidate
          ? english
            ? `${packageShapingCandidate.blockers.length} blockers · ${packageShapingCandidate.commitments.length} commitments · latest briefing attached.`
            : `${packageShapingCandidate.blockers.length} 条阻塞 · ${packageShapingCandidate.commitments.length} 条承诺 · 最近一次简报已挂上。`
          : english
            ? "Nothing attached yet."
            : "暂无证据。",
        english
          ? "Replay, memory and approvals are all one click away."
          : "回放、记忆、审批，点一下就能进。",
      ],
      activeReportAudience: ["sales", "delivery"],
      activeReportDeliveryMode: "event-alert",
      activeReportPreparationSummary: [
        packageShapingCandidate
          ? english
            ? `${packageShapingCandidate.title}: next action, blockers and commitments are ready.`
            : `${packageShapingCandidate.title}：下一步动作、阻塞、承诺都准备好了。`
          : english
            ? "Pick a candidate first."
            : "先挑一条候选。",
        english
          ? "Ranked order tells you which one to push next."
          : "排序告诉你下一条该推哪个。",
      ],
    }),
    collaboration: createProactiveCollaborationProtocol({
      collaborationMode: "helm_drives_human_supervises",
      collaborationRequest: packageShapingCandidate
        ? english
          ? `${packageShapingCandidate.title} is ready to keep moving, but sales and delivery should supervise the framing together before anything customer-facing hardens.`
          : `${packageShapingCandidate.title} 现在可以继续推进，但在任何客户可见动作变硬之前，仍应由销售和交付一起监督这次措辞。`
        : english
          ? "No live package-shaping collaboration request yet."
          : "当前还没有活跃的方案包-shaping 协作请求。",
      collaborationSummary: english
        ? "This is the first-layer package / proposal collaboration view: context and momentum stay live here, while human owners still supervise wording, scope and trust boundary."
        : "这是一层方案包 / 提案协作视图：上下文和推进节奏都会保持在线，而人类负责人仍然监督措辞、范围和信任边界。",
      collaborationReason: packageShapingCandidate
        ? english
          ? "The opportunity already has enough context to move, but it still needs sales / delivery alignment before the next outward step becomes real."
          : "这条机会已经有足够上下文可以继续推进，但在下一步真正对外之前，仍然需要销售 / 交付先对齐。"
        : english
          ? "No live opportunity is ready to ask for sales / delivery collaboration yet."
          : "当前还没有活跃机会准备好发起销售 / 交付协作。",
      collaborationBoundary: [
        english
          ? "Final customer-facing wording, proposal promise and stage-hardening still stay with human owners."
          : "最终客户可见措辞、提案承诺和阶段硬化仍然属于人工负责人。",
      ],
      collaborationOwner: packageShapingCandidate?.owner?.name
        ? english
          ? `${packageShapingCandidate.owner.name} with delivery review`
          : `${packageShapingCandidate.owner.name} + delivery review`
        : english
          ? "Sales owner + delivery review"
          : "Sales owner + delivery review",
      collaborationWorkerAssignment: [
        english
          ? "Sales worker: keep follow-up pack, objection framing and next-step narrative ready."
          : "销售执行：持续准备跟进 资料、异议措辞和下一步叙事。",
        english
          ? "Delivery worker: keep scope, dependency and clarification notes visible."
          : "交付执行：持续把范围、依赖和澄清备注挂在前台。",
      ],
      collaborationEscalationHint: english
        ? "If the move turns high-risk or starts shaping external commitment, route it into approvals before the owner sends anything."
        : "如果这一步开始变成高风险或外部承诺整形，就先把它送进审批，再让负责人外发。",
      collaborationDecisionRequest: english
        ? "Confirm whether the follow-up path should keep moving, or stop and wait for an explicit human review."
        : "确认这条跟进路径是继续推进，还是需要停下等待明确人工复核。",
      collaborationNextStep: [
        english
          ? "Choose follow-up, meeting or internal clarification."
          : "选择跟进、会议还是内部澄清。",
        english
          ? "Confirm whether the current framing is safe enough for the next external move."
          : "确认当前措辞是否足够安全，可以进入下一步外部动作。",
      ],
    }),
    helmCanDo: [
      english
        ? "Keep the package-shaping candidate ranked high and attach the latest evidence bundle."
        : "持续把这条方案包-shaping 候选事项排在前面，并挂好最新证据包。",
      english
        ? "Prepare follow-up framing, meeting context and memory-backed summaries."
        : "准备跟进措辞、会议上下文和经营记忆-backed 摘要。",
    ],
    helmSuggestsOnly: [
      english
        ? "The final package wording, proposal promise and trust-sensitive next step."
        : "最终方案包措辞、提案承诺和信任敏感的下一步动作。",
    ],
    humanDecisionRequired: [
      english
        ? "Decide whether sales or delivery should lead the next visible move."
        : "决定下一步对外动作应该由销售还是交付主导。",
    ],
    humanLeadRequired: [
      english
        ? "Any move that hardens external commitment or changes customer-facing expectation."
        : "任何会把外部承诺说实、或改写客户预期的动作。",
    ],
    nextActions: [
      {
        label: english ? "Open proposal page" : "打开提案页面",
        href: packageShapingCandidate
          ? `/proposals/${packageShapingCandidate.id}`
          : "/opportunities",
      },
      {
        label: english ? "Open package page" : "打开方案包页面",
        href: packageShapingCandidate
          ? `/packages/${packageShapingCandidate.id}`
          : "/opportunities",
        variant: "secondary",
      },
      {
        label: english ? "Open evidence" : "打开证据",
        href: packageShapingCandidate
          ? `/memory?objectType=OPPORTUNITY&objectId=${packageShapingCandidate.id}`
          : "/memory",
        variant: "ghost",
      },
    ],
    evidenceLinks: [
      {
        label: english ? "Replay memory" : "回看记忆",
        href: "/memory",
      },
      {
        label: english ? "Open reports" : "打开周报",
        href: "/reports",
      },
    ],
  });
  const _displayOpportunityOperatingSnapshot = {
    objectState: displayText(opportunityOperatingSnapshot.objectState),
    blocker: displayText(opportunityOperatingSnapshot.blocker),
    pendingDecision: displayText(opportunityOperatingSnapshot.pendingDecision),
    nextAction: displayText(opportunityOperatingSnapshot.nextAction),
  };
  const _displayOpportunityOperatingConnections =
    opportunityOperatingConnections.map((connection) => ({
      ...connection,
      label: displayText(connection.label),
      value: displayText(connection.value),
      description: displayText(connection.description),
    }));
  const displayOpportunitiesProtocol = formatOpportunityReportingProtocol(
    opportunitiesProtocol,
    english,
  );
  const displayPackageShapingFlow = formatOpportunityProactiveFlow(
    packageShapingFlow,
    english,
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (!event.over) return;
    const opportunityId = String(event.active.id);
    const targetStage = String(event.over.id) as OpportunityItem["stage"];
    const current = items.find((item) => item.id === opportunityId);

    if (
      !current ||
      current.stage === targetStage ||
      !(targetStage in stageLabels)
    )
      return;

    const previousStage = current.stage;
    const previousLossReason = current.lossReason ?? "";
    let lossReason = current.lossReason ?? "";
    if (targetStage === "LOST") {
      const promptResult = window.prompt(
        english
          ? "Please enter the loss reason for later review"
          : "请输入丢失原因，便于后续复盘",
        current.lossReason ??
          (english
            ? "Budget delayed / no longer active"
            : "预算延后 / 暂不继续"),
      );
      if (promptResult === null) {
        toast.message(english ? "Stage change canceled" : "已取消阶段变更");
        return;
      }
      lossReason = promptResult;
    }

    setItems((previous) =>
      previous.map((item) =>
        item.id === opportunityId
          ? {
              ...item,
              stage: targetStage,
              lossReason: targetStage === "LOST" ? lossReason : null,
            }
          : item,
      ),
    );

    startTransition(async () => {
      const result = await moveOpportunityStageAction(
        opportunityId,
        targetStage,
        lossReason,
      );
      if (!result.ok) {
        setItems((previous) =>
          previous.map((item) =>
            item.id === opportunityId
              ? {
                  ...item,
                  stage: previousStage,
                  lossReason: previousLossReason || null,
                }
              : item,
          ),
        );
        toast.error(english ? "Failed to update stage" : "阶段更新失败");
        return;
      }
      toast.success(
        english
          ? `Moved to "${stageLabelsByLocale[targetStage]}", and audit + momentum tracking were updated.`
          : `已移动到「${stageLabelsByLocale[targetStage]}」，系统已写入审计日志并同步推进节奏`,
      );
      router.refresh();
    });
  };

  const handleGenerateDraft = (id: string) => {
    startTransition(async () => {
      const result = await generateOpportunityFollowUpAction(id);
      if (!result.ok || !result.result) {
        toast.error(
          result.error ?? (english ? "Generation failed" : "生成失败"),
        );
        return;
      }
      toast.success(
        result.result.requiresApproval
          ? english
            ? "Draft created and routed to approvals"
            : "已生成草稿并送入审批"
          : english
            ? "Draft created automatically"
            : "草稿已自动生成",
      );
      router.push("/approvals");
      router.refresh();
    });
  };

  const handleConvertDingTalkSignal = (id: string) => {
    startTransition(async () => {
      const result = await createActionFromDingTalkSignalAction(id);
      if (!result.ok) {
        toast.error(
          result.error ?? (english ? "Conversion failed" : "转换失败"),
        );
        return;
      }
      toast.success(
        english ? "Converted to governed action" : "已转换为受治理动作",
      );
      router.push("/approvals");
      router.refresh();
    });
  };

  const handleAssignOwner = (opportunityId: string, ownerId: string) => {
    startTransition(async () => {
      const result = await assignOpportunityOwnerAction(opportunityId, ownerId);
      if (!result.ok) {
        toast.error(english ? "Failed to update owner" : "负责人更新失败");
        return;
      }
      toast.success(english ? "Owner updated" : "负责人已更新");
      router.refresh();
    });
  };

  const handleSaveDetail = () => {
    if (detailDraft.stage === "LOST" && !detailDraft.lossReason.trim()) {
      toast.error(
        english
          ? "Please provide a loss reason before marking the opportunity as lost"
          : "标记已失效时请补充丢失原因",
      );
      return;
    }

    startTransition(async () => {
      const result = await saveOpportunityAction({
        id: detailDraft.id,
        title: detailDraft.title,
        type: detailDraft.type,
        stage: detailDraft.stage,
        riskLevel: detailDraft.riskLevel,
        nextAction: detailDraft.nextAction,
        dueDate: detailDraft.dueDate,
        companyId: detailDraft.companyId,
        ownerId: detailDraft.ownerId,
        lossReason: detailDraft.lossReason,
      });
      if (!result.ok) {
        toast.error(result.error ?? (english ? "Save failed" : "保存失败"));
        return;
      }

      const targetOpportunityId = result.id ?? detailDraft.id;
      let uploadedCount = 0;

      if (targetOpportunityId && queuedFiles.length) {
        for (const file of queuedFiles) {
          const uploadFormData = new FormData();
          uploadFormData.append("file", file);
          const uploadResponse = await fetch(
            `/api/opportunities/${targetOpportunityId}/attachments`,
            {
              method: "POST",
              body: uploadFormData,
            },
          ).catch(() => null);

          const uploadPayload =
            uploadResponse ? await uploadResponse.json().catch(() => null) : null;
          if (!uploadResponse?.ok || !uploadPayload?.success) {
            toast.error(
              uploadPayload?.message ??
                (english
                  ? `Failed to upload file: ${file.name}`
                  : `文件上传失败：${file.name}`),
            );
            continue;
          }
          uploadedCount += 1;
        }
      }

      toast.success(
        detailDraft.id
          ? english
            ? "Opportunity updated"
            : "机会已更新"
          : english
            ? "Opportunity created"
            : "机会已创建",
      );
      if (uploadedCount > 0) {
        toast.success(
          english
            ? `${uploadedCount} attachment(s) uploaded`
            : `已上传 ${uploadedCount} 个附件`,
        );
      }
      setQueuedFiles([]);
      setFileInputKey((value) => value + 1);
      setSheetOpen(false);
      setSelectedIds([]);
      router.replace("/opportunities");
      router.refresh();
    });
  };

  const applyBulkUpdate = (
    kind: "stage" | "owner" | "dueDate",
    value: string,
  ) => {
    if (!selectedIds.length) return;
    startTransition(async () => {
      const result = await bulkUpdateOpportunitiesAction({
        ids: selectedIds,
        stage:
          kind === "stage" ? (value as OpportunityItem["stage"]) : undefined,
        ownerId: kind === "owner" ? value : undefined,
        dueDate: kind === "dueDate" ? value : undefined,
      });

      if (!result.ok) {
        toast.error(
          result.error ?? (english ? "Bulk update failed" : "批量更新失败"),
        );
        return;
      }

      toast.success(
        english
          ? `${selectedIds.length} opportunities updated in bulk`
          : `已批量更新 ${selectedIds.length} 条机会`,
      );
      setSelectedIds([]);
      router.refresh();
    });
  };

  const openDetail = (opportunity?: OpportunityItem | null) => {
    setDetailDraft(
      createDraftFromOpportunity(
        opportunity ?? undefined,
        memberships[0]?.user.id,
      ),
    );
    setQueuedFiles([]);
    setFileInputKey((value) => value + 1);
    setSheetOpen(true);
    if (opportunity?.id) {
      router.replace(`/opportunities?opportunityId=${opportunity.id}`);
    }
  };

  return (
    <div className="workspace-surface-stack">
      <PageHeader
        eyebrow={pageStory.eyebrow}
        title={english ? "Which opportunities need action today" : "今天先推进哪几个机会"}
        description={pageStory.description}
        actions={
          <>
            <div className="workspace-panel-muted rounded-[22px] p-1">
              <Button
                variant={opportunityView === "board" ? "default" : "ghost"}
                size="sm"
                onClick={() => setOpportunityView("board")}
              >
                <Rows3 className="h-4 w-4" />
                {english ? "Board" : "看板"}
              </Button>
              <Button
                variant={opportunityView === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setOpportunityView("list")}
              >
                <Table2 className="h-4 w-4" />
                {english ? "List" : "列表"}
              </Button>
            </div>
            <StartRecordingButton variant="secondary" />
            <Button onClick={() => openDetail(null)}>
              <Plus className="h-4 w-4" />
              {english ? "New opportunity" : "新建机会"}
            </Button>
          </>
        }
      />

      <CustomerAssetFocusStrip
        eyebrow={english ? "Customer asset" : "客户资产"}
        title={opportunityOperatingTitle}
        summary={opportunityOperatingSummary}
        primaryAction={
          opportunityOperatingFocus
            ? {
                label: english ? "Open opportunity" : "打开机会",
                href: buildOpportunityDetailHref(opportunityOperatingFocus.id),
              }
            : {
                label: english ? "Create opportunity" : "新建机会",
                href: "/opportunities#opportunity-workspace",
              }
        }
        secondaryAction={{
          label: english ? "High-risk only" : "只看高风险",
          href: "/opportunities?preset=high-risk&sort=risk",
        }}
        items={[
          {
            label: english ? "Current state" : "当前状态",
            value: opportunityOperatingSnapshot.objectState,
            tone: "info",
          },
          {
            label: english ? "Pressure" : "当前压力",
            value: opportunityOperatingSnapshot.blocker,
            tone:
              opportunityOperatingFocus?.riskLevel === "HIGH" ||
              opportunityOperatingFocus?.riskLevel === "CRITICAL"
                ? "danger"
                : "warning",
          },
          {
            label: english ? "Next decision" : "下一步判断",
            value: opportunityOperatingSnapshot.pendingDecision,
            detail: opportunityOperatingSnapshot.nextAction,
            href: opportunityOperatingFocus
              ? buildOpportunityDetailHref(
                  opportunityOperatingFocus.id,
                  OPPORTUNITY_PAGE_ANCHORS.actionWorkspace,
                )
              : undefined,
            tone: "success",
          },
        ]}
      />

      <HomeSurfaceArrivalBanner
        kind="detail"
        english={english}
        contract={{
          ownership: english
            ? "Opportunity detail owns the current object state, next-step judgement and the action workspace."
            : displayText(
                "机会 detail 负责当前对象状态、下一步判断和动作工作区。",
              ),
          nextStep: english
            ? "Start in the opportunity workspace, then decide whether the next move belongs in follow-through, memory, or approvals."
            : displayText(
                "先从机会工作区开始，再决定下一步应该落在跟进闭环、经营记忆还是审批。",
              ),
          boundary: english
            ? "This page can rank and shape the move, but it still does not grant external commitment or autonomous send authority."
            : displayText(
                "这个页面可以排序并整形动作，但不会获得对外承诺或自动发送权限。",
              ),
        }}
      />

      <Card id="opportunity-workspace" className="workspace-panel">
        <CardContent className="space-y-5 py-5">
          <div
            className={`grid gap-4 ${demoMode ? "xl:grid-cols-[1.2fr_repeat(4,minmax(0,0.85fr))]" : "xl:grid-cols-4"}`}
          >
            {demoMode ? (
              <div className="workspace-panel-muted rounded-[24px] px-4 py-4">
                <Badge variant="approval">
                  {english ? "Today focus" : "今日机会焦点"}
                </Badge>
                <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                  {english
                    ? "Start with overdue, high-risk and owner-missing deals."
                    : "先看逾期、高风险和缺负责人的机会。"}
                </p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {english
                    ? "Open a deal, set the next move, then confirm whether it belongs in follow-up, memory or review."
                    : "打开机会，先改下一步，再判断进入跟进、记忆还是复核。"}
                </p>
              </div>
            ) : null}
            <SummaryStat
              label={english ? "In active motion" : "当前可推进"}
              value={activeCount}
              tone="info"
              detail={
                english ? "Opportunities still moving" : "正在推进中的机会"
              }
              active={summaryScope === "all"}
              onClick={() => {
                setSummaryScope("all");
                setSortBy("priority");
              }}
            />
            <SummaryStat
              label={english ? "Overdue" : "逾期未推进"}
              value={overdueCount}
              tone="warning"
              detail={english ? "Best to close today" : "建议今天先收口"}
              active={summaryScope === "overdue"}
              onClick={() => {
                setSummaryScope("overdue");
                setSortBy("due");
              }}
            />
            <SummaryStat
              label={english ? "High risk" : "高风险机会"}
              value={highRiskCount}
              tone="danger"
              detail={
                english ? "Most likely to stall or drop" : "最容易掉单或卡住"
              }
              active={summaryScope === "high-risk"}
              onClick={() => {
                setSummaryScope("high-risk");
                setSortBy("risk");
              }}
            />
            <SummaryStat
              label={english ? "Owned by me" : "只看我的"}
              value={mineCount}
              tone="approval"
              detail={
                english ? "Currently assigned to me" : "当前归我负责的事项"
              }
              active={summaryScope === "mine"}
              onClick={() => {
                setSummaryScope("mine");
              }}
            />
          </div>

          <details
            className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--background-elevated)]"
            data-testid="opportunity-filter-disclosure"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[color:var(--foreground)]">
                  {english ? "Filter and sort" : "筛选和排序"}
                </span>
                <span className="mt-1 block text-xs leading-5 text-[color:var(--muted-foreground)]">
                  {english
                    ? "Open only when you need to narrow the ranked opportunity list."
                    : "只有要收窄机会清单时再展开。"}
                </span>
              </span>
              <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)]">
                {english ? "Open filters" : "展开筛选"}
              </span>
            </summary>
            <div className="space-y-3 px-4 pb-4">
              <div className="grid gap-3 xl:grid-cols-[1.6fr_repeat(3,minmax(0,0.9fr))]">
                <div className="space-y-2">
                  <p className="workspace-toolbar-label">
                    {english ? "Search" : "搜索"}
                  </p>
                  <Input
                    aria-label={english ? "Search opportunities" : "搜索机会"}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={
                      english
                        ? "Search title, company or contact"
                        : "搜索标题、公司或联系人"
                    }
                  />
                </div>
                <div className="space-y-2">
                  <p className="workspace-toolbar-label">
                    {english ? "Type" : "类型"}
                  </p>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger
                      aria-label={english ? "Type filter" : "类型筛选"}
                    >
                      <SelectValue
                        placeholder={english ? "Type filter" : "类型筛选"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {english ? "All types" : "全部类型"}
                      </SelectItem>
                      {Object.entries(typeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <p className="workspace-toolbar-label">
                    {english ? "Stage" : "阶段"}
                  </p>
                  <Select value={stageFilter} onValueChange={setStageFilter}>
                    <SelectTrigger
                      aria-label={english ? "Stage filter" : "阶段筛选"}
                    >
                      <SelectValue
                        placeholder={english ? "Stage filter" : "阶段筛选"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {english ? "All stages" : "全部阶段"}
                      </SelectItem>
                      {Object.entries(stageLabelsByLocale).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <p className="workspace-toolbar-label">
                    {english ? "Sort" : "排序"}
                  </p>
                  <Select
                    value={sortBy}
                    onValueChange={(value) =>
                      setSortBy(value as "priority" | "risk" | "due" | "updated")
                    }
                  >
                    <SelectTrigger aria-label={english ? "Sort" : "排序"}>
                      <SelectValue placeholder={english ? "Sort" : "排序"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="priority">
                        {english ? "By priority" : "按优先级"}
                      </SelectItem>
                      <SelectItem value="updated">
                        {english ? "By last updated" : "按最近更新"}
                      </SelectItem>
                      <SelectItem value="due">
                        {english ? "By due date" : "按截止时间"}
                      </SelectItem>
                      <SelectItem value="risk">
                        {english ? "By risk" : "按风险等级"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-[1fr_1fr_1fr]">
                <div className="space-y-2">
                  <p className="workspace-toolbar-label">
                    {english ? "Risk" : "风险"}
                  </p>
                  <Select value={riskFilter} onValueChange={setRiskFilter}>
                    <SelectTrigger
                      aria-label={english ? "Risk filter" : "风险筛选"}
                      data-testid="opportunity-risk-filter"
                    >
                      <SelectValue
                        placeholder={english ? "Risk filter" : "风险筛选"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {english ? "All risks" : "全部风险"}
                      </SelectItem>
                      {Object.entries(riskLabelsByLocale).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <p className="workspace-toolbar-label">
                    {english ? "Owner" : "负责人"}
                  </p>
                  <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                    <SelectTrigger
                      aria-label={english ? "Owner filter" : "负责人筛选"}
                    >
                      <SelectValue
                        placeholder={english ? "Owner filter" : "负责人筛选"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {english ? "All owners" : "全部负责人"}
                      </SelectItem>
                      {memberships.map((membership) => (
                        <SelectItem
                          key={membership.user.id}
                          value={membership.user.id}
                        >
                          {membership.user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <p className="workspace-toolbar-label">
                    {english ? "More filters" : "更多筛选"}
                  </p>
                  <Select value={actionFilter} onValueChange={setActionFilter}>
                    <SelectTrigger
                      aria-label={english ? "More filters" : "更多筛选"}
                    >
                      <SelectValue
                        placeholder={english ? "More filters" : "更多筛选"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {actionFilterOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </details>

          <div className="workspace-toolbar flex flex-wrap items-center gap-2 rounded-[24px] px-3 py-3">
            <p className="workspace-toolbar-label pr-1">
              {english ? "Quick scopes" : "快速范围"}
            </p>
            <Button
              size="sm"
              variant={summaryScope === "mine" ? "default" : "secondary"}
              onClick={() =>
                setSummaryScope((value) => (value === "mine" ? "all" : "mine"))
              }
            >
              {english ? "Only mine" : "只看我的"}
            </Button>
            <Button
              size="sm"
              variant={summaryScope === "overdue" ? "default" : "secondary"}
              onClick={() =>
                setSummaryScope((value) =>
                  value === "overdue" ? "all" : "overdue",
                )
              }
            >
              {english ? "Only overdue" : "逾期未推进"}
            </Button>
            <Badge variant="warning">
              {english
                ? `${filtered.length} total`
                : `共 ${filtered.length} 条`}
            </Badge>
            {selectedIds.length ? (
              <Badge variant="info">
                {english
                  ? `${selectedIds.length} selected`
                  : `已选 ${selectedIds.length} 条`}
              </Badge>
            ) : null}
          </div>

          {selectedIds.length ? (
            <div className="grid gap-3 workspace-panel-muted rounded-2xl p-4 lg:grid-cols-[1fr_1fr_1fr]">
              <Select
                onValueChange={(value) => applyBulkUpdate("stage", value)}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={english ? "Bulk update stage" : "批量更新阶段"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(stageLabelsByLocale).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                onValueChange={(value) => applyBulkUpdate("owner", value)}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      english ? "Bulk reassign owner" : "批量修改负责人"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {memberships.map((membership) => (
                    <SelectItem
                      key={membership.user.id}
                      value={membership.user.id}
                    >
                      {membership.user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="datetime-local"
                aria-label={
                  english
                    ? "Bulk update opportunity due date"
                    : "批量更新机会截止时间"
                }
                onChange={(event) =>
                  event.target.value &&
                  applyBulkUpdate("dueDate", event.target.value)
                }
              />
            </div>
          ) : null}

          {suggestedOrder.length ? (
            <div className="workspace-panel rounded-[24px] px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">
                    {english ? "System-recommended order" : "建议推进顺序"}
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                    {english
                      ? "Sorted by priority, risk and recent activity, so you can explain which opportunities deserve attention first today."
                      : "按优先级、风险和最近更新时间综合排序，适合拿来讲今天先推进哪几条。"}
                  </p>
                </div>
                <Badge variant="neutral">Top 3</Badge>
              </div>
              <div className="mt-4 grid gap-3 xl:grid-cols-3">
                {suggestedOrder.map((opportunity, index) => (
                  <button
                    key={opportunity.id}
                    type="button"
                    aria-label={
                      english
                        ? `Open opportunity: ${opportunity.title}`
                        : `打开机会：${displayText(opportunity.title)}`
                    }
                    onClick={() => openDetail(opportunity)}
                    className="rounded-2xl border border-[color:var(--border)] px-4 py-4 text-left transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={index === 0 ? "warning" : "info"}>
                        {index === 0
                          ? english
                            ? "Push first"
                            : "最该先推"
                          : english
                            ? `Handle #${index + 1}`
                            : `建议第 ${index + 1} 个处理`}
                      </Badge>
                      {isOverdue(opportunity.dueDate) ? (
                        <Badge variant="danger">
                          {english ? "Overdue" : "逾期"}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-3 font-medium text-[color:var(--foreground)]">
                      {displayText(opportunity.title)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                      {trimText(
                        displayOptionalText(opportunity.nextAction),
                        64,
                      )}
                    </p>
                    <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">
                      {english
                        ? `Updated ${relativeLabel(opportunity.updatedAt)}`
                        : `最后更新 ${relativeLabel(opportunity.updatedAt)}`}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {workspaceDingTalkWorkProgress.length ? (
        <Card className="workspace-panel-muted">
          <CardHeader>
            <CardTitle>
              {english
                ? "Work Progress (DingTalk getReportList)"
                : "工作进度（钉钉 getReportList）"}
            </CardTitle>
            <CardDescription>
              {english
                ? "Latest read-only work reports, linked with reporter and department."
                : "最近只读工作汇报，已关联汇报人和部门。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-[minmax(0,200px)_minmax(0,160px)_minmax(0,1fr)] gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-xs font-medium text-[color:var(--muted)]">
              <p>{english ? "Reporter / Dept" : "汇报人 / 部门"}</p>
              <p>{english ? "Reported At" : "汇报时间"}</p>
              <p>{english ? "Summary" : "摘要"}</p>
            </div>
            {workspaceDingTalkWorkProgress.slice(0, 8).map((item) => (
              <div
                key={item.reportId}
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3"
              >
                <div className="grid grid-cols-[minmax(0,200px)_minmax(0,160px)_minmax(0,1fr)] gap-3">
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    {(item.reporterName ??
                      (english ? "Unknown reporter" : "未知汇报人")) +
                      " · " +
                      (item.departmentName ??
                        (english ? "Unknown dept" : "未知部门"))}
                  </p>
                  <p className="text-xs text-[color:var(--muted-foreground)]">
                    {(english ? "Reported at " : "汇报于 ") +
                      dateLabel(item.createdAt)}
                  </p>
                  <p className="text-sm leading-6 text-[color:var(--muted)]">
                    {trimText(item.previewText, 140)}
                  </p>
                </div>
                {item.sections.length ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-[color:var(--muted-foreground)]">
                      {english ? "View details" : "查看详情"}
                    </summary>
                    <div className="mt-2 space-y-2">
                      {item.sections.map((section, index) => (
                        <div
                          key={`${item.reportId}-workspace-section-${index}`}
                          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2 py-2"
                        >
                          <p className="text-xs font-medium text-[color:var(--foreground)]">
                            {section.key ?? (english ? "Section" : "分段")}
                          </p>
                          <pre className="mt-1 whitespace-pre-wrap text-xs leading-6 text-[color:var(--muted)]">
                            {section.value}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <ReportingProtocolPanel
        protocol={displayOpportunitiesProtocol}
        english={english}
      />

      <ProactiveMechanismPanel
        title={
          english ? "Collaboration raised proactively" : "主动抬出的机会协作"
        }
        description={
          english
            ? "Sales or delivery should not need to rediscover a proposal window by reading raw rows. This page should first prepare the context, then ask for the right collaboration."
            : displayText(
                "销售或交付不该靠重读原始行，才发现方案窗口已经出现。先准备好上下文，再主动发起正确协作。",
              )
        }
        flows={[displayPackageShapingFlow]}
        english={english}
      />

      {opportunityView === "board" ? (
        <DndContext
          id={OPPORTUNITIES_BOARD_DND_ID}
          sensors={sensors}
          onDragEnd={handleDragEnd}
        >
          {filtered.length ? (
            <div className="min-w-0 overflow-hidden pb-3">
              <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {columns.map(([stage, label]) => (
                  <StageColumn
                    key={stage}
                    stage={stage}
                    label={label}
                    opportunities={grouped[stage] ?? []}
                  >
                    {grouped[stage]?.map((opportunity) => (
                      <OpportunityCard
                        key={opportunity.id}
                        opportunity={opportunity}
                        memberships={memberships}
                        selected={selectedIds.includes(opportunity.id)}
                        onSelect={(checked) =>
                          setSelectedIds((previous) =>
                            checked
                              ? [...new Set([...previous, opportunity.id])]
                              : previous.filter((id) => id !== opportunity.id),
                          )
                        }
                        onOpen={() => openDetail(opportunity)}
                        onGenerateDraft={() =>
                          handleGenerateDraft(opportunity.id)
                        }
                        onConvertDingTalkSignal={() =>
                          handleConvertDingTalkSignal(opportunity.id)
                        }
                        onAssignOwner={handleAssignOwner}
                      />
                    ))}
                  </StageColumn>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              title={
                english
                  ? "No opportunities match the current filters"
                  : "没有符合当前筛选条件的机会"
              }
              description={
                english
                  ? "Loosen the filters or create a new opportunity to start moving work forward."
                  : "可以放宽筛选条件，或新建一条机会开始推进。"
              }
            />
          )}
        </DndContext>
      ) : filtered.length ? (
        <Card>
          <CardHeader>
            <CardTitle>{english ? "Opportunity list" : "机会列表"}</CardTitle>
            <CardDescription>
              {english
                ? "Better for fast sorting, bulk filtering and row-by-row edits, with a more operational-table feel."
                : "更适合快速排序、批量筛选和逐条编辑，呈现方式更像真实业务台账。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs font-medium text-[color:var(--muted-foreground)]">
                <tr>
                  <th className="pb-3 pr-4">{english ? "Select" : "选择"}</th>
                  <th className="pb-3 pr-4">
                    {english ? "Title / object" : "标题 / 对象"}
                  </th>
                  <th className="pb-3 pr-4">{english ? "Stage" : "阶段"}</th>
                  <th className="pb-3 pr-4">{english ? "Risk" : "风险"}</th>
                  <th className="pb-3 pr-4">
                    {english ? "Next step" : "下一步"}
                  </th>
                  <th className="pb-3 pr-4">{english ? "Due" : "截止"}</th>
                  <th className="pb-3 pr-4">
                    {english ? "Updated" : "最后更新"}
                  </th>
                  <th className="pb-3 pr-4">{english ? "Owner" : "负责人"}</th>
                  <th className="pb-3 pr-4">{english ? "Actions" : "操作"}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((opportunity) => (
                  <tr
                    key={opportunity.id}
                    className="border-t border-[color:color-mix(in_oklab,var(--border)_76%,transparent)] align-top"
                  >
                    <td className="py-4 pr-4">
                      <input
                        type="checkbox"
                        className="h-5 w-5 cursor-pointer accent-[color:var(--accent)]"
                        aria-label={
                          english
                            ? `Select opportunity: ${opportunity.title}`
                            : `选择机会：${displayText(opportunity.title)}`
                        }
                        checked={selectedIds.includes(opportunity.id)}
                        onChange={(event) =>
                          setSelectedIds((previous) =>
                            event.target.checked
                              ? [...new Set([...previous, opportunity.id])]
                              : previous.filter((id) => id !== opportunity.id),
                          )
                        }
                      />
                    </td>
                    <td className="py-4 pr-4">
                      <button
                        type="button"
                        aria-label={
                          english
                            ? `Open opportunity: ${opportunity.title}`
                            : `打开机会：${displayText(opportunity.title)}`
                        }
                        className="space-y-1 text-left"
                        onClick={() => openDetail(opportunity)}
                      >
                        <p className="font-medium text-[color:var(--foreground)]">
                          {displayText(opportunity.title)}
                        </p>
                        <p className="text-xs text-[color:var(--muted-foreground)]">
                          {opportunity.company?.name ??
                            (english ? "No company linked" : "未关联公司")}{" "}
                          ·{" "}
                          {opportunity.contacts[0]?.name ??
                            (english ? "No contact linked" : "未关联联系人")}
                        </p>
                      </button>
                    </td>
                    <td className="py-4 pr-4">
                      <StageBadge stage={opportunity.stage} />
                    </td>
                    <td className="py-4 pr-4">
                      <RiskBadge risk={opportunity.riskLevel} />
                    </td>
                    <td className="max-w-[280px] py-4 pr-4 text-[color:var(--muted)]">
                      {trimText(
                        displayOptionalText(opportunity.nextAction),
                        88,
                      )}
                    </td>
                    <td className="py-4 pr-4 text-[color:var(--muted)]">
                      {dateLabel(opportunity.dueDate)}
                    </td>
                    <td className="py-4 pr-4 text-[color:var(--muted)]">
                      {relativeLabel(opportunity.updatedAt)}
                    </td>
                    <td className="py-4 pr-4 text-[color:var(--muted)]">
                      {opportunity.owner?.name ??
                        (english ? "Unassigned" : "未分配")}
                    </td>
	                    <td className="py-4 pr-4">
	                      <div className="flex flex-wrap gap-2">
	                        <Button asChild size="sm" variant="secondary">
	                          <Link
	                            href={buildOpportunityAssetHref(
	                              opportunity.id,
	                              "opportunity-list",
	                            )}
	                          >
	                            {english ? "Open asset" : "经营资产"}
	                            <ArrowRight className="h-4 w-4" />
	                          </Link>
	                        </Button>
	                        <Button
	                          size="sm"
	                          variant="ghost"
	                          onClick={() => openDetail(opportunity)}
	                        >
	                          {english ? "Open details" : "查看详情"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleGenerateDraft(opportunity.id)}
                        >
                          <Sparkles className="h-4 w-4" />
                          {english ? "Draft follow-up" : "跟进草稿"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title={
            english
              ? "No opportunities match the current filters"
              : "没有符合当前筛选条件的机会"
          }
          description={
            english
              ? "Loosen the filters or create a new opportunity to start moving work forward."
              : "可以放宽筛选条件，或新建一条机会开始推进。"
          }
        />
      )}

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) {
            router.replace("/opportunities");
          }
        }}
      >
        <SheetContent
          className="max-w-[620px]"
          closeLabel={english ? "Close opportunity details" : "关闭机会详情"}
        >
          <SheetHeader>
            <SheetTitle>
              {detailDraft.id
                ? english
                  ? "Opportunity details"
                  : "机会详情"
                : english
                  ? "New opportunity"
                  : "新建机会"}
            </SheetTitle>
            <SheetDescription>
              {english
                ? "Review the current state, blockers, commitments and editable fields before choosing the next move."
                : "先看当前状态、阻塞、承诺和可编辑字段，再决定下一步怎么推进。"}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-5 p-5">
            {activeOpportunity ? (
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="default">
                  <Link
                    href={buildOpportunityAssetHref(
                      activeOpportunity.id,
                      "opportunity-sheet",
                    )}
                  >
                    {english ? "Open asset view" : "打开经营资产视图"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <StartRecordingButton
                  variant="secondary"
                  objectType="OPPORTUNITY"
                  objectId={activeOpportunity.id}
                  objectLabel={activeOpportunity.title}
                  defaultTitle={
                    english
                      ? `${activeOpportunity.title} live capture`
                      : `${activeOpportunity.title} 现场记录`
                  }
                />
              </div>
            ) : null}
            {activeOpportunity ? (
              <div
                id={OPPORTUNITY_PAGE_ANCHORS.briefing}
                className="theme-detail-shell overflow-hidden rounded-[28px]"
              >
                <div className="border-b border-[color:color-mix(in_oklab,var(--border-strong)_76%,transparent)] px-5 py-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-[color:var(--border)] bg-[color:color-mix(in_oklab,white_84%,var(--surface-subtle)_16%)] text-[color:var(--foreground)] ring-[color:var(--ring)] dark:border-white/10 dark:bg-white/[0.08] dark:text-[color:var(--dark-inset-foreground)] dark:ring-white/10">
                      {english ? "Opportunity brief" : "机会摘要"}
                    </Badge>
                    <StageBadge stage={activeOpportunity.stage} />
                    <RiskBadge risk={activeOpportunity.riskLevel} />
                    <Badge
                      variant="warning"
                      className="border-[color:var(--status-warning-border)]/20 bg-[color:var(--accent-warm)]/10 text-[color:var(--status-warning-text)] ring-[color:var(--status-warning-border)]/15"
                    >
                      {english ? "Priority" : "优先级"}{" "}
                      {getPriorityLabel(activeOpportunity.priorityScore)}
                    </Badge>
                  </div>
                  <div className="mt-4 space-y-2">
                    <h3 className="text-[1.7rem] font-semibold leading-[1.25] tracking-tight text-white">
                      {activeOpportunity.title}
                    </h3>
                    <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                      {english
                        ? `${activeOpportunity.company?.name ?? "No linked company"} · ${activeOpportunity.contacts[0]?.name ?? "No linked contact"}`
                        : `${activeOpportunity.company?.name ?? "未关联公司"} · ${activeOpportunity.contacts[0]?.name ?? "未关联联系人"}`}
                    </p>
                  </div>
                </div>

                <div className="grid gap-0 lg:grid-cols-[1.35fr_0.95fr]">
                  <div className="space-y-5 px-5 py-5">
                    <section className="space-y-2">
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                        {english ? "Current status" : "当前状态"}
                      </p>
                      <p className="text-lg font-semibold text-white">
                        {isOverdue(activeOpportunity.dueDate)
                          ? english
                            ? "This opportunity is already overdue"
                            : "这条机会已经逾期未推进"
                          : activeOpportunity.riskLevel === "HIGH" ||
                              activeOpportunity.riskLevel === "CRITICAL"
                            ? english
                              ? "This opportunity is currently in a high-risk window"
                              : "这条机会当前处在高风险区间"
                            : english
                              ? "This opportunity is still in a healthy motion window"
                              : "这条机会目前仍处在可健康推进的窗口"}
                      </p>
                      <p className="text-sm leading-7 text-[color:var(--dark-inset-muted)]">
                        {isOverdue(activeOpportunity.dueDate)
                          ? english
                            ? "Tighten the next move and the due date first; otherwise momentum will keep cooling and the follow-up cost will rise."
                            : "建议先把下一步动作和截止时间收紧，否则推进节奏会继续降温，后续补救成本会更高。"
                          : activeOpportunity.riskLevel === "HIGH" ||
                              activeOpportunity.riskLevel === "CRITICAL"
                            ? english
                              ? "The risk source is already affecting forward movement. Confirm whether the problem is commitment pressure, collaboration lag or unclear ownership before pushing harder."
                              : "当前风险已经开始影响推进，需要先确认是承诺压力、内部协同滞后，还是负责人边界不清，再决定后续动作。"
                            : english
                              ? "The opportunity is not out of control yet, so this is the right time to turn the current judgement into a real follow-up, meeting or owner update."
                              : "当前机会还没有失控，正适合把现有判断尽快落成真实跟进、会议安排或负责人更新。"}
                      </p>
                    </section>

                    <section className="theme-detail-shell-card space-y-3 rounded-[24px] px-4 py-4">
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                        {english ? "Operating snapshot" : "推进快照"}
                      </p>
                      <div className="space-y-3">
                        <BriefLine
                          label={english ? "Latest movement" : "最近推进"}
                          value={relativeLabel(activeOpportunity.updatedAt)}
                          note={
                            english
                              ? "Estimated from the latest meaningful update."
                              : "按最近一次关键变化估算。"
                          }
                        />
                        <BriefLine
                          label={english ? "Current blocker" : "当前卡点"}
                          value={
                            activeOpportunity.blockers[0]?.title ??
                            (english ? "No major blocker yet" : "暂无显著卡点")
                          }
                          note={
                            activeOpportunity.blockers.length
                              ? english
                                ? `${activeOpportunity.blockers.length} blocker(s) are still open.`
                                : `当前仍有 ${activeOpportunity.blockers.length} 个阻塞未关闭。`
                              : english
                                ? "No structured blocker is blocking this item right now."
                                : "当前没有结构化阻塞正在影响推进。"
                          }
                        />
                        <BriefLine
                          label={english ? "Open commitments" : "未完成承诺"}
                          value={
                            activeOpportunity.commitments[0]?.title ??
                            (english
                              ? "No open commitment"
                              : "当前没有开放承诺")
                          }
                          note={
                            activeOpportunity.commitments.length
                              ? english
                                ? `${activeOpportunity.commitments.length} commitment(s) still need to be fulfilled.`
                                : `当前还有 ${activeOpportunity.commitments.length} 条承诺待兑现。`
                              : english
                                ? "No overdue commitment is active."
                                : "当前没有逾期承诺。"
                          }
                        />
                        <BriefLine
                          label={
                            english ? "Next move on record" : "台账中的下一步"
                          }
                          value={
                            displayOptionalText(activeOpportunity.nextAction) ||
                            (english
                              ? "No next move has been captured yet."
                              : "当前还没有沉淀出下一步动作。")
                          }
                        />
                      </div>
                    </section>
                  </div>

                  <div className="border-t border-[color:color-mix(in_oklab,var(--border-strong)_76%,transparent)] px-5 py-5 lg:border-l lg:border-t-0">
                    <div className="space-y-4">
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                        {english ? "Key attributes" : "关键属性"}
                      </p>
                      <dl className="space-y-3">
                        <DetailRow
                          label={english ? "Owner" : "负责人"}
                          value={
                            activeOpportunity.owner?.name ??
                            (english ? "Unassigned" : "未分配")
                          }
                          note={
                            english
                              ? "This person is responsible for the current forward motion."
                              : "当前推进责任暂时挂在这个人身上。"
                          }
                        />
                        <DetailRow
                          label={english ? "Priority" : "优先级"}
                          value={getPriorityLabel(
                            activeOpportunity.priorityScore,
                          )}
                        />
                        <DetailRow
                          label={english ? "Current stage" : "当前阶段"}
                          value={stageLabelsByLocale[activeOpportunity.stage]}
                          note={
                            english
                              ? "Stage changes will refresh ordering, review and follow-up logic."
                              : "阶段变化会同步刷新排序、审阅和跟进逻辑。"
                          }
                        />
                        <DetailRow
                          label={english ? "Last updated" : "最后更新"}
                          value={relativeLabel(activeOpportunity.updatedAt)}
                        />
                        <DetailRow
                          label={english ? "Due date" : "截止时间"}
                          value={dateLabel(activeOpportunity.dueDate)}
                        />
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeOpportunity ? (
              <div
                id={OPPORTUNITY_PAGE_ANCHORS.actionWorkspace}
                className="theme-detail-shell overflow-hidden rounded-[28px]"
              >
                <div className="border-b border-[color:color-mix(in_oklab,var(--border-strong)_76%,transparent)] px-5 py-4">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-[color:var(--status-success-text)]/80">
                      {english ? "AI handling desk" : "动作处理工作区"}
                    </p>
                    <p className="text-sm font-semibold text-white">
                      {english
                        ? "Handle the real next move here"
                        : "先在这里把真实推进动作处理掉"}
                    </p>
                    <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                      {english
                        ? "You usually do not need to read or edit every field. In most cases, tightening the next move, due date and ownership is enough to turn the current judgement into real progress."
                        : "你通常不需要先翻完所有字段。大多数情况下，只要把下一步动作、截止时间和负责人收紧，就能把当前判断变成真实推进。"}
                    </p>
                  </div>
                </div>
                <div className="space-y-4 px-5 py-5">
                  <div className="rounded-[22px] border border-[color:var(--status-success-border)]/15 bg-[color:var(--accent-success)]/[0.08] px-4 py-4">
                    <p className="text-xs font-medium text-[color:var(--status-success-text)]/80">
                      {english ? "What to change now" : "现在先改什么"}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-[color:var(--dark-inset-muted)]">
                      {english
                        ? "1. Make the next move specific. 2. Put a real due date on it. 3. Confirm who owns the follow-through."
                        : "1. 把下一步动作写具体。2. 给它一个真实截止时间。3. 确认谁来持续跟进。"}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" asChild>
                        <Link href={`/proposals/${activeOpportunity.id}`}>
                          {english ? "Open proposal page" : "打开方案页"}
                        </Link>
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/packages/${activeOpportunity.id}`}>
                          {english ? "Open package page" : "打开方案包页"}
                        </Link>
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[color:var(--dark-inset-foreground)]">
                      {english
                        ? "Next move to execute now"
                        : "现在准备执行的下一步"}
                    </label>
                    <Textarea
                      value={detailDraft.nextAction}
                      onChange={(event) =>
                        setDetailDraft((state) => ({
                          ...state,
                          nextAction: event.target.value,
                        }))
                      }
                      className="min-h-[132px]"
                    />
                    <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
                      {english
                        ? "Write it like something a person can actually do next, not a status label."
                        : "把它写成一个人下一步真的能做的动作，而不是状态标签。"}
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[color:var(--dark-inset-foreground)]">
                        {english
                          ? "Due date to hold the pace"
                          : "维持节奏的截止时间"}
                      </label>
                      <Input
                        type="datetime-local"
                        aria-label={
                          english
                            ? "Opportunity due date"
                            : "机会截止时间"
                        }
                        value={detailDraft.dueDate}
                        onChange={(event) =>
                          setDetailDraft((state) => ({
                            ...state,
                            dueDate: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <FieldSelect
                      label={
                        english
                          ? "Who should own this next"
                          : "接下来谁负责盯住"
                      }
                      value={detailDraft.ownerId}
                      options={memberships.map((membership) => [
                        membership.user.id,
                        membership.user.name,
                      ])}
                      onChange={(value) =>
                        setDetailDraft((state) => ({
                          ...state,
                          ownerId: value,
                        }))
                      }
                    />
                  </div>

                  {detailDraft.stage === "LOST" ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[color:var(--dark-inset-foreground)]">
                        {english
                          ? "Why this is being closed"
                          : "这条为什么要关闭"}
                      </label>
                      <Textarea
                        value={detailDraft.lossReason}
                        onChange={(event) =>
                          setDetailDraft((state) => ({
                            ...state,
                            lossReason: event.target.value,
                          }))
                        }
                        placeholder={
                          english
                            ? "Capture the loss reason so it can be reviewed or reactivated later."
                            : "记录失效原因，方便后续复盘和再激活。"
                        }
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeOpportunity ? (
              <div
                id={OPPORTUNITY_PAGE_ANCHORS.judgementWorkspace}
                className="theme-detail-shell overflow-hidden rounded-[28px]"
              >
                <div className="border-b border-[color:color-mix(in_oklab,var(--border-strong)_76%,transparent)] px-5 py-4">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-[color:var(--status-info-text)]/80">
                      {english ? "Decision workspace" : "判断工作区"}
                    </p>
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">
                      {english ? "Judgement-first workspace" : "推进判断前台"}
                    </p>
                    <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                      {english
                        ? "Recommended move · evidence · blockers · action outlet."
                        : "推荐动作 · 证据 · 卡点 · 动作出口。"}
                    </p>
                  </div>
                </div>
                <div className="space-y-4 px-5 py-5">
                  <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                    {english
                      ? "Read the current move first, then decide whether to generate the next action."
                      : "先看当前最该推进什么，再决定是否生成下一步动作。"}
                  </p>
                  {recommendationState.loading ? (
                    <p className="workspace-note-meta text-sm">
                      {english
                        ? "Refreshing recommendation order..."
                        : "正在刷新建议排序..."}
                    </p>
                  ) : null}
                  {primaryRecommendation ? (
                    <div
                      id={buildOpportunityItemAnchor(
                        "recommendation",
                        primaryRecommendation.recommendationId,
                      )}
                    >
                      <RecommendationJudgementCard
                        recommendation={primaryRecommendation}
                        emphasis="featured"
                        surfaceTone="light"
                        detailLevel="summary"
                        summaryLabel={english ? "Primary move" : "首选动作"}
                        sourcePage={`/opportunities?opportunityId=${activeOpportunity.id}`}
                        className="shadow-none"
                        cta={
                          !primaryRecommendation.recommendationId.startsWith(
                            "fallback-",
                          ) ? (
                            <Button
                              onClick={() =>
                                startTransition(async () => {
                                  const result =
                                    await createActionFromRecommendationAction(
                                      primaryRecommendation.recommendationId,
                                      `/opportunities?opportunityId=${activeOpportunity.id}`,
                                    );
                                  if (!result.ok) {
                                    toast.error(
                                      result.error ??
                                        (english
                                          ? "Failed to create action from recommendation"
                                          : "生成判断建议动作失败"),
                                    );
                                    return;
                                  }
                                  toast.success(
                                    english
                                      ? "Created action from recommendation"
                                      : "已按判断建议生成动作",
                                  );
                                  router.push("/approvals");
                                  router.refresh();
                                })
                              }
                            >
                              {english
                                ? "Create action from judgement"
                                : "按判断生成动作"}
                            </Button>
                          ) : undefined
                        }
                        secondaryCta={
                          <div className="flex flex-wrap items-center gap-2">
                            <Button variant="secondary" asChild>
                              <Link
                                href={`/memory?objectType=OPPORTUNITY&objectId=${activeOpportunity.id}`}
                              >
                                {english
                                  ? "Open supporting facts"
                                  : "查看支撑事实"}
                              </Link>
                            </Button>
                            <RecommendationFeedbackButtons
                              recommendationId={
                                primaryRecommendation.recommendationId
                              }
                              sourcePage={`/opportunities?opportunityId=${activeOpportunity.id}`}
                            />
                          </div>
                        }
                      />
                    </div>
                  ) : (
                    <EmptyState
                      title={
                        english
                          ? "No primary recommendation yet"
                          : "当前还没有主推荐"
                      }
                      description={
                        english
                          ? "The system needs more structured memory or recent interaction before it can form a stronger recommendation."
                          : "系统需要更多结构化记忆或最近互动，才能形成更强的推进判断。"
                      }
                    />
                  )}
                  {secondaryRecommendations.length ? (
                    <div className="grid gap-4 xl:grid-cols-2">
                      {secondaryRecommendations.map((item) => (
                        <RecommendationJudgementCard
                          key={item.recommendationId}
                          recommendation={item}
                          emphasis="quiet"
                          surfaceTone="light"
                          detailLevel="summary"
                          summaryLabel={english ? "Secondary move" : "次优动作"}
                          sourcePage={`/opportunities?opportunityId=${activeOpportunity.id}`}
                          className="shadow-none"
                          cta={
                            !item.recommendationId.startsWith("fallback-") ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  startTransition(async () => {
                                    const result =
                                      await createActionFromRecommendationAction(
                                        item.recommendationId,
                                        `/opportunities?opportunityId=${activeOpportunity.id}`,
                                      );
                                    if (!result.ok) {
                                      toast.error(
                                        result.error ??
                                          (english
                                            ? "Failed to create action from recommendation"
                                            : "生成判断建议动作失败"),
                                      );
                                      return;
                                    }
                                    toast.success(
                                      english
                                        ? "Created action from recommendation"
                                        : "已按判断建议生成动作",
                                    );
                                    router.push("/approvals");
                                    router.refresh();
                                  })
                                }
                              >
                                {english ? "Create action" : "生成动作"}
                              </Button>
                            ) : undefined
                          }
                          secondaryCta={
                            <RecommendationFeedbackButtons
                              recommendationId={item.recommendationId}
                              sourcePage={`/opportunities?opportunityId=${activeOpportunity.id}`}
                            />
                          }
                        />
                      ))}
                    </div>
                  ) : null}
                  {discouragedRecommendation ? (
                    <div
                      className="workspace-note-card px-4 py-4"
                      data-tone="amber"
                    >
                      <p className="workspace-note-title text-sm font-semibold">
                        {english
                          ? "Not the best move right now"
                          : "不建议现在先做的动作"}
                      </p>
                      <p className="workspace-note-title mt-3 text-sm font-semibold leading-7">
                        {discouragedRecommendation.title}
                      </p>
                      <p className="workspace-note-body mt-3 text-sm leading-7">
                        {discouragedRecommendation.explanation}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="workspace-note-meta text-xs leading-6">
                          {english
                            ? "The system did not rank it first because blocker pressure, commitment pressure or policy boundary make the timing weaker right now."
                            : "它暂时没有排在最前，是因为当前卡点、承诺压力或策略边界让它的时机还不对。"}
                        </p>
                        <Button size="sm" variant="ghost" asChild>
                          <Link href="/approvals">
                            {english
                              ? "Review similar outcomes"
                              : "回看类似结果"}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeOpportunity ? (
              <div
                id={OPPORTUNITY_PAGE_ANCHORS.boundarySummary}
                className="grid gap-4 xl:grid-cols-2"
              >
                <div className="theme-surface-panel space-y-3 rounded-2xl p-4">
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    {english ? "Current blockers" : "当前卡点"}
                  </p>
                  {activeOpportunity.blockers.length ? (
                    activeOpportunity.blockers.map((blocker) => (
                      <div
                        key={blocker.id}
                        id={buildOpportunityItemAnchor("blocker", blocker.id)}
                      >
                        <BlockerCard
                          blocker={{
                            ...blocker,
                            targetLabel:
                              blocker.relatedOpportunity?.title ??
                              blocker.relatedMeeting?.title ??
                              blocker.relatedContact?.name ??
                              blocker.relatedCompany?.name ??
                              activeOpportunity.title,
                          }}
                          compact
                        />
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[color:var(--muted-foreground)]">
                      {english
                        ? "No structured blocker yet."
                        : "当前没有结构化阻塞。"}
                    </p>
                  )}
                </div>
                <div className="theme-surface-panel space-y-3 rounded-2xl p-4">
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    {english ? "Current commitments" : "当前承诺"}
                  </p>
                  {activeOpportunity.commitments.length ? (
                    activeOpportunity.commitments.map((commitment) => (
                      <div
                        key={commitment.id}
                        id={buildOpportunityItemAnchor(
                          "commitment",
                          commitment.id,
                        )}
                      >
                        <CommitmentCard
                          commitment={{
                            ...commitment,
                            sourceLabel: describeCommitmentSource(
                              commitment.sourceType,
                              english,
                            ),
                            ownerName: commitment.ownerUser?.name ?? null,
                            targetLabel:
                              commitment.relatedOpportunity?.title ??
                              commitment.relatedMeeting?.title ??
                              commitment.relatedContact?.name ??
                              commitment.relatedCompany?.name ??
                              activeOpportunity.title,
                          }}
                          compact
                        />
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[color:var(--muted-foreground)]">
                      {english
                        ? "No open commitment right now."
                        : "当前没有未完成承诺。"}
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            <div
              id={OPPORTUNITY_PAGE_ANCHORS.recordSettings}
              className="theme-detail-shell overflow-hidden rounded-[28px]"
            >
              <div className="border-b border-[color:color-mix(in_oklab,var(--border-strong)_76%,transparent)] px-5 py-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                    {english ? "Record settings" : "记录属性"}
                  </p>
                  <p className="text-sm font-semibold text-white">
                    {english
                      ? "Use these fields when you need to adjust the record itself"
                      : "这里用于修改台账本身，不是主要处理动作"}
                  </p>
                  <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                    {english
                      ? "These are secondary settings: title, stage, risk and company binding. Most day-to-day handling should happen in the AI handling desk above."
                      : "这里是次级设置：标题、阶段、风险、公司绑定等。日常推进动作优先在上面的动作处理工作区完成。"}
                  </p>
                </div>
              </div>
              <div className="space-y-4 px-5 py-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[color:var(--dark-inset-foreground)]">
                    {english ? "Title" : "标题"}
                  </label>
                  <Input
                    aria-label={english ? "Opportunity title" : "机会标题"}
                    value={detailDraft.title}
                    onChange={(event) =>
                      setDetailDraft((state) => ({
                        ...state,
                        title: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium text-[color:var(--dark-inset-foreground)]">
                    {english ? "Attachments" : "附件"}
                  </label>
                  <div className="workspace-panel-muted rounded-2xl px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          document
                            .getElementById("opportunity-attachment-input")
                            ?.click()
                        }
                      >
                        <Upload className="h-4 w-4" />
                        {english ? "Upload file" : "上传文件"}
                      </Button>
                      <input
                        key={fileInputKey}
                        id="opportunity-attachment-input"
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(event) => {
                          const selectedFiles = Array.from(
                            event.target.files ?? [],
                          );
                          if (!selectedFiles.length) return;
                          setQueuedFiles((existing) => [
                            ...existing,
                            ...selectedFiles,
                          ]);
                        }}
                      />
                      <p className="text-xs text-[color:var(--muted-foreground)]">
                        {english
                          ? "Up to 10MB per file. Files upload after saving this opportunity."
                          : "单文件最多 10MB。保存机会后自动上传并关联。"}
                      </p>
                    </div>

                    {queuedFiles.length ? (
                      <div className="mt-3 space-y-2">
                        {queuedFiles.map((file, index) => (
                          <div
                            key={`${file.name}-${file.size}-${index}`}
                            className="flex items-center justify-between gap-2 rounded-xl border border-[color:var(--border)] px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-[color:var(--foreground)]">
                                {file.name}
                              </p>
                              <p className="text-xs text-[color:var(--muted-foreground)]">
                                {formatAttachmentSize(file.size)}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setQueuedFiles((existing) =>
                                  existing.filter((_, itemIndex) => itemIndex !== index),
                                )
                              }
                            >
                              {english ? "Remove" : "移除"}
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {activeOpportunity?.attachments.length ? (
                      <div className="mt-3 space-y-2">
                        {activeOpportunity.attachments.map((attachment) => (
                          <a
                            key={attachment.id}
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-between gap-2 rounded-xl border border-[color:var(--border)] px-3 py-2 hover:bg-[color:var(--surface-subtle)]"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-[color:var(--foreground)]">
                                {attachment.fileName}
                              </p>
                              <p className="text-xs text-[color:var(--muted-foreground)]">
                                {formatAttachmentSize(attachment.sizeBytes)} ·{" "}
                                {dateLabel(attachment.uploadedAt)}
                              </p>
                            </div>
                            <Paperclip className="h-4 w-4 text-[color:var(--muted-foreground)]" />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FieldSelect
                    label={english ? "Type" : "类型"}
                    value={detailDraft.type}
                    options={Object.entries(typeLabels)}
                    onChange={(value) =>
                      setDetailDraft((state) => ({
                        ...state,
                        type: value as DetailDraft["type"],
                      }))
                    }
                  />
                  <FieldSelect
                    label={english ? "Stage" : "阶段"}
                    value={detailDraft.stage}
                    options={Object.entries(stageLabelsByLocale)}
                    onChange={(value) =>
                      setDetailDraft((state) => ({
                        ...state,
                        stage: value as DetailDraft["stage"],
                      }))
                    }
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FieldSelect
                    label={english ? "Risk level" : "风险等级"}
                    value={detailDraft.riskLevel}
                    options={Object.entries(riskLabelsByLocale)}
                    onChange={(value) =>
                      setDetailDraft((state) => ({
                        ...state,
                        riskLevel: value as DetailDraft["riskLevel"],
                      }))
                    }
                  />
                  <FieldSelect
                    label={english ? "Company" : "关联公司"}
                    value={detailDraft.companyId || "__none__"}
                    options={[
                      [
                        "__none__",
                        english ? "No linked company" : "未关联公司",
                      ],
                      ...companies.map(
                        (company) =>
                          [company.id, company.name] as [string, string],
                      ),
                    ]}
                    onChange={(value) =>
                      setDetailDraft((state) => ({
                        ...state,
                        companyId: value === "__none__" ? "" : value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            {activeOpportunity ? (
              <div
                id={OPPORTUNITY_PAGE_ANCHORS.contextDetails}
                className="workspace-note-card px-4 py-4"
                data-tone="slate"
              >
                <p className="workspace-note-title text-sm font-semibold">
                  {english ? "Context details" : "详情补充"}
                </p>
                <div className="workspace-note-body mt-3 grid gap-2 text-sm leading-7">
                  <p>
                    {english ? "Linked contacts" : "关联联系人"}：
                    {activeOpportunity.contacts
                      .map((contact) => contact.name)
                      .join("、") ||
                      (english ? "No linked contact" : "未关联联系人")}
                  </p>
                  <p>
                    {english ? "Company" : "公司"}：
                    {activeOpportunity.company?.name ??
                      (english ? "No linked company" : "未关联公司")}
                  </p>
                  <p>
                    {english ? "Last updated" : "最后更新时间"}：
                    {dateLabel(activeOpportunity.updatedAt)}
                  </p>
                </div>
              </div>
            ) : null}

            {activeOpportunity ? (
              <div
                id={OPPORTUNITY_PAGE_ANCHORS.memorySummary}
                className="workspace-note-card px-4 py-4"
                data-tone="violet"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="workspace-note-title text-sm font-semibold">
                    {english ? "Object memory summary" : "对象级记忆摘要"}
                  </p>
                  <Button size="sm" variant="ghost" asChild>
                    <Link
                      href={`/memory?objectType=OPPORTUNITY&objectId=${activeOpportunity.id}`}
                    >
                      {english ? "Open memory" : "查看记忆"}
                    </Link>
                  </Button>
                </div>
                <p className="workspace-note-body mt-3 text-sm leading-7">
                  {(activeOpportunity.briefingSnapshot?.payload.summary as
                    | string
                    | undefined) ??
                    (english
                      ? "The system condenses recent memory, current blockers and open commitments into an opportunity summary you can act on immediately."
                      : "最近形成的记忆、当前卡点和未完成承诺会收敛成一个可直接推进的机会摘要。")}
                </p>
                {Array.isArray(
                  activeOpportunity.briefingSnapshot?.payload
                    .recommendedNextSteps,
                ) ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(
                      activeOpportunity.briefingSnapshot?.payload
                        .recommendedNextSteps as string[]
                    )
                      .slice(0, 2)
                      .map((item, index) => (
                        <Badge
                          key={item}
                          id={buildOpportunityItemAnchor(
                            "briefing-step",
                            index,
                          )}
                          variant="info"
                        >
                          {item}
                        </Badge>
                      ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeOpportunity ? (
              <div
                id={OPPORTUNITY_PAGE_ANCHORS.memoryFacts}
                className="grid gap-4 xl:grid-cols-2"
              >
                <div className="theme-surface-panel space-y-3 rounded-2xl p-4">
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    {english ? "Recent key memory" : "最近形成的关键记忆"}
                  </p>
                  {activeOpportunity.memoryFacts.length ? (
                    activeOpportunity.memoryFacts.map((fact) => (
                      <div
                        key={fact.id}
                        id={buildOpportunityItemAnchor("memory-fact", fact.id)}
                        className="workspace-panel-muted rounded-2xl px-3 py-3"
                      >
                        <p className="text-sm font-medium text-[color:var(--foreground)]">
                          {fact.title}
                        </p>
                        <p className="mt-2 text-sm text-[color:var(--muted)]">
                          {trimText(fact.content, 88)}
                        </p>
                        <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                          {english
                            ? `Confidence ${fact.confidence} · ${dateLabel(fact.updatedAt)}`
                            : `置信度 ${fact.confidence} · ${dateLabel(fact.updatedAt)}`}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[color:var(--muted-foreground)]">
                      {english
                        ? "No structured memory fact yet."
                        : "当前还没有结构化记忆事实。"}
                    </p>
                  )}
                </div>
                <div className="workspace-panel-muted space-y-3 rounded-2xl p-4">
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    {english
                      ? "What happens if you do not push today"
                      : "如果今天不推进会怎样"}
                  </p>
                  <div className="rounded-2xl border border-[color:var(--status-warning-border)] bg-[color:color-mix(in_oklab,var(--surface)_94%,white_6%)] px-4 py-4">
                    <p className="text-sm leading-7 text-[color:var(--foreground)]">
                      {activeOpportunity.riskLevel === "CRITICAL" ||
                      activeOpportunity.riskLevel === "HIGH"
                        ? english
                          ? "This opportunity is already in a high-risk window. If you do not move it today, blockers and open commitments will keep stacking up and it will cost much more to recover momentum later."
                          : "当前机会已经进入高风险窗口。如果今天不推进，阻塞和未完成承诺会继续堆积，后续需要更大成本才能拉回节奏。"
                        : english
                          ? "The opportunity is not out of control yet, but if you keep editing fields without real actions, the system’s judgement will drift farther from reality."
                          : "这条机会暂时还没有失控，但如果继续只改字段不推进动作，后续判断会越来越失真。"}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap justify-between gap-3 pt-2">
              {detailDraft.id ? (
                <Button
                  variant="secondary"
                  onClick={() => handleGenerateDraft(detailDraft.id!)}
                >
                  <Sparkles className="h-4 w-4" />
                  {english ? "Generate follow-up draft" : "生成跟进草稿"}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setSheetOpen(false)}>
                  {english ? "Cancel" : "取消"}
                </Button>
                <Button disabled={pending} onClick={handleSaveDetail}>
                  {pending
                    ? english
                      ? "Saving..."
                      : "保存中..."
                    : english
                      ? "Save opportunity"
                      : "保存机会"}
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}


function StageColumn({
  stage,
  label,
  opportunities,
  children,
}: {
  stage: OpportunityItem["stage"];
  label: string;
  opportunities: OpportunityItem[];
  children: React.ReactNode;
}) {
  const { locale } = useWorkspaceUi();
  const english = locale === "en-US";
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-full min-w-0 snap-start rounded-[28px] border p-4 ${isOver ? "border-[color:var(--border-strong)] bg-[color:color-mix(in_oklab,var(--surface-subtle)_78%,var(--accent-soft)_22%)]" : "border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_80%,white_20%)]"}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3 px-1">
        <p className="text-base font-semibold tracking-tight text-[color:var(--foreground)]">
          {label}
        </p>
        <Badge variant="default">{opportunities.length}</Badge>
      </div>
      <div className="space-y-3">
        {opportunities.length ? (
          children
        ) : (
          <div className="theme-surface-panel-dashed rounded-2xl px-4 py-12 text-center text-sm leading-6 text-[color:var(--muted-foreground)]">
            {english ? "Drop here to move work forward" : "拖到这里推进"}
          </div>
        )}
      </div>
    </div>
  );
}

function OpportunityCard({
  opportunity,
  memberships,
  selected,
  onSelect,
  onOpen,
  onGenerateDraft,
  onConvertDingTalkSignal,
  onAssignOwner,
}: {
  opportunity: OpportunityItem;
  memberships: OpportunitiesClientProps["memberships"];
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onOpen: () => void;
  onGenerateDraft: () => void;
  onConvertDingTalkSignal: () => void;
  onAssignOwner: (opportunityId: string, ownerId: string) => void;
}) {
  const { locale } = useWorkspaceUi();
  const english = locale === "en-US";
  const dateLabel = (value: Date | string | null | undefined) =>
    formatOpportunityDateLabel(value, english, formatDateLabel);
  const relativeLabel = (value: Date | string | null | undefined) =>
    formatOpportunityRelativeLabel(value, english, formatRelative);
  const displayText = (value: string | null | undefined) =>
    formatOpportunityDisplayText(value ?? "", english);
  const typeLabels = getLocalizedOpportunityTypeLabels(locale);
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: opportunity.id,
    });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`min-w-0 rounded-[24px] border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_92%,white_8%)] p-4 shadow-sm transition ${isDragging ? "opacity-70" : ""}`}
    >
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            className="mt-0.5 inline-flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-xl border border-[color:var(--border)] text-[color:var(--muted-foreground)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] active:cursor-grabbing"
            {...listeners}
            {...attributes}
            aria-label={
              english
                ? `Move opportunity card: ${opportunity.title}`
                : `移动机会卡片：${displayText(opportunity.title)}`
            }
            onClick={(event) => event.stopPropagation()}
          >
            <Rows3 className="h-4 w-4" />
          </button>
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0 cursor-pointer accent-[color:var(--accent)]"
            aria-label={
              english
                ? `Select opportunity: ${opportunity.title}`
                : `选择机会：${displayText(opportunity.title)}`
            }
            checked={selected}
            onChange={(event) => onSelect(event.target.checked)}
            onClick={(event) => event.stopPropagation()}
          />
          <button
            type="button"
            aria-label={
              english
                ? `Open opportunity: ${opportunity.title}`
                : `打开机会：${displayText(opportunity.title)}`
            }
            className="min-w-0 flex-1 text-left"
            onClick={onOpen}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      opportunity.priorityScore >= 80 ? "warning" : "default"
                    }
                  >
                    {getPriorityLabel(opportunity.priorityScore)}
                  </Badge>
                  {isOverdue(opportunity.dueDate) ? (
                    <Badge variant="danger">
                      {english ? "Overdue" : "逾期"}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-[1.55rem] font-semibold leading-9 tracking-tight text-[color:var(--foreground)]">
                  {displayText(opportunity.title)}
                </p>
                <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {typeLabels[opportunity.type]} ·{" "}
                  {opportunity.company?.name ??
                    (english ? "No linked company" : "未关联公司")}
                </p>
              </div>
              <RiskBadge risk={opportunity.riskLevel} />
            </div>
          </button>
        </div>
        <p className="line-clamp-3 text-sm leading-7 text-[color:var(--muted)]">
          {trimText(displayText(opportunity.nextAction))}
        </p>
        {opportunity.dingtalkSignalSummary?.totalSignals ? (
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2">
            <p className="text-xs font-medium text-[color:var(--foreground)]">
              {english
                ? `DingTalk signals (7d): ${opportunity.dingtalkSignalSummary.totalSignals} · converted ${opportunity.dingtalkSignalSummary.convertedActionCount} · pending approval ${opportunity.dingtalkSignalSummary.pendingApprovalCount}`
                : `钉钉执行信号（近7天）：${opportunity.dingtalkSignalSummary.totalSignals} 条 · 已转动作 ${opportunity.dingtalkSignalSummary.convertedActionCount} 条 · 待审批 ${opportunity.dingtalkSignalSummary.pendingApprovalCount} 条`}
            </p>
          </div>
        ) : null}
        {opportunity.dingtalkSignalSummary?.workProgress?.length ? (
          <div className="space-y-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3">
            <p className="text-xs font-medium text-[color:var(--foreground)]">
              {english
                ? "Work progress (DingTalk getReportList)"
                : "工作进度（钉钉 getReportList）"}
            </p>
            {opportunity.dingtalkSignalSummary.workProgress
              .slice(0, 2)
              .map((item) => (
                <div
                  key={item.reportId}
                  className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2"
                >
                  <p className="text-xs text-[color:var(--foreground)]">
                    {(item.reporterName ??
                      (english ? "Unknown reporter" : "未知汇报人")) +
                      " · " +
                      (item.departmentName ??
                        (english ? "Unknown dept" : "未知部门"))}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                    {(english ? "Reported at: " : "汇报时间：") +
                      dateLabel(item.createdAt)}
                  </p>
                  <p className="mt-1 text-xs leading-6 text-[color:var(--muted)]">
                    {trimText(item.previewText, 120)}
                  </p>
                  {item.sections.length ? (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[11px] text-[color:var(--muted-foreground)]">
                        {english ? "View details" : "查看详情"}
                      </summary>
                      <div className="mt-2 space-y-2">
                        {item.sections.map((section, index) => (
                          <div
                            key={`${item.reportId}-opportunity-section-${index}`}
                            className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-2"
                          >
                            <p className="text-[11px] font-medium text-[color:var(--foreground)]">
                              {section.key ?? (english ? "Section" : "分段")}
                            </p>
                            <pre className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-[color:var(--muted)]">
                              {section.value}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              ))}
          </div>
        ) : null}
        <div className="grid gap-2 text-xs text-[color:var(--muted-foreground)]">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-3.5 w-3.5" />
            <span>
              {english ? "Due" : "截止"}：{dateLabel(opportunity.dueDate)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>
              {english ? "Updated" : "最后更新"}：
              {relativeLabel(opportunity.updatedAt)}
            </span>
          </div>
        </div>
        <div className="theme-surface-panel flex items-center justify-between gap-3 rounded-2xl px-3 py-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback
                name={
                  opportunity.owner?.name ?? (english ? "Unassigned" : "待分配")
                }
              />
            </Avatar>
            <div>
              <p className="text-xs font-medium text-[color:var(--foreground)]">
                {opportunity.owner?.name ?? (english ? "Unassigned" : "未分配")}
              </p>
              <p className="text-[11px] text-[color:var(--muted-foreground)]">
                {opportunity.contacts[0]?.name ??
                  (english ? "No linked contact" : "未关联联系人")}
              </p>
            </div>
          </div>
          <UserRound className="h-4 w-4 text-[color:var(--muted-foreground)]" />
	        </div>
	        <div className="grid gap-2">
	          <Button asChild size="sm" variant="secondary">
	            <Link
	              href={buildOpportunityAssetHref(
	                opportunity.id,
	                "opportunity-card",
	              )}
	            >
	              {english ? "Open asset" : "经营资产"}
	              <ArrowRight className="h-4 w-4" />
	            </Link>
	          </Button>
	          <Button size="sm" variant="ghost" onClick={onOpen}>
	            {english ? "Open details" : "查看详情"}
	          </Button>
          <Button size="sm" variant="ghost" onClick={onGenerateDraft}>
            <Sparkles className="h-4 w-4" />
            {english ? "Generate follow-up draft" : "生成跟进草稿"}
          </Button>
          {opportunity.dingtalkSignalSummary?.totalSignals ? (
            <Button size="sm" variant="ghost" onClick={onConvertDingTalkSignal}>
              {english ? "Convert DingTalk signal" : "转换钉钉信号"}
            </Button>
          ) : null}
          <Select
            defaultValue={opportunity.owner?.id ?? memberships[0]?.user.id}
            onValueChange={(value) => onAssignOwner(opportunity.id, value)}
          >
            <SelectTrigger
              aria-label={
                english
                  ? `Assign owner for ${opportunity.title}`
                  : `指派负责人：${displayText(opportunity.title)}`
              }
              className="h-9 text-xs"
            >
              <SelectValue
                placeholder={english ? "Assign owner" : "指派负责人"}
              />
            </SelectTrigger>
            <SelectContent>
              {memberships.map((membership) => (
                <SelectItem key={membership.user.id} value={membership.user.id}>
                  {membership.user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function FieldSelect({
  label,
  value,
  options,
  onChange,
  dark = false,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
  dark?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label
        className={cn(
          "text-sm font-medium",
          dark ? "text-[color:var(--dark-inset-foreground)]" : "text-[color:var(--foreground)]",
        )}
      >
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function BriefLine({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="theme-detail-shell-tile rounded-[20px] px-4 py-4">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-base font-medium leading-7 text-[color:var(--foreground)] dark:text-white">
        {value}
      </p>
      {note ? (
        <p className="mt-2 text-sm leading-7 text-[color:var(--muted)] dark:text-[color:var(--muted-foreground)]">
          {note}
        </p>
      ) : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="border-b border-[color:color-mix(in_oklab,var(--border-strong)_72%,transparent)] pb-3 last:border-b-0 last:pb-0">
      <dt className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </dt>
      <dd className="mt-2 text-base font-medium text-[color:var(--foreground)] dark:text-white">
        {value}
      </dd>
      {note ? (
        <dd className="mt-1 text-sm leading-7 text-[color:var(--muted)] dark:text-[color:var(--muted-foreground)]">
          {note}
        </dd>
      ) : null}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  detail,
  tone,
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  detail: string;
  tone: "warning" | "danger" | "info" | "approval";
  active?: boolean;
  onClick?: () => void;
}) {
  const accentClasses =
    tone === "danger"
      ? "border-[color:var(--status-danger-border)] before:bg-[color:var(--status-danger-bg)]0"
      : tone === "warning"
        ? "border-[color:var(--status-warning-border)] before:bg-[color:var(--status-warning-bg)]0"
        : tone === "approval"
          ? "border-[color:var(--status-info-border)] before:bg-[color:var(--accent)]"
          : "border-[color:var(--status-info-border)] before:bg-[color:var(--status-info-bg)]0";
  const dotClasses =
    tone === "danger"
      ? "bg-[color:var(--status-danger-bg)]0"
      : tone === "warning"
        ? "bg-[color:var(--status-warning-bg)]0"
        : tone === "approval"
          ? "bg-[color:var(--accent)]"
          : "bg-[color:var(--status-info-bg)]0";

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`workspace-accent-card relative rounded-[24px] px-4 py-4 text-left transition before:absolute before:inset-x-0 before:top-0 before:h-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#194650]/35 ${active ? "ring-2 ring-[#194650]/18 shadow-[0_22px_40px_-26px_rgba(25,70,80,0.45)]" : "hover:-translate-y-0.5 hover:shadow-[0_22px_40px_-26px_rgba(15,23,42,0.45)]"} ${accentClasses}`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dotClasses}`} />
        <p className="workspace-accent-card-label text-sm font-semibold tracking-[0.04em]">
          {label}
        </p>
      </div>
      <p className="workspace-accent-card-value mt-5 text-4xl font-semibold tracking-tight">
        {value}
      </p>
      <p className="workspace-accent-card-detail mt-3 text-base font-medium leading-7">
        {detail}
      </p>
    </button>
  );
}

function buildOpportunityDetailHref(
  opportunityId: string,
  anchorId: string = OPPORTUNITY_PAGE_ANCHORS.briefing,
) {
  return buildSectionHref(
    `/opportunities?opportunityId=${opportunityId}`,
    anchorId,
  );
}

function buildOpportunityMemoryHref(
  opportunityId: string,
  anchorId: string = MEMORY_PAGE_ANCHORS.timeline,
) {
  return buildSectionHref(
    `/memory?objectType=OPPORTUNITY&objectId=${opportunityId}`,
    anchorId,
  );
}

function hasEvidenceTarget<T>(value: T | null | undefined): value is T {
  return Boolean(value);
}

function buildOpportunityPayloadEvidenceGroups({
  opportunity,
  primaryRecommendation,
  english,
}: {
  opportunity: OpportunityItem;
  primaryRecommendation: RecommendationCard | null;
  english: boolean;
}) {
  const evidenceText = (value: string) =>
    formatOpportunityDisplayText(value, english);
  const dateLabel = (value: Date | string | null | undefined) =>
    formatOpportunityDateLabel(value, english, formatDateLabel);
  const briefingSummary =
    typeof opportunity.briefingSnapshot?.payload.summary === "string"
      ? opportunity.briefingSnapshot.payload.summary
      : null;
  const recommendedNextSteps = Array.isArray(
    opportunity.briefingSnapshot?.payload.recommendedNextSteps,
  )
    ? opportunity.briefingSnapshot?.payload.recommendedNextSteps.filter(
        (item): item is string => typeof item === "string",
      )
    : [];

  return createEvidencePayloadGroups({
    english,
    replayItems: [
      {
        itemId: `${opportunity.id}-replay-stage`,
        label: english ? "Open opportunity replay" : "查看机会回放",
        href: buildOpportunityDetailHref(
          opportunity.id,
          OPPORTUNITY_PAGE_ANCHORS.briefing,
        ),
        summary: english
          ? `Current stage: ${opportunity.stage}, with priority ${opportunity.priorityScore} and ${opportunity.actionItems.length} recent action records still attached.`
          : `当前阶段：${opportunity.stage}，优先级 ${opportunity.priorityScore}，并且还挂着 ${opportunity.actionItems.length} 条最近动作记录。`,
      },
      opportunity.nextAction
        ? {
            itemId: `${opportunity.id}-replay-next-action`,
            label: english ? "Open current next step" : "查看当前下一步",
            href: buildOpportunityDetailHref(
              opportunity.id,
              OPPORTUNITY_PAGE_ANCHORS.actionWorkspace,
            ),
            summary: english
              ? `Current next step on the board: ${trimText(opportunity.nextAction, 96)}`
              : `面板当前下一步：${trimText(evidenceText(opportunity.nextAction), 96)}`,
          }
        : undefined,
      opportunity.dueDate
        ? {
            itemId: `${opportunity.id}-replay-due-date`,
            label: english ? "Open active due window" : "查看当前时间窗口",
            href: buildOpportunityDetailHref(
              opportunity.id,
              OPPORTUNITY_PAGE_ANCHORS.actionWorkspace,
            ),
            summary: english
              ? `Active due window: ${dateLabel(opportunity.dueDate)}`
              : `当前时间窗口：${dateLabel(opportunity.dueDate)}`,
          }
        : undefined,
    ].filter(hasEvidenceTarget),
    auditItems: [
      opportunity.auditLogs[0]
        ? {
            itemId: `${opportunity.id}-audit-latest`,
            label: english ? "Open latest audit event" : "查看最新审计事件",
            href: buildOpportunityMemoryHref(
              opportunity.id,
              buildMemoryItemAnchor("audit", opportunity.auditLogs[0].id),
            ),
            summary: english
              ? `${opportunity.auditLogs.length} audit records are already attached; latest event: ${trimText(opportunity.auditLogs[0].summary, 92)}`
              : evidenceText(
                  `当前已经挂上 ${opportunity.auditLogs.length} 条审计记录；最新一条是：${trimText(opportunity.auditLogs[0].summary, 92)}`,
                ),
          }
        : undefined,
      opportunity.auditLogs[1]
        ? {
            itemId: `${opportunity.id}-audit-previous`,
            label: english ? "Open prior audit event" : "查看前一条审计事件",
            href: buildOpportunityMemoryHref(
              opportunity.id,
              buildMemoryItemAnchor("audit", opportunity.auditLogs[1].id),
            ),
            summary: english
              ? `Recent prior event: ${trimText(opportunity.auditLogs[1].summary, 92)}`
              : evidenceText(
                  `前一条执行痕迹：${trimText(opportunity.auditLogs[1].summary, 92)}`,
                ),
          }
        : undefined,
      opportunity.auditLogs[0]?.sourcePage
        ? {
            itemId: `${opportunity.id}-audit-source-page`,
            label: english ? "Open audit source page" : "查看审计来源页面",
            href: opportunity.auditLogs[0].sourcePage,
            summary: english
              ? `Latest audit was written from ${opportunity.auditLogs[0].sourcePage}.`
              : `最近一条审计来自 ${opportunity.auditLogs[0].sourcePage}。`,
          }
        : undefined,
    ].filter(hasEvidenceTarget),
    memoryItems: [
      opportunity.memoryFacts[0]
        ? {
            itemId: `${opportunity.id}-memory-facts`,
            label: english
              ? "Open opportunity memory facts"
              : "查看机会记忆事实",
            href: buildOpportunityMemoryHref(
              opportunity.id,
              buildMemoryItemAnchor("fact", opportunity.memoryFacts[0].id),
            ),
            summary: english
              ? `${opportunity.memoryFacts.length} memory facts are live on this opportunity; lead fact: ${trimText(opportunity.memoryFacts[0].content, 88)}`
              : `当前机会还挂着 ${opportunity.memoryFacts.length} 条记忆事实；最靠前一条是：${trimText(opportunity.memoryFacts[0].content, 88)}`,
          }
        : undefined,
      opportunity.blockers[0]
        ? {
            itemId: `${opportunity.id}-memory-blockers`,
            label: english ? "Open blocker memory" : "查看阻塞记忆",
            href: buildOpportunityMemoryHref(
              opportunity.id,
              buildMemoryItemAnchor("blocker", opportunity.blockers[0].id),
            ),
            summary: english
              ? `${opportunity.blockers.length} blockers remain visible; top blocker: ${trimText(opportunity.blockers[0].blockerText, 88)}`
              : `当前仍可见 ${opportunity.blockers.length} 条阻塞；最上面一条是：${trimText(opportunity.blockers[0].blockerText, 88)}`,
          }
        : undefined,
      opportunity.commitments[0]
        ? {
            itemId: `${opportunity.id}-memory-commitments`,
            label: english ? "Open commitment memory" : "查看承诺记忆",
            href: buildOpportunityMemoryHref(
              opportunity.id,
              buildMemoryItemAnchor(
                "commitment",
                opportunity.commitments[0].id,
              ),
            ),
            summary: english
              ? `${opportunity.commitments.length} commitments are still in play; nearest one: ${trimText(opportunity.commitments[0].commitmentText, 88)}`
              : `当前仍在生效的承诺有 ${opportunity.commitments.length} 条；最近一条是：${trimText(opportunity.commitments[0].commitmentText, 88)}`,
          }
        : undefined,
    ].filter(hasEvidenceTarget),
    handoffItems: [
      briefingSummary
        ? {
            itemId: `${opportunity.id}-handoff-briefing`,
            label: english ? "Open briefing handoff" : "查看简报交接",
            href: buildOpportunityDetailHref(
              opportunity.id,
              OPPORTUNITY_PAGE_ANCHORS.memorySummary,
            ),
            summary: english
              ? `Briefing snapshot summary: ${trimText(briefingSummary, 96)}`
              : `Briefing snapshot 摘要：${trimText(briefingSummary, 96)}`,
          }
        : undefined,
      recommendedNextSteps[0]
        ? {
            itemId: `${opportunity.id}-handoff-next-step`,
            label: english ? "Open handoff next step" : "查看交接下一步",
            href: buildOpportunityDetailHref(
              opportunity.id,
              buildOpportunityItemAnchor("briefing-step", 0),
            ),
            summary: english
              ? `Recommended next step from handoff payload: ${trimText(recommendedNextSteps[0], 96)}`
              : `交接载荷里的推荐下一步：${trimText(recommendedNextSteps[0], 96)}`,
          }
        : undefined,
      primaryRecommendation
        ? {
            itemId: `${opportunity.id}-handoff-live-recommendation`,
            label: english
              ? "Open live recommendation handoff"
              : "查看当前判断建议交接",
            href: buildOpportunityDetailHref(
              opportunity.id,
              buildOpportunityItemAnchor(
                "recommendation",
                primaryRecommendation.recommendationId,
              ),
            ),
            summary: english
              ? `Live recommendation currently in view: ${trimText(primaryRecommendation.title, 96)}`
              : `当前页面正在引用的判断建议：${trimText(primaryRecommendation.title, 96)}`,
          }
        : undefined,
    ].filter(hasEvidenceTarget),
  });
}

function createDraftFromOpportunity(
  opportunity?: OpportunityItem,
  fallbackOwnerId?: string,
): DetailDraft {
  return {
    id: opportunity?.id,
    title: opportunity?.title ?? "",
    type: opportunity?.type ?? "CLIENT",
    stage: opportunity?.stage ?? "NEW",
    riskLevel: opportunity?.riskLevel ?? "MEDIUM",
    nextAction: opportunity?.nextAction ?? "",
    dueDate: toDateTimeLocalInput(opportunity?.dueDate),
    companyId: opportunity?.company?.id ?? "",
    ownerId: opportunity?.owner?.id ?? fallbackOwnerId ?? "",
    lossReason: opportunity?.lossReason ?? "",
  };
}

function getPriorityLabel(priorityScore: number) {
  if (priorityScore >= 85) return "P1";
  if (priorityScore >= 70) return "P2";
  return "P3";
}

function formatAttachmentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function describeCommitmentSource(sourceType: string, english = false) {
  if (sourceType === "MEETING_NOTE")
    return english ? "Meeting note" : "会议纪要";
  if (sourceType === "ACTION_ITEM")
    return english ? "Post-meeting action" : "会后动作";
  if (sourceType === "EMAIL_THREAD")
    return english ? "Email thread" : "邮件线程";
  return english ? "System extraction" : "系统提取";
}

const riskOrder = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};
