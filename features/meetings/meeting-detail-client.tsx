"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  History,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { RecommendationJudgementCard } from "@/components/recommendations/recommendation-judgement-card";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { BlockerCard } from "@/components/shared/blocker-card";
import { ControlledDisclosure } from "@/components/shared/controlled-disclosure";
import { CommitmentCard } from "@/components/shared/commitment-card";
import { EmptyState } from "@/components/shared/empty-state";
import { HomeSurfaceArrivalBanner } from "@/components/shared/home-surface-arrival-banner";
import { PageHeader } from "@/components/shared/page-header";
import { RiskBadge } from "@/components/shared/risk-badge";
import {
  ActionModeBadge,
  ApprovalBadge,
  StageBadge,
} from "@/components/shared/status-badges";
import { WorkspaceGuidancePanel } from "@/components/shared/workspace-guidance-panel";
import { WorkspaceSurfacePreferences } from "@/components/shared/workspace-surface-preferences";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  formatDateLabel,
  safeParseJson,
  toDateTimeLocalInput,
  trimText,
} from "@/lib/utils";
import {
  generateMeetingBriefing,
  generatePostMeetingActionSuggestions,
} from "@/lib/ai";
import {
  applyMeetingMemoryReviewOnlyOverrides,
  buildMeetingMemoryExportPayload,
  buildMeetingMemoryBundle,
  buildMeetingMemoryGovernanceSummary,
  buildMeetingMemoryItemGovernanceSummary,
  buildMeetingMemoryLoopSummary,
  buildMeetingMemorySourceUseLedger,
  buildMeetingTemplateSummary,
  buildMeetingWorkspaceLightSummary,
} from "@/lib/operating-system";
import { getWorkspaceStory } from "@/lib/presentation/workspace-story";
import {
  createFollowUpMeetingAction,
  generateMeetingActionItemsAction,
  generateInterviewAction,
  processMeetingMemoryAction,
  sendMeetingSummaryAction,
  updateMeetingActionItemAction,
  updateOpportunityFromMeetingAction,
} from "@/features/meetings/actions";
import { formatMeetingDisplayText } from "@/features/meetings/display-copy";
import { MeetingV2RuntimeCard } from "@/features/meetings/meeting-v2-runtime-card";
import type { MeetingConnectorIngestionRetrievalSummary } from "@/lib/helm-v2/connector-ingestion-retrieval-runtime";
import { generateMeetingBriefingAction } from "@/features/memory/actions";
import { createActionFromRecommendationAction } from "@/features/recommendations/actions";
import { StartRecordingButton } from "@/features/conversation-capture/start-recording-button";
import type { DraftCommsRuntimeSummary } from "@/lib/helm-v2/draft-comms-handoff-runtime";
import type { HumanActionExecutionRuntimeSummary } from "@/lib/helm-v2/human-action-execution-runtime";
import type { MeetingRuntimeSummary } from "@/lib/helm-v2/meeting-action-pack-runtime";
import type { MemoryRetrievalPackSurfaceTrace } from "@/lib/memory/retrieval-pack-adapter";
import type { OfficialWriteRuntimeSummary } from "@/lib/helm-v2/official-system-integration-runtime";
import type { OpportunityJudgeRuntimeSummary } from "@/lib/helm-v2/opportunity-judge-runtime";
import {
  buildCustomerAssetHref,
  buildOpportunityAssetHref,
} from "@/features/business-assets/hrefs";

type ActionItemValue = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: Date | null;
  updatedAt: Date;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  executionMode:
    | "SUGGEST_ONLY"
    | "REQUIRES_APPROVAL"
    | "AUTO_WITHIN_THRESHOLD"
    | "FORBIDDEN";
  requiresApproval: boolean;
  ownerId: string | null;
  owner: { id?: string; name: string } | null;
  approvalTask: {
    status: "PENDING" | "EXECUTED" | "REJECTED" | "WITHDRAWN";
  } | null;
  contact: { name: string } | null;
};

type MeetingDetailClientProps = {
  actionGovernance: {
    canManage: boolean;
    canReview: boolean;
    manageDeniedMessage: string;
    reviewDeniedMessage: string;
  };
  runtimeGovernance: {
    canManage: boolean;
    canReview: boolean;
    manageDeniedMessage: string;
    reviewDeniedMessage: string;
  };
  meeting: {
    id: string;
    title: string;
    agenda: string | null;
    startsAt: Date;
    location: string | null;
    companyId: string | null;
    opportunityId: string | null;
    company: { id: string; name: string } | null;
    contacts: Array<{ id: string; name: string; title: string | null }>;
    opportunity: {
      id: string;
      title: string;
      type: string;
      stage:
        | "NEW"
        | "CONTACTED"
        | "ADVANCING"
        | "WAITING_THEM"
        | "INTERNAL_SYNC"
        | "DONE"
        | "LOST";
      riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      nextAction: string | null;
      company: { id: string; name: string } | null;
    } | null;
    note: {
      attendeesSummary: string | null;
      relationshipSummary: string | null;
      previousConclusion: string | null;
      meetingGoal: string | null;
      recommendedQuestions: string | null;
      riskAlerts: string | null;
      liveTranscript: string | null;
      summary: string | null;
      keyDecisions: string | null;
      confirmations: string | null;
    } | null;
    actionItems: ActionItemValue[];
    memoryFacts: Array<{
      id: string;
      title: string;
      content: string;
      confidence: number;
      objectType:
        | "CONTACT"
        | "COMPANY"
        | "OPPORTUNITY"
        | "MEETING"
        | "ACTION_ITEM"
        | "APPROVAL_TASK"
        | "POLICY_RULE"
        | "EMAIL_THREAD";
      objectId?: string;
      sourceType?: string | null;
      sourceId?: string | null;
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
    }>;
    blockers: Array<{
      id: string;
      title: string;
      blockerType: string;
      blockerText: string;
      severity: number;
      status: string;
      firstSeenAt: Date;
      updatedAt: Date;
      relatedContact: { id: string; name: string } | null;
      relatedCompany: { id: string; name: string } | null;
      relatedOpportunity: { id: string; title: string } | null;
    }>;
    memoryRetrievalPack: MemoryRetrievalPackSurfaceTrace | null;
    briefingSnapshot: {
      id: string;
      generatedAt: Date;
      payload: Record<string, unknown>;
    } | null;
    memoryEntries: Array<{
      id: string;
      title: string;
      content: string;
      createdAt: Date;
    }>;
    meetingRuntime: MeetingRuntimeSummary | null;
    meetingOpportunityJudgeRuntime: OpportunityJudgeRuntimeSummary | null;
    meetingDraftCommsRuntime: DraftCommsRuntimeSummary | null;
    meetingHumanActionExecutionRuntime: HumanActionExecutionRuntimeSummary | null;
    meetingOfficialWriteRuntime: OfficialWriteRuntimeSummary | null;
    meetingIngestionRetrievalRuntime: MeetingConnectorIngestionRetrievalSummary | null;
    dingtalkSignalSummary?: {
      total: number;
      byScope: Record<string, number>;
      items: Array<{
        id: string;
        scope: string;
        sourceType: string;
        sourceId: string;
        summary: string;
        flowModule: string;
        businessDomain: string;
        createdAt: Date;
      }>;
    };
    dingtalkWorkProgress?: Array<{
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
  memberships: Array<{ user: { id: string; name: string } }>;
  auditLogs: Array<{
    id: string;
    actor: string;
    actorType: string;
    actionType: string;
    summary: string;
    createdAt: Date;
  }>;
  recommendations: Array<{
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
  }>;
};

type ActionDraft = {
  actionItemId: string;
  title: string;
  description: string;
  dueDate: string;
  ownerId: string;
  executionMode: ActionItemValue["executionMode"];
};

function formatSnapshotSummary(value: string, english: boolean) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("{")) {
    const summaryMatch = trimmed.match(/"summary"\s*:\s*"([^"]+)/);
    if (summaryMatch?.[1]?.trim()) {
      return formatMeetingDisplayText(summaryMatch[1], english);
    }

    const parsed = safeParseJson<{
      summary?: unknown;
      recommendedNextSteps?: unknown;
      recentFacts?: unknown;
    }>(trimmed, {});
    const summary = typeof parsed.summary === "string" ? parsed.summary : "";
    if (summary.trim()) {
      return formatMeetingDisplayText(summary, english);
    }

    const nextStep = Array.isArray(parsed.recommendedNextSteps)
      ? parsed.recommendedNextSteps.find(
          (item): item is string => typeof item === "string",
        )
      : null;
    if (nextStep) {
      return formatMeetingDisplayText(nextStep, english);
    }
  }

  return formatMeetingDisplayText(trimmed, english);
}

export function MeetingDetailClient({
  actionGovernance,
  runtimeGovernance,
  meeting,
  memberships,
  auditLogs,
  recommendations,
}: MeetingDetailClientProps) {
  const router = useRouter();
  const { locale, demoMode } = useWorkspaceUi();
  const english = locale === "en-US";
  const text = (value: string) => formatMeetingDisplayText(value, english);
  const meetingTabIdPrefix = `meeting-${meeting.id}-tab`;
  const meetingTabTriggerIds = {
    briefing: `${meetingTabIdPrefix}-trigger-briefing`,
    notes: `${meetingTabIdPrefix}-trigger-notes`,
    actions: `${meetingTabIdPrefix}-trigger-actions`,
  } as const;
  const meetingTabContentIds = {
    briefing: `${meetingTabIdPrefix}-content-briefing`,
    notes: `${meetingTabIdPrefix}-content-notes`,
    actions: `${meetingTabIdPrefix}-content-actions`,
  } as const;
  const pageStory = getWorkspaceStory("meetings", locale, demoMode);
  const [pending, startTransition] = useTransition();
  const [editingAction, setEditingAction] = useState<ActionDraft | null>(null);
  const canManageGovernedActions = actionGovernance.canManage;
  const governedActionDisabled = pending || !canManageGovernedActions;
  const briefing = generateMeetingBriefing({
    note: meeting.note,
    opportunity: meeting.opportunity
      ? {
          type: meeting.opportunity.type as
            | "CLIENT"
            | "RECRUITING"
            | "PARTNERSHIP"
            | "INTERNAL",
          stage: meeting.opportunity.stage,
          riskLevel: meeting.opportunity.riskLevel,
          nextAction: meeting.opportunity.nextAction,
        }
      : null,
    attendees: meeting.contacts.map(
      (contact) =>
        `${contact.name}${contact.title ? ` · ${contact.title}` : ""}`,
    ),
  });

  const postActions = generatePostMeetingActionSuggestions({
    opportunity: meeting.opportunity
      ? {
          type: meeting.opportunity.type as
            | "CLIENT"
            | "RECRUITING"
            | "PARTNERSHIP"
            | "INTERNAL",
          stage: meeting.opportunity.stage,
          riskLevel: meeting.opportunity.riskLevel,
          nextAction: meeting.opportunity.nextAction,
        }
      : null,
    note: meeting.note,
  });

  const summaryPreview = useMemo(
    () =>
      [meeting.note?.summary, meeting.note?.confirmations]
        .filter((item): item is string => Boolean(item))
        .map((item) => formatMeetingDisplayText(item, english))
        .join("\n\n"),
    [english, meeting.note?.confirmations, meeting.note?.summary],
  );
  const snapshotPayload = meeting.briefingSnapshot?.payload as
    | {
        summary?: string;
        recentFacts?: Array<{ id: string; title: string }>;
        openCommitments?: Array<{
          id: string;
          title: string;
          dueDate?: string;
        }>;
        activeBlockers?: Array<{ id: string; title: string }>;
        recommendedQuestions?: string[];
        recommendedNextSteps?: string[];
        generationMode?: string;
        retrievalPackTrace?: MemoryRetrievalPackSurfaceTrace | null;
        llmMeta?: {
          model?: string;
          modelVersion?: string;
          modelRole?: string;
          provider?: string;
          promptKey?: string;
          promptVersion?: string;
          success?: boolean;
          fallbackUsed?: boolean;
          fallbackReason?: string;
        };
      }
    | undefined;
  const snapshotSummary = snapshotPayload?.summary
    ? formatSnapshotSummary(snapshotPayload.summary, english)
    : "";
  const activeRetrievalPackTrace =
    meeting.memoryRetrievalPack ?? snapshotPayload?.retrievalPackTrace ?? null;
  const dingtalkBriefingBlockers = useMemo(() => {
    if (!meeting.dingtalkWorkProgress?.length) {
      return [];
    }
    return meeting.dingtalkWorkProgress
      .map((item) => {
        const blockerText =
          item.needHelp ?? item.nextWeekPlan ?? item.previewText;
        if (!blockerText?.trim()) {
          return null;
        }
        return {
          reportId: item.reportId,
          reporterName:
            item.reporterName ?? (english ? "Unknown reporter" : "未知汇报人"),
          departmentName:
            item.departmentName ?? (english ? "Unknown dept" : "未知部门"),
          content: blockerText.trim(),
          createdAt: item.createdAt,
        };
      })
      .filter(
        (
          item,
        ): item is {
          reportId: string;
          reporterName: string;
          departmentName: string;
          content: string;
          createdAt: Date | null;
        } => Boolean(item),
      )
      .slice(0, 6);
  }, [english, meeting.dingtalkWorkProgress]);
  const noPushRisk =
    meeting.opportunity?.riskLevel === "CRITICAL"
      ? english
        ? "Don't move today and this slips into lost — or a competitor window."
        : "今天不动，这条机会就要掉进失效或竞争对手窗口。"
      : meeting.opportunity?.type === "RECRUITING"
        ? english
          ? "Don't move today and the candidate keeps cooling down."
          : "今天不动，候选人继续降温。"
        : english
          ? "Don't move today and conclusions stay stuck in the notes."
          : "今天不动，结论就停在纪要里。";
  const topBlocker = meeting.blockers[0] ?? null;
  const topCommitment =
    meeting.commitments.find((item) => item.overdueFlag) ??
    meeting.commitments[0] ??
    null;
  const overdueCommitmentCount = meeting.commitments.filter(
    (item) => item.overdueFlag,
  ).length;
  const pendingApprovalCount = meeting.actionItems.filter(
    (item) => item.approvalTask?.status === "PENDING" || item.requiresApproval,
  ).length;
  const primaryRecommendation = recommendations[0] ?? null;
  const primaryNextStepTitle =
    primaryRecommendation?.title ??
    meeting.actionItems[0]?.title ??
    meeting.opportunity?.nextAction ??
    (english
      ? "Generate the post-meeting action set first."
      : "先把会后动作生成出来。");
  const primaryBoundaryLine =
    pendingApprovalCount > 0
      ? english
        ? `${pendingApprovalCount} post-meeting actions waiting on approval.`
        : `${pendingApprovalCount} 条会后动作在等审批。`
      : primaryRecommendation?.policyResult === "REQUIRES_APPROVAL"
        ? english
          ? "Approval required — action stays prepared."
          : "需要审批——动作先备好。"
        : english
          ? "Low-risk — can move without approval."
          : "低风险——可以推进，不必审批。";
  const linkedObjectSummary = [
    meeting.opportunity?.title
      ? english
        ? `Opportunity: ${meeting.opportunity.title}`
        : `机会：${meeting.opportunity.title}`
      : null,
    meeting.company?.name
      ? english
        ? `Company: ${meeting.company.name}`
        : `公司：${meeting.company.name}`
      : null,
    meeting.contacts.length
      ? english
        ? `Contacts: ${meeting.contacts.map((contact) => contact.name).join(", ")}`
        : `联系人：${meeting.contacts.map((contact) => contact.name).join("、")}`
      : null,
  ]
    .filter(Boolean)
    .join(english ? " · " : " · ");
  const followUpPressureLine = topCommitment
    ? english
      ? `Most urgent: close "${topCommitment.title}" first.`
      : `最急：先补齐「${topCommitment.title}」。`
    : topBlocker
      ? english
        ? `Biggest drag: "${topBlocker.title}". Clear it before adding more.`
        : `最大阻力：「${topBlocker.title}」。先清掉再加新动作。`
      : english
        ? "No urgent commitment or blocker. Good time to turn outcomes into actions."
        : "没有紧急承诺或阻塞。适合把结论转成动作。";
  const meetingImpactLine = meeting.opportunity
    ? english
      ? `Directly affects "${meeting.opportunity.title}" — stage, timeline, approval.`
      : `直接影响「${meeting.opportunity.title}」——阶段、时间线、审批。`
    : english
      ? "Mainly affects post-meeting routing and memory. Close within 24 hours."
      : "主要影响会后分派和记忆沉淀。24 小时内收口。";
  const baseMeetingMemoryBundle = useMemo(
    () =>
      buildMeetingMemoryBundle(
        {
          meeting: {
            id: meeting.id,
            title: meeting.title,
            summary: meeting.note?.summary,
            keyDecisions: meeting.note?.keyDecisions,
            openQuestions: meeting.note?.recommendedQuestions,
            startsAt: meeting.startsAt,
            location: meeting.location,
            attendeeNames: meeting.contacts.map((contact) => contact.name),
          },
          memoryFacts: meeting.memoryFacts,
          commitments: meeting.commitments.map((item) => ({
            ...item,
            relatedMeeting: { id: meeting.id, title: meeting.title },
          })),
          blockers: meeting.blockers.map((item) => ({
            ...item,
            relatedMeeting: { id: meeting.id, title: meeting.title },
          })),
          memoryEntries: meeting.memoryEntries,
          affectedObjects: [
            { id: meeting.id, objectType: "MEETING", label: meeting.title },
            ...(meeting.opportunity
              ? [
                  {
                    id: meeting.opportunity.id,
                    objectType: "OPPORTUNITY" as const,
                    label: meeting.opportunity.title,
                  },
                ]
              : []),
            ...(meeting.company
              ? [
                  {
                    id: meeting.company.id,
                    objectType: "COMPANY" as const,
                    label: meeting.company.name,
                  },
                ]
              : []),
            ...meeting.contacts.map((contact) => ({
              id: contact.id,
              objectType: "CONTACT" as const,
              label: contact.name,
            })),
          ],
        },
        english,
      ),
    [english, meeting],
  );
  const [meetingReviewHoldItemIds, setMeetingReviewHoldItemIds] = useState<
    string[]
  >([]);
  const meetingMemoryBundle = useMemo(
    () =>
      applyMeetingMemoryReviewOnlyOverrides(
        baseMeetingMemoryBundle,
        meetingReviewHoldItemIds,
        english,
      ),
    [baseMeetingMemoryBundle, english, meetingReviewHoldItemIds],
  );
  const meetingMemoryLoopSummary = useMemo(
    () => buildMeetingMemoryLoopSummary(meetingMemoryBundle, english),
    [english, meetingMemoryBundle],
  );
  const meetingMemoryGovernanceSummary = useMemo(
    () => buildMeetingMemoryGovernanceSummary(meetingMemoryBundle, english),
    [english, meetingMemoryBundle],
  );
  const meetingTemplateSummary = useMemo(
    () =>
      buildMeetingTemplateSummary(
        {
          title: meeting.title,
          summary: meeting.note?.summary,
          goal: meeting.note?.meetingGoal,
          opportunityType: meeting.opportunity?.type ?? null,
          attendeeCount: meeting.contacts.length,
          hasOpenFollowThrough:
            meeting.actionItems.length > 0 || meeting.commitments.length > 0,
          hasBlockers: meeting.blockers.length > 0,
        },
        english,
      ),
    [
      english,
      meeting.actionItems.length,
      meeting.blockers.length,
      meeting.commitments.length,
      meeting.contacts.length,
      meeting.note?.meetingGoal,
      meeting.note?.summary,
      meeting.opportunity?.type,
      meeting.title,
    ],
  );
  const meetingWorkspaceLightSummary = useMemo(
    () => buildMeetingWorkspaceLightSummary(meetingMemoryBundle, english),
    [english, meetingMemoryBundle],
  );
  const meetingMemorySourceUseLedger = useMemo(
    () => buildMeetingMemorySourceUseLedger(meetingMemoryBundle, english),
    [english, meetingMemoryBundle],
  );
  const meetingMemoryExportPayload = useMemo(
    () => buildMeetingMemoryExportPayload(meetingMemoryBundle, english),
    [english, meetingMemoryBundle],
  );
  const manualReviewHoldCount = meetingReviewHoldItemIds.length;
  const calendarIngressPointer = useMemo(
    () =>
      meetingMemoryBundle.sourcePointers.find((pointer) =>
        pointer.id.startsWith("calendar:"),
      ) ?? null,
    [meetingMemoryBundle],
  );
  const threadIngressPointer = useMemo(
    () =>
      meetingMemoryBundle.sourcePointers.find((pointer) =>
        pointer.id.startsWith("thread:"),
      ) ?? null,
    [meetingMemoryBundle],
  );
  const affectedObjectsPointer = useMemo(
    () =>
      meetingMemoryBundle.sourcePointers.find((pointer) =>
        pointer.id.startsWith("objects:"),
      ) ?? null,
    [meetingMemoryBundle],
  );
  const promotedMeetingMemoryItems = useMemo(
    () =>
      meetingMemoryBundle.items
        .filter((item) => item.lifecycle === "promoted")
        .slice(0, 3),
    [meetingMemoryBundle],
  );
  const pendingMeetingMemoryItems = useMemo(
    () =>
      meetingMemoryBundle.items
        .filter((item) =>
          ["ready", "pending-review", "conflict"].includes(item.lifecycle),
        )
        .slice(0, 4),
    [meetingMemoryBundle],
  );
  const promotedMeetingMemoryEntries = useMemo(
    () =>
      promotedMeetingMemoryItems.map((item) => ({
        item,
        governance: buildMeetingMemoryItemGovernanceSummary(
          item,
          meetingMemoryBundle.meetingId,
          english,
        ),
      })),
    [english, meetingMemoryBundle.meetingId, promotedMeetingMemoryItems],
  );
  const pendingMeetingMemoryEntries = useMemo(
    () =>
      pendingMeetingMemoryItems.map((item) => ({
        item,
        governance: buildMeetingMemoryItemGovernanceSummary(
          item,
          meetingMemoryBundle.meetingId,
          english,
        ),
      })),
    [english, meetingMemoryBundle.meetingId, pendingMeetingMemoryItems],
  );
  const meetingWorkspaceSummary =
    pendingApprovalCount > 0
      ? english
        ? `${meetingMemoryBundle.promotedCount} memories landed; ${pendingApprovalCount} actions still need review.`
        : `已沉淀 ${meetingMemoryBundle.promotedCount} 条记忆；${pendingApprovalCount} 条动作还要复核。`
      : english
        ? "Writebacks, open questions, next steps — all visible. Page doesn't execute or send on its own."
        : "写回、待澄清、下一步——都在一层。本页不替你执行或发送。";
  const meetingReviewPostureLine =
    meetingMemoryLoopSummary.blockingLifecycle === "conflict"
      ? english
        ? "Memory conflict — fix the writeback before moving on."
        : "记忆冲突——先修正写回，再继续。"
      : meetingMemoryLoopSummary.blockingLifecycle === "pending-review"
        ? english
          ? "Next step: human review. Keep the output explicit for now."
          : "下一步：人工复核。先保持显式。"
        : meetingMemoryLoopSummary.blockingLifecycle === "ready"
          ? english
            ? "Memory readable. Confirm before promoting it downstream."
            : "记忆可读。确认后再写入下游。"
          : english
            ? "Writeback is already shaping downstream. Keep the follow-through moving."
            : "写回已影响下游。继续推进。";
  const meetingIngressAttendeeLine =
    meeting.note?.attendeesSummary ??
    (meeting.contacts.length
      ? english
        ? `Participants currently in view: ${meeting.contacts.map((contact) => contact.name).join(", ")}.`
        : `当前已进入视野的参与者：${meeting.contacts.map((contact) => contact.name).join("、")}。`
      : english
        ? "No explicit attendee context is visible yet."
        : "当前还没有显式参与者上下文。");
  const meetingIngressContinuityLine = meeting.note?.previousConclusion
    ? english
      ? `Continuity from prior meeting/object state: ${meeting.note.previousConclusion}`
      : `来自上一轮会议 / 对象状态的连续性：${text(meeting.note.previousConclusion)}`
    : meeting.note?.relationshipSummary
      ? english
        ? `Existing relationship continuity: ${meeting.note.relationshipSummary}`
        : `当前可见的关系连续性：${text(meeting.note.relationshipSummary)}`
      : (affectedObjectsPointer?.summary ??
        (english
          ? "Connected through object state, not a prior-meeting note."
          : "通过对象状态接入，没有上一次会议的结论。"));
  const meetingReviewSnapshotSummary = english
    ? `${meeting.memoryFacts.length} facts, ${meeting.commitments.length} commitments, ${meeting.blockers.length} blockers and ${pendingApprovalCount} review gates in view.`
    : `当前可见 ${meeting.memoryFacts.length} 条事实、${meeting.commitments.length} 条承诺、${meeting.blockers.length} 个卡点和 ${pendingApprovalCount} 个复核关口。`;
  const meetingIngressPressureLine = topCommitment
    ? english
      ? `Main pressure: "${topCommitment.title}". This meeting is a follow-through checkpoint.`
      : `主要压力：「${topCommitment.title}」。这场会是跟进检查点。`
    : topBlocker
      ? english
        ? `Main pressure: "${topBlocker.title}". Read this meeting as a blocker clearing.`
        : `主要压力：「${topBlocker.title}」。这场会是来解卡点的。`
      : primaryBoundaryLine;
  const meetingIngressFollowThroughLine =
    meeting.actionItems.length > 0
      ? english
        ? `${meeting.actionItems.length} post-meeting action(s) are already visible here, so this event is not just being remembered; it is already feeding the follow-through workspace.`
        : `当前这里已经可见 ${meeting.actionItems.length} 条会后动作，所以这场事件不只是被记住了，而是已经开始进入后续推进工作台。`
      : pendingApprovalCount > 0
        ? english
          ? `${pendingApprovalCount} review-sensitive move(s) are already queued behind the boundary, so this meeting is clearly connected to the next formal follow-through step.`
          : `当前已有 ${pendingApprovalCount} 条需要复核的动作排在边界后面，说明这场会议已经明确接上正式的下一步推进。`
        : english
          ? "The next visible handoff is still thin, so this meeting currently relies more on memory and object continuity than on an already-materialized follow-through item."
          : "当前下一步交接还比较薄，所以这场会议暂时更多依赖记忆和对象连续性，而不是一条已经显形的会后动作。";
  const localRecentMeetingContext = (() => {
    if (meeting.note?.previousConclusion) {
      return {
        label: english
          ? "Local recent-meeting continuity"
          : "本地最近会议连续性",
        summary: english
          ? `Visible continuity from a recent related meeting: ${meeting.note.previousConclusion}`
          : `当前可见的最近相关会议连续性：${text(meeting.note.previousConclusion)}`,
      };
    }
    if (meeting.note?.relationshipSummary) {
      return {
        label: english ? "Local relationship continuity" : "本地关系连续性",
        summary: english
          ? `Visible continuity from the same local workspace context: ${meeting.note.relationshipSummary}`
          : `当前可见的本地工作台连续性：${text(meeting.note.relationshipSummary)}`,
      };
    }
    return null;
  })();
  const askHelmPrompts = useMemo(
    () => [
      english
        ? "Why does this meeting matter right now?"
        : "这场会为什么现在最重要？",
      english
        ? "What is already prepared from this meeting?"
        : "这场会当前已经准备出什么？",
      english
        ? "What should we do next after this meeting?"
        : "这场会后现在最该推进什么？",
      english
        ? "What still needs review before it becomes stable memory?"
        : "哪些内容还需要复核，不能直接当成稳定记忆？",
      english
        ? "What continuity from related recent meetings matters here?"
        : "最近相关会议的哪条连续性在这里最重要？",
    ],
    [english],
  );
  const meetingGuidanceRecommendations = [
    {
      title: english
        ? "Start from the next move, not the raw note"
        : "先看下一步，而不是原始纪要",
      body: primaryBoundaryLine,
      meta: primaryNextStepTitle,
    },
    {
      title: english
        ? "Read the current review posture before promoting writeback"
        : "在提升写回前先读当前复核状态",
      body: meetingReviewPostureLine,
      meta: meetingWorkspaceLightSummary.visibilityLabel,
    },
    {
      title: english
        ? "Keep object impact and follow-through in one frame"
        : "把对象影响和后续推进放在同一视野里",
      body: meetingImpactLine,
      meta: linkedObjectSummary || undefined,
    },
  ];
  const displayMeetingWorkspaceSummary = text(meetingWorkspaceSummary);
  const displayMeetingReviewPostureLine = text(meetingReviewPostureLine);
  const displayMeetingReviewSnapshotSummary = text(
    meetingReviewSnapshotSummary,
  );
  const displayMeetingIngressPressureLine = text(meetingIngressPressureLine);
  const displayMeetingIngressFollowThroughLine = text(
    meetingIngressFollowThroughLine,
  );
  const displayMeetingGuidanceRecommendations =
    meetingGuidanceRecommendations.map((item) => ({
      ...item,
      title: text(item.title),
      body: text(item.body),
      meta: item.meta ? text(item.meta) : item.meta,
    }));
  const meetingGuidanceReminders = [
    {
      title: english ? "Attendee signal" : "参与者信号",
      body: meetingIngressAttendeeLine,
    },
    {
      title: english ? "Continuity signal" : "连续性信号",
      body: meetingIngressContinuityLine,
    },
    {
      title: english ? "Follow-through signal" : "跟进信号",
      body: displayMeetingIngressFollowThroughLine,
      meta: displayMeetingIngressPressureLine,
    },
  ];
  const [askHelmQuery, setAskHelmQuery] = useState(askHelmPrompts[0] ?? "");
  const [activeAskHelmQuery, setActiveAskHelmQuery] = useState(
    askHelmPrompts[0] ?? "",
  );
  const askHelmAnswer = useMemo(
    () =>
      buildMeetingScopedAskHelmAnswer({
        question: activeAskHelmQuery,
        meeting,
        meetingMemoryBundle,
        meetingMemoryGovernanceSummary,
        meetingMemoryLoopSummary,
        meetingTemplateSummary,
        meetingWorkspaceLightSummary,
        localRecentMeetingContext,
        linkedObjectSummary,
        meetingImpactLine,
        primaryNextStepTitle,
        primaryBoundaryLine,
        topCommitment,
        topBlocker,
        pendingApprovalCount,
        english,
      }),
    [
      activeAskHelmQuery,
      english,
      linkedObjectSummary,
      meeting,
      meetingImpactLine,
      meetingMemoryBundle,
      meetingMemoryGovernanceSummary,
      meetingMemoryLoopSummary,
      meetingTemplateSummary,
      meetingWorkspaceLightSummary,
      localRecentMeetingContext,
      pendingApprovalCount,
      primaryBoundaryLine,
      primaryNextStepTitle,
      topBlocker,
      topCommitment,
    ],
  );

  const exportMeetingMemoryBundle = () => {
    downloadMeetingMemoryBundleExport(
      meetingMemoryExportPayload,
      `meeting-memory-${meeting.id}`,
    );
    toast.success(
      english ? "Meeting memory bundle exported" : "会议记忆包已导出",
    );
  };

  const movePromotedItemBackToReview = (itemId: string, title: string) => {
    setMeetingReviewHoldItemIds((current) =>
      current.includes(itemId) ? current : [...current, itemId],
    );
    toast.success(
      english
        ? `${title} moved back behind review`
        : `已将“${title}”退回到复核后面`,
    );
  };

  const restorePromotedItemPosture = (itemId: string, title: string) => {
    setMeetingReviewHoldItemIds((current) =>
      current.filter((currentId) => currentId !== itemId),
    );
    toast.success(
      english
        ? `${title} restored to promoted posture`
        : `已恢复“${title}”的已提升姿态`,
    );
  };

  const runAction = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
    pushTo?: string,
  ) => {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error ?? (english ? "Action failed" : "操作失败"));
        return;
      }
      toast.success(success);
      if (pushTo) router.push(pushTo);
      router.refresh();
    });
  };

  const meetingSecondaryContext = (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_360px]">
      <WorkspaceGuidancePanel
        eyebrow={english ? "Meeting guidance" : "会议引导"}
        title={
          english
            ? "Use the meeting surface to connect context, review posture and the next formal move."
            : "把会议页面当成连接上下文、复核状态和正式下一步的主回路。"
        }
        summary={
          english
            ? "This page should explain what changed, what already wrote back into memory, and what still needs explicit review before any follow-through becomes real execution."
            : "直接确认这场会改变了什么、哪些内容已经回写进记忆、以及哪些会后动作在变成真实执行前仍需要显式复核。"
        }
        recommendations={displayMeetingGuidanceRecommendations}
        reminders={meetingGuidanceReminders}
        recommendationsLabel={english ? "Recommended next moves" : "建议先处理"}
        remindersLabel={english ? "Meeting reminders" : "会议提醒"}
        boundaryLabel={english ? "Boundary" : "边界"}
        boundary={
          canManageGovernedActions
            ? english
              ? `${primaryBoundaryLine} This surface can prepare, review and route follow-through, but it still does not grant autonomous send authority.`
              : `${primaryBoundaryLine} 这个页面可以准备、复核并路由后续推进，但它仍不代表获得了自动发送权限。`
            : actionGovernance.manageDeniedMessage
        }
      />
      <div className="workspace-surface-stack">
        <WorkspaceSurfacePreferences />
        <Card className="workspace-form-assist workspace-panel-muted">
          <CardContent className="space-y-3 py-5">
            <p className="workspace-eyebrow">
              {english ? "Meeting assist" : "会议辅助"}
            </p>
            <p className="text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
              {english
                ? "Move from context to follow-through without losing the review boundary."
                : "在不丢失复核边界的前提下，把上下文更快推到后续推进。"}
            </p>
            <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
              {english
                ? "Refresh memory, regenerate next steps, route the summary when ready."
                : "刷新记忆、重新生成下一步、草稿好了再送审。"}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  runAction(
                    () => processMeetingMemoryAction(meeting.id),
                    english
                      ? "Meeting memory reprocessed"
                      : "会议记忆已重新处理",
                  )
                }
              >
                {english ? "Process memory" : "处理记忆"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  runAction(
                    () => generateMeetingBriefingAction(meeting.id),
                    english ? "Briefing snapshot refreshed" : "已刷新简报快照",
                  )
                }
              >
                {english ? "Refresh briefing" : "刷新简报"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={governedActionDisabled}
                onClick={() =>
                  runAction(
                    () => generateMeetingActionItemsAction(meeting.id),
                    english
                      ? "Post-meeting action items generated"
                      : "已生成会后动作项",
                  )
                }
              >
                {english ? "Generate action items" : "生成会后动作"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={governedActionDisabled}
                onClick={() =>
                  runAction(
                    () => sendMeetingSummaryAction(meeting.id),
                    english
                      ? "Summary draft created and routed to approvals"
                      : "已生成纪要并进入审批",
                    "/approvals",
                  )
                }
              >
                {english ? "Route summary to approvals" : "送纪要到审批"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const saveActionItem = () => {
    if (!editingAction) return;

    startTransition(async () => {
      const result = await updateMeetingActionItemAction(editingAction);
      if (!result.ok) {
        toast.error(
          result.error ?? (english ? "Action update failed" : "动作更新失败"),
        );
        return;
      }
      toast.success(english ? "Post-meeting action updated" : "会后动作已更新");
      setEditingAction(null);
      router.refresh();
    });
  };
  const linkedOpportunityAssetHref = meeting.opportunity
    ? buildOpportunityAssetHref(meeting.opportunity.id, "meeting-detail")
    : null;
  const linkedCustomerAssetHref = meeting.company
    ? buildCustomerAssetHref(meeting.company.id, "meeting-detail")
    : null;

  return (
    <div className="workspace-surface-stack">
      <PageHeader
        eyebrow={pageStory.eyebrow}
        title={meeting.title}
        titleAs="h2"
        description={`${pageStory.description} · ${formatDateLabel(meeting.startsAt)} · ${meeting.company?.name ?? (english ? "No linked company" : "未关联公司")}`}
        actions={
          <>
            <StartRecordingButton
              variant="secondary"
              objectType="MEETING"
              objectId={meeting.id}
              objectLabel={meeting.title}
              defaultTitle={
                english
                  ? `${meeting.title} live capture`
                  : `${meeting.title} 现场记录`
              }
            />
            {linkedOpportunityAssetHref || linkedCustomerAssetHref ? (
              <Button variant="secondary" asChild>
                <Link
                  href={linkedOpportunityAssetHref ?? linkedCustomerAssetHref ?? "#"}
                >
                  {linkedOpportunityAssetHref
                    ? english
                      ? "Open opportunity asset"
                      : "打开机会资产"
                    : english
                      ? "Open customer asset"
                      : "打开客户资产"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
            <Button
              variant="secondary"
              disabled={governedActionDisabled}
              onClick={() =>
                runAction(
                  () => generateMeetingActionItemsAction(meeting.id),
                  english
                    ? "Post-meeting action items generated"
                    : "已生成会后动作项",
                )
              }
            >
              <Sparkles className="h-4 w-4" />
              {english ? "Generate action items" : "生成会后动作"}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                runAction(
                  () => processMeetingMemoryAction(meeting.id),
                  english ? "Meeting memory reprocessed" : "会议记忆已重新处理",
                )
              }
            >
              <Sparkles className="h-4 w-4" />
              {english ? "Process meeting memory" : "处理会议记忆"}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                runAction(
                  () => generateMeetingBriefingAction(meeting.id),
                  english ? "Briefing snapshot refreshed" : "已刷新简报快照",
                )
              }
            >
              <Sparkles className="h-4 w-4" />
              {english ? "Refresh memory briefing" : "刷新记忆简报"}
            </Button>
            <Button
              disabled={governedActionDisabled}
              onClick={() =>
                runAction(
                  () => sendMeetingSummaryAction(meeting.id),
                  english
                    ? "Summary draft created and routed to approvals"
                    : "已生成纪要并进入审批",
                  "/approvals",
                )
              }
            >
              <FileText className="h-4 w-4" />
              {english
                ? "Generate summary and send to approvals"
                : "生成纪要并送审"}
            </Button>
            <Button
              variant="secondary"
              disabled={governedActionDisabled}
              onClick={() =>
                runAction(
                  () => createFollowUpMeetingAction(meeting.id),
                  english
                    ? "Follow-up meeting action created"
                    : "已生成后续会议动作",
                  "/approvals",
                )
              }
            >
              <CalendarPlus className="h-4 w-4" />
              {english ? "Create follow-up meeting" : "创建后续会议"}
            </Button>
          </>
        }
      />

      <HomeSurfaceArrivalBanner
        kind="detail"
        english={english}
        contract={{
          ownership: english
            ? "Meeting detail owns live context, follow-through review posture and the meeting workspace."
            : "会议详情负责现场上下文、会后动作复核姿态和会议工作区。",
          nextStep: english
            ? "Start in the meeting workspace, then decide whether the next move belongs in follow-through, memory, or approvals."
            : "先从会议工作区开始，再决定下一步应该落在会后推进、记忆还是审批。",
          boundary: english
            ? "This page can prepare, review and route follow-through, but it still does not grant autonomous send authority."
            : "这个页面可以准备、复核并路由会后推进，但不会获得自动发送权限。",
        }}
      />

      {meeting.dingtalkSignalSummary?.total ? (
        <Card className="workspace-panel-muted border-[color:var(--border)]">
          <CardHeader>
            <CardTitle className="text-base tracking-tight text-[color:var(--foreground)]">
              {english ? "DingTalk signal routing" : "钉钉信号流转"}
            </CardTitle>
            <CardDescription className="text-sm leading-6 text-[color:var(--muted-foreground)]">
              {english
                ? `${meeting.dingtalkSignalSummary.total} DingTalk signals linked to this meeting.`
                : `${meeting.dingtalkSignalSummary.total} 条钉钉信号关联到这场会议。`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {Object.entries(meeting.dingtalkSignalSummary.byScope).map(
                ([scope, count]) => (
                  <Badge key={scope} variant="info">
                    {scope}: {count}
                  </Badge>
                ),
              )}
            </div>
            <div className="space-y-2">
              {meeting.dingtalkSignalSummary.items.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[color:var(--border)] px-3 py-2 text-sm"
                >
                  <p className="font-medium text-[color:var(--foreground)]">
                    {item.scope} · {item.flowModule} · {item.businessDomain}
                  </p>
                  <p className="text-[color:var(--muted-foreground)]">
                    {trimText(item.summary, 120)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {meeting.dingtalkWorkProgress?.length ? (
        <Card className="workspace-panel-muted border-[color:var(--border)]">
          <CardHeader>
            <CardTitle className="text-base tracking-tight text-[color:var(--foreground)]">
              {english ? "DingTalk work progress" : "钉钉工作进度"}
            </CardTitle>
            <CardDescription className="text-sm leading-6 text-[color:var(--muted-foreground)]">
              {english
                ? "Read-only progress stream from DingTalk — reporter and department included."
                : "钉钉只读工作进度——附带汇报人和部门信息。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {meeting.dingtalkWorkProgress.map((item) => (
              <div
                key={item.reportId}
                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info">
                    {item.templateName ??
                      (english ? "Work report" : "工作汇报")}
                  </Badge>
                  <Badge variant="neutral">
                    {item.reporterName ??
                      (english ? "Unknown reporter" : "未知汇报人")}
                  </Badge>
                  <Badge variant="neutral">
                    {item.departmentName ??
                      (english ? "Unknown dept" : "未知部门")}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                  {(english ? "Reported at: " : "汇报时间：") +
                    formatDateLabel(item.createdAt)}
                </p>
                {item.weeklySummary ? (
                  <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                    {english ? "Summary: " : "总结："}
                    {trimText(item.weeklySummary, 220)}
                  </p>
                ) : null}
                {item.nextWeekPlan ? (
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                    {english ? "Next plan: " : "下周计划："}
                    {trimText(item.nextWeekPlan, 220)}
                  </p>
                ) : null}
                {item.needHelp ? (
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                    {english ? "Need help: " : "需协同："}
                    {trimText(item.needHelp, 220)}
                  </p>
                ) : null}
                {item.sections.length ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-[color:var(--muted-foreground)]">
                      {english
                        ? "View full report details"
                        : "查看完整汇报内容"}
                    </summary>
                    <div className="mt-2 space-y-2">
                      {item.sections.map((section, index) => (
                        <div
                          key={`${item.reportId}-section-${index}`}
                          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2 py-2"
                        >
                          <p className="text-xs font-medium text-[color:var(--foreground)]">
                            {section.key ?? (english ? "Section" : "分段")}
                          </p>
                          <pre className="mt-1 whitespace-pre-wrap text-xs leading-6 text-[color:var(--muted-foreground)]">
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

      {!canManageGovernedActions ? (
        <div
          className="workspace-note-card px-4 py-4 text-sm leading-7 text-[color:var(--foreground)]"
          data-tone="amber"
        >
          {actionGovernance.manageDeniedMessage}
        </div>
      ) : null}

      <Card id="meeting-workspace" className="workspace-panel">
        <CardContent className="grid gap-4 py-5 xl:grid-cols-[1.12fr_0.88fr]">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">
                {english ? "Meeting OS wedge" : "会议推进主线"}
              </Badge>
              <Badge variant="neutral">{meetingTemplateSummary.label}</Badge>
              <Badge
                variant={
                  meetingWorkspaceLightSummary.visibilityCue === "review-only"
                    ? "approval"
                    : meetingWorkspaceLightSummary.visibilityCue ===
                        "promoted-to-object-state"
                      ? "success"
                      : "neutral"
                }
              >
                {meetingWorkspaceLightSummary.visibilityLabel}
              </Badge>
              {meeting.opportunity ? (
                <StageBadge stage={meeting.opportunity.stage} />
              ) : null}
              {meeting.opportunity ? (
                <RiskBadge risk={meeting.opportunity.riskLevel} />
              ) : null}
              {pendingApprovalCount > 0 ? (
                <Badge variant="approval">
                  {english
                    ? `${pendingApprovalCount} waiting review`
                    : `${pendingApprovalCount} 条待复核`}
                </Badge>
              ) : null}
            </div>
            <div className="space-y-2">
              <p className="text-lg font-semibold text-[color:var(--foreground)]">
                {english
                  ? "This meeting is the shortest path from context to action, approval and memory writeback."
                  : "这场会负责把现场上下文接回目标推进链，判断它改变了哪些经营状态、下一步和复核边界。"}
              </p>
              <p className="text-sm leading-6 text-[color:var(--muted)]">
                {text(meetingTemplateSummary.summary)}
              </p>
              <p className="text-sm leading-7 text-[color:var(--muted)]">
                {meetingImpactLine}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                  {english ? "Related object state" : "受影响的经营状态"}
                </p>
                <p className="mt-2 font-medium text-[color:var(--foreground)]">
                  {linkedObjectSummary ||
                    (english ? "No linked object yet" : "当前还没有关联对象")}
                </p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  {text(meetingTemplateSummary.objectEmphasisLine)}
                </p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {english
                    ? "Linked items keep updating the briefing and what's flagged after the meeting."
                    : "这些关联会继续更新简报和会后要追的事。"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {linkedOpportunityAssetHref ? (
                    <Button asChild size="sm" variant="secondary">
                      <Link href={linkedOpportunityAssetHref}>
                        {english ? "Open opportunity asset" : "打开机会资产"}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                  {linkedCustomerAssetHref ? (
                    <Button asChild size="sm" variant="ghost">
                      <Link href={linkedCustomerAssetHref}>
                        {english ? "Open customer asset" : "打开客户资产"}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                  {english ? "Current next move" : "当前最该推进的一步"}
                </p>
                <p className="mt-2 font-medium text-[color:var(--foreground)]">
                  {primaryNextStepTitle}
                </p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  {text(meetingTemplateSummary.nextStepLine)}
                </p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {primaryBoundaryLine}
                </p>
              </div>
            </div>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div data-meeting-review-snapshot="true">
              <ControlledDisclosure
                className="theme-surface-panel-soft rounded-2xl"
                defaultExpanded={false}
                summaryClassName="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-4"
                bodyClassName="border-t border-[color:var(--border)] px-4 py-4"
                summary={
                  <>
                    <div className="min-w-0 space-y-2">
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                        {english ? "Review snapshot" : "复核快照"}
                      </p>
                      <p className="text-sm leading-6 text-[color:var(--muted)]">
                        {displayMeetingReviewSnapshotSummary}
                      </p>
                    </div>
                    <div className="inline-flex shrink-0 items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
                      <span>{english ? "Open" : "展开"}</span>
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </>
                }
              >
                <div className="grid grid-cols-2 gap-3 text-sm text-[color:var(--muted)]">
                  <div>
                    <p className="text-lg font-semibold text-[color:var(--foreground)]">
                      {meeting.memoryFacts.length}
                    </p>
                    <p>{english ? "supporting facts" : "支持事实"}</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-[color:var(--foreground)]">
                      {meeting.commitments.length}
                    </p>
                    <p>{english ? "commitments" : "承诺"}</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-[color:var(--foreground)]">
                      {meeting.blockers.length}
                    </p>
                    <p>{english ? "blockers" : "阻塞"}</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-[color:var(--foreground)]">
                      {pendingApprovalCount}
                    </p>
                    <p>{english ? "review gates" : "需人工复核"}</p>
                  </div>
                </div>
                {activeRetrievalPackTrace ? (
                  <div className="mt-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="info">
                        {english ? "Retrieval pack" : "检索包"}
                      </Badge>
                      <Badge variant="neutral">
                        {english
                          ? `Selected ${activeRetrievalPackTrace.trace.selectedCount}`
                          : `入选 ${activeRetrievalPackTrace.trace.selectedCount}`}
                      </Badge>
                      <Badge variant="neutral">
                        {english
                          ? `Omitted ${activeRetrievalPackTrace.trace.omittedCount}`
                          : `省略 ${activeRetrievalPackTrace.trace.omittedCount}`}
                      </Badge>
                      {activeRetrievalPackTrace.fallback.used ? (
                        <Badge variant="warning">
                          {english ? "Fallback" : "回退"}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                      {english
                        ? activeRetrievalPackTrace.trace.boundaryNote
                        : text(
                            "检索资料只做证据打包；不会改变建议排序、审批负责人或承诺权限。",
                          )}
                    </p>
                  </div>
                ) : null}
                <p className="mt-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {displayMeetingReviewPostureLine}
                </p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {text(meetingWorkspaceLightSummary.summary)}
                </p>
                {manualReviewHoldCount > 0 ? (
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                    {english
                      ? `${manualReviewHoldCount} promoted meeting-memory item(s) are currently being held back behind review on this page, so the visible writeback stays explicit and reversible.`
                      : `当前有 ${manualReviewHoldCount} 条已提升会议记忆在这个页面里被人工保留在复核之后，所以可见写回仍然保持显式且可逆。`}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={exportMeetingMemoryBundle}
                  >
                    <Download className="h-4 w-4" />
                    {english
                      ? "Export meeting memory bundle"
                      : "导出会议记忆包"}
                  </Button>
                </div>
              </ControlledDisclosure>
            </div>
            <div className="space-y-3 rounded-2xl border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_94%,white_6%)] px-4 py-4">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "Go next" : "现在继续往下走"}
              </p>
              <Button
                className="w-full justify-start"
                disabled={governedActionDisabled}
                onClick={() =>
                  runAction(
                    () => sendMeetingSummaryAction(meeting.id),
                    english ? "Summary action created" : "纪要动作已生成",
                    "/approvals#meeting-follow-through-review",
                  )
                }
              >
                <FileText className="h-4 w-4" />
                {english
                  ? "Send summary draft to approvals"
                  : "把纪要草稿送进复核与边界"}
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start"
                asChild
              >
                <Link
                  href={`/memory?objectType=MEETING&objectId=${meeting.id}`}
                >
                  {english ? "Open meeting memory" : "打开会议记忆"}
                </Link>
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start"
                onClick={exportMeetingMemoryBundle}
              >
                <Download className="h-4 w-4" />
                {english ? "Export bundle" : "导出记忆包"}
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start"
                asChild
              >
                <Link href="/approvals#meeting-follow-through-review">
                  {english ? "Open review boundary" : "打开复核与边界"}
                </Link>
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start"
                asChild
              >
                <Link href="/diagnostics#meeting-workflow-readiness">
                  {english ? "See workflow readiness" : "查看协同就绪度"}
                </Link>
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start"
                asChild
              >
                <Link href="/dashboard">
                  {english ? "Back to dashboard arbitration" : "回到目标推进台"}
                </Link>
              </Button>
              {meeting.opportunity ? (
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  disabled={governedActionDisabled}
                  onClick={() =>
                    runAction(
                      () => updateOpportunityFromMeetingAction(meeting.id),
                      english
                        ? "Opportunity-sync action created"
                        : "机会同步动作已生成",
                      "/approvals#meeting-follow-through-review",
                    )
                  }
                >
                  <Zap className="h-4 w-4" />
                  {english
                    ? "Sync opportunity after meeting"
                    : "把会议结论同步回机会"}
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {meetingSecondaryContext}

      <Card className="workspace-panel-muted">
        <CardContent className="grid gap-4 py-5 xl:grid-cols-[1.15fr_repeat(3,minmax(0,0.78fr))]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="approval">
                {english ? "Meeting memory bundle" : "会议记忆包"}
              </Badge>
              <Badge variant="info">
                {english ? "Reusable operating memory" : "可复用经营记忆"}
              </Badge>
            </div>
            <p className="text-lg font-semibold text-[color:var(--foreground)]">
              {english
                ? "This meeting only becomes reusable when the page shows what already wrote back, what is ready for promotion, and what should stay behind review."
                : "只有当这页说明哪些内容已沉淀为经营状态、哪些仍待复核、哪些仍存在冲突时，这场会议才会变成可复用经营记忆。"}
            </p>
            <p className="text-sm leading-6 text-[color:var(--muted)]">
              {text(meetingMemoryBundle.summary)}
            </p>
            <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
              {text(meetingMemoryBundle.lifecycleSummary)}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="theme-surface-panel rounded-2xl px-4 py-3">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                  {english ? "Affected objects" : "受影响对象"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {meetingMemoryBundle.affectedObjects
                    .slice(0, 5)
                    .map((item) => (
                      <Badge
                        key={`${item.objectType}:${item.id}`}
                        variant="info"
                      >
                        {item.label}
                      </Badge>
                    ))}
                </div>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-3">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                  {english ? "Source pointers" : "来源使用说明"}
                </p>
                <div className="mt-2 space-y-2">
                  {meetingMemoryBundle.sourcePointers
                    .slice(0, 3)
                    .map((pointer) => (
                      <div key={pointer.id} className="space-y-1">
                        <p className="text-sm font-medium text-[color:var(--foreground)]">
                          {text(pointer.label)}
                        </p>
                        <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                          {text(pointer.summary)}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
          <div className="theme-surface-panel rounded-2xl px-4 py-4">
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
              {english ? "Already wrote back" : "已经写回的部分"}
            </p>
            <p className="mt-2 text-3xl font-semibold text-[color:var(--foreground)]">
              {meetingMemoryBundle.promotedCount}
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
              {english
                ? `${meetingMemoryBundle.facts.length} facts, ${meetingMemoryBundle.commitments.length} commitments and ${meetingMemoryBundle.blockers.length} blockers are already visible in structured memory or downstream object state.`
                : `当前已有 ${meetingMemoryBundle.facts.length} 条事实、${meetingMemoryBundle.commitments.length} 条承诺和 ${meetingMemoryBundle.blockers.length} 条阻塞进入结构化记忆或下游对象状态。`}
            </p>
          </div>
          <div className="theme-surface-panel rounded-2xl px-4 py-4">
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
              {english ? "Ready for promotion" : "准备提升"}
            </p>
            <p className="mt-2 text-3xl font-semibold text-[color:var(--foreground)]">
              {meetingMemoryBundle.readyCount}
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
              {english
                ? `${meetingMemoryBundle.decisions.length} decisions and ${meetingMemoryBundle.openQuestions.length} open questions are the main promotion candidates from this meeting.`
                : `当前最主要的提升候选来自这场会议里的 ${meetingMemoryBundle.decisions.length} 条决策和 ${meetingMemoryBundle.openQuestions.length} 条待确认问题。`}
            </p>
          </div>
          <div className="theme-surface-panel rounded-2xl px-4 py-4">
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
              {english ? "Still pending review" : "仍待复核"}
            </p>
            <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">
              {meetingMemoryBundle.conflictCount > 0
                ? english
                  ? `${meetingMemoryBundle.conflictCount} conflict cues visible`
                  : `当前有 ${meetingMemoryBundle.conflictCount} 条冲突线索`
                : english
                  ? `${meetingMemoryBundle.pendingReviewCount} items should stay visible behind review`
                  : `当前有 ${meetingMemoryBundle.pendingReviewCount} 条项目应继续留在复核之后`}
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
              {english
                ? "Anything unresolved here should stay explainable instead of silently overwriting current object state."
                : "这里仍未解决的部分都应该保持可解释，而不是静默覆盖当前对象状态。"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="workspace-panel-muted">
        <CardContent className="grid gap-4 py-5 xl:grid-cols-[1.2fr_repeat(4,minmax(0,0.82fr))]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">
                {english ? "Meeting ingress context" : "会议入口上下文"}
              </Badge>
              <Badge variant="neutral">{english ? "Read-only" : "只读"}</Badge>
            </div>
            <p className="text-lg font-semibold text-[color:var(--foreground)]">
              {english
                ? "Use this as the pre-meeting operating entry: why this event is on the calendar, which thread/object pressure is attached to it, and what it should release into follow-through."
                : "把这里读成会前 operating 入口：这场会议为什么会出现在日程里、它接着哪条线程/对象压力、以及它应该释放哪一步会后推进。"}
            </p>
            <p className="text-sm leading-6 text-[color:var(--muted)]">
              {calendarIngressPointer?.summary
                ? text(calendarIngressPointer.summary)
                : english
                  ? "Calendar/event context is still thin, so this readout relies more on meeting memory and object continuity."
                  : "当前日程 / 会议上下文还比较薄，所以这条读数主要依赖会议记忆和对象连续性来理解这场会。"}
            </p>
          </div>
          <div className="theme-surface-panel rounded-2xl px-4 py-4">
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
              {english ? "Calendar / event" : "日程 / 事件"}
            </p>
            <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--foreground)]">
              {calendarIngressPointer?.label ??
                (english ? "Current meeting event" : "当前会议事件")}
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
              {calendarIngressPointer?.summary
                ? text(calendarIngressPointer.summary)
                : english
                  ? "This meeting currently enters the loop mainly through its visible event slot."
                  : "这场会议当前主要通过可见事件时段进入主回路。"}
            </p>
          </div>
          <div className="theme-surface-panel rounded-2xl px-4 py-4">
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
              {english ? "Participants" : "参与者"}
            </p>
            <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--foreground)]">
              {meeting.contacts.length
                ? english
                  ? `${meeting.contacts.length} linked attendees`
                  : `${meeting.contacts.length} 位已关联参与者`
                : english
                  ? "Attendee context is thin"
                  : "参与者上下文较薄"}
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
              {meetingIngressAttendeeLine}
            </p>
          </div>
          <div className="theme-surface-panel rounded-2xl px-4 py-4">
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
              {english ? "Related thread / inbox" : "相关线程 / 收件箱"}
            </p>
            <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--foreground)]">
              {threadIngressPointer
                ? english
                  ? "Thread pressure visible"
                  : "线程压力可见"
                : english
                  ? "No strong thread cue"
                  : "当前没有显著线程线索"}
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
              {threadIngressPointer?.summary
                ? text(threadIngressPointer.summary)
                : english
                  ? "No visible inbox-pressure cue is currently being pulled into this meeting."
                  : "当前还没有把显著的收件箱压力线索拉进这场会议。"}
            </p>
          </div>
          <div className="theme-surface-panel rounded-2xl px-4 py-4">
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
              {english ? "Continuity + pressure" : "连续性 + 压力"}
            </p>
            <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--foreground)]">
              {affectedObjectsPointer?.label ??
                (english ? "Object continuity in view" : "对象连续性已接入")}
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
              {meetingIngressContinuityLine}
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
              {displayMeetingIngressPressureLine}
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
              {displayMeetingIngressFollowThroughLine}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="workspace-panel">
        <CardContent className="space-y-4 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">
                  {english ? "Meeting workspace" : "这场会议工作台"}
                </Badge>
                <Badge variant="approval">
                  {english ? "Meeting-scoped only" : "仅限这场会议"}
                </Badge>
                <Badge variant="neutral">{meetingTemplateSummary.label}</Badge>
                <Badge variant="neutral">
                  {meetingWorkspaceLightSummary.visibilityLabel}
                </Badge>
              </div>
              <p className="text-lg font-semibold text-[color:var(--foreground)]">
                {english
                  ? "Read this as the operating workspace for one meeting: what changed, what already wrote back, what still needs review, and what should move next."
                  : "把这里读成一场会议的经营工作台：发生了什么、什么已经写回、什么仍待复核、下一步该怎么动。"}
              </p>
              <p className="max-w-4xl text-sm leading-6 text-[color:var(--muted)]">
                {displayMeetingWorkspaceSummary}
              </p>
              <p className="max-w-4xl text-sm leading-6 text-[color:var(--muted-foreground)]">
                {text(meetingWorkspaceLightSummary.collaborationLine)}
              </p>
              {manualReviewHoldCount > 0 ? (
                <p className="max-w-4xl text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {english
                    ? `${manualReviewHoldCount} previously promoted item(s) are now being kept behind review by manual governance hold in this meeting workspace.`
                    : `当前有 ${manualReviewHoldCount} 条原本已提升的内容，正在这场会议工作台里被人工治理保持留在复核之后。`}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={exportMeetingMemoryBundle}
              >
                <Download className="h-4 w-4" />
                {english ? "Export bundle" : "导出记忆包"}
              </Button>
              <Button size="sm" variant="secondary" asChild>
                <Link
                  href={`/memory?objectType=MEETING&objectId=${meeting.id}`}
                >
                  {english ? "Open meeting memory" : "打开会议记忆"}
                </Link>
              </Button>
              <Button size="sm" variant="secondary" asChild>
                <Link href="/approvals#meeting-follow-through-review">
                  {english ? "Open review boundary" : "打开复核与边界"}
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="theme-surface-panel-soft rounded-2xl px-4 py-4">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "Template frame" : "模板框架"}
              </p>
              <p className="mt-2 font-medium text-[color:var(--foreground)]">
                {meetingTemplateSummary.label}
              </p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                {text(meetingTemplateSummary.objectEmphasisLine)}
              </p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                {text(meetingTemplateSummary.reviewLine)}
              </p>
            </div>
            <div className="theme-surface-panel-soft rounded-2xl px-4 py-4">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "Workspace visibility" : "工作台可见性"}
              </p>
              <p className="mt-2 font-medium text-[color:var(--foreground)]">
                {meetingWorkspaceLightSummary.visibilityLabel}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="neutral">
                  {english
                    ? `Personal ${meetingWorkspaceLightSummary.personalCount}`
                    : `个人 ${meetingWorkspaceLightSummary.personalCount}`}
                </Badge>
                <Badge variant="neutral">
                  {english
                    ? `Shared ${meetingWorkspaceLightSummary.sharedCount}`
                    : `共享 ${meetingWorkspaceLightSummary.sharedCount}`}
                </Badge>
                <Badge variant="neutral">
                  {english
                    ? `Promoted ${meetingWorkspaceLightSummary.promotedCount}`
                    : `已提升 ${meetingWorkspaceLightSummary.promotedCount}`}
                </Badge>
                <Badge variant="neutral">
                  {english
                    ? `Review-only ${meetingWorkspaceLightSummary.reviewOnlyCount}`
                    : `仅复核 ${meetingWorkspaceLightSummary.reviewOnlyCount}`}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                {text(meetingWorkspaceLightSummary.summary)}
              </p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="min-w-0 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="theme-surface-panel rounded-2xl px-4 py-4">
                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                    {english ? "Current meeting summary" : "当前会议摘要"}
                  </p>
                  <p className="mt-2 font-medium text-[color:var(--foreground)]">
                    {meeting.note?.summary
                      ? text(meeting.note.summary)
                      : english
                        ? "This meeting is currently being read through its connected objects and follow-through pressure."
                        : "当前这场会议主要通过关联对象和会后推进压力来被理解。"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                    {meetingImpactLine}
                  </p>
                </div>
                <div className="theme-surface-panel rounded-2xl px-4 py-4">
                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                    {english ? "Connected objects" : "关联对象"}
                  </p>
                  <p className="mt-2 font-medium text-[color:var(--foreground)]">
                    {linkedObjectSummary ||
                      (english
                        ? "No connected object yet"
                        : "当前还没有连接对象")}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                    {meetingMemoryLoopSummary.affectedObjectsLine}
                  </p>
                </div>
                <div className="theme-surface-panel rounded-2xl px-4 py-4">
                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                    {english ? "Next-step workspace" : "下一步工作台"}
                  </p>
                  <p className="mt-2 font-medium text-[color:var(--foreground)]">
                    {primaryNextStepTitle}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                    {meetingMemoryLoopSummary.nextStepLine}
                  </p>
                </div>
                <div className="theme-surface-panel rounded-2xl px-4 py-4">
                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                    {english ? "Current review posture" : "当前复核状态"}
                  </p>
                  <p className="mt-2 font-medium text-[color:var(--foreground)]">
                    {meetingMemoryGovernanceSummary.reviewStateLabel}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                    {displayMeetingReviewPostureLine}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                    {meetingMemoryGovernanceSummary.reviewSummary}
                  </p>
                  {manualReviewHoldCount > 0 ? (
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                      {english
                        ? `Manual governance hold is currently keeping ${manualReviewHoldCount} promoted item(s) review-only on this page.`
                        : `当前有 ${manualReviewHoldCount} 条已提升内容在这个页面里被人工治理保持为仅复核。`}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="info">
                      {meetingMemoryGovernanceSummary.visibilityLabel}
                    </Badge>
                    {meetingMemoryGovernanceSummary.sourceClassLabels.map(
                      (label) => (
                        <Badge key={label} variant="neutral">
                          {label}
                        </Badge>
                      ),
                    )}
                  </div>
                </div>
              </div>

              <div className="theme-surface-panel-soft rounded-2xl px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neutral">
                    {english ? "Source-use ledger" : "来源使用台账"}
                  </Badge>
                  <Badge variant="approval">
                    {english ? "Readable only" : "仅做可读说明"}
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                  {text(meetingMemorySourceUseLedger.summary)}
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {meetingMemorySourceUseLedger.entries
                    .slice(0, 4)
                    .map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3"
                      >
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="neutral">
                            {entry.sourceClassLabel}
                          </Badge>
                          <Badge
                            variant={
                              entry.reviewState === "conflict"
                                ? "danger"
                                : entry.reviewState === "pending-review"
                                  ? "approval"
                                  : entry.reviewState === "missing-clarity"
                                    ? "warning"
                                    : "success"
                            }
                          >
                            {entry.reviewStateLabel}
                          </Badge>
                          <Badge variant="info">{entry.visibilityLabel}</Badge>
                        </div>
                        <p className="mt-2 font-medium text-[color:var(--foreground)]">
                          {text(entry.title)}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                          {text(entry.sourcePointerLabel)}：
                          {text(entry.sourcePointerSummary)}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                          {text(entry.eligibilitySummary)}
                        </p>
                      </div>
                    ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="theme-surface-panel-soft rounded-2xl px-4 py-4">
                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                    {english ? "Promoted meeting memory" : "已提升的会议记忆"}
                  </p>
                  <div className="mt-3 space-y-3">
                    {promotedMeetingMemoryEntries.length ? (
                      promotedMeetingMemoryEntries.map(
                        ({ item, governance }) => (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="success">
                                {formatMeetingMemoryLifecycle(
                                  item.lifecycle,
                                  english,
                                )}
                              </Badge>
                              <Badge variant="info">
                                {formatMeetingMemoryKind(item.kind, english)}
                              </Badge>
                              <Badge variant="neutral">
                                {governance.visibilityLabel}
                              </Badge>
                              <Badge variant="neutral">
                                {governance.sourceClassLabel}
                              </Badge>
                            </div>
                            <p className="mt-2 font-medium text-[color:var(--foreground)]">
                              {text(item.title)}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                              {text(trimText(item.summary, 110))}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                              {text(governance.eligibilitySummary)}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                              {text(governance.sourceSummary)}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  movePromotedItemBackToReview(
                                    item.id,
                                    item.title,
                                  )
                                }
                              >
                                {english ? "Move back to review" : "回退到复核"}
                              </Button>
                            </div>
                          </div>
                        ),
                      )
                    ) : (
                      <p className="text-sm leading-6 text-[color:var(--muted)]">
                        {english
                          ? "No meeting-derived item has fully promoted yet."
                          : "当前还没有完全提升成功的会议记忆项。"}
                      </p>
                    )}
                  </div>
                </div>

                <div className="theme-surface-panel-soft rounded-2xl px-4 py-4">
                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                    {english
                      ? "Still pending review or conflict"
                      : "仍待复核 / 冲突"}
                  </p>
                  <div className="mt-3 space-y-3">
                    {pendingMeetingMemoryEntries.length ? (
                      pendingMeetingMemoryEntries.map(
                        ({ item, governance }) => (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant={
                                  item.lifecycle === "conflict"
                                    ? "danger"
                                    : item.lifecycle === "pending-review"
                                      ? "approval"
                                      : "warning"
                                }
                              >
                                {formatMeetingMemoryLifecycle(
                                  item.lifecycle,
                                  english,
                                )}
                              </Badge>
                              <Badge variant="info">
                                {formatMeetingMemoryKind(item.kind, english)}
                              </Badge>
                              <Badge variant="neutral">
                                {governance.visibilityLabel}
                              </Badge>
                              <Badge variant="neutral">
                                {governance.sourceClassLabel}
                              </Badge>
                              {meetingReviewHoldItemIds.includes(item.id) ? (
                                <Badge variant="approval">
                                  {english
                                    ? "Manual review hold"
                                    : "人工保留复核"}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="mt-2 font-medium text-[color:var(--foreground)]">
                              {text(item.title)}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                              {text(trimText(item.reasonChainSummary, 120))}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                              {text(governance.eligibilitySummary)}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                              {text(governance.sourceSummary)}
                            </p>
                            {meetingReviewHoldItemIds.includes(item.id) ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() =>
                                    restorePromotedItemPosture(
                                      item.id,
                                      item.title,
                                    )
                                  }
                                >
                                  {english
                                    ? "Restore promoted posture"
                                    : "恢复已提升姿态"}
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        ),
                      )
                    ) : (
                      <p className="text-sm leading-6 text-[color:var(--muted)]">
                        {english
                          ? "No pending-review or conflict cue is dominating this meeting right now."
                          : "当前没有待复核或冲突项在主导这场会议。"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info">
                    {english
                      ? "Ask within this meeting"
                      : "基于当前会议上下文提问"}
                  </Badge>
                  <Badge variant="approval">
                    {english ? "Read-only scope" : "只读范围"}
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                  {english
                    ? "Answers here stay limited to this meeting, its connected objects, promoted meeting memory, linked blockers / commitments / decisions, and any recent related-meeting continuity already visible inside this local workspace context. This block does not search the whole workspace or execute anything."
                    : "这里的回答只会基于这场会议、它关联的对象、已提升的会议记忆，以及相关阻塞、承诺和决策；如果当前页面已经可见最近相关会议的连续性，也只会在这个本地工作台上下文里引用。这里不会搜索整个工作台，也不会执行任何动作。"}
                </p>
                <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4">
                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                    {english ? "Source posture" : "来源状态"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {askHelmAnswer.sourceClassLabels.map((label) => (
                      <Badge key={label} variant="neutral">
                        {label}
                      </Badge>
                    ))}
                    {localRecentMeetingContext ? (
                      <Badge variant="neutral">
                        {localRecentMeetingContext.label}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                    {askHelmAnswer.sourcePostureLine}
                  </p>
                  {localRecentMeetingContext ? (
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                      {text(localRecentMeetingContext.summary)}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                    {text(askHelmAnswer.reviewAwareLine)}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {askHelmPrompts.map((prompt) => (
                    <Button
                      key={prompt}
                      size="sm"
                      variant={
                        askHelmQuery === prompt ? "default" : "secondary"
                      }
                      onClick={() => {
                        setAskHelmQuery(prompt);
                        setActiveAskHelmQuery(prompt);
                      }}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <Input
                    value={askHelmQuery}
                    onChange={(event) => setAskHelmQuery(event.target.value)}
                    placeholder={
                      english
                        ? "Ask only about this meeting and its connected objects"
                        : "只询问这场会议及其关联对象"
                    }
                  />
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setActiveAskHelmQuery(
                        askHelmQuery.trim() || askHelmPrompts[0] || "",
                      )
                    }
                  >
                    {english ? "Ask" : "提问"}
                  </Button>
                </div>
                <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4">
                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                    {english ? "Meeting answer" : "会议回答"}
                  </p>
                  <p className="mt-2 font-medium text-[color:var(--foreground)]">
                    {text(askHelmAnswer.headline)}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
                    {text(askHelmAnswer.answer)}
                  </p>
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                      {english
                        ? "Why this answer is available"
                        : "这条回答为什么可用"}
                    </p>
                    {askHelmAnswer.sources.map((source, index) => (
                      <p
                        key={`${source}-${index}`}
                        className="text-sm leading-6 text-[color:var(--muted)]"
                      >
                        {text(source)}
                      </p>
                    ))}
                  </div>
                  <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3">
                    <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                      {english ? "Boundary note" : "边界说明"}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                      {text(askHelmAnswer.boundaryLine)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {meeting.opportunity ? (
        <Card className="workspace-panel-muted">
          <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">
                  {english ? "Linked opportunity" : "关联机会"}
                </Badge>
                <StageBadge stage={meeting.opportunity.stage} />
                <RiskBadge risk={meeting.opportunity.riskLevel} />
              </div>
              <p className="font-semibold text-[color:var(--foreground)]">
                {meeting.opportunity.title}
              </p>
              <p className="text-sm text-[color:var(--muted-foreground)]">
                {english ? "Current next step" : "当前下一步"}：
                {text(
                  meeting.opportunity.nextAction ??
                    (english ? "To be filled" : "待补充"),
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <Link href={linkedOpportunityAssetHref ?? "#"}>
                  {english ? "Open opportunity asset" : "打开机会资产"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="secondary"
                disabled={governedActionDisabled}
                onClick={() =>
                  runAction(
                    () => updateOpportunityFromMeetingAction(meeting.id),
                    english
                      ? "Opportunity-sync action created"
                      : "已生成机会状态同步动作",
                    "/approvals",
                  )
                }
              >
                <Zap className="h-4 w-4" />
                {english ? "Update opportunity stage" : "更新机会阶段"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-[color:var(--status-danger-border)] bg-[color:var(--status-danger-bg)]/70">
        <CardContent className="flex flex-col gap-3 py-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <Badge variant="danger">
              {english ? "If we do not push today" : "如果今天不推进"}
            </Badge>
            <p className="text-base font-semibold text-[color:var(--foreground)]">
              {noPushRisk}
            </p>
            <p className="text-sm leading-6 text-[color:var(--muted)]">
              {english
                ? "This is why summary, approvals and opportunity-state sync must stay on one follow-through chain instead of remaining buried in post-meeting notes."
                : "这也是为什么纪要、审批和机会状态同步需要被放在同一条链路里，而不是留在一份会后记录里。"}
            </p>
          </div>
          <Button
            variant="secondary"
            disabled={governedActionDisabled}
            onClick={() =>
              runAction(
                () => sendMeetingSummaryAction(meeting.id),
                english
                  ? "Summary draft created and routed to approvals"
                  : "已生成纪要并进入审批",
                "/approvals",
              )
            }
          >
            <FileText className="h-4 w-4" />
            {english ? "Send summary to approvals first" : "先把纪要送审"}
          </Button>
        </CardContent>
      </Card>

      <Card className="workspace-panel-muted">
        <CardContent className="grid gap-4 py-5 md:grid-cols-4">
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
              {english ? "Memory generation" : "记忆生成状态"}
            </p>
            <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
              {meeting.memoryFacts.length}
            </p>
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {english
                ? "Supporting facts available for this meeting"
                : "本次会议可引用的支持事实"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
              {english ? "Open commitments" : "开放承诺"}
            </p>
            <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
              {meeting.commitments.length}
            </p>
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {english
                ? "Commitments that still need follow-through after the meeting"
                : "会后需要继续兑现的承诺"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
              {english ? "Current blockers" : "当前卡点"}
            </p>
            <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
              {meeting.blockers.length}
            </p>
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {english
                ? "Blockers that need explicit follow-up after the meeting"
                : "需要在会后显式处理的卡点"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
              {english ? "Briefing snapshot" : "简报快照"}
            </p>
            <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
              {meeting.briefingSnapshot
                ? english
                  ? "Ready"
                  : "已生成"
                : english
                  ? "Pending"
                  : "待生成"}
            </p>
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {english
                ? "This keeps the structured judgement visible both before and after the meeting."
                : "会前、会后都能回看这次会议的结构化判断"}
            </p>
          </div>
        </CardContent>
      </Card>

      <section
        className="space-y-3"
        data-testid="meeting-runtime-evidence-disclosure"
      >
        <details className="group rounded-2xl border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_88%,var(--surface-subtle)_12%)] px-4 py-4">
          <summary
            aria-label={
              english ? "Open supporting evidence summary" : "展开补充依据摘要"
            }
            className="cursor-pointer list-none"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                  {english ? "Supporting evidence" : "补充依据摘要"}
                </p>
                <h2 className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">
                  {english
                    ? "Open review evidence and saved-state context"
                    : "展开复核依据与恢复点资料"}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
                  {english
                    ? "These cards keep the supporting evidence available without making the default meeting flow read like a system console."
                    : "这些卡片只保留必要依据，不打断会议判断和下一步操作。"}
                </p>
              </div>
              <Badge variant="neutral">
                <span className="group-open:hidden">
                  {english ? "Expand when needed" : "需要时展开"}
                </span>
                <span className="hidden group-open:inline">
                  {english ? "Hide summary" : "收起摘要"}
                </span>
              </Badge>
            </div>
          </summary>
          <div className="mt-4">
            <Card className="workspace-shell-panel border-[color:var(--mode-card-border)]">
              <CardHeader>
                <CardTitle className="text-lg tracking-tight text-[color:var(--foreground)]">
                  {english ? "Evidence summary" : "依据摘要"}
                </CardTitle>
                <CardDescription className="text-sm leading-7 text-[color:var(--muted)]">
                  {english
                    ? "Facts, actions, blockers — and what still needs review before going out."
                    : "事实、动作、阻塞——以及对外之前还要复核的部分。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    {
                      label: english ? "Facts" : "事实",
                      value: meeting.memoryFacts.length,
                      note: english ? "available for review" : "可供复核引用",
                    },
                    {
                      label: english ? "Actions" : "动作",
                      value: meeting.actionItems.length,
                      note: english
                        ? "visible follow-through"
                        : "已进入后续推进",
                    },
                    {
                      label: english ? "Blockers" : "阻塞",
                      value: meeting.blockers.length,
                      note: english ? "need explicit handling" : "需要显式处理",
                    },
                    {
                      label: english ? "Commitments" : "承诺",
                      value: meeting.commitments.length,
                      note: english ? "must stay bounded" : "必须保留边界",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4"
                    >
                      <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">
                        {item.label}
                      </p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">
                        {item.value}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                        {item.note}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">
                      {english ? "Suggested next handling" : "建议下一步处理"}
                    </p>
                    <p className="text-sm leading-7 text-[color:var(--muted)]">
                      {meeting.blockers.length > 0
                        ? english
                          ? "Resolve the visible blockers before turning the meeting into an external follow-up."
                          : "先处理当前卡点，再决定是否进入客户可见的后续跟进。"
                        : english
                          ? "The meeting can move to review or follow-through without opening engineering diagnostics."
                          : "这场会议可以继续进入复核或后续推进，不需要展开工程诊断。"}
                    </p>
                    <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
                      {runtimeGovernance.canReview
                        ? english
                          ? "Review authority is available for this workspace; use the review queue for any commitment-sensitive wording."
                          : "当前工作区具备复核权限；任何可能形成承诺的表述，都先进入复核队列。"
                        : english
                          ? "You can read the evidence here, but review authority is not available for this account."
                          : "你可以查看依据，但当前账号没有复核权限。"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild>
                      <Link href="/approvals">
                        {english ? "Open review queue" : "打开复核队列"}
                      </Link>
                    </Button>
                    <Button asChild variant="secondary">
                      <Link href="/meetings">
                        {english ? "Back to meetings" : "返回会议列表"}
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </details>
      </section>

      <MeetingV2RuntimeCard
        meetingId={meeting.id}
        runtime={meeting.meetingRuntime}
        canManageRuntime={runtimeGovernance.canManage}
        canReviewRuntime={runtimeGovernance.canReview}
      />

      <Tabs defaultValue="briefing" className="space-y-4">
        <TabsList>
          <TabsTrigger
            value="briefing"
            id={meetingTabTriggerIds.briefing}
            aria-controls={meetingTabContentIds.briefing}
          >
            {english ? "Pre-meeting briefing" : "会前简报"}
          </TabsTrigger>
          <TabsTrigger
            value="notes"
            id={meetingTabTriggerIds.notes}
            aria-controls={meetingTabContentIds.notes}
          >
            {english ? "Meeting notes" : "会议记录"}
          </TabsTrigger>
          <TabsTrigger
            value="actions"
            id={meetingTabTriggerIds.actions}
            aria-controls={meetingTabContentIds.actions}
          >
            {english ? "Post-meeting actions" : "会后行动"}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="briefing"
          id={meetingTabContentIds.briefing}
          aria-labelledby={meetingTabTriggerIds.briefing}
        >
          <div className="grid gap-6 xl:grid-cols-[1.06fr_0.94fr]">
            <Card>
              <CardHeader>
                <CardTitle>
                  {english ? "Pre-meeting briefing" : "会前简报"}
                </CardTitle>
                <CardDescription>
                  {english
                    ? "Relationships, prior conclusions, goals, risks — all in one screen."
                    : "关系、过往结论、目标、风险——一屏看完。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {meeting.contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="theme-surface-panel-soft rounded-2xl px-4 py-4"
                    >
                      <p className="text-sm font-semibold text-[color:var(--foreground)]">
                        {contact.name}
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                        {contact.title ??
                          (english ? "No title yet" : "未填写职位")}
                      </p>
                      <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">
                        {english
                          ? "The contact timeline and meeting context have already been attached automatically."
                          : "已自动关联联系人时间线与会议上下文。"}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <InfoBlock
                    title={english ? "Attendee summary" : "与会人摘要"}
                    content={briefing.attendees.join("\n")}
                  />
                  <InfoBlock
                    title={english ? "Relationship summary" : "历史关系摘要"}
                    content={text(briefing.relationshipSummary)}
                  />
                  <InfoBlock
                    title={english ? "Previous conclusion" : "上次沟通结论"}
                    content={text(briefing.previousConclusion)}
                  />
                  <InfoBlock
                    title={english ? "Meeting goal" : "本次会议目标"}
                    content={text(briefing.meetingGoal)}
                  />
                </div>
                {snapshotPayload && snapshotSummary ? (
                  <div className="workspace-panel-muted rounded-2xl px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                        {english
                          ? "Structured briefing snapshot"
                          : "结构化简报快照"}
                      </p>
                      {snapshotPayload?.generationMode === "llm_enhanced" ? (
                        <Badge variant="info">
                          {english ? "Enhanced" : "已增强"}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm leading-7 text-[color:var(--foreground)]">
                      {snapshotSummary}
                    </p>
                    {snapshotPayload.retrievalPackTrace ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="info">
                          {english ? "Budgeted memory pack" : "预算化记忆包"}
                        </Badge>
                        <Badge variant="neutral">
                          {english
                            ? `Selected ${snapshotPayload.retrievalPackTrace.trace.selectedCount}`
                            : `入选 ${snapshotPayload.retrievalPackTrace.trace.selectedCount}`}
                        </Badge>
                        <Badge variant="neutral">
                          {english
                            ? `Omitted ${snapshotPayload.retrievalPackTrace.trace.omittedCount}`
                            : `省略 ${snapshotPayload.retrievalPackTrace.trace.omittedCount}`}
                        </Badge>
                      </div>
                    ) : null}
                    <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">
                      {english
                        ? "Generated automatically from meeting facts / commitments / blockers, and can be corrected and rebuilt."
                        : "基于本次会议相关事实、承诺和阻塞自动生成，可被修正和重建。"}
                      {snapshotPayload?.llmMeta?.modelVersion ||
                      snapshotPayload?.llmMeta?.model
                        ? ` ${english ? "Current enhancement model" : "当前增强模型"}：${snapshotPayload.llmMeta?.modelVersion ?? snapshotPayload.llmMeta?.model}。`
                        : ""}
                      {snapshotPayload?.llmMeta?.promptKey
                        ? ` ${english ? "Prompt template" : "增强模板"}：${snapshotPayload.llmMeta.promptKey}。`
                        : ""}
                      {snapshotPayload?.llmMeta?.fallbackReason
                        ? ` ${english ? "Fallback reason" : "回退原因"}：${snapshotPayload.llmMeta.fallbackReason}。`
                        : ""}
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="workspace-panel-muted">
                <CardHeader>
                  <CardTitle>
                    {english
                      ? "Why this meeting matters"
                      : "这场会议值得讲的点"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm leading-6 text-[color:var(--muted)]">
                  <div className="workspace-panel rounded-2xl px-4 py-3">
                    {english
                      ? "Historical relationship context, the previous conclusion and this meeting goal are compressed into one pre-meeting brief, so sales or advisory users do not need to search through email and notes again."
                      : "历史关系、上次结论和本次目标已经压成会前简报，销售或顾问不需要再自己翻邮件和纪要。"}
                  </div>
                  <div className="workspace-panel rounded-2xl px-4 py-3">
                    {english
                      ? "Post-meeting actions are prepared as drafts first, then risk and policy decide whether they stay in review or move into a bounded execution path."
                      : "会后动作先生成草案，再由风险和策略判断是留在复核，还是进入有边界的执行路径。"}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    {english ? "Recommended questions" : "推荐提问"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(snapshotPayload?.recommendedQuestions?.length
                    ? snapshotPayload.recommendedQuestions
                    : briefing.recommendedQuestions
                  ).map((question) => (
                    <div
                      key={question}
                      className="theme-surface-panel rounded-2xl px-4 py-3 text-sm text-[color:var(--foreground)]"
                    >
                      {text(question)}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{english ? "Risk prompts" : "风险提醒"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {briefing.riskAlerts.map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-3 rounded-2xl border border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)] px-4 py-3"
                    >
                      <RiskBadge
                        risk={meeting.opportunity?.riskLevel ?? "MEDIUM"}
                      />
                      <p className="text-sm text-[color:var(--status-warning-text)]">
                        {formatMeetingDisplayText(item, english)}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {dingtalkBriefingBlockers.length ? (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {english
                        ? "This-week blockers and dependencies (DingTalk reports)"
                        : "本周阻塞与跨部门依赖（钉钉周报）"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {dingtalkBriefingBlockers.map((item) => (
                      <div
                        key={`${item.reportId}-briefing-blocker`}
                        className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3"
                      >
                        <p className="text-sm font-medium text-[color:var(--foreground)]">
                          {item.reporterName} · {item.departmentName}
                        </p>
                        <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                          {(english ? "Reported at " : "汇报于 ") +
                            formatDateLabel(item.createdAt)}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[color:var(--foreground)]">
                          {trimText(item.content, 360)}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle>
                    {english ? "Supporting facts" : "支持事实"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {meeting.memoryFacts.length ? (
                    meeting.memoryFacts.slice(0, 4).map((fact) => (
                      <div
                        key={fact.id}
                        className="theme-surface-panel rounded-2xl px-4 py-3"
                      >
                        <p className="text-sm font-medium text-[color:var(--foreground)]">
                          {text(fact.title)}
                        </p>
                        <p className="mt-2 text-sm text-[color:var(--muted)]">
                          {text(trimText(fact.content, 110))}
                        </p>
                        <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                          {english ? "Confidence" : "置信度"} {fact.confidence}{" "}
                          · {text(fact.objectType)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      title={
                        english
                          ? "No supporting facts yet"
                          : "当前还没有支持事实"
                      }
                      description={
                        english
                          ? "After meeting notes are imported and structured memory is generated, the factual basis behind the briefing will appear here."
                          : "导入会议纪要并生成结构化记忆后，这里会显示简报的事实依据。"
                      }
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent
          value="notes"
          id={meetingTabContentIds.notes}
          aria-labelledby={meetingTabTriggerIds.notes}
        >
          <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <Card>
              <CardHeader>
                <CardTitle>{english ? "Meeting notes" : "会议记录"}</CardTitle>
                <CardDescription>
                  {english
                    ? "The first version still uses structured mock notes so real transcription can be connected later."
                    : "第一版采用真实结构的 mock 记录，方便后续接入真实会议转写。"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap rounded-2xl bg-[color:var(--dark-inset-bg)] px-4 py-4 text-sm leading-7 text-[color:var(--dark-inset-foreground)]">
                  {meeting.note?.liveTranscript ??
                    (english ? "No live transcript yet" : "暂无实时记录")}
                </pre>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{english ? "Key summary" : "重点摘要"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-7 text-[color:var(--muted)]">
                    {meeting.note?.summary
                      ? text(meeting.note.summary)
                      : english
                        ? "No summary yet"
                        : "暂无摘要"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    {english ? "Key decisions" : "关键决策"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(
                    meeting.note?.keyDecisions?.split("\n").filter(Boolean) ??
                    []
                  ).map((decision) => (
                    <div
                      key={decision}
                      className="theme-surface-panel flex items-start gap-3 rounded-2xl px-4 py-3"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-[color:var(--status-success-text)]" />
                      <p className="text-sm text-[color:var(--foreground)]">{decision}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    {english ? "Summary draft preview" : "发送纪要草稿预览"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="workspace-panel-muted rounded-2xl p-4">
                    <pre className="whitespace-pre-wrap text-sm leading-7 text-[color:var(--muted)]">
                      {summaryPreview ||
                        (english ? "No summary preview yet" : "暂无纪要预览")}
                    </pre>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() =>
                      runAction(
                        () => sendMeetingSummaryAction(meeting.id),
                        english
                          ? "Summary action sent to approvals"
                          : "纪要动作已送入审批",
                        "/approvals",
                      )
                    }
                  >
                    <FileText className="h-4 w-4" />
                    {english
                      ? "Generate summary and route to approvals"
                      : "一键生成纪要并进入审批"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent
          value="actions"
          id={meetingTabContentIds.actions}
          aria-labelledby={meetingTabTriggerIds.actions}
        >
          <div className="grid gap-6 xl:grid-cols-[1fr_0.92fr]">
            <Card>
              <CardHeader>
                <CardTitle>{english ? "Action items" : "会后动作项"}</CardTitle>
                <CardDescription>
                  {english
                    ? "Each action can be edited for owner, due date and execution mode. This page is the core operating surface for post-meeting follow-through."
                    : "每个动作都可以直接改责任人、截止时间和审批方式，这一页就是会后闭环的核心操作台。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {meeting.actionItems.length ? (
                  meeting.actionItems.map((item) => (
                    <div
                      key={item.id}
                      className="theme-surface-panel rounded-2xl px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-[color:var(--foreground)]">
                          {text(item.title)}
                        </p>
                        <RiskBadge risk={item.riskLevel} />
                        <ActionModeBadge mode={item.executionMode} />
                        {item.approvalTask ? (
                          <ApprovalBadge status={item.approvalTask.status} />
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                        {item.description}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[color:var(--muted-foreground)]">
                        <span>
                          {english ? "Owner" : "责任人"}：
                          {item.owner?.name ??
                            (english ? "Unassigned" : "待分配")}
                        </span>
                        <span>
                          {english ? "Due" : "截止"}：
                          {formatDateLabel(item.dueDate)}
                        </span>
                        <span>
                          {english ? "Target" : "作用对象"}：
                          {item.contact?.name ??
                            meeting.opportunity?.title ??
                            (english ? "Meeting" : "会议")}
                        </span>
                        <span>
                          {item.requiresApproval
                            ? english
                              ? "Requires approval"
                              : "需审批"
                            : english
                              ? "Can auto-execute"
                              : "可自动执行"}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!canManageGovernedActions}
                          onClick={() =>
                            setEditingAction({
                              actionItemId: item.id,
                              title: item.title,
                              description: item.description ?? item.title,
                              dueDate: toDateTimeLocalInput(item.dueDate),
                              ownerId:
                                item.ownerId ?? memberships[0]?.user.id ?? "",
                              executionMode: item.executionMode,
                            })
                          }
                        >
                          {english ? "Edit action" : "编辑动作"}
                        </Button>
                        {item.approvalTask?.status === "PENDING" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => router.push("/approvals")}
                          >
                            {english ? "Open approvals" : "去审批"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title={
                      english
                        ? "No post-meeting actions yet"
                        : "还没有生成会后动作"
                    }
                    description={
                      english
                        ? "Generate action items first, then decide which actions should go to approvals or auto-execute."
                        : "可以先生成会后动作项，再决定哪些动作进入审批或自动执行。"
                    }
                  />
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {english
                      ? "Commitments created by this meeting"
                      : "本次会议形成的承诺"}
                  </CardTitle>
                  <CardDescription>
                    {english
                      ? "These are the promises that must be fulfilled after the meeting so you can decide what to close before pushing again."
                      : "这里优先显示会后必须兑现的承诺，帮助你判断先补什么、再推什么。"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {meeting.commitments.length ? (
                    meeting.commitments.map((item) => (
                      <CommitmentCard
                        key={item.id}
                        commitment={{
                          ...item,
                          sourceLabel: describeCommitmentSource(
                            item.sourceType,
                            english,
                          ),
                          ownerName: item.ownerUser?.name ?? null,
                          targetLabel:
                            item.relatedOpportunity?.title ??
                            item.relatedCompany?.name ??
                            item.relatedContact?.name ??
                            meeting.title,
                        }}
                        compact
                      />
                    ))
                  ) : (
                    <EmptyState
                      title={
                        english
                          ? "No structured commitments yet"
                          : "还没有结构化承诺"
                      }
                      description={
                        english
                          ? "After meeting notes are imported, in-meeting commitments will become trackable objects here."
                          : "会议纪要导入后，会中承诺会沉淀为可追踪对象。"
                      }
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    {english ? "Current blockers" : "当前卡点"}
                  </CardTitle>
                  <CardDescription>
                    {english
                      ? "These blockers directly influence recommendation ranking and post-meeting execution mode."
                      : "这些阻塞会直接影响判断建议排序和会后动作方式。"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {meeting.blockers.length ? (
                    meeting.blockers.map((item) => (
                      <BlockerCard
                        key={item.id}
                        blocker={{
                          ...item,
                          targetLabel:
                            item.relatedOpportunity?.title ??
                            item.relatedCompany?.name ??
                            item.relatedContact?.name ??
                            meeting.title,
                        }}
                        compact
                      />
                    ))
                  ) : (
                    <EmptyState
                      title={english ? "No blocker right now" : "当前没有阻塞"}
                      description={
                        english
                          ? "If budget concerns, objections or resource conflicts appear in the meeting, they will surface here first."
                          : "一旦会议里出现预算、顾虑、资源冲突等阻塞，会优先列在这里。"
                      }
                    />
                  )}
                </CardContent>
              </Card>

              <Card className="border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)]/60">
                <CardHeader>
                  <CardTitle>
                    {english
                      ? "The 24-hour post-meeting window"
                      : "会后 24 小时黄金推进窗口"}
                  </CardTitle>
                  <CardDescription>
                    {english
                      ? "This is not just a reminder. It explains why some actions rank first, and why others must close commitments or clear blockers before anything else."
                      : "这块不是提醒而已，而是在告诉你为什么把某些动作排到前面，为什么有些动作要先补承诺、先解阻塞。"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm leading-7 text-[color:var(--foreground)]">
                  <p>{meetingImpactLine}</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-[color:var(--status-warning-border)] bg-[color:color-mix(in_oklab,var(--surface)_88%,white_12%)] px-4 py-3">
                      <p className="text-xs font-medium text-[color:var(--status-warning-text)]">
                        {english
                          ? "Main post-meeting pressure"
                          : "当前最大会后压力"}
                      </p>
                      <p className="mt-2 font-medium text-[color:var(--foreground)]">
                        {topCommitment
                          ? topCommitment.title
                          : topBlocker
                            ? topBlocker.title
                            : english
                              ? "No major pressure"
                              : "暂无显著压力"}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                        {followUpPressureLine}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[color:var(--status-warning-border)] bg-[color:color-mix(in_oklab,var(--surface)_88%,white_12%)] px-4 py-3">
                      <p className="text-xs font-medium text-[color:var(--status-warning-text)]">
                        {english ? "Current ranking basis" : "当前排序依据"}
                      </p>
                      <p className="mt-2 font-medium text-[color:var(--foreground)]">
                        {overdueCommitmentCount > 0
                          ? english
                            ? `${overdueCommitmentCount} overdue commitments first`
                            : `${overdueCommitmentCount} 条逾期承诺优先`
                          : topBlocker
                            ? english
                              ? "Clear blockers before adding new actions"
                              : "先处理阻塞，再推进新动作"
                            : english
                              ? "Turn meeting conclusions into actions first"
                              : "优先把会后决定落成动作"}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                        {english
                          ? "Recommendation simultaneously looks at facts formed in this meeting, open commitments, active blockers and the current policy boundary."
                          : "判断建议会同时参考本次会议形成的事实、未完成承诺、当前卡点和当前策略边界。"}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--status-warning-border)] bg-[color:color-mix(in_oklab,var(--surface)_84%,white_16%)] px-4 py-3 text-[color:var(--status-warning-text)]">
                    {noPushRisk}
                  </div>
                </CardContent>
              </Card>

              <Card className="theme-judgement-panel">
                <CardHeader>
                  <CardTitle>
                    {english
                      ? "Post-meeting next best actions"
                      : "会后优先动作"}
                  </CardTitle>
                  <CardDescription>
                    {english
                      ? "Why this move now — backed by the facts, commitments and blockers from the meeting."
                      : "为什么先做这一步——依据本次会议形成的事实、承诺和阻塞。"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="theme-judgement-panel-inset rounded-2xl px-4 py-3 text-sm leading-6 text-[color:var(--muted)]">
                    {topCommitment
                      ? english
                        ? `The system will first recommend actions that digest commitments like "${topCommitment.title}" before deciding whether to add more follow-up pushes.`
                        : `当前先选择能消化“${topCommitment.title}”这类会后承诺的动作，再决定要不要继续追加新的推进动作。`
                      : topBlocker
                        ? english
                          ? `The system will first recommend actions that remove blockers like "${topBlocker.title}" instead of stacking more post-meeting tasks.`
                          : `当前先选择能解除“${topBlocker.title}”这类阻塞的动作，而不是直接堆更多会后任务。`
                        : english
                          ? "Current recommendation will prioritize turning this meeting’s conclusions into immediately executable next steps."
                          : "当前判断建议会优先把这场会议里的结论变成可以立即执行的下一步。"}
                  </div>
                  {recommendations.length
                    ? recommendations.slice(0, 2).map((item, index) => (
                        <RecommendationJudgementCard
                          key={item.recommendationId}
                          recommendation={item}
                          emphasis={index === 0 ? "featured" : "quiet"}
                          summaryLabel={
                            index === 0
                              ? english
                                ? "Primary post-meeting recommendation"
                                : "会后主建议"
                              : english
                                ? "Alternate move"
                                : "备选动作"
                          }
                          sourcePage={`/meetings/${meeting.id}`}
                          className={
                            index === 0
                              ? "border-[color:var(--border)] bg-[color:color-mix(in_oklab,white_84%,var(--surface-subtle)_16%)] shadow-none dark:border-white/10 dark:bg-white/10"
                              : "border-[color:var(--border)] bg-[color:color-mix(in_oklab,white_88%,var(--surface-subtle)_12%)] shadow-none dark:border-white/10 dark:bg-white/5"
                          }
                          cta={
                            <Button
                              variant="secondary"
                              className="theme-primary-action"
                              disabled={governedActionDisabled}
                              onClick={() =>
                                runAction(
                                  () =>
                                    createActionFromRecommendationAction(
                                      item.recommendationId,
                                      `/meetings/${meeting.id}`,
                                    ),
                                  english
                                    ? "Action created from recommendation"
                                    : "已按建议生成动作",
                                  "/approvals",
                                )
                              }
                            >
                              <Sparkles className="h-4 w-4" />
                              {english
                                ? "Create action from recommendation"
                                : "按建议生成动作"}
                            </Button>
                          }
                          secondaryCta={
                            <Button
                              variant="secondary"
                              className="border border-[color:var(--border)] bg-[color:color-mix(in_oklab,white_84%,var(--surface-subtle)_16%)] text-[color:var(--foreground)] hover:bg-[color:color-mix(in_oklab,white_72%,var(--surface-subtle)_28%)] dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                              asChild
                            >
                              <Link
                                href={`/memory?objectType=MEETING&objectId=${meeting.id}`}
                              >
                                {english
                                  ? "View supporting facts"
                                  : "查看支持事实"}
                              </Link>
                            </Button>
                          }
                        />
                      ))
                    : null}
                  {postActions.map((item) => (
                    <div
                      key={item}
                      className="theme-judgement-panel-inset rounded-2xl px-4 py-3 text-sm text-[color:var(--muted)]"
                    >
                      {item}
                    </div>
                  ))}
                  {snapshotPayload?.recommendedNextSteps?.length
                    ? snapshotPayload.recommendedNextSteps.map((item) => (
                        <div
                          key={item}
                          className="theme-judgement-panel-inset rounded-2xl px-4 py-3 text-sm text-[color:var(--foreground)] dark:text-white"
                        >
                          {item}
                        </div>
                      ))
                    : null}
                  <Button
                    variant="secondary"
                    className="w-full justify-start border border-[color:var(--border)] bg-[color:color-mix(in_oklab,white_84%,var(--surface-subtle)_16%)] text-[color:var(--foreground)] hover:bg-[color:color-mix(in_oklab,white_72%,var(--surface-subtle)_28%)] dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                    disabled={governedActionDisabled}
                    onClick={() =>
                      runAction(
                        () => generateMeetingActionItemsAction(meeting.id),
                        english
                          ? "Post-meeting action items generated"
                          : "已生成会后动作项",
                      )
                    }
                  >
                    <Sparkles className="h-4 w-4" />
                    {english
                      ? "Turn these suggestions into actions"
                      : "把这些建议落成动作"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    {english ? "Quick actions" : "快捷动作"}
                  </CardTitle>
                  <CardDescription>
                    {english
                      ? "Keep “generate summary, send to approvals, sync opportunity and create follow-up meeting” on one smooth path."
                      : "把“生成纪要、送审、更新机会、创建后续会议”压缩成一条顺滑链路。"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    className="w-full justify-start"
                    disabled={governedActionDisabled}
                    onClick={() =>
                      runAction(
                        () => sendMeetingSummaryAction(meeting.id),
                        english ? "Summary action created" : "纪要动作已生成",
                        "/approvals",
                      )
                    }
                  >
                    <FileText className="h-4 w-4" />
                    {english ? "Send summary draft" : "发送纪要草稿"}
                  </Button>
                  <Button
                    className="w-full justify-start"
                    variant="secondary"
                    disabled={governedActionDisabled}
                    onClick={() =>
                      runAction(
                        () => createFollowUpMeetingAction(meeting.id),
                        english
                          ? "Follow-up meeting action created"
                          : "后续会议动作已生成",
                        "/approvals",
                      )
                    }
                  >
                    <CalendarPlus className="h-4 w-4" />
                    {english ? "Create follow-up meeting" : "创建后续会议"}
                  </Button>
                  <Button
                    className="w-full justify-start"
                    variant="secondary"
                    disabled={governedActionDisabled}
                    onClick={() =>
                      runAction(
                        () => updateOpportunityFromMeetingAction(meeting.id),
                        english
                          ? "Opportunity-sync action created"
                          : "机会同步动作已生成",
                        "/approvals",
                      )
                    }
                  >
                    <Zap className="h-4 w-4" />
                    {english ? "Update opportunity stage" : "更新机会状态"}
                  </Button>
                  {meeting.opportunity?.type === "RECRUITING" ? (
                    <Button
                      className="w-full justify-start"
                      variant="secondary"
                      disabled={governedActionDisabled}
                      onClick={() =>
                        runAction(
                          () => generateInterviewAction(meeting.id),
                          english
                            ? "Interview action created"
                            : "后续面试动作已生成",
                          "/approvals",
                        )
                      }
                    >
                      <Sparkles className="h-4 w-4" />
                      {english
                        ? "Create follow-up interview action"
                        : "生成后续面试安排动作"}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    {english ? "Meeting timeline" : "会议时间线"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {meeting.memoryEntries.length ? (
                    meeting.memoryEntries.map((entry) => (
                      <Link
                        key={entry.id}
                        href="/memory"
                        aria-label={entry.title}
                        className="theme-surface-panel block rounded-2xl px-4 py-4 transition hover:border-[#194650]/20 hover:bg-[color:color-mix(in_oklab,white_72%,var(--surface-subtle)_28%)] dark:hover:bg-white/10"
                      >
                        <p className="font-medium text-[color:var(--foreground)]">
                          {entry.title}
                        </p>
                        <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                          {trimText(entry.content, 120)}
                        </p>
                        <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                          {formatDateLabel(entry.createdAt)}
                        </p>
                      </Link>
                    ))
                  ) : (
                    <EmptyState
                      title={
                        english ? "No meeting timeline yet" : "还没有会议时间线"
                      }
                      description={
                        english
                          ? "New notes, action execution and follow-up meetings will write back here automatically."
                          : "新的纪要、动作执行和会议创建会自动写入这里。"
                      }
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            {english ? "Activity history" : "操作历史"}
          </CardTitle>
          <CardDescription>
            {english
              ? "This keeps a replay of AI suggestions, approvals, execution and manual edits."
              : "这里会记录建议、复核、执行和人工编辑等完整回放。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {auditLogs.length ? (
            auditLogs.map((log) => (
              <div
                key={log.id}
                className="theme-surface-panel rounded-2xl px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-[color:var(--foreground)]">
                    {text(log.summary)}
                  </p>
                  <Badge variant="default">{text(log.actionType)}</Badge>
                </div>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                  {log.actor} · {log.actorType}
                </p>
                <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                  {formatDateLabel(log.createdAt)}
                </p>
              </div>
            ))
          ) : (
            <EmptyState
              title={
                english ? "No meeting history yet" : "当前还没有会议相关历史"
              }
              description={
                english
                  ? "Once notes, approvals or post-meeting task updates happen, the replay will fill in automatically."
                  : "一旦生成纪要、审批动作或更新会后任务，这里会自动补齐回放。"
              }
            />
          )}
        </CardContent>
      </Card>

      <Sheet
        open={Boolean(editingAction)}
        onOpenChange={(open) => !open && setEditingAction(null)}
      >
        <SheetContent
          className="max-w-[560px]"
          closeLabel={
            english ? "Close post-meeting action editor" : "关闭会后动作编辑"
          }
        >
          <SheetHeader>
            <SheetTitle>
              {english ? "Edit post-meeting action" : "编辑会后动作"}
            </SheetTitle>
            <SheetDescription>
              {english
                ? "Update the content, owner, due date and execution boundary directly here."
                : "可以直接修改动作内容、责任人、截止时间和审批方式。"}
            </SheetDescription>
          </SheetHeader>
          {editingAction ? (
            <div className="space-y-4 p-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[color:var(--foreground)]">
                  {english ? "Action title" : "动作标题"}
                </label>
                <Input
                  disabled={!canManageGovernedActions}
                  value={editingAction.title}
                  onChange={(event) =>
                    setEditingAction((state) =>
                      state ? { ...state, title: event.target.value } : state,
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[color:var(--foreground)]">
                  {english ? "Action description" : "动作说明"}
                </label>
                <Textarea
                  disabled={!canManageGovernedActions}
                  value={editingAction.description}
                  onChange={(event) =>
                    setEditingAction((state) =>
                      state
                        ? { ...state, description: event.target.value }
                        : state,
                    )
                  }
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[color:var(--foreground)]">
                    {english ? "Due date" : "截止时间"}
                  </label>
                  <Input
                    disabled={!canManageGovernedActions}
                    type="datetime-local"
                    value={editingAction.dueDate}
                    onChange={(event) =>
                      setEditingAction((state) =>
                        state
                          ? { ...state, dueDate: event.target.value }
                          : state,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[color:var(--foreground)]">
                    {english ? "Owner" : "责任人"}
                  </label>
                  <Select
                    disabled={!canManageGovernedActions}
                    value={editingAction.ownerId}
                    onValueChange={(value) =>
                      setEditingAction((state) =>
                        state ? { ...state, ownerId: value } : state,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
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
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[color:var(--foreground)]">
                  {english ? "Execution mode" : "审批方式"}
                </label>
                <Select
                  disabled={!canManageGovernedActions}
                  value={editingAction.executionMode}
                  onValueChange={(value) =>
                    setEditingAction((state) =>
                      state
                        ? {
                            ...state,
                            executionMode:
                              value as ActionDraft["executionMode"],
                          }
                        : state,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUGGEST_ONLY">
                      {english ? "Suggest only" : "仅建议"}
                    </SelectItem>
                    <SelectItem value="REQUIRES_APPROVAL">
                      {english ? "Require approval" : "需逐条审批"}
                    </SelectItem>
                    <SelectItem value="AUTO_WITHIN_THRESHOLD">
                      {english ? "Auto within threshold" : "阈值内自动执行"}
                    </SelectItem>
                    <SelectItem value="FORBIDDEN">
                      {english ? "Forbidden" : "禁止执行"}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-[color:var(--muted-foreground)]">
                  {english
                    ? "High-risk actions still require approval and will be intercepted automatically."
                    : "高风险动作仍必须审批，会自动进入拦截复核。"}
                </p>
              </div>
              {!canManageGovernedActions ? (
                <div
                  className="workspace-note-card px-4 py-4 text-sm leading-7 text-[color:var(--foreground)]"
                  data-tone="amber"
                >
                  {actionGovernance.manageDeniedMessage}
                </div>
              ) : null}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => setEditingAction(null)}
                >
                  {english ? "Cancel" : "取消"}
                </Button>
                <Button
                  disabled={governedActionDisabled}
                  onClick={saveActionItem}
                >
                  {pending
                    ? english
                      ? "Saving..."
                      : "保存中..."
                    : english
                      ? "Save action"
                      : "保存动作"}
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function InfoBlock({ title, content }: { title: string; content: string }) {
  return (
    <div className="workspace-panel rounded-2xl px-4 py-4">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {title}
      </p>
      <pre className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[color:var(--foreground)]">
        {content}
      </pre>
    </div>
  );
}

function describeCommitmentSource(sourceType: string, english: boolean) {
  if (sourceType === "MEETING_NOTE")
    return english ? "Meeting note" : "会议纪要";
  if (sourceType === "ACTION_ITEM")
    return english ? "Post-meeting action" : "会后动作";
  if (sourceType === "EMAIL_THREAD")
    return english ? "Email thread" : "邮件线程";
  return english ? "System extraction" : "系统提取";
}

function formatMeetingMemoryLifecycle(
  lifecycle: "promoted" | "ready" | "pending-review" | "conflict",
  english: boolean,
) {
  if (lifecycle === "promoted") {
    return english ? "Promoted" : "已提升";
  }
  if (lifecycle === "ready") {
    return english ? "Ready" : "可继续提升";
  }
  if (lifecycle === "pending-review") {
    return english ? "Pending review" : "待复核";
  }
  return english ? "Conflict" : "冲突";
}

function formatMeetingMemoryKind(
  kind:
    | "fact"
    | "commitment"
    | "blocker"
    | "decision"
    | "open-question"
    | "correction",
  english: boolean,
) {
  if (kind === "fact") return english ? "Fact" : "事实";
  if (kind === "commitment") return english ? "Commitment" : "承诺";
  if (kind === "blocker") return english ? "Blocker" : "阻塞";
  if (kind === "decision") return english ? "Decision" : "决策";
  if (kind === "open-question") return english ? "Open question" : "待确认问题";
  return english ? "Correction" : "修正";
}

function downloadMeetingMemoryBundleExport(
  payload: ReturnType<typeof buildMeetingMemoryExportPayload>,
  fileStem: string,
) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${fileStem}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function buildMeetingScopedAskHelmAnswer(input: {
  question: string;
  meeting: MeetingDetailClientProps["meeting"];
  meetingMemoryBundle: ReturnType<typeof buildMeetingMemoryBundle>;
  meetingMemoryGovernanceSummary: ReturnType<
    typeof buildMeetingMemoryGovernanceSummary
  >;
  meetingMemoryLoopSummary: ReturnType<typeof buildMeetingMemoryLoopSummary>;
  meetingTemplateSummary: ReturnType<typeof buildMeetingTemplateSummary>;
  meetingWorkspaceLightSummary: ReturnType<
    typeof buildMeetingWorkspaceLightSummary
  >;
  localRecentMeetingContext: { label: string; summary: string } | null;
  linkedObjectSummary: string;
  meetingImpactLine: string;
  primaryNextStepTitle: string;
  primaryBoundaryLine: string;
  topCommitment:
    | MeetingDetailClientProps["meeting"]["commitments"][number]
    | null;
  topBlocker: MeetingDetailClientProps["meeting"]["blockers"][number] | null;
  pendingApprovalCount: number;
  english: boolean;
}) {
  const question = input.question.trim();
  const normalized = question.toLowerCase();
  const pendingLabels = input.meetingMemoryBundle.items
    .filter((item) =>
      ["ready", "pending-review", "conflict"].includes(item.lifecycle),
    )
    .slice(0, 3)
    .map((item) => item.title);
  const sourceLabels = input.meetingMemoryBundle.sourcePointers
    .slice(0, 3)
    .map((pointer) => `${pointer.label}：${pointer.summary}`);
  const sourceClassLabels = input.localRecentMeetingContext
    ? [
        ...input.meetingMemoryGovernanceSummary.sourceClassLabels,
        input.localRecentMeetingContext.label,
      ]
    : input.meetingMemoryGovernanceSummary.sourceClassLabels;
  const sourcePostureLine = input.localRecentMeetingContext
    ? `${input.meetingMemoryGovernanceSummary.sourceSummary} ${input.localRecentMeetingContext.summary}`
    : input.meetingMemoryGovernanceSummary.sourceSummary;
  const reviewAwareLine =
    input.meetingMemoryGovernanceSummary.visibilityCue === "review-only"
      ? input.english
        ? `Some meeting-derived content still stays ${input.meetingMemoryGovernanceSummary.visibilityLabel.toLowerCase()}, so the answer stays boundary-aware instead of treating everything as settled state.`
        : `当前仍有部分会议产出处于“${input.meetingMemoryGovernanceSummary.visibilityLabel}”状态，所以回答会继续保持边界清楚，而不会把所有内容都当成稳定状态。`
      : input.english
        ? `The currently used sources are readable enough to support meeting-scoped answers, but this block still stays read-only and review-aware.`
        : `当前引用来源已经足够支持会议范围内回答，但这里仍然保持只读和保留复核意识。`;
  const defaultBoundaryLine = input.english
    ? "This answer stays inside the meeting scope. It does not imply send authority, workflow control or automatic execution."
    : "这条回答只停留在本场会议范围内，不代表发送权限、流程控制权或自动执行。";

  if (/为什么|重要|matter|important/.test(normalized)) {
    return {
      headline: input.english
        ? "Why this meeting matters now"
        : "这场会议为什么现在重要",
      answer: `${input.meetingTemplateSummary.summary} ${input.meetingImpactLine} ${input.linkedObjectSummary ? `${input.english ? "It is already connected to" : "它已经连接到"} ${input.linkedObjectSummary}。` : ""}`,
      sources: [
        input.english
          ? `Meeting note summary: ${input.meeting.note?.summary ?? "No structured summary yet."}`
          : `会议摘要：${input.meeting.note?.summary ?? "当前还没有结构化摘要。"}`,
        input.meetingMemoryLoopSummary.affectedObjectsLine,
        ...(input.localRecentMeetingContext
          ? [input.localRecentMeetingContext.summary]
          : []),
        ...sourceLabels,
      ],
      sourceClassLabels,
      sourcePostureLine,
      reviewAwareLine,
      boundaryLine: defaultBoundaryLine,
    };
  }

  if (/准备|prepared|prepare|事实|fact|证据|evidence/.test(normalized)) {
    return {
      headline: input.english
        ? "What is already prepared from this meeting"
        : "这场会议当前已经准备出什么",
      answer: input.english
        ? `${input.meeting.memoryFacts.length} meeting-linked facts, ${input.meeting.commitments.length} commitments, ${input.meeting.blockers.length} blockers and ${input.pendingApprovalCount} visible review gates are already grouped here.`
        : `当前已经把 ${input.meeting.memoryFacts.length} 条会议相关事实、${input.meeting.commitments.length} 条承诺、${input.meeting.blockers.length} 条阻塞，以及 ${input.pendingApprovalCount} 个可见复核边界收在这里。`,
      sources: [
        input.meetingWorkspaceLightSummary.summary,
        input.meetingMemoryBundle.summary,
        input.meetingMemoryBundle.lifecycleSummary,
        ...(input.localRecentMeetingContext
          ? [input.localRecentMeetingContext.summary]
          : []),
        ...sourceLabels,
      ],
      sourceClassLabels,
      sourcePostureLine,
      reviewAwareLine,
      boundaryLine: defaultBoundaryLine,
    };
  }

  if (/下一步|what.*next|next step|推进|follow/.test(normalized)) {
    return {
      headline: input.english
        ? "The next move after this meeting"
        : "这场会后的下一步",
      answer: `${input.primaryNextStepTitle}。${input.meetingMemoryLoopSummary.nextStepLine}`,
      sources: [
        input.meetingTemplateSummary.nextStepLine,
        input.primaryBoundaryLine,
        input.topCommitment
          ? input.english
            ? `Top commitment pressure: ${input.topCommitment.title}`
            : `当前承诺压力：${input.topCommitment.title}`
          : input.topBlocker
            ? input.english
              ? `Top blocker pressure: ${input.topBlocker.title}`
              : `当前卡点压力：${input.topBlocker.title}`
            : input.english
              ? "No dominant commitment or blocker is currently overriding the next move."
              : "当前没有显著承诺或阻塞在覆盖下一步。",
        input.meetingMemoryLoopSummary.nextStepLine,
      ],
      sourceClassLabels,
      sourcePostureLine,
      reviewAwareLine,
      boundaryLine: defaultBoundaryLine,
    };
  }

  if (/recent|related|continuity|连续性|上一轮|最近相关/.test(normalized)) {
    return {
      headline: input.english
        ? "Visible continuity from related recent meetings"
        : "最近相关会议的可见连续性",
      answer: input.localRecentMeetingContext
        ? input.localRecentMeetingContext.summary
        : input.english
          ? "No explicit recent related-meeting continuity is visible on this page yet, so this answer stays inside the current meeting, connected objects and promoted meeting memory."
          : "当前页面还没有显式可见的最近相关会议连续性，所以回答会继续停留在这场会议、关联对象和已提升会议记忆范围内。",
      sources: [
        input.meetingTemplateSummary.objectEmphasisLine,
        input.meetingWorkspaceLightSummary.collaborationLine,
        ...(input.localRecentMeetingContext
          ? [input.localRecentMeetingContext.summary]
          : []),
        ...sourceLabels,
      ],
      sourceClassLabels,
      sourcePostureLine,
      reviewAwareLine,
      boundaryLine: defaultBoundaryLine,
    };
  }

  if (/review|审批|边界|boundary|冲突|conflict|记忆/.test(normalized)) {
    return {
      headline: input.english
        ? "What still needs review before it becomes stable memory"
        : "哪些内容还需要复核，不能直接当成稳定记忆",
      answer:
        pendingLabels.length > 0
          ? input.english
            ? `${pendingLabels.join(", ")} still read as ready, pending-review or conflict, so they should remain explicit before becoming stable object-state memory.`
            : `${pendingLabels.join("、")} 当前仍然更像可继续提升、待复核或冲突项，所以在变成稳定对象状态前，应继续保持显式。`
          : input.english
            ? "No dominant pending-review or conflict item is visible right now, so the main task is keeping the follow-through loop moving."
            : "当前没有显著的待复核或冲突项，所以重点是继续把后续推进回路推下去。",
      sources: [
        input.meetingMemoryLoopSummary.lifecycleLabel,
        input.meetingMemoryLoopSummary.readinessDependencyLine,
        input.meetingTemplateSummary.reviewLine,
        ...sourceLabels,
      ],
      sourceClassLabels,
      sourcePostureLine,
      reviewAwareLine,
      boundaryLine: defaultBoundaryLine,
    };
  }

  return {
    headline: input.english
      ? "This answer stays inside the meeting scope"
      : "这条回答只停留在会议范围内",
    answer: input.english
      ? "Right now this answer can cover why this meeting matters, what is already prepared, what should move next, and what still needs review before becoming stable memory."
      : "当前这条回答只会覆盖这场会议为什么重要、已经准备了什么、下一步该做什么，以及哪些内容仍需复核才能变成稳定记忆。",
    sources: [
      input.meetingTemplateSummary.summary,
      input.meetingMemoryBundle.summary,
      input.meetingMemoryLoopSummary.affectedObjectsLine,
      ...(input.localRecentMeetingContext
        ? [input.localRecentMeetingContext.summary]
        : []),
      ...sourceLabels,
    ],
    sourceClassLabels,
    sourcePostureLine,
    reviewAwareLine,
    boundaryLine: defaultBoundaryLine,
  };
}
