"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  BellRing,
  CircleOff,
  Play,
  FilePenLine,
  Mail,
  RotateCcw,
  ShieldAlert,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { RecommendationJudgementCard } from "@/components/recommendations/recommendation-judgement-card";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { BlockerCard } from "@/components/shared/blocker-card";
import { CommitmentCard } from "@/components/shared/commitment-card";
import { CustomerAssetFocusStrip } from "@/components/shared/customer-asset-focus-strip";
import { EmptyState } from "@/components/shared/empty-state";
import { FirstLoopSurfaceSummary } from "@/components/shared/first-loop-surface-summary";
import {
  HomeSurfaceArrivalBanner,
  useHomeSurfaceArrival,
} from "@/components/shared/home-surface-arrival-banner";
import { PageHeader } from "@/components/shared/page-header";
import { ProactiveMechanismPanel } from "@/components/shared/proactive-mechanism-panel";
import { ReportingProtocolPanel } from "@/components/shared/reporting-protocol-panel";
import { RiskBadge } from "@/components/shared/risk-badge";
import { ApprovalBadge } from "@/components/shared/status-badges";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { actionTypeLabels } from "@/data/constants";
import type { BiBoardContribution } from "@/lib/extensions/registry";
import { useConsoleStore } from "@/hooks/use-console-store";
import type {
  BiReportHandoffExecutionLogRecord,
} from "@/lib/bi-report-skill/types";
import {
  getLocalizedActionTypeChannelLabels,
  getLocalizedActionTypeLabels,
  getLocalizedMemorySourceLabels,
} from "@/lib/i18n/labels";
import {
  createActiveReportProtocol,
  createProactiveCollaborationProtocol,
  createProactiveFlow,
} from "@/lib/presentation/proactive-mechanism";
import { buildBusinessLoopGapReadout } from "@/lib/presentation/business-loop-gap-readout";
import {
  APPROVAL_PAGE_ANCHORS,
  MEMORY_PAGE_ANCHORS,
  buildApprovalItemAnchor,
  buildMemoryItemAnchor,
  buildSectionHref,
  scrollToWindowHashTarget,
} from "@/lib/presentation/page-section-anchors";
import { createPageReportingProtocol } from "@/lib/presentation/reporting-protocol";
import { getWorkspaceStory } from "@/lib/presentation/workspace-story";
import {
  formatDateLabel,
  formatRelative,
  safeParseJson,
  trimText,
} from "@/lib/utils";
import {
  buildApprovalBoundaryModel,
  buildMeetingMemoryBundle,
  buildMeetingMemoryGovernanceSummary,
  buildMeetingMemoryLoopSummary,
  buildApprovalTaskReasonChain,
  type BusinessLoopGapSummary,
  type WorkspaceFirstLoopModel,
  getOperatingSkillById,
} from "@/lib/operating-system";
import {
  createEvidencePayloadGroups,
  createWorkerSkillResourcePageSupport,
} from "@/lib/worker-skill-resource/presentation";
import {
  approveTaskAction,
  blockApprovedTaskAction,
  convertTaskToManualAction,
  executeApprovedTaskAction,
  enableAutoExecutionForTaskTypeAction,
  rejectTaskAction,
} from "@/features/approvals/actions";
import { getApprovalDraftEditCopy } from "@/features/approvals/approval-draft-display";
import { buildApprovalFirstLoopDisplayModel } from "@/features/approvals/approval-first-loop-display";
import {
  formatApprovalLearningDisplayText,
  formatApprovalPolicyModeForReview,
} from "@/features/approvals/approval-learning-display";
import { resolveApprovalObjectDetailHref } from "@/features/approvals/approval-object-detail-link";

type ApprovalsClientProps = {
  actionGovernance: {
    canReview: boolean;
    canChangePolicy: boolean;
    reviewDeniedMessage: string;
    policyDeniedMessage: string;
  };
  tasks: Array<{
    id: string;
    status: "PENDING" | "EXECUTED" | "REJECTED" | "WITHDRAWN";
    channel: string | null;
    isHighRisk: boolean;
    autoExecute: boolean;
    contextSnapshot: string | null;
    reasoning: string | null;
    editableContent: string | null;
    resultPreview: string | null;
    createdAt: Date;
    updatedAt: Date;
    reviewedAt: Date | null;
    reviewedBy: { name: string } | null;
    biSource: {
      decisionId: string | null;
      signalId: string | null;
      signalKey: string | null;
      skillKey: string | null;
      skillLabel: string;
      handoffTargetType: string | null;
      detailHref: string;
    } | null;
    dingtalkSource: {
      scope: string | null;
      sourceId: string | null;
      sourceType: string | null;
    } | null;
    actionItem: {
      id: string;
      status: string;
      executionStatus: string | null;
      statusReason: string | null;
      title: string;
      actionType: keyof typeof actionTypeLabels;
      description: string | null;
      riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      suggestedExecutionAt: Date | null;
      executionMode: string;
      recommendationLog: {
        id: string;
        title: string;
        score: number;
        explanation: string;
        policyResult: string;
        supportingFactIds: string | null;
        blockerIds: string | null;
        commitmentIds: string | null;
        recommendationPayload: string | null;
      } | null;
      opportunity: {
        id: string;
        title: string;
        company: { id: string; name: string } | null;
      } | null;
      contact: { id: string; name: string } | null;
      meeting: { id: string; title: string } | null;
    };
    recommendationFacts: Array<{
      id: string;
      title: string;
      content: string;
      confidence: number;
      updatedAt: Date;
    }>;
    recommendationBlockers: Array<{
      id: string;
      title: string;
      blockerText: string;
      blockerType: string;
      severity: number;
      status: string;
      firstSeenAt: Date;
      updatedAt: Date;
      relatedContact: { id: string; name: string } | null;
      relatedCompany: { id: string; name: string } | null;
      relatedOpportunity: { id: string; title: string } | null;
      relatedMeeting: { id: string; title: string } | null;
    }>;
    recommendationCommitments: Array<{
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
  }>;
  learningPanels: Record<
    string,
    {
      actionType: keyof typeof actionTypeLabels;
      actionLabel: string;
      policy: {
        id: string;
        name: string;
        mode: string;
        riskThreshold: string;
        enabled: boolean;
        modeLabel: string;
        riskLabel: string;
      } | null;
      feedbackStats: {
        total: number;
        approved: number;
        editedApproved: number;
        rejected: number;
        autoExecuted: number;
      };
      learnedPatterns: Array<{
        id: string;
        title: string;
        summary: string;
        confidence: number;
        evidenceCount: number;
      }>;
      signalHints: Array<{
        id: string;
        summary: string;
        weight: number;
        updatedAt: Date;
      }>;
      openSuggestions: Array<{
        id: string;
        title: string;
        reason: string;
        currentValue: string | null;
        suggestedValue: string | null;
        confidence: number;
        createdAt: Date;
      }>;
      acceptedSuggestions: Array<{
        id: string;
        title: string;
        appliedEffectSummary: string | null;
        confirmedAt: Date | null;
        appliedAt: Date | null;
      }>;
      summaryLines: string[];
    }
  >;
  businessLoopGapSummary: BusinessLoopGapSummary;
  firstLoopModel: WorkspaceFirstLoopModel;
  /**
   * Optional BI signal board card from `lib/extensions/registry.tsx`.
   * Null when no enabled extension contributes one. The card is rendered
   * only when this is non-null.
   */
  biBoardContribution: BiBoardContribution | null;
  initialApprovalId: string | null;
  initialEvidencePanelOpen: boolean;
};

type _ApprovalSummaryConnection = {
  label: string;
  value: string;
  description: string;
  href: string;
};
type HandoffExecutionComposerState = {
  planSummary: string;
  planExpectedOutcome: string;
  planRiskNotes: string;
  resultSummary: string;
  resultOutcome: string;
  resultFollowUpNotes: string;
  resultEffective: boolean;
  resultFollowUpNeeded: boolean;
};

type BiBoardAccessState = "checking" | "available" | "unavailable";

function isExpectedBiBoardUnavailableStatus(status: number) {
  return status === 403 || status === 404;
}

function formatApprovalQueueStatus(status: ApprovalsClientProps["tasks"][number]["status"], english: boolean) {
  switch (status) {
    case "PENDING":
      return english ? "Pending review" : "待复核";
    case "EXECUTED":
      return english ? "Executed" : "已执行";
    case "REJECTED":
      return english ? "Rejected" : "已拒绝";
    case "WITHDRAWN":
      return english ? "Withdrawn" : "已撤回";
    default:
      return status;
  }
}

function formatRecommendationPolicyResult(value: string, english: boolean) {
  switch (value) {
    case "AUTO_WITHIN_THRESHOLD":
      return english ? "Within reviewed threshold" : "已复核阈值内";
    case "REVIEW_REQUIRED":
      return english ? "Review required" : "需要复核";
    case "BLOCKED":
      return english ? "Blocked" : "已阻断";
    default:
      return value.replace(/_/g, " ").toLowerCase();
  }
}

export function ApprovalsClient({
  actionGovernance,
  tasks,
  learningPanels,
  businessLoopGapSummary,
  firstLoopModel,
  biBoardContribution,
  initialApprovalId,
  initialEvidencePanelOpen,
}: ApprovalsClientProps) {
  const approvalHomeArrival = useHomeSurfaceArrival("approvals");
  const router = useRouter();
  const pathname = usePathname();
  const { locale, demoMode } = useWorkspaceUi();
  const english = locale === "en-US";
  const approvalText = (text: string) =>
    formatApprovalLearningDisplayText(text, english);
  const approvalTitle = (text: string | null | undefined) =>
    approvalText(text ?? "");
  const approvalOptionalTitle = (text: string | null | undefined) =>
    text ? approvalText(text) : undefined;
  const formatContextSnapshot = (raw: string | null | undefined) => {
    const trimmed = raw?.trim();
    if (!trimmed) {
      return english ? "No context yet" : "暂无上下文";
    }

    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const source = typeof parsed.source === "string" ? parsed.source : null;
      if (source === "bi_signal_closure_kernel") {
        const signalId = typeof parsed.signalId === "string" ? parsed.signalId : null;
        const signalKey = typeof parsed.signalKey === "string" ? parsed.signalKey : null;
        const severity = typeof parsed.severity === "string" ? parsed.severity : null;
        const lines = english
          ? [
              "BI signal context (closure kernel)",
              signalKey ? `- signalKey: ${signalKey}` : null,
              severity ? `- severity: ${severity}` : null,
              signalId ? `- signalId: ${signalId}` : null,
            ]
          : [
              "BI 信号上下文（closure kernel）",
              signalKey ? `- 信号 key：${signalKey}` : null,
              severity ? `- 风险等级：${severity}` : null,
              signalId ? `- 信号 id：${signalId}` : null,
            ];
        return lines.filter(Boolean).join("\n");
      }
    } catch {
      // ignore and fall back
    }

    return trimmed;
  };
  const pageStory = getWorkspaceStory("approvals", locale, demoMode);
  const actionLabels = getLocalizedActionTypeLabels(locale);
  const actionChannelLabels = getLocalizedActionTypeChannelLabels(locale);
  const memorySourceLabels = getLocalizedMemorySourceLabels(locale);
  const [pending, startTransition] = useTransition();
  const { selectedApprovalId, setSelectedApprovalId } = useConsoleStore();
  const [activeView, setActiveView] = useState<"pending" | "history">(
    "pending",
  );
  const [activeFilter, setActiveFilter] =
    useState<(typeof filterOptions)[number]["key"]>("all");
  const [search, setSearch] = useState("");
  const [actionTypeFilter, setActionTypeFilter] = useState<
    "all" | keyof typeof actionTypeLabels
  >("all");
  const [automationFilter, setAutomationFilter] = useState<
    "all" | "auto" | "manual"
  >("all");
  const [draft, setDraft] = useState<string | null>(null);
  const [previewApprovalId, setPreviewApprovalId] = useState<string | null>(
    null,
  );
  const [decisionSupportOpen, setDecisionSupportOpen] = useState(
    initialEvidencePanelOpen,
  );
  const [handoffExecutionLogs, setHandoffExecutionLogs] = useState<
    BiReportHandoffExecutionLogRecord[]
  >([]);
  const [handoffExecutionLogsLoading, setHandoffExecutionLogsLoading] =
    useState(false);
  const [biBoardAccessState, setBiBoardAccessState] =
    useState<BiBoardAccessState>(biBoardContribution ? "checking" : "unavailable");
  const [handoffExecutionComposer, setHandoffExecutionComposer] =
    useState<HandoffExecutionComposerState>({
      planSummary: "",
      planExpectedOutcome: "",
      planRiskNotes: "",
      resultSummary: "",
      resultOutcome: "",
      resultFollowUpNotes: "",
      resultEffective: true,
      resultFollowUpNeeded: false,
    });
  const filterOptions = [
    { key: "all", label: english ? "All" : "全部" },
    { key: "PENDING", label: english ? "Pending" : "待复核" },
    { key: "EXECUTED", label: english ? "Executed" : "已执行" },
    { key: "REJECTED", label: english ? "Rejected" : "已拒绝" },
    { key: "WITHDRAWN", label: english ? "Withdrawn" : "已撤回" },
    { key: "external", label: actionChannelLabels.DRAFT_EXTERNAL_EMAIL },
    { key: "internal", label: english ? "Internal actions" : "内部动作" },
    { key: "highRisk", label: english ? "High-risk actions" : "高风险动作" },
  ] as const;
  const selected = tasks.find((task) => task.id === selectedApprovalId) ?? null;
  const previewed =
    tasks.find(
      (task) => task.id === (previewApprovalId ?? selectedApprovalId),
    ) ?? null;
  const approvalFirstLoopDisplayModel = useMemo(
    () => buildApprovalFirstLoopDisplayModel(firstLoopModel, english),
    [english, firstLoopModel],
  );
  const isAwaitingExecutionTask = (
    task: ApprovalsClientProps["tasks"][number],
  ) => task.status === "EXECUTED" && task.actionItem.status === "APPROVED";

  const pendingTasks = tasks.filter(
    (task) => task.status === "PENDING" || isAwaitingExecutionTask(task),
  );
  const historyTasks = tasks.filter(
    (task) => task.status !== "PENDING" && !isAwaitingExecutionTask(task),
  );
  const previewedTargetLabel =
    previewed?.actionItem.contact?.name ??
    approvalOptionalTitle(previewed?.actionItem.opportunity?.title) ??
    approvalOptionalTitle(previewed?.actionItem.meeting?.title) ??
    (english ? "Current object" : "当前对象");
  const previewedTargetHref = previewed
    ? resolveApprovalObjectDetailHref({
        contact: previewed.actionItem.contact,
        opportunity: previewed.actionItem.opportunity,
        meeting: previewed.actionItem.meeting,
        biSource: previewed.biSource,
      })
    : null;
  const selectedApprovalHashTargetId = selected?.id ?? null;
  const selectedActionType = selected?.actionItem.actionType ?? null;
  const previewedActionType = previewed?.actionItem.actionType ?? null;
  const recentSimilarActions =
    selectedApprovalHashTargetId && selectedActionType
      ? tasks
          .filter(
            (task) =>
              task.id !== selectedApprovalHashTargetId &&
              task.actionItem.actionType === selectedActionType &&
              task.status !== "PENDING",
          )
          .slice(0, 3)
      : [];
  const selectedLearningPanel = selectedActionType
    ? (learningPanels[selectedActionType] ?? null)
    : null;
  const previewedLearningPanel = previewedActionType
    ? (learningPanels[previewedActionType] ?? null)
    : null;
  const canReviewGovernedActions = actionGovernance.canReview;
  const canChangeActionPolicy = actionGovernance.canChangePolicy;
  const selectedActionAwaitingExecution =
    selected?.status === "EXECUTED" &&
    selected.actionItem.status === "APPROVED";
  const selectedActionExecuted = selected?.actionItem.status === "EXECUTED";
  const selectedActionBlocked = selected?.actionItem.status === "BLOCKED";
  const selectedBiSignalId = selected?.biSource?.signalId ?? null;
  const selectedBiDecisionId = selected?.biSource?.decisionId ?? null;
  const selectedBiLatestPlan =
    handoffExecutionLogs.find((log) => log.stage === "plan") ?? null;
  const selectedBiLatestResult =
    handoffExecutionLogs.find((log) => log.stage === "result") ?? null;

  useEffect(() => {
    let active = true;

    if (!biBoardContribution) {
      setBiBoardAccessState("unavailable");
      return;
    }

    setBiBoardAccessState("checking");

    async function checkBiBoardAccess() {
      if (!biBoardContribution) {
        return;
      }

      try {
        const response = await fetch(biBoardContribution.previewApiUrl, {
          credentials: "same-origin",
        });

        if (isExpectedBiBoardUnavailableStatus(response.status)) {
          if (active) {
            setBiBoardAccessState("unavailable");
          }
          return;
        }

        if (!response.ok) {
          if (active) {
            setBiBoardAccessState("unavailable");
          }
          return;
        }

        const payload = (await response.json().catch(() => null)) as
          | { available?: boolean }
          | null;
        if (!active) return;
        if (payload && payload.available === false) {
          setBiBoardAccessState("unavailable");
          return;
        }

        setBiBoardAccessState("available");
      } catch {
        if (active) {
          setBiBoardAccessState("unavailable");
        }
      }
    }

    void checkBiBoardAccess();

    return () => {
      active = false;
    };
  }, [biBoardContribution]);

  useEffect(() => {
    if (!initialApprovalId) {
      return;
    }

    const target = tasks.find((task) => task.id === initialApprovalId);
    if (!target) {
      return;
    }

    setSelectedApprovalId(target.id);
    setPreviewApprovalId(target.id);
    setDraft(target.editableContent ?? "");
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("approvalId", target.id);
      const query = params.toString();
      const nextUrl = buildSectionHref(
        query ? `${pathname}?${query}` : pathname,
        APPROVAL_PAGE_ANCHORS.preview,
      );
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [initialApprovalId, pathname, setSelectedApprovalId, tasks]);

  useEffect(() => {
    if (!selectedApprovalHashTargetId) {
      return;
    }

    const recentOutcomeAnchors =
      selectedApprovalHashTargetId && selectedActionType
        ? tasks
            .filter(
              (task) =>
                task.id !== selectedApprovalHashTargetId &&
                task.actionItem.actionType === selectedActionType &&
                task.status !== "PENDING",
            )
            .slice(0, 3)
            .map((task) => buildApprovalItemAnchor("outcome", task.id))
        : [];
    const selectedApprovalHashTargets = selected
      ? [
          ...Object.values(APPROVAL_PAGE_ANCHORS),
          ...selected.recommendationBlockers
            .slice(0, 2)
            .map((item) => buildApprovalItemAnchor("blocker", item.id)),
          ...selected.recommendationCommitments
            .slice(0, 2)
            .map((item) => buildApprovalItemAnchor("commitment", item.id)),
          ...selected.recommendationFacts
            .slice(0, 3)
            .map((item) => buildApprovalItemAnchor("fact", item.id)),
          ...recentOutcomeAnchors,
        ]
      : Object.values(APPROVAL_PAGE_ANCHORS);

    scrollToWindowHashTarget(selectedApprovalHashTargets);
  }, [selected, selectedActionType, selectedApprovalHashTargetId, tasks]);

  useEffect(() => {
    let active = true;

    if (!selectedBiSignalId || !selectedBiDecisionId || !biBoardContribution) {
      setHandoffExecutionLogs([]);
      setHandoffExecutionComposer({
        planSummary: "",
        planExpectedOutcome: "",
        planRiskNotes: "",
        resultSummary: "",
        resultOutcome: "",
        resultFollowUpNotes: "",
        resultEffective: true,
        resultFollowUpNeeded: false,
      });
      return;
    }

    const handoffExecutionLogsApiUrl = biBoardContribution.handoffExecutionLogsApiUrl;

    async function loadHandoffExecutionLogs() {
      const signalId = selectedBiSignalId;
      if (!signalId) {
        return;
      }
      setHandoffExecutionLogsLoading(true);
      try {
        const response = await fetch(
          `${handoffExecutionLogsApiUrl}?signalId=${encodeURIComponent(signalId)}`,
          { credentials: "same-origin" },
        );

        if (!response.ok) {
          throw new Error(
            `handoff execution logs request failed with status ${response.status}`,
          );
        }

        const payload =
          (await response.json()) as BiReportHandoffExecutionLogRecord[];
        if (!active) return;
        setHandoffExecutionLogs(payload);
      } catch {
        if (!active) return;
        setHandoffExecutionLogs([]);
      } finally {
        if (active) {
          setHandoffExecutionLogsLoading(false);
        }
      }
    }

    void loadHandoffExecutionLogs();

    return () => {
      active = false;
    };
  }, [biBoardContribution, selectedBiDecisionId, selectedBiSignalId]);

  const openApprovalDrawer = useCallback(
    (approval: ApprovalsClientProps["tasks"][number]) => {
      setPreviewApprovalId(approval.id);
      setSelectedApprovalId(approval.id);
      setDraft(approval.editableContent ?? "");
      setDecisionSupportOpen(false);
      window.history.replaceState(
        window.history.state,
        "",
        buildApprovalDrawerHref(approval.id),
      );
    },
    [setSelectedApprovalId],
  );

  const closeSelectedApproval = useCallback(() => {
    if (selectedApprovalId) {
      setPreviewApprovalId(selectedApprovalId);
    }
    setSelectedApprovalId(null);
    setDraft(null);

    const params = new URLSearchParams(window.location.search);
    params.delete("approvalId");
    params.delete("evidenceOpen");
    const query = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      query ? `${pathname}?${query}` : pathname,
    );
  }, [pathname, selectedApprovalId, setSelectedApprovalId]);

  const visibleList = activeView === "pending" ? pendingTasks : historyTasks;
  const filtered = useMemo(() => {
    return visibleList.filter((task) => {
      const matchesSearch =
        !search ||
        task.actionItem.title.toLowerCase().includes(search.toLowerCase()) ||
        task.reasoning?.toLowerCase().includes(search.toLowerCase()) ||
        task.actionItem.contact?.name
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        task.actionItem.opportunity?.title
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesFilter =
        activeFilter === "all"
          ? true
          : activeFilter === "PENDING"
            ? task.status === "PENDING" || isAwaitingExecutionTask(task)
            : activeFilter === "external"
              ? task.channel === "外发动作" ||
                task.channel === "External action"
              : activeFilter === "internal"
                ? task.channel === "内部动作" ||
                  task.channel === "Internal action"
                : activeFilter === "highRisk"
                  ? task.isHighRisk
                  : activeFilter === "EXECUTED"
                    ? task.status === "EXECUTED"
                    : task.status === activeFilter;

      const matchesActionType =
        actionTypeFilter === "all" ||
        task.actionItem.actionType === actionTypeFilter;
      const matchesAutomation =
        automationFilter === "all"
          ? true
          : automationFilter === "auto"
            ? task.autoExecute
            : !task.autoExecute;

      return (
        matchesSearch && matchesFilter && matchesActionType && matchesAutomation
      );
    });
  }, [actionTypeFilter, activeFilter, automationFilter, search, visibleList]);

  const summary = {
    pending: pendingTasks.length,
    highRisk: tasks.filter(
      (task) =>
        task.isHighRisk &&
        (task.status === "PENDING" || isAwaitingExecutionTask(task)),
    ).length,
    executed: tasks.filter((task) => task.actionItem.status === "EXECUTED")
      .length,
    external: tasks.filter(
      (task) =>
        (task.channel === "外发动作" || task.channel === "External action") &&
        (task.status === "PENDING" || isAwaitingExecutionTask(task)),
    ).length,
  };
  const boundaryModel = useMemo(
    () => buildApprovalBoundaryModel(tasks, english),
    [english, tasks],
  );
  const meetingLinkedPendingTasks = pendingTasks.filter((task) =>
    Boolean(task.actionItem.meeting),
  );
  const meetingLinkedReviewItems = meetingLinkedPendingTasks.slice(0, 3);
  const meetingLinkedApprovalFocus =
    meetingLinkedPendingTasks.find(
      (task) =>
        task.isHighRisk ||
        task.channel === "外发动作" ||
        task.channel === "External action",
    ) ??
    meetingLinkedPendingTasks[0] ??
    null;
  const meetingLinkedBoundarySummary = meetingLinkedApprovalFocus
    ? english
      ? `First up: "${meetingLinkedApprovalFocus.actionItem.title}". Draft and evidence are ready — your call.`
      : `先看「${approvalTitle(meetingLinkedApprovalFocus.actionItem.title)}」。草稿和证据已就绪，等你拍板。`
    : english
      ? "No meeting-triggered reviews waiting."
      : "没有会议触发的复核在等。";
  const approvalEvidenceFocus =
    selected ??
    previewed ??
    pendingTasks.find((task) => task.isHighRisk) ??
    pendingTasks.find(
      (task) =>
        task.channel === "外发动作" || task.channel === "External action",
    ) ??
    pendingTasks[0] ??
    historyTasks[0] ??
    null;
  const approvalEvidenceHistory = approvalEvidenceFocus
    ? tasks
        .filter(
          (task) =>
            task.id !== approvalEvidenceFocus.id &&
            task.actionItem.actionType ===
              approvalEvidenceFocus.actionItem.actionType &&
            task.status !== "PENDING",
        )
        .slice(0, 3)
    : [];
  const approvalMemoryEvidenceHref = approvalEvidenceFocus
    ? buildApprovalMemoryHref(approvalEvidenceFocus)
    : buildSectionHref("/memory", MEMORY_PAGE_ANCHORS.timeline);
  const approvalEvidencePostureAction = {
    title: english
      ? "Check evidence before changing execution posture"
      : "调整执行姿态前先核验证据",
    href: approvalMemoryEvidenceHref,
  };
  const originalDraft = selected?.editableContent ?? "";
  const editableDraft = draft ?? originalDraft;
  const isDraftEdited = editableDraft !== originalDraft;
  const draftEditCopy = getApprovalDraftEditCopy({
    english,
    isEdited: isDraftEdited,
  });
  const approvalsBriefing = {
    label: english ? "AI approval brief" : "复核汇报",
    headline:
      activeView === "history"
        ? english
          ? `${summary.executed} approved actions are already shaping execution history`
          : `已有 ${summary.executed} 条已执行动作沉淀进执行历史`
        : summary.highRisk
          ? english
            ? `${summary.highRisk} high-risk actions are waiting for a human decision`
            : `当前有 ${summary.highRisk} 条高风险动作在等人工判断`
          : english
            ? `${summary.pending} actions are waiting for approval review`
            : `当前有 ${summary.pending} 条动作仍待复核`,
    summary:
      activeView === "history"
        ? english
          ? `Recent execution: ${summary.executed} approved, ${summary.highRisk} still flagged high-risk. Use the rows below to decide what's stable enough to streamline next.`
          : `最近执行：已通过 ${summary.executed} 条，仍标高风险 ${summary.highRisk} 条。下面的列表用来判断哪些已经稳定到可以收敛。`
        : english
          ? `${summary.pending} pending · ${summary.highRisk} high-risk · ${summary.external} external. Open the top item and decide.`
          : `当前待复核 ${summary.pending} 条 · 高风险 ${summary.highRisk} 条 · 对外 ${summary.external} 条。打开第一条，做判断。`,
    takeawaysLabel: english ? "What I see" : "我现在看到的情况",
    takeaways: [
      english
        ? `${summary.pending} actions are still waiting in the queue, and ${summary.highRisk} of them are risky enough to require explicit human judgement.`
        : `当前队列里还有 ${summary.pending} 条动作在等待处理，其中 ${summary.highRisk} 条已经高风险到必须明确人工判断。`,
      english
        ? `${summary.external} external-facing actions are still behind the boundary, which means trust-sensitive work is not fully closed yet.`
        : `当前仍有 ${summary.external} 条对外动作停在边界后面，说明信任敏感的工作还没有真正收口。`,
      english
        ? "Each row carries its reason chain. Open it before deciding approve / rewrite / hold."
        : "每一行都带理由链。打开它再决定通过 / 改写 / 继续拦住。",
    ],
    operatorLabel: english ? "Reason chain first" : "先看理由链",
    operatorPrompt:
      activeView === "history"
        ? english
          ? "Look at recent history. Which action types are stable enough to automate later?"
          : "看最近历史。哪些动作类型稳到可以后续自动化？"
        : summary.highRisk
          ? english
            ? `Read the ${summary.highRisk} high-risk reason chains first, then clear external actions.`
            : `先看 ${summary.highRisk} 条高风险动作的理由链，再清外发。`
          : english
            ? "Open the top item, read the reason, then approve / rewrite / hold."
            : "打开最上面的，读理由，然后通过 / 改写 / 拦住。",
    decisionsLabel: english ? "You decide" : "你现在要决定",
    decisions: [
      english
        ? "Which pending action is safe enough to let through right now."
        : "哪一条待复核动作现在已经足够安全，可以直接放行。",
      english
        ? "Which action should be rewritten instead of being approved as-is."
        : "哪一条动作需要改写，而不是按原样通过。",
      english
        ? "Which action types are mature enough to become future auto-handling candidates."
        : "哪些动作类型已经稳定到可以进入后续自动处理候选。",
    ],
  };
  const approvalsContractSupport = createWorkerSkillResourcePageSupport({
    pageId: "approvals",
    english,
    supplementalEvidenceGroups: approvalEvidenceFocus
      ? buildApprovalPayloadEvidenceGroups({
          approval: approvalEvidenceFocus,
          similarActions: approvalEvidenceHistory,
          english,
        })
      : [],
    supplementalEvidenceSummary: [
      english
        ? "Reason, source, preview, history — all visible before you decide."
        : "理由、来源、预览、历史——决定前都看得到。",
      english
        ? "Every decision lands an audit trail."
        : "每一次决定都留下审计。",
    ],
    supplementalLinks: [
      {
        label: english ? "Open memory timeline" : "打开记忆时间线",
        href: approvalMemoryEvidenceHref,
      },
      {
        label: english ? "Evidence focus" : "证据焦点",
        href: approvalEvidencePostureAction.href,
      },
      {
        label: english ? "Open weekly report" : "打开周报",
        href: "/reports",
      },
      {
        label: english ? "Open opportunity workspace" : "打开机会面板",
        href: "/opportunities",
      },
    ],
  });
  const approvalsProtocol = createPageReportingProtocol({
    pageJudgement: approvalsBriefing.headline,
    pageJudgementReason: approvalsBriefing.summary,
    pageWhyItMatters: approvalsBriefing.takeaways.slice(0, 3),
    pageActionSummary: [
      english
        ? "Actions are already ranked — no need to scan equally."
        : "动作已经排好——不必逐条扫。",
      english
        ? `${summary.pending} pending, ${summary.highRisk} need human review.`
        : `${summary.pending} 待处理，${summary.highRisk} 需要人工。`,
      english
        ? `${summary.external} external actions tied to audit and consequence.`
        : `${summary.external} 条外发动作，已挂上审计和后果。`,
    ],
    pageDecisionRequest: [
      english
        ? "Decide which action is safe enough to let through right now."
        : "决定哪一条动作现在已经足够安全，可以直接放行。",
      english
        ? "Decide which action should be rewritten or converted instead of approved as-is."
        : "决定哪一条动作需要改写或改成人工处理，而不是按原样通过。",
      english
        ? "Decide which action types are already mature enough for future auto-handling."
        : "决定哪些动作类型已经稳定到可以进入未来自动处理候选。",
    ],
    pageNextAction: [
      {
        label: english ? "Open review queue" : "打开复核队列",
        href: "#approval-queue",
      },
      {
        label: english ? "Open preview panel" : "打开预览面板",
        href: "#approval-preview",
        variant: "secondary",
      },
      {
        label: english ? "Open memory evidence" : "打开记忆依据",
        href: approvalMemoryEvidenceHref,
        variant: "ghost",
      },
    ],
    pageBoundarySummary: [
      english
        ? "External, high-risk, uncertain — they wait for you."
        : "对外、高风险、不确定的——都等你。",
      english
        ? "Suggestions stay suggestions until you let them through."
        : "你不放行，建议就只是建议。",
    ],
    pageEvidenceSummary: approvalsContractSupport.pageEvidenceSummary,
    pageWorkerSummary: approvalsContractSupport.pageWorkerSummary,
    pageWorkerAssignments: approvalsContractSupport.pageWorkerAssignments,
    pageEscalationHint:
      summary.highRisk > 0
        ? english
          ? "High-risk and external first. Then clean lower-risk."
          : "先处理高风险和外发。再清低风险。"
        : english
          ? "No obvious risk? Check history to plan future auto-handling."
          : "没有明显风险？看历史，规划后续自动化。",
    pagePrioritySignal:
      activeView === "history"
        ? english
          ? "Watch execution history — maturity matters more than queue volume."
          : "看执行历史——成熟度比队列量重要。"
        : english
          ? "Trust-boundary pressure: high-risk actions are waiting."
          : "信任边界压力：高风险动作在等。",
    pageEvidenceLinks: approvalsContractSupport.pageEvidenceLinks,
    pageEvidenceGroups: approvalsContractSupport.pageEvidenceGroups,
  });
  const approvalCandidate =
    pendingTasks.find((task) => task.isHighRisk) ??
    pendingTasks.find(
      (task) =>
        task.channel === "外发动作" || task.channel === "External action",
    ) ??
    pendingTasks[0] ??
    null;
  const approvalCandidateMemoryHref = approvalCandidate
    ? buildApprovalMemoryHref(approvalCandidate)
    : approvalMemoryEvidenceHref;
  const approvalTarget =
    approvalCandidate?.actionItem.contact?.name ??
    approvalOptionalTitle(approvalCandidate?.actionItem.opportunity?.title) ??
    approvalOptionalTitle(approvalCandidate?.actionItem.meeting?.title) ??
    (english ? "current object" : "当前对象");
  const approvalAudience = approvalCandidate?.actionItem.opportunity
    ? (["sales", "operator"] as const)
    : approvalCandidate?.actionItem.meeting
      ? (["delivery", "operator"] as const)
      : (["founder", "operator"] as const);
  const approvalFocusTitle = approvalCandidate
    ? english
      ? `Review “${approvalCandidate.actionItem.title}” first`
      : `先复核“${approvalTitle(approvalCandidate.actionItem.title)}”`
    : english
      ? "No customer-visible draft is waiting right now"
      : "当前没有客户可见草稿在等待";
  const approvalFocusSummary = approvalCandidate
    ? english
      ? `${summary.pending} pending · ${summary.highRisk} high-risk · ${summary.external} external-facing. Decide whether the top draft can leave the boundary.`
      : `${summary.pending} 条待处理 · ${summary.highRisk} 条高风险 · ${summary.external} 条对外动作。先判断第一条能不能离开边界。`
    : english
      ? "When a worker finishes a trust-sensitive draft, it will appear here before any external move."
      : "只要协作者完成信任敏感草稿，它会先出现在这里，而不是直接对外推进。";
  const approvalFocusPressure = approvalCandidate
    ? approvalCandidate.isHighRisk
      ? english
        ? "High-risk draft. Human review must stay explicit."
        : "高风险草稿，必须明确人工复核。"
      : approvalCandidate.channel === "外发动作" ||
          approvalCandidate.channel === "External action"
        ? english
          ? "External-facing action. Review wording before release."
          : "对外动作，先复核措辞再放行。"
        : english
          ? "Draft is held until you decide."
          : "草稿已停住，等你判断。"
    : english
      ? "No review pressure is open."
      : "当前没有打开的复核压力。";
  const businessLoopGapReadout = buildBusinessLoopGapReadout({
    english,
    businessLoopGapSummary,
    fallbackHref: "/operating",
  });
  const approvalProactiveFlow = createProactiveFlow({
    flowId: "worker-draft-awaiting-review",
    flowTitle: english
      ? "Review request from worker output"
      : "协作者输出触发的复核请求",
    triggerCondition: approvalCandidate
      ? english
        ? `${approvalCandidate.actionItem.title} is already drafted and stopped at the trust boundary, so it is being raised as a review request instead of staying buried in a queue.`
        : `${approvalTitle(approvalCandidate.actionItem.title)} 当前已经起草完并停在信任边界后面，所以它现在会被抬成复核请求，而不是继续埋在队列里。`
      : english
        ? "No active approval request is waiting right now. The next real draft will appear here as soon as a worker finishes something that needs review."
        : "当前没有活跃审批请求在等待。只要有协作者完成需要复核的草稿，下一条真实请求就会先出现在这里。",
    activeReport: createActiveReportProtocol({
      activeReportType: "request",
      activeReportSummary: approvalCandidate
        ? english
          ? `${approvalCandidate.actionItem.title} is ready for review`
          : `${approvalTitle(approvalCandidate.actionItem.title)} 已准备好等待复核`
        : english
          ? "No active review request yet"
          : "当前还没有活跃复核请求",
      activeReportReason: approvalCandidate
        ? approvalText(
            approvalCandidate.reasoning ??
              (english
                ? "Draft, reason and preview are ready — open and decide."
                : "草稿、理由、预览都已就绪 — 打开并做判断。"),
          )
        : english
          ? "A request appears here only when a real draft crosses the review boundary."
          : "只有真实 draft 跨过复核边界时，这里才会出现请求。",
      activeReportPriority:
        approvalCandidate?.isHighRisk ||
        approvalCandidate?.channel === "外发动作" ||
        approvalCandidate?.channel === "External action"
          ? "urgent"
          : "watch",
      activeReportBoundary: [
        english
          ? "The draft and consequence preview can be prepared here, but external or trust-sensitive execution still cannot self-authorize."
          : "这里可以先准备草稿和后果预览，但外发或信任敏感执行仍然不能自我授权。",
        english
          ? "Recommendation remains recommendation until a human explicitly lets it through."
          : "判断建议在人工明确放行之前，始终只是建议。",
      ],
      activeReportDecisionRequest: english
        ? `Decide whether ${approvalCandidate?.actionItem.title ?? "this draft"} should be approved, rewritten, converted or held behind the boundary.`
        : `决定 ${approvalTitle(approvalCandidate?.actionItem.title) || "这条草稿"} 该被通过、改写、转人工，还是继续拦在边界后面。`,
      activeReportWorkerSummary: [
        english
          ? "Recommendation worker keeps the why-now explanation attached."
          : "判断建议协作者会持续保留时机说明。",
        english
          ? "Approval worker keeps the draft, source context and execution preview current."
          : "审批协作者会持续维护草稿、来源上下文和执行预览。",
      ],
      activeReportEvidenceSummary: [
        approvalCandidate
          ? formatApprovalTargetEvidenceSummary(
              approvalCandidate,
              approvalTarget,
              english,
            )
          : english
          ? "No evidence bundle is active yet."
          : "当前还没有活跃证据包。",
        businessLoopGapReadout.pendingDecision ??
          (english
            ? "No gap attached to this review."
            : "当前复核没有挂上缺口。"),
        english
          ? "Replay, audit and memory drill-down stay available before anyone lets the action through."
          : "在任何人放行动作前，回放、审计和记忆下钻都保持可用。",
      ],
      activeReportAudience: [...approvalAudience],
      activeReportDeliveryMode: "decision-request",
      activeReportPreparationSummary: [
        approvalCandidate
          ? english
            ? `Raw action context is already converted into a review-ready request for ${approvalTarget}.`
            : `${approvalTarget} 的原始动作上下文已经收成了一条可复核的请求。`
          : english
            ? "The next review-worthy draft is still pending."
            : "下一条值得复核的草稿仍在等待出现。",
        english
          ? "The recommendation explanation and result preview are already attached, so the owner does not need to reconstruct impact first."
          : "判断建议解释和结果预览已经先挂上了，负责人不需要先重新推演影响。",
      ],
    }),
    collaboration: createProactiveCollaborationProtocol({
      collaborationMode: "helm_prepares_human_decides",
      collaborationRequest: approvalCandidate
        ? english
          ? `A clean review decision is needed on ${approvalCandidate.actionItem.title}, because the draft is ready but the trust boundary still belongs to a human owner.`
          : `${approvalTitle(approvalCandidate.actionItem.title)} 现在需要一次清晰判断，因为草稿已经准备好，但信任边界仍然属于人工负责人。`
        : english
          ? "No active collaboration request yet."
          : "当前还没有活跃协作请求。",
      collaborationSummary: english
        ? "This collaboration mode is simple: the draft gets prepared, a human decides, and only then does the move become execution."
        : "这个协作模式很简单：先把草稿准备好，再由人来拍板，之后动作才会进入执行。",
      collaborationReason: approvalCandidate
        ? english
          ? "The draft is mature enough to review, but not safe enough to self-authorize."
          : "这条草稿已经成熟到可以复核，但还不安全到可以自我授权。"
        : english
          ? "No review-worthy draft is active yet."
          : "当前还没有达到复核阈值的草稿。",
      collaborationBoundary: [
        english
          ? "External send, trust-sensitive execution and commitment hardening still require explicit human ownership."
          : "外发、信任敏感执行和承诺硬化仍然需要明确的人工负责人。",
      ],
      collaborationOwner: approvalCandidate?.reviewedBy?.name
        ? approvalCandidate.reviewedBy.name
        : english
          ? "Approval owner"
          : "审批负责人",
      collaborationWorkerAssignment: [
        english
          ? "Approval worker: keep the review package complete and current."
          : "审批协作者：保持复核包完整且最新。",
        english
          ? "Policy boundary: keep recommendation and commitment clearly separated."
          : "策略边界：持续把判断建议和承诺分开。",
      ],
      collaborationEscalationHint: english
        ? "If this move is still ambiguous after preview, keep it blocked and ask for a stronger owner-level decision instead of letting it drift through."
        : "如果看完预览后这一步仍然模糊，就继续拦住它，并请求更强的负责人层级判断，而不是让它糊里糊涂地滑过去。",
      collaborationDecisionRequest: english
        ? "Approve, rewrite, convert to manual handling, or keep it behind the boundary."
        : "通过、改写、转人工处理，或继续拦在边界后面。",
      collaborationNextStep: [
        english
          ? "Open the drawer and make one explicit review decision."
          : "打开抽屉，做一次明确复核判断。",
        english
          ? "If approved, keep replay and audit attached to the execution result."
          : "如果放行，也要继续把回放和审计绑定到执行结果上。",
      ],
    }),
    helmCanDo: [
      english
        ? "Prepare the draft, source context and consequence preview before review."
        : "在复核前先准备好草稿、来源上下文和后果预览。",
      english
        ? "Keep the queue sorted by trust pressure, external exposure and risk."
        : "持续按信任压力、外发暴露和风险等级刷新队列顺序。",
    ],
    helmSuggestsOnly: [
      english
        ? "Whether the draft is safe enough to become real execution."
        : "这条草稿是否已经足够安全，可以变成真实执行。",
    ],
    humanDecisionRequired: [
      english
        ? "Approve, reject, rewrite or convert the current draft."
        : "对当前草稿做通过、拒绝、改写或转人工处理的判断。",
    ],
    humanLeadRequired: [
      english
        ? "Any move that could be interpreted as an external commitment or irreversible execution."
        : "任何可能被理解成外部承诺或不可逆执行的动作。",
    ],
    nextActions: [
      {
        label: english ? "Open review queue" : "打开复核队列",
        href: "#approval-queue",
      },
      {
        label: english ? "Open preview panel" : "打开预览面板",
        href: "#approval-preview",
        variant: "secondary",
      },
      {
        label: english ? "Open evidence" : "打开证据",
        href: approvalCandidateMemoryHref,
        variant: "ghost",
      },
    ],
    evidenceLinks: [
      {
        label: english ? "Open memory timeline" : "打开记忆时间线",
        href: approvalCandidateMemoryHref,
      },
      {
        label: english ? "Open reports" : "打开周报",
        href: "/reports",
      },
    ],
  });
  const runAction = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) => {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error ?? (english ? "Action failed" : "操作失败"));
        return;
      }
      toast.success(success);
      router.refresh();
    });
  };

  const saveSelectedBiExecutionLog = (
    stage: "plan" | "result",
    success: string,
  ) => {
    if (!selected || !selectedBiSignalId || !selectedBiDecisionId || !biBoardContribution) {
      toast.error(english ? "BI handoff context is missing" : "缺少 BI 承接上下文");
      return;
    }

    const body =
      stage === "plan"
        ? {
            signalId: selectedBiSignalId,
            decisionId: selectedBiDecisionId,
            actionItemId: selected.actionItem.id,
            approvalTaskId: selected.id,
            stage,
            summary: handoffExecutionComposer.planSummary.trim(),
            details: {
              expectedOutcome:
                handoffExecutionComposer.planExpectedOutcome.trim() || null,
              riskNotes: handoffExecutionComposer.planRiskNotes.trim() || null,
            },
          }
        : {
            signalId: selectedBiSignalId,
            decisionId: selectedBiDecisionId,
            actionItemId: selected.actionItem.id,
            approvalTaskId: selected.id,
            stage,
            summary: handoffExecutionComposer.resultSummary.trim(),
            details: {
              outcome: handoffExecutionComposer.resultOutcome.trim() || null,
              followUpNotes:
                handoffExecutionComposer.resultFollowUpNotes.trim() || null,
            },
            isEffective: handoffExecutionComposer.resultEffective,
            followUpNeeded: handoffExecutionComposer.resultFollowUpNeeded,
          };

    if (!body.summary) {
      toast.error(
        english
          ? stage === "plan"
            ? "Plan summary is required"
            : "Result summary is required"
          : stage === "plan"
            ? "请填写处理方案摘要"
            : "请填写执行结果摘要",
      );
      return;
    }

    const handoffExecutionLogsApiUrl = biBoardContribution.handoffExecutionLogsApiUrl;

    startTransition(async () => {
      try {
        const response = await fetch(
          handoffExecutionLogsApiUrl,
          {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify(body),
          },
        );
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(
            payload?.error ??
              (english ? "Failed to save handoff log" : "保存经营处理记录失败"),
          );
        }

        const created =
          (await response.json()) as BiReportHandoffExecutionLogRecord;
        setHandoffExecutionLogs((current) => [created, ...current]);
        toast.success(success);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : english
              ? "Action failed"
              : "操作失败",
        );
      }
    });
  };

  return (
    <div className="workspace-surface-stack">
      <div
        data-frontstage-block="decision-request"
        data-page-decision-request="true"
      >
        <PageHeader
          eyebrow={pageStory.eyebrow}
          title={english ? "Actions waiting for you" : "待确认动作"}
          description={
            english
              ? "Start with the draft most likely to affect a customer."
              : "先处理最可能影响客户的一条草稿。"
          }
        />
      </div>

      <CustomerAssetFocusStrip
        eyebrow={english ? "Customer-visible draft" : "客户可见草稿"}
        title={approvalFocusTitle}
        summary={approvalFocusSummary}
        primaryAction={
          approvalCandidate
            ? {
                label: english ? "Open draft" : "打开草稿",
                href: buildApprovalDrawerHref(approvalCandidate.id),
              }
            : {
                label: english ? "Back to dashboard" : "回到首页",
                href: "/dashboard",
              }
        }
        secondaryAction={
          approvalCandidate
            ? {
                label: english ? "Open evidence" : "查看依据",
                href: approvalCandidateMemoryHref,
              }
            : null
        }
        items={[
          {
            label: english ? "Object" : "对象",
            value: approvalTarget,
            detail: approvalCandidate
              ? formatApprovalQueueStatus(approvalCandidate.status, english)
              : undefined,
            tone: "info",
          },
          {
            label: english ? "Pressure" : "当前压力",
            value: approvalFocusPressure,
            tone: approvalCandidate?.isHighRisk ? "danger" : "warning",
          },
          {
            label: english ? "Decision" : "需要你判断",
            value: approvalCandidate
              ? english
                ? "Approve, rewrite, reject, or move to manual handling."
                : "通过、改写、拒绝，或转人工处理。"
              : english
                ? "No decision required."
                : "暂无需要判断。",
            detail: approvalCandidate?.reasoning
              ? approvalText(approvalCandidate.reasoning)
              : null,
            href: approvalCandidate
              ? buildApprovalDrawerHref(approvalCandidate.id)
              : null,
            tone: "success",
          },
        ]}
      />

      <details className="order-last rounded-lg border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-4 py-3 text-sm text-[color:var(--muted)]">
        <summary className="cursor-pointer list-none font-semibold text-[color:var(--foreground)] marker:content-none [&::-webkit-details-marker]:hidden">
          {english ? "Reference rules" : "引用规则"}
        </summary>
        <div className="mt-4 space-y-4">
          <HomeSurfaceArrivalBanner
            kind="approvals"
            english={english}
            contract={{
              ownership: english
                ? "Approvals owns trust-sensitive draft review, boundary checks and release posture."
                : "复核页负责信任敏感草稿、边界检查和是否放行的判断姿态。",
              nextStep: english
                ? "Start in the approval preview, then decide whether the draft should be approved, rewritten, rejected or converted to manual handling."
                : "先看复核预览，再决定草稿是通过、改写、拒绝还是转人工处理。",
              boundary: english
                ? "Approving a draft here still does not create autonomous send or commitment authority."
                : "在这里通过草稿，也不意味着系统获得了自动发送或自动承诺权限。",
            }}
          />

          {!approvalHomeArrival.isHomeSurfaceArrival ? (
            <FirstLoopSurfaceSummary
              model={approvalFirstLoopDisplayModel}
              english={english}
              eyebrow={english ? "Review path" : "确认路径"}
              compact
            />
          ) : null}

          <ReportingProtocolPanel protocol={approvalsProtocol} english={english} />

          <ProactiveMechanismPanel
            title={
              english
                ? "Approval collaboration raised proactively"
                : "主动抬出的审批协作"
            }
            description={
              english
                ? "When a worker finishes a trust-sensitive draft, it should not stay as a queue row. This page should raise a clean review request with boundary, evidence and the next human decision."
                : "当协作者完成一条信任敏感草稿时，它不该只留成一行队列，而应该把边界、证据和下一步人工判断一起主动送出来。"
            }
            flows={[approvalProactiveFlow]}
            english={english}
          />
        </div>
      </details>

      {biBoardAccessState === "available" && biBoardContribution ? (
        <Card className="order-8 workspace-panel border-[color:var(--mode-card-border)]">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>
                  {english ? "BI signal board" : "经营信号看板"}
                </CardTitle>
                <CardDescription>
                  {english
                    ? biBoardContribution.descriptionEnglish
                    : biBoardContribution.descriptionChinese}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="secondary">
              <Link href={biBoardContribution.ctaHref}>
                {english
                  ? biBoardContribution.ctaLabelEnglish
                  : biBoardContribution.ctaLabelChinese}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <details
        className="order-2 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--background-elevated)]"
        data-testid="approval-load-disclosure"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[color:var(--foreground)]">
              {english ? "Review load" : "复核负载"}
            </span>
            <span className="mt-1 block text-xs leading-5 text-[color:var(--muted-foreground)]">
              {english
                ? `${summary.pending} pending · ${summary.highRisk} high risk · ${summary.external} external waiting`
                : `${summary.pending} 条待复核 · ${summary.highRisk} 条高风险 · ${summary.external} 条待处理外发`}
            </span>
          </span>
          <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)]">
            {english ? "Open load" : "展开负载"}
          </span>
        </summary>
        <div className="grid gap-4 px-4 pb-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label={english ? "Pending" : "待复核"}
            value={summary.pending}
            tone="approval"
            active={activeView === "pending" && activeFilter === "PENDING"}
            onClick={() => {
              setActiveView("pending");
              setActiveFilter("PENDING");
            }}
          />
          <MetricCard
            label={english ? "High risk" : "高风险"}
            value={summary.highRisk}
            tone="danger"
            active={activeView === "pending" && activeFilter === "highRisk"}
            onClick={() => {
              setActiveView("pending");
              setActiveFilter("highRisk");
            }}
          />
          <MetricCard
            label={english ? "External waiting" : "待处理外发"}
            value={summary.external}
            tone="info"
            active={activeView === "pending" && activeFilter === "external"}
            onClick={() => {
              setActiveView("pending");
              setActiveFilter("external");
            }}
          />
          <MetricCard
            label={english ? "Executed history" : "已执行历史"}
            value={summary.executed}
            tone="success"
            active={activeView === "history" && activeFilter === "EXECUTED"}
            onClick={() => {
              setActiveView("history");
              setActiveFilter("EXECUTED");
            }}
          />
        </div>
      </details>

      <details
        id="meeting-follow-through-review"
        className="order-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--background-elevated)]"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[color:var(--foreground)]">
              {english ? "Other meeting drafts" : "其他会议草稿"}
            </span>
            <span className="mt-1 block text-xs leading-5 text-[color:var(--muted-foreground)]">
              {meetingLinkedReviewItems.length
                ? english
                  ? `${meetingLinkedReviewItems.length} meeting-derived drafts are available when you need the full queue.`
                  : `${meetingLinkedReviewItems.length} 条会议衍生草稿在这里，需要时再展开。`
                : english
                  ? "No meeting-derived draft is waiting right now."
                  : "当前没有会议衍生草稿在等待。"}
            </span>
          </span>
          <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)]">
            {english ? "Open drafts" : "展开草稿"}
          </span>
        </summary>
        <div className="space-y-4 px-4 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <Badge variant="approval">
                {english
                  ? "Meeting follow-through review"
                  : "会议会后动作确认"}
              </Badge>
              <p className="text-lg font-semibold text-[color:var(--foreground)]">
                {english
                  ? "Start with the customer action that came out of the meeting."
                  : "先看从会议带出来的客户动作。"}
              </p>
              <details className="max-w-3xl rounded-lg border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-3 py-2 text-xs leading-6 text-[color:var(--muted)]">
                <summary className="cursor-pointer list-none font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
                  {english ? "Review notes" : "处理口径"}
                </summary>
                <p className="mt-2">{meetingLinkedBoundarySummary}</p>
                <p>
                  {english
                    ? "Drafts, reason chains and evidence stay here for the human decision."
                    : "草稿、理由链和证据留在这里，等人做判断。"}
                </p>
              </details>
            </div>
            <div className="flex flex-wrap gap-2">
              {meetingLinkedApprovalFocus ? (
                <Button
                  size="sm"
                  onClick={() => openApprovalDrawer(meetingLinkedApprovalFocus)}
                >
                  {english ? "Open first draft" : "打开第一条草稿"}
                </Button>
              ) : null}
              {meetingLinkedApprovalFocus?.actionItem.meeting ? (
                <Button size="sm" variant="secondary" asChild>
                  <Link
                    href={`/meetings/${meetingLinkedApprovalFocus.actionItem.meeting.id}`}
                  >
                    {english ? "Back to meeting" : "回到会议"}
                  </Link>
                </Button>
              ) : null}
              <Button size="sm" variant="secondary" asChild>
                <Link href="/diagnostics#meeting-workflow-readiness">
                  {english ? "Open readiness view" : "查看协同就绪度"}
                </Link>
              </Button>
            </div>
          </div>

          {meetingLinkedReviewItems.length ? (
            <div className="grid gap-4 xl:grid-cols-3">
              {meetingLinkedReviewItems.map((task) => {
                const posture = getMeetingFollowThroughBoundaryPosture(
                  task,
                  english,
                );
                const meetingMemoryBundle = buildMeetingMemoryBundle(
                  {
                    meeting: {
                      id: task.actionItem.meeting?.id ?? task.id,
                      title: approvalTitle(
                        task.actionItem.meeting?.title ?? task.actionItem.title,
                      ),
                      summary: approvalText(task.reasoning ?? ""),
                    },
                    memoryFacts: task.recommendationFacts.map((fact) => ({
                      ...fact,
                      objectType: "MEETING" as const,
                      objectId: task.actionItem.meeting?.id ?? task.id,
                      sourceType: "APPROVAL_REVIEW_FACT",
                      sourceId: fact.id,
                    })),
                    commitments: task.recommendationCommitments,
                    blockers: task.recommendationBlockers,
                    affectedObjects: [
                      ...(task.actionItem.meeting
                        ? [
                            {
                              id: task.actionItem.meeting.id,
                              objectType: "MEETING" as const,
                              label: approvalTitle(
                                task.actionItem.meeting.title,
                              ),
                            },
                          ]
                        : []),
                      ...(task.actionItem.opportunity
                        ? [
                            {
                              id: task.actionItem.opportunity.id,
                              objectType: "OPPORTUNITY" as const,
                              label: approvalTitle(
                                task.actionItem.opportunity.title,
                              ),
                            },
                          ]
                        : []),
                      ...(task.actionItem.opportunity?.company
                        ? [
                            {
                              id: task.actionItem.opportunity.company.id,
                              objectType: "COMPANY" as const,
                              label: task.actionItem.opportunity.company.name,
                            },
                          ]
                        : []),
                      ...(task.actionItem.contact
                        ? [
                            {
                              id: task.actionItem.contact.id,
                              objectType: "CONTACT" as const,
                              label: task.actionItem.contact.name,
                            },
                          ]
                        : []),
                    ],
                  },
                  english,
                );
                const meetingMemorySummary = buildMeetingMemoryLoopSummary(
                  meetingMemoryBundle,
                  english,
                );
                const meetingMemoryGovernance =
                  buildMeetingMemoryGovernanceSummary(
                    meetingMemoryBundle,
                    english,
                  );
                const meetingIngressThreadPointer =
                  meetingMemoryBundle.sourcePointers.find((pointer) =>
                    pointer.id.startsWith("thread:"),
                  ) ?? null;
                const meetingIngressCalendarPointer =
                  meetingMemoryBundle.sourcePointers.find((pointer) =>
                    pointer.id.startsWith("calendar:"),
                  ) ?? null;
                const ingressFollowThroughLine = task.actionItem.meeting
                  ? english
                    ? `This review is the visible handoff from "${task.actionItem.meeting.title}" into downstream follow-through, so the boundary check belongs here instead of being hidden inside the meeting note.`
                    : `这条复核正是从“${approvalTitle(task.actionItem.meeting.title)}”进入下游推进的显性交接，所以边界检查应留在这里，而不是藏回会议纪要里。`
                  : english
                    ? "This review item still belongs to the meeting follow-through chain, even when the source meeting label is thin."
                    : "即使来源会议标签较薄，这条复核项也仍属于会议后续推进链路。";
                const ingressParticipantLine =
                  (task.actionItem.contact?.name ??
                  task.actionItem.opportunity?.company?.name)
                    ? english
                      ? `The continuity cue is currently being carried by ${[
                          task.actionItem.contact?.name,
                          task.actionItem.opportunity?.company?.name,
                        ]
                          .filter(Boolean)
                          .join(" / ")}.`
                      : `当前连续性线索主要由 ${[
                          task.actionItem.contact?.name,
                          task.actionItem.opportunity?.company?.name,
                        ]
                          .filter(Boolean)
                          .join(" / ")} 承接。`
                    : english
                      ? "No strong participant or company continuity cue is visible yet, so the review still leans mainly on meeting memory and boundary posture."
                      : "当前还没有显著的参与者或公司连续性线索，所以这条复核主要仍靠会议记忆和边界姿态支撑。";
                const visibleReasonChain = buildApprovalTaskReasonChain(
                  task,
                  english,
                ).slice(0, 3);
                return (
                  <div
                    key={task.id}
                    className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="approval">
                        {english ? "Review item" : "复核项"}
                      </Badge>
                      <Badge variant="info">
                        {getMeetingFollowThroughTypeLabel(task, english)}
                      </Badge>
                      <Badge variant={posture.variant}>{posture.label}</Badge>
                    </div>
                    <div className="mt-3 flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <p className="font-semibold text-[color:var(--foreground)]">
                          {approvalTitle(task.actionItem.title)}
                        </p>
                        <p className="text-sm leading-6 text-[color:var(--muted)]">
                          {trimText(approvalText(task.reasoning ?? ""), 92)}
                        </p>
                      </div>
                      <RiskBadge risk={task.actionItem.riskLevel} />
                    </div>
                    <details className="mt-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-3 py-2 text-xs text-[color:var(--muted)]">
                      <summary className="cursor-pointer list-none font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
                        {english ? "More evidence" : "更多依据"}
                      </summary>
                      <div className="mt-3 grid gap-3">
                        <div className="theme-surface-panel-soft rounded-2xl px-4 py-3">
                        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                          {english ? "Boundary posture" : "边界姿态"}
                        </p>
                        <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--foreground)]">
                          {posture.summary}
                        </p>
                      </div>
                      <div className="theme-surface-panel-soft rounded-2xl px-4 py-3">
                        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                          {english
                            ? "Meeting memory relationship"
                            : "会议记忆关系"}
                        </p>
                        <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--foreground)]">
                          {meetingMemorySummary.lifecycleLabel}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="neutral">
                            {meetingMemoryGovernance.visibilityLabel}
                          </Badge>
                          <Badge
                            variant={
                              meetingMemoryGovernance.reviewState === "conflict"
                                ? "danger"
                                : meetingMemoryGovernance.reviewState ===
                                    "pending-review"
                                  ? "approval"
                                  : meetingMemoryGovernance.reviewState ===
                                      "missing-clarity"
                                    ? "warning"
                                    : "success"
                            }
                          >
                            {meetingMemoryGovernance.reviewStateLabel}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                          {approvalText(
                            meetingMemorySummary.affectedObjectsLine,
                          )}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                          {approvalText(meetingMemoryGovernance.reviewSummary)}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                          {meetingMemorySummary.blockingLifecycle
                            ? english
                              ? `This review item is still blocked here because the linked meeting memory is ${meetingMemorySummary.blockingLabel.toLowerCase()}, so it should stay review-only instead of pretending it already belongs to settled object state.`
                              : `这条复核项之所以还停在这里，是因为相关会议记忆当前仍是“${meetingMemorySummary.blockingLabel}”，所以它需要继续保留在仅复核视野里，而不是假装已经属于稳定对象状态。`
                            : english
                              ? `The memory itself is already promoted, but this action still remains boundary-limited, so approvals should stay the formal review surface.`
                              : `这层记忆本身虽然已经提升成功，但该动作仍受边界限制，所以审批页依然是正式复核面。`}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                          {approvalText(
                            meetingMemoryGovernance.eligibilitySummary,
                          )}
                        </p>
                      </div>
                      <div className="theme-surface-panel-soft rounded-2xl px-4 py-3">
                        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                          {english ? "Reason chain first view" : "首屏理由链"}
                        </p>
                        <div className="mt-2 space-y-2">
                          {visibleReasonChain.map((item) => (
                            <p
                              key={item.id}
                              className="text-sm leading-6 text-[color:var(--muted)]"
                            >
                              {approvalText(item.label)}：
                              {approvalText(item.summary)}
                            </p>
                          ))}
                        </div>
                      </div>
                      <div className="theme-surface-panel-soft rounded-2xl px-4 py-3">
                        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                          {english ? "Ingress cue" : "入口线索"}
                        </p>
                        <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--foreground)]">
                          {task.actionItem.meeting
                            ? english
                              ? `Source meeting: ${task.actionItem.meeting.title}`
                              : `来源会议：${approvalTitle(task.actionItem.meeting.title)}`
                            : english
                              ? "No explicit source meeting label"
                              : "当前没有显式来源会议标签"}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                          {meetingIngressCalendarPointer?.summary
                            ? approvalText(
                                meetingIngressCalendarPointer.summary,
                              )
                            : english
                              ? "This review is still anchored mainly to visible meeting/event context."
                              : "这条复核当前主要仍锚定在可见的会议 / 事件上下文上。"}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                          {meetingIngressThreadPointer
                            ? approvalText(meetingIngressThreadPointer.summary)
                            : english
                              ? "No strong related thread cue is visible, so the review boundary is being held mainly by meeting memory and downstream object pressure."
                              : "当前没有显著相关线程线索，所以这条边界主要还是由会议记忆和下游对象压力撑住。"}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                          {ingressParticipantLine}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                          {ingressFollowThroughLine}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                          {meetingMemorySummary.blockingLifecycle
                            ? english
                              ? `Review is still required because the ingress context is flowing into memory as ${meetingMemorySummary.blockingLabel.toLowerCase()}, not as a settled reusable writeback.`
                              : `当前仍需复核，是因为入口上下文进入记忆层后仍表现为“${meetingMemorySummary.blockingLabel}”，而不是已经稳定可复用的写回。`
                            : english
                              ? "Even when ingress context is already readable, the action still needs formal review here before it can leave the boundary."
                              : "即使入口上下文已经可读，这条动作也仍需要先在这里经过正式复核，才能离开边界。"}
                        </p>
                      </div>
                      <div className="theme-surface-panel-soft rounded-2xl px-4 py-3">
                        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                          {english ? "Evidence preview" : "证据预览"}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                          {formatApprovalEvidencePreview(task, english)}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                          {english
                            ? "Open the draft first, then decide whether it should stay behind review or go back for rewrite."
                            : "先打开草稿，再决定它是继续留在复核边界后面，还是退回改写。"}
                        </p>
                        </div>
                      </div>
                    </details>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => openApprovalDrawer(task)}
                      >
                        {english ? "Open draft" : "打开草稿"}
                      </Button>
                      {task.actionItem.meeting ? (
                        <Button size="sm" variant="secondary" asChild>
                          <Link
                            href={`/meetings/${task.actionItem.meeting.id}`}
                          >
                            {english ? "Go to meeting" : "回到会议"}
                          </Link>
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openApprovalDrawer(task)}
                      >
                        {english ? "Enter human review" : "进入人工复核"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title={
                english
                  ? "No meeting follow-through waiting in review"
                  : "当前没有会议会后动作停在复核"
              }
              description={
                english
                  ? "Once a meeting-derived draft crosses the trust boundary, it should appear here first instead of being buried inside the generic queue."
                  : "只要会议衍生出的草稿跨过信任边界，它会出现在这里，而不是被淹没在泛队列里。"
              }
            />
          )}
        </div>
      </details>

      <Card className="order-3 workspace-panel">
        <CardContent className="grid gap-4 py-5 xl:grid-cols-[1.2fr_repeat(3,minmax(0,0.92fr))]">
          <div className="space-y-2">
            <Badge variant="approval">
              {english ? "Action state" : "动作状态"}
            </Badge>
            <p className="text-lg font-semibold text-[color:var(--foreground)]">
              {english
                ? "Which drafts need your confirmation?"
                : "哪些草稿需要你确认？"}
            </p>
            <details className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-3 py-2 text-xs leading-6 text-[color:var(--muted)]">
              <summary className="cursor-pointer list-none font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
                {english ? "Decision basis" : "处理依据"}
              </summary>
              <p className="mt-2">{boundaryModel.summaryLine}</p>
            </details>
            <div className="flex flex-wrap gap-2 pt-1">
              {boundaryModel.topSkillIds.map((skillId) => (
                <Badge key={skillId} variant="info">
                  {getOperatingSkillById(skillId)?.name ?? skillId}
                </Badge>
              ))}
            </div>
          </div>
          <Item
            label={english ? "Can move now" : "可直接处理"}
            tone="sky"
            value={String(boundaryModel.autoEligibleCount)}
          />
          <Item
            label={english ? "Need confirmation" : "需确认"}
            tone="amber"
            value={String(boundaryModel.approvalRequiredCount)}
          />
          <details className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4">
            <summary className="cursor-pointer list-none text-xs font-medium text-[color:var(--muted-foreground)] marker:content-none [&::-webkit-details-marker]:hidden">
              {english ? "Reason chain" : "理由链"}
            </summary>
            <div className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
              {[
                english
                  ? "First read why the action is blocked behind the boundary."
                  : "先看这条动作为什么会被拦在边界后面。",
                english
                  ? "Then read why the system is surfacing it now instead of later."
                  : "再看系统为什么现在把它抬出来，而不是继续往后放。",
                english
                  ? "Finally read what will update after approval, rewrite or manual takeover."
                  : "最后看批准、改写或转人工之后，哪些对象和回放会被联动更新。",
              ].map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </details>
        </CardContent>
      </Card>

      {demoMode ? (
        <Card className="order-4 workspace-panel-muted">
          <CardContent className="grid gap-4 py-5 xl:grid-cols-[1.2fr_repeat(3,minmax(0,0.9fr))]">
            <div className="space-y-2">
              <Badge variant="approval">
                {english
                  ? "Why these actions were stopped"
                  : "动作卡住原因"}
              </Badge>
              <p className="text-lg font-semibold text-[color:var(--foreground)]">
                {english
                  ? "The approval center makes the trust boundary between AI recommendations and real execution explicit."
                  : "先确认草稿、证据和风险，再决定是否继续推进。"}
              </p>
              <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                {english
                  ? "External messages are reviewed by default, internal actions execute under policy, and high-risk items always require a human check. Every approval, rejection and auto-execution leaves a replayable record."
                  : "对外消息默认先审，内部动作按策略执行，高风险事项始终需要人工确认。每次批准、拒绝和自动处理都会留下回放记录。"}
              </p>
            </div>
            <Item
              label={english ? "Approval rule" : "审批原则"}
              tone="amber"
              value={
                english
                  ? "External first, high risk always reviewed"
                  : "外发先审，高风险必审"
              }
            />
            <Item
              label={english ? "Downstream result" : "联动结果"}
              tone="sky"
              value={
                english
                  ? "Opportunity, contact, meeting and timeline update together"
                  : "机会、联系人、会议、时间线同步变化"
              }
            />
            <Item
              label={english ? "Rule shortcut" : "规则入口"}
              tone="violet"
              value={
                english
                  ? "Turn this action type into future auto-handling in one click"
                  : "可一键把同类动作改成以后自动处理"
              }
            />
          </CardContent>
        </Card>
      ) : null}

      <Card id="approval-queue" className="order-5 workspace-panel">
        <CardContent className="space-y-5 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-2">
              <p className="workspace-eyebrow">
                {english ? "Queue controls" : "队列控制"}
              </p>
              <p className="text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
                {english
                  ? "Read the queue by urgency, channel and execution mode instead of scanning raw cards."
                  : "按紧迫度、渠道和执行方式读队列，而不是在原始卡片里反复扫。"}
              </p>
              <p className="max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
                {english
                  ? "Search first, narrow by action type and automation mode, then use the status chips to reduce the queue to one review context."
                  : "先搜索，再按动作类型和自动化方式收窄，最后用状态标签把队列压到一个清晰的复核场景。"}
              </p>
            </div>
            <Tabs
              value={activeView}
              onValueChange={(value) =>
                setActiveView(value as typeof activeView)
              }
            >
              <TabsList>
                <TabsTrigger value="pending">
                  {english ? "Pending" : "待处理"}
                </TabsTrigger>
                <TabsTrigger value="history">
                  {english ? "History" : "已审批历史"}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_repeat(2,minmax(0,0.9fr))]">
            <div className="space-y-2">
              <p className="workspace-toolbar-label">
                {english ? "Search" : "搜索"}
              </p>
              <div className="relative">
                <BellRing className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9"
                  placeholder={
                    english
                      ? "Search action, object or AI reasoning"
                      : "搜索动作、对象或判断原因"
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <p className="workspace-toolbar-label">
                {english ? "Action type" : "动作类型"}
              </p>
              <Select
                value={actionTypeFilter}
                onValueChange={(value) =>
                  setActionTypeFilter(value as typeof actionTypeFilter)
                }
              >
                <SelectTrigger
                  aria-label={english ? "Action type filter" : "动作类型筛选"}
                >
                  <SelectValue
                    placeholder={english ? "Action type" : "动作类型"}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {english ? "All action types" : "全部动作类型"}
                  </SelectItem>
                  {Object.entries(actionLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="workspace-toolbar-label">
                {english ? "Execution mode" : "执行方式"}
              </p>
              <Select
                value={automationFilter}
                onValueChange={(value) =>
                  setAutomationFilter(value as typeof automationFilter)
                }
              >
                <SelectTrigger
                  aria-label={
                    english ? "Execution mode filter" : "执行方式筛选"
                  }
                >
                  <SelectValue
                    placeholder={english ? "Execution mode" : "执行方式"}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {english ? "All execution modes" : "全部执行方式"}
                  </SelectItem>
                  <SelectItem value="manual">
                    {english ? "Manual review" : "人工确认"}
                  </SelectItem>
                  <SelectItem value="auto">
                    {english ? "Auto-execution candidate" : "自动执行候选"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="workspace-toolbar flex flex-wrap items-center gap-2 rounded-[24px] px-3 py-3">
            <p className="workspace-toolbar-label pr-1">
              {english ? "Status" : "状态"}
            </p>
            {filterOptions.map((option) => (
              <Button
                key={option.key}
                size="sm"
                variant={activeFilter === option.key ? "default" : "secondary"}
                onClick={() => setActiveFilter(option.key)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="order-6 grid gap-4 lg:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          {filtered.length ? (
            filtered.map((task) => {
              const targetLabel =
                task.actionItem.contact?.name ??
                approvalOptionalTitle(task.actionItem.opportunity?.title) ??
                approvalOptionalTitle(task.actionItem.meeting?.title) ??
                (english ? "Unlinked object" : "未关联对象");
              const targetHref = resolveApprovalObjectDetailHref({
                contact: task.actionItem.contact,
                opportunity: task.actionItem.opportunity,
                meeting: task.actionItem.meeting,
                biSource: task.biSource,
              });

              return (
                <article
                  key={task.id}
                  className={`w-full rounded-[24px] border p-5 text-left shadow-sm transition hover:bg-[color:var(--surface-subtle)] ${task.isHighRisk ? "border-[color:var(--status-danger-border)] bg-[color:var(--status-danger-bg)]/30" : task.channel === "外发动作" || task.channel === "External action" ? "border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)]/20" : "border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_92%,white_8%)]"}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        task.channel === "外发动作" ||
                        task.channel === "External action"
                          ? "warning"
                          : "info"
                      }
                    >
                      {task.channel === "外发动作" ||
                      task.channel === "External action" ? (
                        <Mail className="mr-1 h-3 w-3" />
                      ) : null}
                      {task.channel ?? (english ? "Action" : "动作")}
                    </Badge>
                    <Badge variant="default">
                      {actionLabels[task.actionItem.actionType]}
                    </Badge>
                    <ApprovalBadge status={task.status} />
                    {task.dingtalkSource ? (
                      <Badge variant="info">
                        {english ? "DingTalk MCP" : "钉钉 MCP"}
                      </Badge>
                    ) : null}
                    {task.isHighRisk ? (
                      <Badge variant="danger">
                        <ShieldAlert className="mr-1 h-3 w-3" />
                        {english ? "High risk" : "高风险"}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-lg font-semibold text-[color:var(--foreground)]">
                        {approvalTitle(task.actionItem.title)}
                      </p>
                      <p className="text-sm text-[color:var(--muted-foreground)]">
                        {english ? "Target" : "作用对象"}：{targetLabel}
                      </p>
                      {task.dingtalkSource ? (
                        <p className="text-xs text-[color:var(--muted-foreground)]">
                          {english ? "Evidence" : "证据来源"}：
                          {` ${task.dingtalkSource.scope ?? "UNKNOWN"} / ${task.dingtalkSource.sourceType ?? "unknown_type"} / ${task.dingtalkSource.sourceId ?? "n/a"}`}
                        </p>
                      ) : null}
                      <p className="text-sm leading-6 text-[color:var(--muted)]">
                        {trimText(approvalText(task.reasoning ?? ""), 110)}
                      </p>
                    </div>
                    <RiskBadge risk={task.actionItem.riskLevel} />
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <Item
                      label={
                        english ? "Suggested execution time" : "建议执行时间"
                      }
                      value={formatDateLabel(
                        task.actionItem.suggestedExecutionAt,
                      )}
                    />
                    <Item
                      label={english ? "Auto-execute" : "自动执行"}
                      value={
                        task.autoExecute
                          ? english
                            ? "Yes"
                            : "是"
                          : english
                            ? "No"
                            : "否"
                      }
                    />
                    <Item
                      label={english ? "Approval reason" : "审批理由"}
                      value={trimText(approvalText(task.reasoning ?? ""), 32)}
                    />
                    <Item
                      label={english ? "Last updated" : "最近更新时间"}
                      value={formatRelative(task.updatedAt)}
                    />
                  </div>
                  {task.actionItem.recommendationLog ? (
                    <div className="mt-4 workspace-panel rounded-2xl px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="warning">
                          {english
                            ? `Score ${task.actionItem.recommendationLog.score}`
                            : `建议分 ${task.actionItem.recommendationLog.score}`}
                        </Badge>
                        <Badge variant="approval">
                          {formatRecommendationPolicyResult(
                            task.actionItem.recommendationLog.policyResult,
                            english,
                          )}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                        {trimText(
                          approvalText(
                            task.actionItem.recommendationLog.explanation,
                          ),
                          96,
                        )}
                      </p>
                      <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                        {formatApprovalRecommendationLogEvidence(
                          task.actionItem.recommendationLog,
                          english,
                        )}
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[color:var(--muted-foreground)]">
                    {targetHref ? (
                      <Link
                        href={targetHref}
                        data-approval-object-detail-link="true"
                        className="inline-flex min-h-7 items-center rounded-lg px-1.5 font-medium text-[var(--accent)] hover:bg-[color:var(--surface-subtle)] hover:opacity-80"
                      >
                        {english ? "Open business object" : "打开经营对象"}
                      </Link>
                    ) : (
                      <span
                        aria-disabled="true"
                        data-approval-object-detail-unavailable="true"
                        className="inline-flex min-h-7 items-center rounded-lg px-1.5 font-medium text-[color:var(--muted-foreground)]"
                      >
                        {english ? "No linked business object" : "暂无关联经营对象"}
                      </span>
                    )}
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {activeView === "history" ? (
                        <span>
                          {task.reviewedBy?.name
                            ? english
                              ? `Handled by ${task.reviewedBy.name}`
                              : `处理人：${task.reviewedBy.name}`
                            : english
                              ? "Handled by system"
                              : "系统处理"}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewApprovalId(task.id);
                        }}
                        aria-label={
                          english
                            ? `Preview approval task: ${task.actionItem.title}`
                            : `预览复核项：${approvalTitle(task.actionItem.title)}`
                        }
                        data-approval-queue-preview-button="true"
                        className="inline-flex min-h-8 items-center rounded-xl border border-[color:var(--border)] px-3 text-xs font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                      >
                        {english ? "Preview" : "预览复核项"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <EmptyState
              title={
                activeView === "pending"
                  ? english
                    ? "No pending approvals right now"
                    : "当前没有待复核动作"
                  : english
                    ? "No matching approval history"
                    : "没有匹配的审批历史"
              }
              description={
                activeView === "pending"
                  ? english
                    ? "High-risk actions, external messages and policy-blocked actions will flow here automatically."
                    : "高风险动作、外发消息和策略拦截动作会自动进入这里。"
                  : english
                    ? "Adjust the filters to review executed, rejected or withdrawn records."
                    : "可以切换筛选条件，查看执行、拒绝或撤回记录。"
              }
            />
          )}
        </div>

        <Card
          id={APPROVAL_PAGE_ANCHORS.preview}
          className="h-fit lg:sticky lg:top-28"
        >
          <CardHeader>
            <CardTitle>
              {english ? "Action waiting on you" : "需要你处理的动作"}
            </CardTitle>
            <CardDescription>
              {english
                ? "Select one item, confirm the linked business object, then approve, rewrite or hand it off."
                : "先选中一条，看清它关联的经营对象，再决定通过、改写还是转人工。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {previewed ? (
              <>
                <div className="workspace-panel-muted rounded-2xl p-4">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        previewed.channel === "外发动作" ||
                        previewed.channel === "External action"
                          ? "warning"
                          : "info"
                      }
                      >
                        {previewed.channel ?? (english ? "Action" : "动作")}
                      </Badge>
                    {previewed.isHighRisk ? (
                      <Badge variant="danger">
                        {english ? "High risk" : "高风险"}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-3 font-medium text-[color:var(--foreground)]">
                    {approvalTitle(previewed.actionItem.title)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                    {trimText(approvalText(previewed.reasoning ?? ""), 100)}
                  </p>
                </div>
                <div className="grid gap-3">
                  {previewedTargetHref ? (
                    <Button asChild variant="secondary">
                      <Link href={previewedTargetHref}>
                        {english ? "Open linked business object" : "打开关联经营对象"}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                  <Item
                    label={english ? "Source context" : "来源上下文"}
                    value={trimText(
                      approvalText(formatContextSnapshot(previewed.contextSnapshot)),
                      42,
                    )}
                  />
                  <Item
                    label={english ? "Result preview" : "结果预览"}
                    value={trimText(
                      approvalText(previewed.resultPreview ?? ""),
                      42,
                    )}
                  />
                  <Item
                    label={english ? "Impact after approval" : "批准后影响"}
                    value={
                      english
                        ? "Synchronize related objects, timeline and audit records"
                        : "同步相关对象状态、时间线与审计记录"
                    }
                  />
                  <Item
                    label={english ? "Recommendation source" : "推荐来源"}
                    value={
                      previewed.actionItem.recommendationLog
                        ? english
                          ? `Review-backed recommendation · score ${previewed.actionItem.recommendationLog.score}`
                          : `复核依据建议 · 分数 ${previewed.actionItem.recommendationLog.score}`
                        : english
                          ? "This action was not triggered directly by recommendation"
                          : "当前动作不是由判断建议直接触发"
                    }
                  />
                </div>
                {previewed.recommendationBlockers[0] ? (
                  <BlockerCard
                    blocker={{
                      ...previewed.recommendationBlockers[0],
                      targetLabel:
                        approvalOptionalTitle(
                          previewed.recommendationBlockers[0].relatedOpportunity
                            ?.title,
                        ) ??
                        approvalOptionalTitle(
                          previewed.recommendationBlockers[0].relatedMeeting
                            ?.title,
                        ) ??
                        previewed.recommendationBlockers[0].relatedContact
                          ?.name ??
                        previewed.recommendationBlockers[0].relatedCompany
                          ?.name ??
                        previewedTargetLabel,
                    }}
                    compact
                  />
                ) : null}
                {previewed.recommendationCommitments[0] ? (
                  <CommitmentCard
                    commitment={{
                      ...previewed.recommendationCommitments[0],
                      sourceLabel: describeCommitmentSource(
                        previewed.recommendationCommitments[0].sourceType,
                        memorySourceLabels,
                      ),
                      ownerName:
                        previewed.recommendationCommitments[0].ownerUser
                          ?.name ?? null,
                      targetLabel:
                        approvalOptionalTitle(
                          previewed.recommendationCommitments[0]
                            .relatedOpportunity?.title,
                        ) ??
                        approvalOptionalTitle(
                          previewed.recommendationCommitments[0].relatedMeeting
                            ?.title,
                        ) ??
                        previewed.recommendationCommitments[0].relatedContact
                          ?.name ??
                        previewed.recommendationCommitments[0].relatedCompany
                          ?.name ??
                        previewedTargetLabel,
                    }}
                    compact
                  />
                ) : null}
                {previewedLearningPanel ? (
                  <ApprovalLearningPanel
                    panel={previewedLearningPanel}
                    compact
                  />
                ) : null}
                <Button
                  className="w-full"
                  onClick={() => openApprovalDrawer(previewed)}
                  data-approval-open-drawer-from-preview="true"
                >
                  <FilePenLine className="h-4 w-4" />
                  {english ? "Open approval drawer" : "打开审批抽屉"}
                </Button>
              </>
            ) : (
              <EmptyState
                title={english ? "Select an approval task" : "选择一个审批动作"}
                description={
                  english
                    ? "The preview will show source, risk, linked object and the exact action that needs your call."
                    : "预览会显示来源、风险、关联对象，以及真正需要你拍板的动作。"
                }
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => !open && closeSelectedApproval()}
      >
        <SheetContent
          className="max-w-[620px]"
          closeLabel={english ? "Close approval drawer" : "关闭复核抽屉"}
        >
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>
                  {approvalTitle(selected.actionItem.title)}
                </SheetTitle>
                <SheetDescription>
                  {english
                    ? "Read the reason chain and draft, then approve, approve after edit, reject or convert to manual handling. Every path leaves an audit record."
                    : "先读理由链和草稿，再选择批准、编辑后批准、拒绝或转人工。每条路径都会留下审计记录。"}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 p-5">
                <section className="space-y-2">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">
                    {english ? "Reason chain" : "理由链"}
                  </p>
                  <div className="space-y-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4">
                    {buildApprovalTaskReasonChain(selected, english).map(
                      (item) => (
                        <div key={item.id} className="space-y-1">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {approvalText(item.label)}
                          </p>
                          <p className="text-sm leading-6 text-[color:var(--muted)]">
                            {approvalText(item.summary)}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </section>
                <section
                  id={APPROVAL_PAGE_ANCHORS.fullActionContent}
                  className="space-y-2"
                >
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">
                    {english ? "Full action content" : "动作全文"}
                  </p>
                  <div
                    className="workspace-note-card px-4 py-4"
                    data-tone="slate"
                  >
                    <p className="workspace-note-body text-sm leading-7">
                      {approvalText(
                        selected.editableContent ??
                          selected.actionItem.description ??
                          (english ? "No action content yet" : "暂无动作全文"),
                      )}
                    </p>
                  </div>
                </section>
                <section
                  id={APPROVAL_PAGE_ANCHORS.sourceContext}
                  className="space-y-2"
                >
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">
                    {english ? "Source context" : "来源上下文"}
                  </p>
                  <div
                    className="workspace-note-card px-4 py-4"
                    data-tone="sky"
                  >
                    <p className="workspace-note-body text-sm leading-7">
                      {approvalText(formatContextSnapshot(selected.contextSnapshot))}
                    </p>
                  </div>
                </section>
                <section
                  id={APPROVAL_PAGE_ANCHORS.aiReasoning}
                  className="space-y-2"
                >
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">
                    {english
                      ? "Why this should be handled now"
                      : "为什么建议现在处理"}
                  </p>
                  <div
                    className="workspace-note-card px-4 py-4"
                    data-tone="emerald"
                  >
                    <p className="workspace-note-body text-sm leading-7">
                      {selected.reasoning
                        ? approvalText(selected.reasoning)
                        : english
                          ? "No explanation yet"
                          : "暂无说明"}
                    </p>
                  </div>
                </section>
                {selected.actionItem.recommendationLog ? (
                  <section className="space-y-2">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">
                      {english
                        ? "Why the system recommended handling it this way"
                        : "为什么建议这样处理"}
                    </p>
                    <RecommendationJudgementCard
                      recommendation={{
                        recommendationId:
                          selected.actionItem.recommendationLog.id,
                        title: selected.actionItem.recommendationLog.title,
                        description: selected.actionItem.description ?? "",
                        score: selected.actionItem.recommendationLog.score,
                        policyResult:
                          selected.actionItem.recommendationLog.policyResult,
                        explanation:
                          selected.actionItem.recommendationLog.explanation,
                        supportingFactIds:
                          selected.actionItem.recommendationLog
                            .supportingFactIds,
                        blockerIds:
                          selected.actionItem.recommendationLog.blockerIds,
                        commitmentIds:
                          selected.actionItem.recommendationLog.commitmentIds,
                        recommendationPayload:
                          selected.actionItem.recommendationLog
                            .recommendationPayload,
                      }}
                      emphasis="featured"
                      summaryLabel={
                        english
                          ? "Recommendation awaiting approval"
                          : "待复核判断建议"
                      }
                      sourcePage="/approvals"
                      footer={
                        <p className="text-xs text-[color:var(--muted-foreground)]">
                          {english
                            ? "Your decision is recorded as review evidence, so future recommendations stay aligned with this boundary."
                            : "你的决定会作为复核证据记录下来，让后续建议继续贴合这条边界。"}
                        </p>
                      }
                    />
                  </section>
                ) : null}
                {selected.recommendationBlockers.length ||
                selected.recommendationCommitments.length ||
                selected.recommendationFacts.length ? (
                  <section
                    id={APPROVAL_PAGE_ANCHORS.supportingEvidence}
                    className="space-y-3"
                  >
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">
                      {english
                        ? "Current blocker / commitment / supporting facts"
                        : "当前卡点 / 承诺 / 支持事实"}
                    </p>
                    {selected.recommendationBlockers.length ? (
                      <div className="space-y-3">
                        {selected.recommendationBlockers
                          .slice(0, 2)
                          .map((item) => (
                            <div
                              key={item.id}
                              id={buildApprovalItemAnchor("blocker", item.id)}
                            >
                              <BlockerCard
                                blocker={{
                                  ...item,
                                  targetLabel:
                                    approvalOptionalTitle(
                                      item.relatedOpportunity?.title,
                                    ) ??
                                    approvalOptionalTitle(
                                      item.relatedMeeting?.title,
                                    ) ??
                                    item.relatedContact?.name ??
                                    item.relatedCompany?.name ??
                                    selected.actionItem.contact?.name ??
                                    approvalOptionalTitle(
                                      selected.actionItem.opportunity?.title,
                                    ) ??
                                    approvalOptionalTitle(
                                      selected.actionItem.meeting?.title,
                                    ) ??
                                    (english ? "Current object" : "当前对象"),
                                }}
                                compact
                              />
                            </div>
                          ))}
                      </div>
                    ) : null}
                    {selected.recommendationCommitments.length ? (
                      <div className="space-y-3">
                        {selected.recommendationCommitments
                          .slice(0, 2)
                          .map((item) => (
                            <div
                              key={item.id}
                              id={buildApprovalItemAnchor(
                                "commitment",
                                item.id,
                              )}
                            >
                              <CommitmentCard
                                commitment={{
                                  ...item,
                                  sourceLabel: describeCommitmentSource(
                                    item.sourceType,
                                    memorySourceLabels,
                                  ),
                                  ownerName: item.ownerUser?.name ?? null,
                                  targetLabel:
                                    approvalOptionalTitle(
                                      item.relatedOpportunity?.title,
                                    ) ??
                                    approvalOptionalTitle(
                                      item.relatedMeeting?.title,
                                    ) ??
                                    item.relatedContact?.name ??
                                    item.relatedCompany?.name ??
                                    selected.actionItem.contact?.name ??
                                    approvalOptionalTitle(
                                      selected.actionItem.opportunity?.title,
                                    ) ??
                                    approvalOptionalTitle(
                                      selected.actionItem.meeting?.title,
                                    ) ??
                                    (english ? "Current object" : "当前对象"),
                                }}
                                compact
                              />
                            </div>
                          ))}
                      </div>
                    ) : null}
                    {selected.recommendationFacts.length ? (
                      <div
                        className="workspace-note-card px-4 py-4"
                        data-tone="sky"
                      >
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">
                          {english ? "Supporting facts" : "支持事实"}
                        </p>
                        <div className="mt-3 space-y-3">
                          {selected.recommendationFacts
                            .slice(0, 3)
                            .map((fact) => (
                              <div
                                key={fact.id}
                                id={buildApprovalItemAnchor("fact", fact.id)}
                                className="workspace-note-card px-4 py-3"
                                data-tone="slate"
                              >
                                <p className="text-sm font-medium text-[color:var(--foreground)]">
                                  {approvalTitle(fact.title)}
                                </p>
                                <p className="mt-2 text-sm leading-7 text-[color:var(--foreground)]">
                                  {trimText(approvalText(fact.content), 104)}
                                </p>
                                <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                                  {english ? "Confidence" : "置信度"}{" "}
                                  {fact.confidence} ·{" "}
                                  {formatDateLabel(fact.updatedAt)}
                                </p>
                              </div>
                            ))}
                        </div>
                      </div>
                    ) : null}
                  </section>
                ) : null}
                {recentSimilarActions.length || selectedLearningPanel ? (
                  <details
                    className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3"
                    open={decisionSupportOpen}
                    onToggle={(event) =>
                      setDecisionSupportOpen(event.currentTarget.open)
                    }
                  >
                    <summary className="cursor-pointer text-sm font-semibold text-[color:var(--foreground)]">
                      {english ? "Decision support details" : "辅助判断材料"}
                    </summary>
                    <div className="mt-4 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3">
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-semibold text-[color:var(--foreground)]">
                            {english ? "Evidence timeline" : "证据时间线"}
                          </p>
                          <p className="text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {english
                              ? "Open the object memory behind this review before changing the draft posture."
                              : "改草稿姿态前，先打开这条复核背后的对象记忆。"}
                          </p>
                        </div>
                        <Button asChild size="sm" variant="secondary">
                          <Link
                            href={buildApprovalMemoryHref(selected)}
                            data-approval-drawer-evidence-link="true"
                          >
                            {english ? "Open evidence" : "打开证据"}
                          </Link>
                        </Button>
                      </div>
                      {recentSimilarActions.length ? (
                        <section
                          id={APPROVAL_PAGE_ANCHORS.recentOutcomes}
                          className="space-y-2"
                        >
                          <p className="text-sm font-semibold text-[color:var(--foreground)]">
                            {english
                              ? "Recent similar action outcomes"
                              : "最近同类动作结果"}
                          </p>
                          <div className="space-y-3">
                            {recentSimilarActions.map((task) => (
                              <div
                                key={task.id}
                                id={buildApprovalItemAnchor("outcome", task.id)}
                                className="workspace-note-card px-4 py-4"
                                data-tone="slate"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                                    {approvalTitle(task.actionItem.title)}
                                  </p>
                                  <ApprovalBadge status={task.status} />
                                </div>
                                <p className="mt-2 text-sm leading-7 text-[color:var(--foreground)]">
                                  {trimText(
                                    approvalText(task.reasoning ?? ""),
                                    84,
                                  )}
                                </p>
                                <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                                  {english ? "Handled on" : "处理于"}{" "}
                                  {formatDateLabel(
                                    task.reviewedAt ?? task.updatedAt,
                                  )}
                                </p>
                              </div>
                            ))}
                          </div>
                        </section>
                      ) : null}
                      {selectedLearningPanel ? (
                        <section className="space-y-2">
                          <p className="text-sm font-semibold text-[color:var(--foreground)]">
                            {english
                              ? "Similar review signals"
                              : "同类动作参考"}
                          </p>
                          <ApprovalLearningPanel
                            panel={selectedLearningPanel}
                          />
                        </section>
                      ) : null}
                    </div>
                  </details>
                ) : null}
                <section
                  id={APPROVAL_PAGE_ANCHORS.editableDraft}
                  className="space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">
                      {draftEditCopy.sectionTitle}
                    </p>
                    <span
                      className="workspace-note-chip"
                      data-tone={isDraftEdited ? "amber" : "slate"}
                    >
                      {draftEditCopy.statusLabel}
                    </span>
                  </div>
                  <Textarea
                    aria-label={draftEditCopy.sectionTitle}
                    disabled={!canReviewGovernedActions}
                    value={editableDraft}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                  {isDraftEdited ? (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDraft(null)}
                      >
                        <RotateCcw className="h-4 w-4" />
                        {draftEditCopy.restoreLabel}
                      </Button>
                    </div>
                  ) : null}
                </section>
                <section
                  id={APPROVAL_PAGE_ANCHORS.riskNote}
                  className="space-y-2"
                >
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">
                    {english ? "Risk note" : "风险提示"}
                  </p>
                  <div
                    className={`workspace-note-card px-4 py-4 text-sm leading-7 ${selected.isHighRisk ? "text-[color:var(--foreground)]" : "text-[color:var(--foreground)]"}`}
                    data-tone={selected.isHighRisk ? "rose" : "amber"}
                  >
                    {selected.isHighRisk
                      ? english
                        ? "This action is classified as high risk and must be manually confirmed before execution."
                        : "当前动作被判定为高风险，必须由人工确认后执行。"
                      : english
                        ? "Risk is controllable, but it is still worth confirming the object, timing and wording."
                        : "该动作风险可控，但仍建议你确认对象、时机和措辞。"}
                  </div>
                </section>
                <section
                  id={APPROVAL_PAGE_ANCHORS.resultPreview}
                  className="space-y-2"
                >
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">
                    {english ? "After-execution preview" : "执行后结果预览"}
                  </p>
                  <div
                    className="workspace-note-card px-4 py-4 text-sm leading-7 text-[color:var(--foreground)]"
                    data-tone="slate"
                  >
                    {approvalText(
                      selected.resultPreview ??
                        (english
                          ? "Execution will write an audit record and synchronize related timelines."
                          : "执行后会写入审计日志并同步相关时间线。"),
                    )}
                  </div>
                </section>
                {selected.biSource ? (
                  <section className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">
                          {english ? "Handling plan" : "处理方案"}
                        </p>
                        {handoffExecutionLogsLoading ? (
                          <span className="text-xs text-[color:var(--muted-foreground)]">
                            {english ? "Loading…" : "加载中…"}
                          </span>
                        ) : null}
                      </div>
                      <Textarea
                        aria-label={english ? "Handling plan summary" : "处理方案摘要"}
                        placeholder={
                          english
                            ? "Summarize how you plan to handle this BI-driven operating issue."
                            : "概述你准备怎么处理这条 BI 触发的经营问题。"
                        }
                        value={handoffExecutionComposer.planSummary}
                        onChange={(event) =>
                          setHandoffExecutionComposer((current) => ({
                            ...current,
                            planSummary: event.target.value,
                          }))
                        }
                      />
                      <Input
                        aria-label={english ? "Expected outcome" : "预期结果"}
                        placeholder={english ? "Expected outcome" : "预期结果"}
                        value={handoffExecutionComposer.planExpectedOutcome}
                        onChange={(event) =>
                          setHandoffExecutionComposer((current) => ({
                            ...current,
                            planExpectedOutcome: event.target.value,
                          }))
                        }
                      />
                      <Textarea
                        aria-label={english ? "Risk notes" : "风险备注"}
                        placeholder={english ? "Risk notes" : "风险备注"}
                        value={handoffExecutionComposer.planRiskNotes}
                        onChange={(event) =>
                          setHandoffExecutionComposer((current) => ({
                            ...current,
                            planRiskNotes: event.target.value,
                          }))
                        }
                      />
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={pending}
                          onClick={() =>
                            saveSelectedBiExecutionLog(
                              "plan",
                              english ? "Handling plan saved" : "处理方案已保存",
                            )
                          }
                        >
                          <FilePenLine className="h-4 w-4" />
                          {english ? "Save plan" : "保存方案"}
                        </Button>
                      </div>
                      {selectedBiLatestPlan ? (
                        <div
                          className="workspace-note-card px-4 py-4 text-sm leading-7 text-[color:var(--foreground)]"
                          data-tone="slate"
                        >
                          <p className="font-medium text-[color:var(--foreground)]">
                            {english ? "Latest plan" : "最近方案"}
                          </p>
                          <p className="mt-2">{selectedBiLatestPlan.summary}</p>
                          {typeof selectedBiLatestPlan.details?.expectedOutcome ===
                          "string" ? (
                            <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                              {english ? "Expected outcome: " : "预期结果："}
                              {selectedBiLatestPlan.details.expectedOutcome}
                            </p>
                          ) : null}
                          {typeof selectedBiLatestPlan.details?.riskNotes ===
                          "string" ? (
                            <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                              {english ? "Risk notes: " : "风险备注："}
                              {selectedBiLatestPlan.details.riskNotes}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-[color:var(--foreground)]">
                        {english ? "Execution result" : "执行结果"}
                      </p>
                      <Textarea
                        aria-label={english ? "Execution result summary" : "执行结果摘要"}
                        placeholder={
                          english
                            ? "Summarize what was actually done and what changed."
                            : "概述这次实际做了什么，以及结果如何。"
                        }
                        value={handoffExecutionComposer.resultSummary}
                        onChange={(event) =>
                          setHandoffExecutionComposer((current) => ({
                            ...current,
                            resultSummary: event.target.value,
                          }))
                        }
                      />
                      <Input
                        aria-label={english ? "Outcome" : "处理结果"}
                        placeholder={english ? "Outcome" : "处理结果"}
                        value={handoffExecutionComposer.resultOutcome}
                        onChange={(event) =>
                          setHandoffExecutionComposer((current) => ({
                            ...current,
                            resultOutcome: event.target.value,
                          }))
                        }
                      />
                      <Textarea
                        aria-label={english ? "Follow-up notes" : "后续跟进"}
                        placeholder={english ? "Follow-up notes" : "后续跟进"}
                        value={handoffExecutionComposer.resultFollowUpNotes}
                        onChange={(event) =>
                          setHandoffExecutionComposer((current) => ({
                            ...current,
                            resultFollowUpNotes: event.target.value,
                          }))
                        }
                      />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="flex items-center gap-2 text-sm text-[color:var(--foreground)]">
                          <input
                            type="checkbox"
                            checked={handoffExecutionComposer.resultEffective}
                            onChange={(event) =>
                              setHandoffExecutionComposer((current) => ({
                                ...current,
                                resultEffective: event.target.checked,
                              }))
                            }
                          />
                          {english ? "This handling was effective" : "本次处理有效"}
                        </label>
                        <label className="flex items-center gap-2 text-sm text-[color:var(--foreground)]">
                          <input
                            type="checkbox"
                            checked={handoffExecutionComposer.resultFollowUpNeeded}
                            onChange={(event) =>
                              setHandoffExecutionComposer((current) => ({
                                ...current,
                                resultFollowUpNeeded: event.target.checked,
                              }))
                            }
                          />
                          {english ? "Follow-up still needed" : "仍需继续跟进"}
                        </label>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={pending}
                          onClick={() =>
                            saveSelectedBiExecutionLog(
                              "result",
                              english ? "Execution result saved" : "执行结果已保存",
                            )
                          }
                        >
                          <FilePenLine className="h-4 w-4" />
                          {english ? "Save result" : "保存结果"}
                        </Button>
                      </div>
                      {selectedBiLatestResult ? (
                        <div
                          className="workspace-note-card px-4 py-4 text-sm leading-7 text-[color:var(--foreground)]"
                          data-tone="slate"
                        >
                          <p className="font-medium text-[color:var(--foreground)]">
                            {english ? "Latest result" : "最近结果"}
                          </p>
                          <p className="mt-2">
                            {selectedBiLatestResult.summary}
                          </p>
                          {typeof selectedBiLatestResult.details?.outcome ===
                          "string" ? (
                            <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                              {english ? "Outcome: " : "处理结果："}
                              {selectedBiLatestResult.details.outcome}
                            </p>
                          ) : null}
                          {typeof selectedBiLatestResult.details?.followUpNotes ===
                          "string" ? (
                            <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                              {english ? "Follow-up: " : "后续跟进："}
                              {selectedBiLatestResult.details.followUpNotes}
                            </p>
                          ) : null}
                          <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                            {english ? "Effective: " : "是否有效："}
                            {selectedBiLatestResult.isEffective === null
                              ? english
                                ? "Not specified"
                                : "未说明"
                              : selectedBiLatestResult.isEffective
                                ? english
                                  ? "Yes"
                                  : "有效"
                                : english
                                  ? "No"
                                  : "无效"}
                            {" · "}
                            {english ? "Follow-up: " : "是否跟进："}
                            {selectedBiLatestResult.followUpNeeded === null
                              ? english
                                ? "Not specified"
                                : "未说明"
                              : selectedBiLatestResult.followUpNeeded
                                ? english
                                  ? "Needed"
                                  : "需要"
                                : english
                                  ? "No"
                                  : "不需要"}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </section>
                ) : null}
                <div
                  className="workspace-note-card p-4 text-sm leading-7 text-[color:var(--foreground)]"
                  data-tone="sky"
                >
                  {selected.actionItem.recommendationLog
                    ? english
                      ? "If you approve after editing, the system will treat this as valid feedback and later recommendations of the same type will move closer to your approval style."
                      : "如果你编辑后批准，这次改动会被视为一次有效反馈，后续同类建议会更贴近你的审批习惯。"
                    : english
                      ? "Even though this action was not triggered directly by recommendation, your approval result will still affect the automation boundary for later actions of the same kind."
                      : "这条动作虽然不是直接由建议链触发，但你的审批结果仍会影响后续同类动作的自动化边界。"}
                </div>
                {!canReviewGovernedActions ? (
                  <div
                    className="workspace-note-card p-4 text-sm leading-7 text-[color:var(--foreground)]"
                    data-tone="amber"
                  >
                    {actionGovernance.reviewDeniedMessage}
                  </div>
                ) : null}
                {!canChangeActionPolicy ? (
                  <div
                    className="workspace-note-card p-4 text-sm leading-7 text-[color:var(--foreground)]"
                    data-tone="slate"
                  >
                    {actionGovernance.policyDeniedMessage}
                  </div>
                ) : null}
                {selectedActionAwaitingExecution ? (
                  <div
                    className="workspace-note-card p-4 text-sm leading-7 text-[color:var(--foreground)]"
                    data-tone="sky"
                  >
                    {english
                      ? "This action has been approved, but it is still waiting for execution. Use the actions below to mark it executed or blocked."
                      : "这条动作已经审批通过，但还没有执行完成。请在下面继续标记已执行或标记阻断。"}
                  </div>
                ) : null}
                {selectedActionExecuted ? (
                  <div
                    className="workspace-note-card p-4 text-sm leading-7 text-[color:var(--foreground)]"
                    data-tone="emerald"
                  >
                    {english
                      ? "This action has already been executed and no further execution operation is required."
                      : "这条动作已经执行完成，不需要再做后续执行操作。"}
                  </div>
                ) : null}
                {selectedActionBlocked ? (
                  <div
                    className="workspace-note-card p-4 text-sm leading-7 text-[color:var(--foreground)]"
                    data-tone="rose"
                  >
                    {english
                      ? "This action is currently blocked. Review the blocking reason before deciding whether to reopen it."
                      : "这条动作当前已阻断，建议先确认阻断原因，再决定是否重新处理。"}
                  </div>
                ) : null}
                <div className="grid gap-3 pt-2">
                  {selectedActionAwaitingExecution ? (
                    <>
                      <Button
                        disabled={pending}
                        onClick={() =>
                          runAction(
                            () =>
                              executeApprovedTaskAction(
                                selected.id,
                                isDraftEdited ? editableDraft : undefined,
                              ),
                            english
                              ? "Approved action executed"
                              : "已执行已批准动作",
                          )
                        }
                      >
                        <Play className="h-4 w-4" />
                        {english ? "Mark executed" : "标记已执行"}
                      </Button>
                      <Button
                        disabled={pending}
                        variant="secondary"
                        onClick={() =>
                          runAction(
                            () =>
                              blockApprovedTaskAction({
                                taskId: selected.id,
                                reason: english
                                  ? "Execution blocked"
                                  : "执行已阻断",
                              }),
                            english
                              ? "Approved action blocked"
                              : "已阻断已批准动作",
                          )
                        }
                      >
                        <CircleOff className="h-4 w-4" />
                        {english ? "Mark blocked" : "标记阻断"}
                      </Button>
                    </>
                  ) : selectedActionExecuted || selectedActionBlocked ? null : (
                    <>
                      <Button
                        disabled={pending}
                        onClick={() =>
                          runAction(
                            () => approveTaskAction(selected.id),
                            english
                              ? "Action approved and awaiting execution"
                              : "动作已批准待执行",
                          )
                        }
                      >
                        {english ? "Approve for execution" : "批准待执行"}
                      </Button>
                      <Button
                        disabled={
                          pending || !canReviewGovernedActions || !isDraftEdited
                        }
                        variant="secondary"
                        onClick={() =>
                          runAction(
                            () => approveTaskAction(selected.id, editableDraft),
                            english
                              ? "Edited action approved and awaiting execution"
                              : "已编辑后批准待执行",
                          )
                        }
                      >
                        <Wand2 className="h-4 w-4" />
                        {english ? "Approve edited draft" : "编辑后批准待执行"}
                      </Button>
                      <Button
                        disabled={pending}
                        variant="secondary"
                        onClick={() =>
                          runAction(
                            () =>
                              rejectTaskAction({
                                taskId: selected.id,
                                reason: english
                                  ? "Needs manual rewrite"
                                  : "需人工重写",
                              }),
                            english ? "Action rejected" : "动作已拒绝",
                          )
                        }
                      >
                        {english ? "Reject" : "拒绝"}
                      </Button>
                      <Button
                        disabled={pending}
                        variant="secondary"
                        onClick={() =>
                          runAction(
                            () => convertTaskToManualAction(selected.id),
                            english
                              ? "Converted to manual handling"
                              : "已改成人工处理",
                          )
                        }
                      >
                        {english
                          ? "Convert to manual handling"
                          : "改成人工处理"}
                      </Button>
                    </>
                  )}
                </div>
                <details className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3">
                  <summary className="cursor-pointer text-sm font-semibold text-[color:var(--foreground)]">
                    {english ? "Future auto-handling rule (within threshold)" : "后续自动处理规则（阈值内）"}
                  </summary>
                  <div className="mt-3 space-y-3">
                    <p className="text-sm leading-7 text-[color:var(--muted)]">
                      {english
                        ? "Only use this after the current draft pattern is stable enough. It lets the same internal, reversible action type run within a reviewed threshold; customer-visible drafts still wait for your click. Each policy change lands an audit row."
                        : "只有当前草稿模式足够稳定时才使用。同类内部、可回滚动作可在已复核阈值内运行；客户可见草稿仍永远等你点击。每次策略变更都会落一条审计。"}
                    </p>
                    <Button
                      disabled={pending || !canChangeActionPolicy}
                      variant="secondary"
                      onClick={() =>
                        runAction(
                          () =>
                            enableAutoExecutionForTaskTypeAction(selected.id),
                          english
                            ? "Future internal actions of this type will auto-handle within threshold"
                            : "阈值内同类内部动作将自动处理（客户可见动作仍需复核）",
                        )
                      }
                    >
                      {english
                        ? "Auto-handle within threshold (internal, reversible only)"
                        : "阈值内自动处理（仅限内部 · 可回滚）"}
                    </Button>
                  </div>
                </details>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  tone: "warning" | "danger" | "info" | "success" | "approval";
  active?: boolean;
  onClick?: () => void;
}) {
  const classes =
    tone === "danger"
      ? "border-[color:var(--status-danger-border)]"
      : tone === "warning"
        ? "border-[color:var(--status-warning-border)]"
        : tone === "approval"
          ? "border-[color:var(--status-info-border)]"
          : tone === "success"
            ? "border-[color:var(--status-success-border)]"
            : "border-[color:var(--status-info-border)]";

  return (
    <button type="button" onClick={onClick} className="block w-full text-left">
      <Card
        className={`${classes} transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] ${active ? "border-[color:var(--accent)] shadow-[var(--shadow-card-hover)]" : "hover:-translate-y-0.5 hover:border-[color:var(--accent)] hover:shadow-[var(--shadow-card-hover)]"}`}
      >
        <CardContent className="space-y-3 py-5">
          <p className="workspace-kpi-label">{label}</p>
          <p className="text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">
            {value}
          </p>
        </CardContent>
      </Card>
    </button>
  );
}

function Item({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "sky" | "violet" | "emerald" | "amber" | "rose";
}) {
  return (
    <div
      className="workspace-note-card min-h-[136px] px-5 py-5"
      data-tone={tone}
    >
      <p className="workspace-note-label text-[15px] font-semibold tracking-[0.01em]">
        {label}
      </p>
      <p
        className="workspace-note-value mt-4 text-[17px] font-semibold leading-9"
        suppressHydrationWarning
      >
        {value}
      </p>
    </div>
  );
}

function getMeetingFollowThroughTypeLabel(
  task: ApprovalsClientProps["tasks"][number],
  english: boolean,
) {
  if (task.channel === "外发动作" || task.channel === "External action") {
    return english ? "Draft follow-up email" : "跟进邮件草稿";
  }

  if (
    task.actionItem.actionType === "UPDATE_OPPORTUNITY_STAGE" ||
    task.actionItem.actionType === "DRAFT_INTERNAL_NOTE" ||
    task.actionItem.actionType === "CREATE_TASK"
  ) {
    return english ? "Internal update" : "内部更新";
  }

  return english ? "Action list / draft" : "动作清单 / 草稿";
}

function getMeetingFollowThroughBoundaryPosture(
  task: ApprovalsClientProps["tasks"][number],
  english: boolean,
) {
  if (task.isHighRisk) {
    return {
      label: english ? "Blocked" : "已阻塞",
      summary: english
        ? "High-risk meeting follow-through is visible, so it must stay behind explicit human review before anything leaves the boundary."
        : "当前是高风险会议会后动作，必须先停留在显式人工复核后面，不能直接越过边界。",
      variant: "danger" as const,
    };
  }

  if (task.channel === "外发动作" || task.channel === "External action") {
    return {
      label: english ? "Needs review" : "需要复核",
      summary: english
        ? "This draft already exists, but it is still external-facing, so the next move remains a human review decision."
        : "当前草稿已经准备好，但它仍然是对外动作，下一步依然必须是人工复核判断。",
      variant: "warning" as const,
    };
  }

  return {
    label: english ? "OK to proceed after review" : "复核后可继续",
    summary: english
      ? "The draft is already shaped and the risk is more controllable, but this still stays review-first decision support instead of silent execution."
      : "当前草稿已经成形，风险也相对可控，但这里仍保持复核优先的决策支持，而不是静默执行。",
    variant: "success" as const,
  };
}

function safeParseCount(value?: string | null) {
  if (!value) return 0;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function getApprovalEvidenceCounts(
  task: ApprovalsClientProps["tasks"][number],
) {
  return {
    facts: task.recommendationFacts.length,
    blockers: task.recommendationBlockers.length,
    commitments: task.recommendationCommitments.length,
  };
}

function formatApprovalEvidencePreview(
  task: ApprovalsClientProps["tasks"][number],
  english: boolean,
) {
  const counts = getApprovalEvidenceCounts(task);
  const total = counts.facts + counts.blockers + counts.commitments;

  if (total > 0) {
    return english
      ? `${counts.facts} facts · ${counts.commitments} commitments · ${counts.blockers} blockers`
      : `${counts.facts} 条事实 · ${counts.commitments} 条承诺 · ${counts.blockers} 条阻塞`;
  }

  return english
    ? "No structured facts, commitments or blockers are linked yet; review the source context and risk posture first."
    : "暂无结构化事实、承诺或阻塞引用；先看来源上下文和风险姿态。";
}

function formatApprovalTargetEvidenceSummary(
  task: ApprovalsClientProps["tasks"][number],
  targetLabel: string,
  english: boolean,
) {
  const counts = getApprovalEvidenceCounts(task);
  const total = counts.facts + counts.blockers + counts.commitments;

  if (total > 0) {
    return english
      ? `${counts.facts} facts, ${counts.blockers} blockers and ${counts.commitments} commitments are already linked to ${targetLabel}.`
      : `${targetLabel} 当前已经挂上了 ${counts.facts} 条事实、${counts.blockers} 条阻塞和 ${counts.commitments} 条承诺。`;
  }

  return english
    ? `${targetLabel} has no structured evidence bundle yet, so this review should stay anchored to source context, replay and human judgement.`
    : `${targetLabel} 暂无结构化证据包，这次复核先锚定来源上下文、回放和人工判断。`;
}

function formatApprovalRecommendationLogEvidence(
  recommendationLog: NonNullable<
    ApprovalsClientProps["tasks"][number]["actionItem"]["recommendationLog"]
  >,
  english: boolean,
) {
  const facts = safeParseCount(recommendationLog.supportingFactIds);
  const blockers = safeParseCount(recommendationLog.blockerIds);
  const commitments = safeParseCount(recommendationLog.commitmentIds);

  if (facts + blockers + commitments > 0) {
    return english
      ? `Evidence: facts ${facts} · blockers ${blockers} · commitments ${commitments}`
      : `依据：事实 ${facts} · 阻塞 ${blockers} · 承诺 ${commitments}`;
  }

  return english
    ? "Evidence: no structured references yet; use the explanation and source context."
    : "依据：暂无结构化引用；先看解释和来源上下文。";
}

function describeCommitmentSource(
  sourceType: string,
  labels: Record<string, string>,
) {
  return labels[sourceType] ?? sourceType;
}

function buildApprovalDrawerHref(
  approvalId: string,
  anchorId: string = APPROVAL_PAGE_ANCHORS.preview,
) {
  return buildSectionHref(`/approvals?approvalId=${approvalId}`, anchorId);
}

function hasValue<T>(value: T | null | undefined): value is T {
  return Boolean(value);
}

function buildApprovalMemoryHref(
  approval: ApprovalsClientProps["tasks"][number],
  anchorId: string = MEMORY_PAGE_ANCHORS.timeline,
) {
  const approvalReturnParam = `&approvalId=${encodeURIComponent(approval.id)}`;

  if (approval.actionItem.opportunity) {
    return buildSectionHref(
      `/memory?objectType=OPPORTUNITY&objectId=${approval.actionItem.opportunity.id}&from=approvals${approvalReturnParam}`,
      anchorId,
    );
  }

  if (approval.actionItem.contact) {
    return buildSectionHref(
      `/memory?objectType=CONTACT&objectId=${approval.actionItem.contact.id}&from=approvals${approvalReturnParam}`,
      anchorId,
    );
  }

  if (approval.actionItem.meeting) {
    return buildSectionHref(
      `/memory?objectType=MEETING&objectId=${approval.actionItem.meeting.id}&from=approvals${approvalReturnParam}`,
      anchorId,
    );
  }

  return buildSectionHref(
    `/memory?from=approvals&approvalId=${encodeURIComponent(approval.id)}`,
    anchorId,
  );
}

function buildApprovalPayloadEvidenceGroups({
  approval,
  similarActions,
  english,
}: {
  approval: ApprovalsClientProps["tasks"][number];
  similarActions: ApprovalsClientProps["tasks"];
  english: boolean;
}) {
  const displayText = (value: string | null | undefined) =>
    formatApprovalLearningDisplayText(value ?? "", english);
  const payload = safeParseJson<Record<string, unknown>>(
    approval.actionItem.recommendationLog?.recommendationPayload,
    {},
  );
  return createEvidencePayloadGroups({
    english,
    replayItems: [
      approval.contextSnapshot
        ? {
            itemId: `${approval.id}-replay-context`,
            label: english ? "Open context snapshot" : "查看上下文快照",
            href: buildApprovalDrawerHref(
              approval.id,
              APPROVAL_PAGE_ANCHORS.sourceContext,
            ),
            summary: english
              ? trimText(approval.contextSnapshot, 96)
              : trimText(displayText(approval.contextSnapshot), 96),
          }
        : undefined,
      approval.reasoning
        ? {
            itemId: `${approval.id}-replay-reasoning`,
            label: english ? "Open reasoning trace" : "查看判断解释",
            href: buildApprovalDrawerHref(
              approval.id,
              APPROVAL_PAGE_ANCHORS.aiReasoning,
            ),
            summary: trimText(displayText(approval.reasoning), 96),
          }
        : undefined,
      approval.resultPreview
        ? {
            itemId: `${approval.id}-replay-result-preview`,
            label: english ? "Open result preview" : "查看结果预览",
            href: buildApprovalDrawerHref(
              approval.id,
              APPROVAL_PAGE_ANCHORS.resultPreview,
            ),
            summary: trimText(displayText(approval.resultPreview), 96),
          }
        : undefined,
      approval.editableContent
        ? {
            itemId: `${approval.id}-replay-draft`,
            label: english ? "Open editable draft" : "查看可编辑草稿",
            href: buildApprovalDrawerHref(
              approval.id,
              APPROVAL_PAGE_ANCHORS.editableDraft,
            ),
            summary: trimText(displayText(approval.editableContent), 96),
          }
        : undefined,
    ].filter(hasValue),
    auditItems: [
      {
        itemId: `${approval.id}-audit-status`,
        label: english ? "Open approval audit status" : "查看审批审计状态",
        href: buildApprovalDrawerHref(
          approval.id,
          APPROVAL_PAGE_ANCHORS.preview,
        ),
        summary: english
          ? `Current queue status: ${approval.status}.`
          : `当前队列状态：${formatApprovalQueueStatus(approval.status, english)}。`,
      },
      approval.reviewedAt
        ? {
            itemId: `${approval.id}-audit-reviewed`,
            label: english ? "Open review decision trace" : "查看审批决策痕迹",
            href: buildApprovalDrawerHref(
              approval.id,
              APPROVAL_PAGE_ANCHORS.preview,
            ),
            summary: english
              ? `Last reviewed by ${approval.reviewedBy?.name ?? "an owner"}, so the trust boundary already has an explicit decision trace.`
              : `最近一次已由${approval.reviewedBy?.name ?? "相关负责人"}完成处理，信任边界已经留下明确决策痕迹。`,
          }
        : undefined,
      similarActions[0]
        ? {
            itemId: `${approval.id}-audit-similar-history`,
            label: english
              ? "Open similar execution history"
              : "查看同类执行历史",
            href: buildApprovalDrawerHref(
              similarActions[0].id,
              buildApprovalItemAnchor("outcome", similarActions[0].id),
            ),
            summary: english
              ? `${similarActions.length} similar actions already left execution history; latest outcome: ${trimText(similarActions[0].actionItem.title, 72)}.`
              : `已有 ${similarActions.length} 条同类动作沉淀进执行历史；最新一条是：${trimText(displayText(similarActions[0].actionItem.title), 72)}。`,
          }
        : undefined,
      approval.autoExecute
        ? {
            itemId: `${approval.id}-audit-auto-execution`,
            label: english ? "Open automation boundary" : "查看自动执行边界",
            href: buildApprovalDrawerHref(
              approval.id,
              APPROVAL_PAGE_ANCHORS.riskNote,
            ),
            summary: english
              ? "This action type is already marked as auto-handling candidate, but it still remains visible for audit and override."
              : "这类动作已经被标记成自动处理候选，但仍然保留审计与人工接管入口。",
          }
        : undefined,
    ].filter(hasValue),
    memoryItems: [
      approval.recommendationFacts[0]
        ? {
            itemId: `${approval.id}-memory-facts`,
            label: english ? "Open supporting facts" : "查看支撑事实",
            href: buildApprovalMemoryHref(
              approval,
              buildMemoryItemAnchor("fact", approval.recommendationFacts[0].id),
            ),
            summary: english
              ? `${approval.recommendationFacts.length} linked facts keep the recommendation grounded; latest: ${trimText(approval.recommendationFacts[0].content, 88)}`
              : `当前有 ${approval.recommendationFacts.length} 条关联事实支撑这条判断建议；最近一条是：${trimText(approval.recommendationFacts[0].content, 88)}`,
          }
        : undefined,
      approval.recommendationBlockers[0]
        ? {
            itemId: `${approval.id}-memory-blockers`,
            label: english ? "Open blocker memory" : "查看阻塞记忆",
            href: buildApprovalMemoryHref(
              approval,
              buildMemoryItemAnchor(
                "blocker",
                approval.recommendationBlockers[0].id,
              ),
            ),
            summary: english
              ? `${approval.recommendationBlockers.length} blockers are attached; top blocker: ${trimText(approval.recommendationBlockers[0].blockerText, 88)}`
              : `当前挂着 ${approval.recommendationBlockers.length} 条阻塞；最上面一条是：${trimText(approval.recommendationBlockers[0].blockerText, 88)}`,
          }
        : undefined,
      approval.recommendationCommitments[0]
        ? {
            itemId: `${approval.id}-memory-commitments`,
            label: english ? "Open commitment memory" : "查看承诺记忆",
            href: buildApprovalMemoryHref(
              approval,
              buildMemoryItemAnchor(
                "commitment",
                approval.recommendationCommitments[0].id,
              ),
            ),
            summary: english
              ? `${approval.recommendationCommitments.length} commitments remain in view; nearest one: ${trimText(approval.recommendationCommitments[0].commitmentText, 88)}`
              : `当前还能看到 ${approval.recommendationCommitments.length} 条承诺；最近一条是：${trimText(approval.recommendationCommitments[0].commitmentText, 88)}`,
          }
        : undefined,
    ].filter(hasValue),
    handoffItems: [
      approval.actionItem.recommendationLog?.title
        ? {
            itemId: `${approval.id}-handoff-title`,
            label: english ? "Open recommendation handoff" : "查看判断建议交接",
            href: buildApprovalDrawerHref(
              approval.id,
              APPROVAL_PAGE_ANCHORS.preview,
            ),
            summary: english
              ? `Recommendation handoff title: ${trimText(approval.actionItem.recommendationLog.title, 88)}`
              : `交接标题：${trimText(approval.actionItem.recommendationLog.title, 88)}`,
          }
        : undefined,
      typeof payload.whyNow === "string"
        ? {
            itemId: `${approval.id}-handoff-why-now`,
            label: english ? "Open why-now handoff" : "查看时机说明交接",
            href: buildApprovalDrawerHref(
              approval.id,
              APPROVAL_PAGE_ANCHORS.aiReasoning,
            ),
            summary: english
              ? `Why now: ${trimText(payload.whyNow, 96)}`
              : `为什么现在处理：${trimText(payload.whyNow, 96)}`,
          }
        : undefined,
      typeof payload.evidenceSummary === "string"
        ? {
            itemId: `${approval.id}-handoff-evidence-summary`,
            label: english
              ? "Open payload evidence handoff"
              : "查看载荷证据交接",
            href: buildApprovalDrawerHref(
              approval.id,
              APPROVAL_PAGE_ANCHORS.supportingEvidence,
            ),
            summary: english
              ? `Payload evidence summary: ${trimText(payload.evidenceSummary, 96)}`
              : `Payload 证据摘要：${trimText(payload.evidenceSummary, 96)}`,
          }
        : undefined,
      typeof payload.draftContent === "string"
        ? {
            itemId: `${approval.id}-handoff-draft`,
            label: english ? "Open staged draft handoff" : "查看待复核草稿交接",
            href: buildApprovalDrawerHref(
              approval.id,
              APPROVAL_PAGE_ANCHORS.editableDraft,
            ),
            summary: english
              ? `Draft content staged for review: ${trimText(payload.draftContent, 96)}`
              : `已准备待复核的草稿内容：${trimText(payload.draftContent, 96)}`,
          }
        : undefined,
    ].filter(hasValue),
  });
}

function ApprovalLearningPanel({
  panel,
  compact = false,
}: {
  panel: ApprovalsClientProps["learningPanels"][string];
  compact?: boolean;
}) {
  const { locale } = useWorkspaceUi();
  const english = locale === "en-US";
  const policyModeLabel = panel.policy
    ? formatApprovalPolicyModeForReview({
        mode: panel.policy.mode,
        modeLabel: panel.policy.modeLabel,
        english,
      })
    : null;

  return (
    <div className="workspace-note-card px-4 py-4" data-tone="violet">
      <div className="flex flex-wrap items-center gap-2">
        <span className="workspace-note-chip">
          {english ? "Similar review signals" : "同类动作参考"}
        </span>
        <span className="workspace-note-chip">
          {formatApprovalLearningDisplayText(panel.actionLabel, english)}
        </span>
        {panel.policy ? (
          <span className="workspace-note-chip">{policyModeLabel}</span>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        {panel.summaryLines.length ? (
          panel.summaryLines.map((item) => (
            <p key={item} className="workspace-note-body text-sm leading-7">
              {formatApprovalLearningDisplayText(item, english)}
            </p>
          ))
        ) : (
          <p className="workspace-note-body text-sm leading-7">
            {english
              ? "There is no stable signal yet that is strong enough to change this action type. Later suggestions will keep using your approval and edit feedback as reference."
              : "当前还没有稳定到足以影响这类动作的参考信号，后续建议会继续把你的批准和编辑反馈作为依据。"}
          </p>
        )}
      </div>

      {!compact ? (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Item
              label={english ? "Current rule" : "当前规则"}
              value={
                panel.policy
                  ? `${policyModeLabel} / ${panel.policy.riskLabel}`
                  : english
                    ? "Not configured yet"
                    : "尚未配置"
              }
            />
            <Item
              label={english ? "Recent feedback" : "最近反馈"}
              value={
                panel.feedbackStats.total
                  ? english
                    ? `Accepted ${panel.feedbackStats.approved + panel.feedbackStats.editedApproved} · Rejected ${panel.feedbackStats.rejected}`
                    : `采纳 ${panel.feedbackStats.approved + panel.feedbackStats.editedApproved} · 拒绝 ${panel.feedbackStats.rejected}`
                  : english
                    ? "No similar feedback yet"
                    : "暂无同类反馈"
              }
            />
            <Item
              label={english ? "Auto-handled" : "已自动处理"}
              value={
                panel.feedbackStats.autoExecuted
                  ? english
                    ? `${panel.feedbackStats.autoExecuted} times`
                    : `${panel.feedbackStats.autoExecuted} 次`
                  : english
                    ? "None yet"
                    : "暂无"
              }
            />
          </div>

          {panel.learnedPatterns.length ? (
            <div className="mt-4 space-y-3">
              {panel.learnedPatterns.slice(0, 2).map((pattern) => (
                <div
                  key={pattern.id}
                  className="workspace-note-card px-4 py-3"
                  data-tone="slate"
                >
                  <p className="workspace-note-title text-sm font-semibold">
                    {formatApprovalLearningDisplayText(pattern.title, english)}
                  </p>
                  <p className="workspace-note-body mt-2 text-sm leading-7">
                    {formatApprovalLearningDisplayText(
                      pattern.summary,
                      english,
                    )}
                  </p>
                  <p className="workspace-note-meta mt-2 text-xs">
                    {english ? "Confidence" : "置信度"} {pattern.confidence} ·{" "}
                    {english
                      ? `Evidence ${pattern.evidenceCount}`
                      : `证据 ${pattern.evidenceCount} 条`}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {panel.signalHints.length ? (
            <div className="mt-4 space-y-3">
              {panel.signalHints.slice(0, 2).map((signal) => (
                <div
                  key={signal.id}
                  className="workspace-note-card px-4 py-3"
                  data-tone="sky"
                >
                  <p className="workspace-note-body text-sm leading-7">
                    {formatApprovalLearningDisplayText(signal.summary, english)}
                  </p>
                  <p className="workspace-note-meta mt-2 text-xs">
                    {english ? "Weight" : "权重"} {signal.weight} ·{" "}
                    {english ? "Updated" : "更新于"}{" "}
                    {formatDateLabel(signal.updatedAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {panel.openSuggestions.length || panel.acceptedSuggestions.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="workspace-note-card px-4 py-3" data-tone="amber">
                <p className="workspace-note-title text-sm font-semibold">
                  {english
                    ? "Handling suggestions awaiting confirmation"
                    : "待确认的处理建议"}
                </p>
                {panel.openSuggestions.length ? (
                  <div className="mt-3 space-y-3">
                    {panel.openSuggestions.map((suggestion) => (
                      <div
                        key={suggestion.id}
                        className="workspace-note-card px-3 py-3"
                        data-tone="slate"
                      >
                        <p className="workspace-note-title text-sm font-semibold">
                          {formatApprovalLearningDisplayText(
                            suggestion.title,
                            english,
                          )}
                        </p>
                        <p className="workspace-note-body mt-2 text-sm leading-7">
                          {trimText(
                            formatApprovalLearningDisplayText(
                              suggestion.reason,
                              english,
                            ),
                            76,
                          )}
                        </p>
                        <p className="workspace-note-meta mt-2 text-xs">
                          {english ? "Confidence" : "置信度"}{" "}
                          {suggestion.confidence}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="workspace-note-meta mt-3 text-sm">
                    {english
                      ? "There is no new strategy suggestion for this action type."
                      : "当前没有新的同类处理建议。"}
                  </p>
                )}
              </div>
              <div
                className="workspace-note-card px-4 py-3"
                data-tone="emerald"
              >
                <p className="workspace-note-title text-sm font-semibold">
                  {english ? "Recently adopted outcomes" : "最近已采纳结果"}
                </p>
                {panel.acceptedSuggestions.length ? (
                  <div className="mt-3 space-y-3">
                    {panel.acceptedSuggestions.map((suggestion) => (
                      <div
                        key={suggestion.id}
                        className="workspace-note-card px-3 py-3"
                        data-tone="slate"
                      >
                        <p className="workspace-note-title text-sm font-semibold">
                          {formatApprovalLearningDisplayText(
                            suggestion.title,
                            english,
                          )}
                        </p>
                        <p className="workspace-note-body mt-2 text-sm leading-7">
                          {formatApprovalLearningDisplayText(
                            suggestion.appliedEffectSummary ??
                              (english
                                ? "It has been adopted and is already affecting later actions of the same kind."
                                : "已采纳并开始影响后续同类动作。"),
                            english,
                          )}
                        </p>
                        <p className="workspace-note-meta mt-2 text-xs">
                          {english ? "Effective at" : "生效于"}{" "}
                          {formatDateLabel(
                            suggestion.appliedAt ?? suggestion.confirmedAt,
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="workspace-note-meta mt-3 text-sm">
                    {english
                      ? "There is no recent adopted record for this action type yet."
                      : "这类动作还没有最近采纳后的稳定结果。"}
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="workspace-note-meta mt-3 text-xs">
          {panel.policy
            ? english
              ? `Current rule: ${policyModeLabel} / ${panel.policy.riskLabel}`
              : `当前规则：${policyModeLabel} / ${panel.policy.riskLabel}`
            : english
              ? "No matching rule found for this action type."
              : "当前没有找到对应规则。"}
        </div>
      )}
    </div>
  );
}
