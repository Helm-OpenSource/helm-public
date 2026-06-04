"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronDown,
  CircleDot,
  Download,
  Eraser,
  PenSquare,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { BlockerCard } from "@/components/shared/blocker-card";
import { CommitmentCard } from "@/components/shared/commitment-card";
import { EmptyState } from "@/components/shared/empty-state";
import {
  HomeSurfaceArrivalBanner,
  useHomeSurfaceArrival,
} from "@/components/shared/home-surface-arrival-banner";
import { HomeSurfaceSecondaryDisclosure } from "@/components/shared/home-surface-secondary-disclosure";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ControlledDisclosure } from "@/components/shared/controlled-disclosure";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getLocalizedMemorySourceLabels,
  getLocalizedObjectTypeLabels,
} from "@/lib/i18n/labels";
import {
  MEMORY_PAGE_ANCHORS,
  buildMemoryItemAnchor,
  scrollToWindowHashTarget,
} from "@/lib/presentation/page-section-anchors";
import { getWorkspaceStory } from "@/lib/presentation/workspace-story";
import {
  applyMeetingMemoryReviewOnlyOverrides,
  buildAuditReasonChain,
  buildMeetingMemoryExportPayload,
  buildMeetingMemoryBundle,
  buildMeetingMemoryGovernanceSummary,
  buildMeetingMemoryItemGovernanceSummary,
  buildMeetingMemorySourceUseLedger,
  buildMeetingWorkspaceLightSummary,
  buildMemoryObjectStateSnapshots,
  type WorkspaceFirstLoopModel,
  getOperatingSkillById,
} from "@/lib/operating-system";
import { formatDateLabel, safeParseJson } from "@/lib/utils";
import {
  acceptReflectionCarryForwardAction,
  dismissReflectionCarryForwardAction,
} from "@/features/meetings/actions";
import {
  correctMemoryAction,
  correctMemoryFactAction,
  deleteMemoryAction,
  deleteMemoryFactAction,
  generateObjectBriefingAction,
  invalidateMemoryFactAction,
  reviewMemoryDistillationCandidateAction,
  resolveBlockerAction,
  updateBlockerStatusAction,
  updateCommitmentStatusAction,
} from "@/features/memory/actions";
import {
  formatMemoryVisibleStatus,
  formatMemoryVisibleText,
} from "@/features/memory/display-copy";
import {
  buildBusinessAssetHrefFromObject,
  buildCommitmentAssetHref,
  buildRiskAssetHref,
} from "@/features/business-assets/hrefs";

type TimelineCategory =
  | "ALL"
  | "NOTE"
  | "FACT"
  | "COMMITMENT"
  | "BLOCKER"
  | "CORRECTION";

type TimelineItem =
  | {
      id: string;
      category: "NOTE";
      timestamp: Date;
      title: string;
      summary: string;
      objectLabel: string;
      sourceLabel: string;
      entry: MemoryClientProps["memoryEntries"][number];
      externalRecord: MemoryClientProps["externalMemoryRecords"][number] | null;
    }
  | {
      id: string;
      category: "FACT";
      timestamp: Date;
      title: string;
      summary: string;
      objectLabel: string;
      sourceLabel: string;
      fact: MemoryClientProps["memoryFacts"][number];
    }
  | {
      id: string;
      category: "COMMITMENT";
      timestamp: Date;
      title: string;
      summary: string;
      objectLabel: string;
      sourceLabel: string;
      commitment: MemoryClientProps["commitments"][number];
    }
  | {
      id: string;
      category: "BLOCKER";
      timestamp: Date;
      title: string;
      summary: string;
      objectLabel: string;
      sourceLabel: string;
      blocker: MemoryClientProps["blockers"][number];
    }
  | {
      id: string;
      category: "CORRECTION";
      timestamp: Date;
      title: string;
      summary: string;
      objectLabel: string;
      sourceLabel: string;
      correction: MemoryClientProps["corrections"][number];
    };

const TIMELINE_PREVIEW_COUNT = 8;

type MemoryClientProps = {
  query: string;
  objectLevel:
    | "ALL"
    | "WORKSPACE"
    | "CONTACT"
    | "COMPANY"
    | "OPPORTUNITY"
    | "MEETING";
  source: "ALL" | "HELM" | "OPENCLAW";
  entryContext: "APPROVAL_EVIDENCE" | null;
  returnToApprovalId: string | null;
  objectType: "CONTACT" | "COMPANY" | "OPPORTUNITY" | "MEETING" | null;
  objectId: string | null;
  permissions: {
    canExportMemory: boolean;
    canManageMemoryFacts: boolean;
    canManageRuntime: boolean;
    canReviewRuntime: boolean;
  };
  firstLoopModel: WorkspaceFirstLoopModel;
  memoryEntries: Array<{
    id: string;
    entityType: "CONTACT" | "COMPANY" | "OPPORTUNITY" | "MEETING" | "WORKSPACE";
    title: string;
    content: string;
    source: string | null;
    createdAt: Date;
    contact: { name: string } | null;
    company: { name: string } | null;
    opportunity: { title: string } | null;
    meeting: { title: string } | null;
  }>;
  memoryFacts: Array<{
    id: string;
    objectType:
      | "CONTACT"
      | "COMPANY"
      | "OPPORTUNITY"
      | "MEETING"
      | "ACTION_ITEM"
      | "APPROVAL_TASK"
      | "POLICY_RULE"
      | "EMAIL_THREAD";
    objectId: string;
    factType: string;
    title: string;
    content: string;
    confidence: number;
    importance: number;
    freshnessScore: number;
    status: string;
    confirmedByUser: boolean;
    sourceType: string;
    sourceId: string;
    updatedAt: Date;
    createdAt: Date;
  }>;
  commitments: Array<{
    id: string;
    title: string;
    commitmentText: string;
    status: string;
    dueDate: Date | null;
    overdueFlag: boolean;
    confidence: number;
    sourceType: string;
    updatedAt: Date;
    relatedContact: { name: string } | null;
    relatedCompany: { name: string } | null;
    relatedOpportunity: { title: string } | null;
    relatedMeeting: { title: string } | null;
    ownerUser: { name: string } | null;
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
    relatedContact: { name: string } | null;
    relatedCompany: { name: string } | null;
    relatedOpportunity: { title: string } | null;
    relatedMeeting: { title: string } | null;
  }>;
  corrections: Array<{
    id: string;
    correctionType: string;
    beforeValue: string | null;
    afterValue: string | null;
    reason: string | null;
    createdAt: Date;
    memoryFact: { title: string } | null;
    correctedByUser: { name: string } | null;
  }>;
  auditLogs: Array<{
    id: string;
    actor: string;
    actorType: string;
    actionType: string;
    targetType: string;
    summary: string;
    payload: string | null;
    createdAt: Date;
  }>;
  externalMemoryRecords: Array<{
    id: string;
    memoryEntryId: string | null;
    scope: string;
    category: string;
    occurredAt: Date;
    syncedAt: Date;
  }>;
  reflectionCandidates: Array<{
    id: string;
    title: string;
    summary: string;
    reviewPosture: string;
    evidenceSummary: string;
    sourceClasses: string[];
    status: string;
    sessionId: string;
    sessionLabel: string;
    href: string;
    createdAt: Date;
  }>;
  reflectionDecisions: Array<{
    id: string;
    title: string;
    summary: string;
    reviewPosture: string;
    evidenceSummary: string;
    sourceClasses: string[];
    status: string;
    sessionId: string;
    sessionLabel: string;
    href: string;
    createdAt: Date;
  }>;
  distillationCandidates: Array<{
    id: string;
    objectType:
      | "CONTACT"
      | "COMPANY"
      | "OPPORTUNITY"
      | "MEETING"
      | "ACTION_ITEM"
      | "APPROVAL_TASK"
      | "POLICY_RULE"
      | "EMAIL_THREAD";
    objectId: string;
    factType: string;
    title: string;
    summary: string;
    sourceFactIds: string[];
    evidenceRefs: string[];
    sourceRefs: string[];
    repeatCount: number;
    confidence: number;
    reviewPosture: string;
    status: string;
    boundaryNote: string;
    createdFrom: string;
    latestSourceAt: Date;
    decisionReason: string | null;
    decidedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  distillationDecisions: Array<{
    id: string;
    objectType:
      | "CONTACT"
      | "COMPANY"
      | "OPPORTUNITY"
      | "MEETING"
      | "ACTION_ITEM"
      | "APPROVAL_TASK"
      | "POLICY_RULE"
      | "EMAIL_THREAD";
    objectId: string;
    factType: string;
    title: string;
    summary: string;
    sourceFactIds: string[];
    evidenceRefs: string[];
    sourceRefs: string[];
    repeatCount: number;
    confidence: number;
    reviewPosture: string;
    status: string;
    boundaryNote: string;
    createdFrom: string;
    latestSourceAt: Date;
    decisionReason: string | null;
    decidedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
};

export function MemoryClient({
  query,
  objectLevel: initialObjectLevel,
  source: initialSource,
  entryContext,
  returnToApprovalId,
  objectType,
  objectId,
  permissions,
  firstLoopModel,
  memoryEntries,
  memoryFacts,
  commitments,
  blockers,
  corrections,
  auditLogs,
  externalMemoryRecords,
  reflectionCandidates,
  reflectionDecisions,
  distillationCandidates,
  distillationDecisions,
}: MemoryClientProps) {
  const memoryHomeArrival = useHomeSurfaceArrival("memory");
  const router = useRouter();
  const { locale, demoMode } = useWorkspaceUi();
  const english = locale === "en-US";
  const memoryText = (value: string | null | undefined) =>
    formatMemoryVisibleText(value, english);
  const memoryStatus = (value: string | null | undefined) =>
    formatMemoryVisibleStatus(value, english);
  const pageStory = getWorkspaceStory("memory", locale, demoMode);
  const objectTypeLabels = getLocalizedObjectTypeLabels(locale);
  const memorySourceLabels = getLocalizedMemorySourceLabels(locale);
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(query);
  const [dimension, setDimension] =
    useState<MemoryClientProps["objectLevel"]>(initialObjectLevel);
  const [sourceFilter, setSourceFilter] =
    useState<MemoryClientProps["source"]>(initialSource);
  const [category, setCategory] = useState<TimelineCategory>("ALL");
  const [showFullTimeline, setShowFullTimeline] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [factEditingId, setFactEditingId] = useState<string | null>(null);
  const [factDraft, setFactDraft] = useState("");
  const [meetingReviewHoldItemIds, setMeetingReviewHoldItemIds] = useState<
    string[]
  >([]);

  const filteredFacts = useMemo(
    () =>
      memoryFacts.filter((fact) => {
        const matchesQuery =
          !search ||
          `${fact.title}${fact.content}${fact.sourceType}`
            .toLowerCase()
            .includes(search.toLowerCase());
        const matchesDimension =
          dimension === "ALL" || fact.objectType === dimension;
        return matchesQuery && matchesDimension;
      }),
    [dimension, memoryFacts, search],
  );

  const filteredCommitments = useMemo(
    () =>
      commitments.filter(
        (commitment) =>
          !search ||
          `${commitment.title}${commitment.commitmentText}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [commitments, search],
  );

  const filteredBlockers = useMemo(
    () =>
      blockers.filter(
        (blocker) =>
          !search ||
          `${blocker.title}${blocker.blockerText}${blocker.blockerType}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [blockers, search],
  );

  const filteredCorrections = useMemo(
    () =>
      corrections.filter(
        (correction) =>
          !search ||
          `${correction.reason ?? ""}${correction.memoryFact?.title ?? ""}${correction.beforeValue ?? ""}${correction.afterValue ?? ""}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [corrections, search],
  );

  const filtered = useMemo(
    () =>
      memoryEntries.filter((entry) => {
        const matchesQuery =
          !search ||
          entry.title.toLowerCase().includes(search.toLowerCase()) ||
          entry.content.toLowerCase().includes(search.toLowerCase()) ||
          entry.source?.toLowerCase().includes(search.toLowerCase());
        const matchesDimension =
          dimension === "ALL" || entry.entityType === dimension;
        return matchesQuery && matchesDimension;
      }),
    [dimension, memoryEntries, search],
  );

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const externalRecordByEntryId = new Map(
      externalMemoryRecords
        .filter((record) => Boolean(record.memoryEntryId))
        .map((record) => [record.memoryEntryId as string, record]),
    );
    const noteItems: TimelineItem[] = filtered.map((entry) => ({
      id: `note-${entry.id}`,
      category: "NOTE",
      timestamp: entry.createdAt,
      title: formatMemoryVisibleText(entry.title, english),
      summary: formatMemoryVisibleText(entry.content, english),
      objectLabel:
        entry.contact?.name ??
        entry.company?.name ??
        entry.opportunity?.title ??
        entry.meeting?.title ??
        (english ? "General context" : "通用线索"),
      sourceLabel: formatMemoryVisibleText(
        entry.source ?? (english ? "General signal" : "通用线索"),
        english,
      ),
      entry,
      externalRecord: externalRecordByEntryId.get(entry.id) ?? null,
    }));

    const factItems: TimelineItem[] = filteredFacts.map((fact) => ({
      id: `fact-${fact.id}`,
      category: "FACT",
      timestamp: fact.updatedAt,
      title: formatMemoryVisibleText(fact.title, english),
      summary: formatMemoryVisibleText(fact.content, english),
      objectLabel: objectTypeLabels[fact.objectType] ?? fact.objectType,
      sourceLabel: formatMemoryVisibleText(
        memorySourceLabels[fact.sourceType] ?? fact.sourceType,
        english,
      ),
      fact,
    }));

    const commitmentItems: TimelineItem[] = filteredCommitments.map(
      (commitment) => ({
        id: `commitment-${commitment.id}`,
        category: "COMMITMENT",
        timestamp: commitment.updatedAt,
        title: formatMemoryVisibleText(commitment.title, english),
        summary: formatMemoryVisibleText(commitment.commitmentText, english),
        objectLabel:
          commitment.relatedOpportunity?.title ??
          commitment.relatedContact?.name ??
          commitment.relatedCompany?.name ??
          commitment.relatedMeeting?.title ??
          (english ? "Unlinked object" : "未关联对象"),
        sourceLabel: describeCommitmentSource(
          commitment.sourceType,
          memorySourceLabels,
          english,
        ),
        commitment,
      }),
    );

    const blockerItems: TimelineItem[] = filteredBlockers.map((blocker) => ({
      id: `blocker-${blocker.id}`,
      category: "BLOCKER",
      timestamp: blocker.updatedAt,
      title: formatMemoryVisibleText(blocker.title, english),
      summary: formatMemoryVisibleText(blocker.blockerText, english),
      objectLabel:
        blocker.relatedOpportunity?.title ??
        blocker.relatedContact?.name ??
        blocker.relatedCompany?.name ??
        blocker.relatedMeeting?.title ??
        (english ? "Unlinked object" : "未关联对象"),
      sourceLabel: formatMemoryVisibleText(blocker.blockerType, english),
      blocker,
    }));

    const correctionItems: TimelineItem[] = filteredCorrections.map(
      (correction) => ({
        id: `correction-${correction.id}`,
        category: "CORRECTION",
        timestamp: correction.createdAt,
        title: formatMemoryVisibleText(
          correction.memoryFact?.title ??
            (english ? "Memory correction" : "记忆修正"),
          english,
        ),
        summary: formatMemoryVisibleText(
          correction.reason ??
            (english
              ? "A memory fact was adjusted or invalidated."
              : "这条记忆事实已经被调整或标记失效。"),
          english,
        ),
        objectLabel:
          correction.correctedByUser?.name ?? (english ? "System" : "系统"),
        sourceLabel: formatMemoryVisibleText(
          correction.correctionType,
          english,
        ),
        correction,
      }),
    );

    const merged = [
      ...correctionItems,
      ...blockerItems,
      ...commitmentItems,
      ...factItems,
      ...noteItems,
    ];
    return merged.sort(
      (left, right) => right.timestamp.getTime() - left.timestamp.getTime(),
    );
  }, [
    english,
    filtered,
    filteredBlockers,
    filteredCommitments,
    filteredCorrections,
    filteredFacts,
    memorySourceLabels,
    objectTypeLabels,
    externalMemoryRecords,
  ]);

  const filteredTimeline = useMemo(
    () =>
      timelineItems.filter(
        (item) => category === "ALL" || item.category === category,
      ),
    [category, timelineItems],
  );
  const visibleTimeline = showFullTimeline
    ? filteredTimeline
    : filteredTimeline.slice(0, TIMELINE_PREVIEW_COUNT);
  const hiddenTimelineCount = Math.max(
    filteredTimeline.length - visibleTimeline.length,
    0,
  );

  const summary = {
    workspace: memoryEntries.filter((entry) => entry.entityType === "WORKSPACE")
      .length,
    contacts:
      memoryEntries.filter((entry) => entry.entityType === "CONTACT").length +
      memoryFacts.filter((entry) => entry.objectType === "CONTACT").length,
    companies:
      memoryEntries.filter((entry) => entry.entityType === "COMPANY").length +
      memoryFacts.filter((entry) => entry.objectType === "COMPANY").length,
    opportunities:
      memoryEntries.filter((entry) => entry.entityType === "OPPORTUNITY")
        .length +
      memoryFacts.filter((entry) => entry.objectType === "OPPORTUNITY").length,
    meetings:
      memoryEntries.filter((entry) => entry.entityType === "MEETING").length +
      memoryFacts.filter((entry) => entry.objectType === "MEETING").length,
  };
  const objectStateSnapshots = useMemo(
    () =>
      buildMemoryObjectStateSnapshots(
        {
          memoryEntries,
          memoryFacts,
          commitments,
          blockers,
          corrections,
          auditLogs,
        },
        english,
      ),
    [
      auditLogs,
      blockers,
      commitments,
      corrections,
      english,
      memoryEntries,
      memoryFacts,
    ],
  );
  const meetingStateSnapshot =
    objectStateSnapshots.find(
      (snapshot) => snapshot.objectType === "MEETING",
    ) ?? null;
  const meetingLinkedCommitments = useMemo(
    () =>
      commitments.filter((commitment) => Boolean(commitment.relatedMeeting)),
    [commitments],
  );
  const openMeetingLinkedCommitments = meetingLinkedCommitments.filter(
    (commitment) =>
      commitment.status !== "FULFILLED" && commitment.status !== "CANCELED",
  );
  const meetingLinkedBlockers = useMemo(
    () => blockers.filter((blocker) => Boolean(blocker.relatedMeeting)),
    [blockers],
  );
  const activeMeetingLinkedBlockers = meetingLinkedBlockers.filter(
    (blocker) => blocker.status !== "RESOLVED" && blocker.status !== "IGNORED",
  );
  const latestMeetingTimelineItem =
    timelineItems.find((item) => {
      if (item.category === "NOTE") return item.entry.entityType === "MEETING";
      if (item.category === "FACT") return item.fact.objectType === "MEETING";
      if (item.category === "COMMITMENT") {
        return Boolean(item.commitment.relatedMeeting);
      }
      if (item.category === "BLOCKER")
        return Boolean(item.blocker.relatedMeeting);
      return false;
    }) ?? null;
  const meetingDerivedFacts = useMemo(
    () =>
      memoryFacts.filter((fact) => {
        if (fact.objectType === "MEETING") return true;
        if (fact.sourceType === "MEETING_NOTE") return true;
        return objectType === "MEETING" && objectId
          ? fact.objectId === objectId
          : false;
      }),
    [memoryFacts, objectId, objectType],
  );
  const meetingDerivedCorrections = useMemo(() => {
    if (objectType === "MEETING" && objectId) {
      return corrections;
    }

    return [];
  }, [corrections, objectId, objectType]);
  const baseMeetingMemoryBundle = buildMeetingMemoryBundle(
    {
      meeting: {
        id:
          objectType === "MEETING" && objectId ? objectId : "meeting-workflow",
        title:
          latestMeetingTimelineItem?.objectLabel ??
          openMeetingLinkedCommitments[0]?.relatedMeeting?.title ??
          meetingLinkedBlockers[0]?.relatedMeeting?.title ??
          (english ? "Meeting workflow memory" : "会议工作流记忆"),
      },
      memoryFacts: meetingDerivedFacts,
      commitments: meetingLinkedCommitments,
      blockers: meetingLinkedBlockers,
      corrections: meetingDerivedCorrections,
      memoryEntries: memoryEntries.filter(
        (entry) => entry.entityType === "MEETING",
      ),
    },
    english,
  );
  const meetingMemoryBundle = useMemo(
    () =>
      applyMeetingMemoryReviewOnlyOverrides(
        baseMeetingMemoryBundle,
        meetingReviewHoldItemIds,
        english,
      ),
    [baseMeetingMemoryBundle, english, meetingReviewHoldItemIds],
  );
  const meetingMemoryGovernanceSummary = buildMeetingMemoryGovernanceSummary(
    meetingMemoryBundle,
    english,
  );
  const meetingWorkspaceLightSummary = buildMeetingWorkspaceLightSummary(
    meetingMemoryBundle,
    english,
  );
  const meetingMemorySourceUseLedger = useMemo(
    () => buildMeetingMemorySourceUseLedger(meetingMemoryBundle, english),
    [english, meetingMemoryBundle],
  );
  const meetingMemoryExportPayload = useMemo(
    () => buildMeetingMemoryExportPayload(meetingMemoryBundle, english),
    [english, meetingMemoryBundle],
  );
  const promotedMeetingMemoryEntries = useMemo(
    () =>
      meetingMemoryBundle.items
        .filter((item) => item.lifecycle === "promoted")
        .slice(0, 3)
        .map((item) => ({
          item,
          governance: buildMeetingMemoryItemGovernanceSummary(
            item,
            meetingMemoryBundle.meetingId,
            english,
          ),
        })),
    [english, meetingMemoryBundle],
  );
  const heldMeetingMemoryEntries = useMemo(
    () =>
      meetingMemoryBundle.items
        .filter((item) => meetingReviewHoldItemIds.includes(item.id))
        .slice(0, 3)
        .map((item) => ({
          item,
          governance: buildMeetingMemoryItemGovernanceSummary(
            item,
            meetingMemoryBundle.meetingId,
            english,
          ),
        })),
    [english, meetingMemoryBundle, meetingReviewHoldItemIds],
  );
  const visibleCount = filteredTimeline.length;
  const reflectionCandidateCount = reflectionCandidates.length;
  const _reflectionDecisionCount = reflectionDecisions.length;
  const distillationCandidateCount = distillationCandidates.length;
  const distillationDecisionCount = distillationDecisions.length;
  const meetingWorkflowSummary = english
    ? `${openMeetingLinkedCommitments.length} meeting follow-through items and ${activeMeetingLinkedBlockers.length} active blockers are shaping the next move.`
    : `${openMeetingLinkedCommitments.length} 条会后动作、${activeMeetingLinkedBlockers.length} 条活跃阻塞正在影响下一步。`;
  const memoryBriefing = {
    headline:
      dimension === "CONTACT"
        ? english
          ? `${summary.contacts} contact memories`
          : `${summary.contacts} 条联系人记忆`
        : dimension === "COMPANY"
          ? english
            ? `${summary.companies} company memories`
            : `${summary.companies} 条公司记忆`
          : dimension === "OPPORTUNITY"
            ? english
              ? `${summary.opportunities} opportunity memories`
              : `${summary.opportunities} 条机会记忆`
            : dimension === "MEETING"
              ? english
                ? `${summary.meetings} meeting memories`
                : `${summary.meetings} 条会议记忆`
              : english
                ? `${visibleCount} reusable business records`
                : `已沉淀 ${visibleCount} 条经营记录`,
    summary: english
      ? "Facts, commitments, blockers and corrections stay available when the next decision needs context."
      : "事实、承诺、阻塞和修正会在下一次判断时继续可用。",
    takeaways: [
      reflectionCandidateCount > 0
        ? english
          ? `${reflectionCandidateCount} carry-forward candidates waiting for review.`
          : `${reflectionCandidateCount} 条延续候选等复核。`
        : null,
      distillationCandidateCount > 0
        ? english
          ? `${distillationCandidateCount} distillation candidates waiting for review.`
          : `${distillationCandidateCount} 条浓缩候选等复核。`
        : distillationDecisionCount > 0
          ? english
            ? `${distillationDecisionCount} reviewed distillations on file.`
            : `${distillationDecisionCount} 条已复核浓缩在档。`
          : null,
    ].filter((item): item is string => Boolean(item)),
    operatorPrompt: english
      ? "Read the facts, correct drift, export the handoff summary."
      : "先读事实、修正偏差、导出交接摘要。",
  };
  const _memoryGuidanceRecommendations = [
    {
      title: english
        ? "Read object state before replaying the timeline"
        : "先读对象状态，再回放时间线",
      body: english
        ? `${objectStateSnapshots.length} object-state snapshot(s) are already summarizing what the system treats as stable context instead of raw note fragments.`
        : `当前已有 ${objectStateSnapshots.length} 个对象状态快照，先把稳定上下文从零散笔记里抽出来。`,
      meta: meetingStateSnapshot?.summary,
    },
    {
      title: english
        ? "Use meeting memory as workflow substrate"
        : "把会议记忆当成工作流底座来读",
      body: meetingWorkflowSummary,
      href: "#meeting-memory-ledger",
      meta: meetingWorkspaceLightSummary.summary,
    },
    {
      title: english
        ? "Correct drift before exporting wider context"
        : "先修正漂移，再导出更宽上下文",
      body: permissions.canManageMemoryFacts
        ? english
          ? "Fix facts here before they shape downstream decisions."
          : "在这里修正事实，再让它影响下游判断。"
        : english
          ? "Read-only for this role. Correction needs higher review."
          : "当前角色只读。修正要更高级别复核。",
      href: "#memory-timeline",
    },
  ];
  const _memoryGuidanceReminders = [
    {
      title: english ? "Visible timeline scope" : "当前可见时间线范围",
      body: english
        ? `${visibleCount} timeline item(s) are currently visible in this working slice.`
        : `当前工作切片里可见 ${visibleCount} 条时间线条目。`,
    },
    {
      title: english ? "Meeting review-only posture" : "会议仅复核姿态",
      body: meetingWorkspaceLightSummary.collaborationLine,
    },
    {
      title: english ? "Export and correction boundary" : "导出与修正边界",
      body:
        permissions.canExportMemory && permissions.canManageMemoryFacts
          ? english
            ? "Export + correct enabled — both explicit, tenant-scoped, reversible."
            : "导出 + 修正都开放——显式、租户内、可逆。"
          : permissions.canExportMemory
            ? english
              ? "Export enabled. Correction needs a higher role."
              : "可以导出。修正要更高角色。"
            : permissions.canManageMemoryFacts
              ? english
                ? "Correction enabled. Export stays restricted."
                : "可以修正。导出受限。"
              : english
                ? "Read-only."
                : "只读。",
    },
  ];

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
      setEditingId(null);
      setDraft("");
      setFactEditingId(null);
      setFactDraft("");
      router.refresh();
    });
  };

  const exportMeetingMemoryBundle = () => {
    downloadMeetingMemoryBundleExport(
      meetingMemoryExportPayload,
      meetingMemoryBundle.meetingId,
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

  const applyFilters = (
    nextSearch = search,
    nextDimension = dimension,
    nextSource = sourceFilter,
  ) => {
    const params = new URLSearchParams();
    if (nextSearch.trim()) params.set("query", nextSearch.trim());
    if (nextDimension !== "ALL") params.set("objectLevel", nextDimension);
    if (nextSource !== "ALL") params.set("source", nextSource);
    if (objectType && objectId) {
      params.set("objectType", objectType);
      params.set("objectId", objectId);
    }
    if (entryContext === "APPROVAL_EVIDENCE") {
      params.set("from", "approvals");
    }
    if (returnToApprovalId) {
      params.set("approvalId", returnToApprovalId);
    }
    router.push(params.size ? `/memory?${params.toString()}` : "/memory");
  };

  const visibleMemoryHashTargets = useMemo(
    () => [
      MEMORY_PAGE_ANCHORS.timeline,
      MEMORY_PAGE_ANCHORS.auditReplay,
      ...filteredTimeline.map((item) => getTimelineItemAnchorId(item)),
      ...auditLogs
        .slice(0, 8)
        .map((log) => buildMemoryItemAnchor("audit", log.id)),
    ],
    [auditLogs, filteredTimeline],
  );

  useEffect(() => {
    scrollToWindowHashTarget(visibleMemoryHashTargets);
  }, [visibleMemoryHashTargets]);

  const scrollToAuditReplay = () => {
    document
      .getElementById(MEMORY_PAGE_ANCHORS.auditReplay)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const objectScopedMemoryLabel =
    objectType && objectId
      ? buildObjectScopedMemoryLabel({
          english,
          objectType,
          objectTypeLabels,
          memoryEntries,
          commitments,
          blockers,
        })
      : null;
  const objectScopedMemoryHref =
    objectType && objectId
      ? buildObjectScopedMemoryHref(objectType, objectId)
      : null;
  const isApprovalEvidenceEntry = entryContext === "APPROVAL_EVIDENCE";
  const approvalEvidenceReturnHref =
    buildApprovalEvidenceReturnHref(returnToApprovalId);
  const memoryLandingAnchor =
    firstLoopModel.memoryWriteBack.status === "done"
      ? MEMORY_PAGE_ANCHORS.auditReplay
      : MEMORY_PAGE_ANCHORS.timeline;
  const memoryLandingCtaLabel =
    firstLoopModel.memoryWriteBack.status === "done"
      ? english
        ? "Open audit replay"
        : "打开审计回放"
      : english
        ? "Open memory timeline"
        : "打开记忆时间线";
  const memoryPermissionBoundaryNote =
    !permissions.canExportMemory || !permissions.canManageMemoryFacts ? (
      <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
        {permissions.canExportMemory && !permissions.canManageMemoryFacts
          ? english
            ? "Can replay and export. Correction/removal need higher review."
            : "可以回放和导出。修正/移除需要更高级别复核。"
          : !permissions.canExportMemory && permissions.canManageMemoryFacts
            ? english
              ? "Can correct facts. Export needs higher review."
              : "可以修正事实。导出需要更高权限。"
            : english
              ? "Read-only. Export and correction limited to owner / admin / operator / reviewer."
              : "只读。导出和修正限定给所有者、管理员、操作人、复核人。"}
      </div>
    ) : null;
  const distillationReviewSection =
    sourceFilter !== "OPENCLAW" ? (
      <Card className="workspace-panel-muted">
        <CardHeader>
          <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
            <CircleDot className="h-3.5 w-3.5" />
            {english ? "Distillation candidate review" : "记忆浓缩候选复核"}
          </div>
          <CardTitle>
            {english
              ? "Repeated memory candidates waiting for a human decision"
              : "重复记忆候选等待人工确认"}
          </CardTitle>
          <details className="text-xs leading-6 text-[color:var(--muted)]">
            <summary
              aria-label={english ? "Decision scope" : "确认范围"}
              className="cursor-pointer list-none font-semibold marker:content-none [&::-webkit-details-marker]:hidden"
            >
              {english ? "Decision scope" : "确认范围"}
            </summary>
            {english
              ? "Approve/reject/defer only records the decision. This is not a chat surface; it does not create canonical MemoryFact, does not promote memory, does not execute actions, and does not change recommendation ranking."
              : "批准/拒绝/暂缓只记录决定。不晋升记忆，也不改排序。"}
          </details>
        </CardHeader>
        <CardContent className="space-y-4">
          {distillationCandidates.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {distillationCandidates.map((item) => (
                <div
                  key={item.id}
                  className="theme-surface-panel rounded-2xl px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-[color:var(--foreground)]">
                          {memoryText(item.title)}
                        </p>
                        <Badge variant="approval">
                          {memoryStatus(item.status)}
                        </Badge>
                        <Badge variant="neutral">
                          {objectTypeLabels[item.objectType] ?? item.objectType}
                        </Badge>
                      </div>
                      <p className="text-sm leading-7 text-[color:var(--foreground)]">
                        {memoryText(item.summary)}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="neutral">
                          {english ? "Repeat count" : "重复次数"}{" "}
                          {item.repeatCount}
                        </Badge>
                        <Badge variant="neutral">
                          {english ? "Confidence" : "置信度"}{" "}
                          {item.confidence}
                        </Badge>
                        <Badge variant="neutral">
                          {memoryText(item.factType)}
                        </Badge>
                      </div>
                      <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
                        {memoryText(item.boundaryNote)}
                      </p>
                      {item.evidenceRefs.length ? (
                        <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
                          {english ? "Evidence" : "证据"}：
                          {item.evidenceRefs.slice(0, 3).join(", ")}
                        </p>
                      ) : null}
                    </div>
                    {permissions.canManageMemoryFacts ? (
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            runAction(
                              () =>
                                reviewMemoryDistillationCandidateAction({
                                  candidateId: item.id,
                                  decision: "approve",
                                }),
                              english
                                ? "Distillation candidate approved"
                                : "已批准记忆浓缩候选",
                            )
                          }
                          disabled={pending}
                        >
                          {english ? "Approve" : "批准"}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            runAction(
                              () =>
                                reviewMemoryDistillationCandidateAction({
                                  candidateId: item.id,
                                  decision: "defer",
                                }),
                              english
                                ? "Distillation candidate deferred"
                                : "已暂缓记忆浓缩候选",
                            )
                          }
                          disabled={pending}
                        >
                          {english ? "Defer" : "暂缓"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            runAction(
                              () =>
                                reviewMemoryDistillationCandidateAction({
                                  candidateId: item.id,
                                  decision: "reject",
                                }),
                              english
                                ? "Distillation candidate rejected"
                                : "已拒绝记忆浓缩候选",
                            )
                          }
                          disabled={pending}
                        >
                          {english ? "Reject" : "拒绝"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title={
                english
                  ? "No pending distillation candidates"
                  : "暂无待复核的浓缩候选"
              }
              description={
                english
                  ? "Repeated facts that need confirmation show up here."
                  : "需要确认的重复事实会出现在这里。"
              }
            />
          )}
          {distillationDecisions.length ? (
            <div className="space-y-3 border-t border-[color:var(--border)] pt-4">
              <div>
                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                  {english ? "Recently reviewed" : "最近复核记录"}
                </p>
                <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
                  {english
                    ? "Approved, rejected, and deferred candidates stay visible as a review audit trail."
                    : "已批准、已拒绝和已暂缓的候选会作为复核审计轨迹继续可见。"}
                </p>
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                {distillationDecisions.map((item) => (
                  <div
                    key={`decision-${item.id}`}
                    className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-[color:var(--foreground)]">
                        {memoryText(item.title)}
                      </p>
                      <Badge
                        variant={
                          item.status === "APPROVED"
                            ? "success"
                            : item.status === "REJECTED"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {memoryStatus(item.status)}
                      </Badge>
                      <Badge variant="neutral">
                        {item.decidedAt
                          ? formatDateLabel(item.decidedAt)
                          : formatDateLabel(item.updatedAt)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                      {memoryText(item.summary)}
                    </p>
                    {item.decisionReason ? (
                      <p className="mt-2 text-xs leading-6 text-[color:var(--muted-foreground)]">
                        {memoryText(item.decisionReason)}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    ) : null;
  const reflectionCarryForwardSection =
    sourceFilter !== "OPENCLAW" ? (
      <Card className="workspace-panel-muted">
        <CardHeader>
          <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
            <Sparkles className="h-3.5 w-3.5" />
            {english ? "Reflection carry-forward" : "复盘延续"}
          </div>
          <CardTitle>
            {english
              ? "Review-safe runtime context that can feed later memory work"
              : "可复用的信息资产"}
          </CardTitle>
          <details className="text-xs leading-6 text-[color:var(--muted)]">
            <summary
              aria-label={english ? "Source" : "来源"}
              className="cursor-pointer list-none font-semibold marker:content-none [&::-webkit-details-marker]:hidden"
            >
              {english ? "Source" : "来源"}
            </summary>
            {english
              ? "These candidates come from reflection over trusted runtime state."
              : "这些候选来自对已确认运行状态的复盘。"}
          </details>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-2">
          {reflectionCandidates.length ? (
            reflectionCandidates.map((item) => (
              <div
                key={item.id}
                className="theme-surface-panel rounded-2xl px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-[color:var(--foreground)]">{item.title}</p>
                      <Badge variant="success">
                        {memoryStatus(item.status)}
                      </Badge>
                      <Badge variant="neutral">
                        {memoryText(item.sessionLabel)}
                      </Badge>
                    </div>
                    <p className="text-sm leading-7 text-[color:var(--foreground)]">
                      {memoryText(item.summary)}
                    </p>
                    <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
                      {memoryText(item.reviewPosture)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="secondary">
                      <a href={item.href}>
                        {english ? "Open meeting" : "打开会议"}
                      </a>
                    </Button>
                    {permissions.canReviewRuntime ? (
                      <Button
                        data-reflection-carry-forward-action="accept"
                        onClick={() =>
                          runAction(
                            () =>
                              acceptReflectionCarryForwardAction({
                                candidateId: item.id,
                                sourcePage: "/memory",
                              }),
                            english ? "Reflection carry-forward candidate accepted" : "已接受复盘延续候选",
                          )
                        }
                        disabled={pending}
                      >
                        {english ? "Accept" : "接受"}
                      </Button>
                    ) : null}
                    {permissions.canManageRuntime ? (
                      <Button
                        data-reflection-carry-forward-action="dismiss"
                        variant="ghost"
                        onClick={() =>
                          runAction(
                            () =>
                              dismissReflectionCarryForwardAction({
                                candidateId: item.id,
                                sourcePage: "/memory",
                              }),
                            english ? "Reflection carry-forward candidate dismissed" : "已忽略复盘延续候选",
                          )
                        }
                        disabled={pending}
                      >
                        {english ? "Dismiss" : "忽略"}
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.sourceClasses.map((sourceClass) => (
                    <Badge key={`${item.id}-${sourceClass}`} variant="neutral">
                      {memoryText(sourceClass)}
                    </Badge>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-6 text-[color:var(--muted-foreground)]">
                  {memoryText(item.evidenceSummary)}
                </p>
              </div>
            ))
          ) : (
            <EmptyState
              title={
                english ? "No reflection carry-forward yet" : "还没有复盘延续"
              }
              description={
                english
                  ? "Candidates appear here after a confirmed meeting reflection runs."
                  : "会议复盘运行后，候选会出现在这里。"
              }
            />
          )}
        </CardContent>
      </Card>
    ) : null;
  const reflectionDecisionsSection =
    sourceFilter !== "OPENCLAW" && reflectionDecisions.length ? (
      <Card className="workspace-panel-muted">
        <CardHeader>
          <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
            <Sparkles className="h-3.5 w-3.5" />
            {english ? "Reflection decisions" : "复盘决策"}
          </div>
          <CardTitle>
            {english
              ? "Accepted or dismissed carry-forward stays visible as an audit trail"
              : "已经接受或忽略的延续上下文仍然作为审计轨迹保留可见"}
          </CardTitle>
          <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
            {english
              ? "No longer active — kept here for traceability."
              : "已不再活跃——留作可追踪记录。"}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-2">
          {reflectionDecisions.map((item) => (
            <div
              key={item.id}
              className="theme-surface-panel rounded-2xl px-4 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-[color:var(--foreground)]">{item.title}</p>
                    <Badge
                      variant={
                        item.status === "PROMOTED" ? "success" : "danger"
                      }
                    >
                      {memoryStatus(item.status)}
                    </Badge>
                    <Badge variant="neutral">
                      {memoryText(item.sessionLabel)}
                    </Badge>
                  </div>
                  <p className="text-sm leading-7 text-[color:var(--foreground)]">
                    {memoryText(item.summary)}
                  </p>
                  <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
                    {memoryText(item.reviewPosture)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="secondary">
                    <a href={item.href}>
                      {english ? "Open meeting" : "打开会议"}
                    </a>
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.sourceClasses.map((sourceClass) => (
                  <Badge key={`${item.id}-${sourceClass}`} variant="neutral">
                    {memoryText(sourceClass)}
                  </Badge>
                ))}
              </div>
              <p className="mt-3 text-xs leading-6 text-[color:var(--muted-foreground)]">
                {memoryText(item.evidenceSummary)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    ) : null;
  const memoryLandingDeferredContext = (
    <>
      {memoryPermissionBoundaryNote}
      {distillationReviewSection}
      {reflectionCarryForwardSection}
      {reflectionDecisionsSection}
    </>
  );
  const memoryMeetingWorkspaceContext = meetingStateSnapshot ? (
    <Card className="workspace-panel-muted">
      <CardContent className="grid items-start gap-4 py-5 xl:grid-cols-[minmax(0,1.25fr)_repeat(2,minmax(168px,0.7fr))] 2xl:grid-cols-[minmax(0,1.25fr)_repeat(4,minmax(156px,0.7fr))]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="approval">
              {english ? "Meeting OS wedge" : "会议记忆切片"}
            </Badge>
            <Badge variant="neutral">
              {meetingWorkspaceLightSummary.visibilityLabel}
            </Badge>
            <Badge
              variant={
                meetingStateSnapshot.status === "healthy"
                  ? "success"
                  : meetingStateSnapshot.status === "watch"
                    ? "warning"
                    : "danger"
              }
            >
              {meetingStateSnapshot.status === "healthy"
                ? english
                  ? "Meeting memory stable"
                  : "会议记忆较稳定"
                : meetingStateSnapshot.status === "watch"
                  ? english
                    ? "Meeting memory under watch"
                    : "会议记忆需继续观察"
                  : english
                    ? "Meeting memory blocked"
                    : "会议记忆仍受阻"}
            </Badge>
          </div>
          <p className="text-lg font-semibold text-[color:var(--foreground)]">
            {english
              ? "Meeting notes only matter when they keep shaping follow-through, review posture and later arbitration."
              : "会议纪要真正有价值的前提，是它继续改变会后动作、复核边界和后续仲裁。"}
          </p>
          <p className="text-sm leading-6 text-[color:var(--muted)]">
            {meetingWorkflowSummary}
          </p>
          <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
            {memoryText(meetingMemoryBundle.summary)}
          </p>
          <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
            {memoryText(meetingMemoryBundle.lifecycleSummary)}
          </p>
          <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
            {memoryText(meetingWorkspaceLightSummary.summary)}
          </p>
          {meetingReviewHoldItemIds.length > 0 ? (
            <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
              {english
                ? `${meetingReviewHoldItemIds.length} promoted item(s) are currently being held behind review on this page, so the meeting-derived writeback remains explicit and reversible.`
                : `当前有 ${meetingReviewHoldItemIds.length} 条已提升内容在这个页面里被保留在复核后面，所以会议写回仍然保持显式且可逆。`}
            </p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="theme-surface-panel rounded-2xl px-4 py-3">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "Affected objects" : "受影响对象"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {meetingMemoryBundle.affectedObjects.length ? (
                  meetingMemoryBundle.affectedObjects
                    .slice(0, 4)
                    .map((item) => (
                      <Badge
                        key={`${item.objectType}:${item.id}`}
                        variant="info"
                      >
                        {memoryText(item.label)}
                      </Badge>
                    ))
                ) : (
                  <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                    {english
                      ? "Current meeting memory still needs clearer downstream object attribution."
                      : "当前会议记忆还需要更清楚的下游对象归属。"}
                  </p>
                )}
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
                        {memoryText(pointer.label)}
                      </p>
                      <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                        {memoryText(pointer.summary)}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="theme-surface-panel rounded-2xl px-4 py-3">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "Governance visibility" : "治理可见性"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="info">
                  {memoryText(meetingMemoryGovernanceSummary.visibilityLabel)}
                </Badge>
                {meetingMemoryGovernanceSummary.sourceClassLabels.map(
                  (label) => (
                    <Badge key={label} variant="neutral">
                      {memoryText(label)}
                    </Badge>
                  ),
                )}
              </div>
              <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                {memoryText(meetingMemoryGovernanceSummary.ownershipSummary)}
              </p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                {memoryText(meetingWorkspaceLightSummary.collaborationLine)}
              </p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                {memoryText(meetingMemoryGovernanceSummary.sourceSummary)}
              </p>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-3">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "Object-state eligibility" : "对象状态使用资格"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge
                  variant={
                    meetingMemoryGovernanceSummary.reviewState === "conflict"
                      ? "danger"
                      : meetingMemoryGovernanceSummary.reviewState ===
                          "pending-review"
                        ? "approval"
                        : meetingMemoryGovernanceSummary.reviewState ===
                            "missing-clarity"
                          ? "warning"
                          : "success"
                  }
                >
                  {memoryText(meetingMemoryGovernanceSummary.reviewStateLabel)}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                {memoryText(meetingMemoryGovernanceSummary.reviewSummary)}
              </p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                {memoryText(meetingMemoryGovernanceSummary.eligibilitySummary)}
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="theme-surface-panel rounded-2xl px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                  {english ? "Source-use ledger" : "来源使用台账"}
                </p>
                <Badge variant="approval">
                  {english ? "Readable only" : "仅做可读说明"}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                {memoryText(meetingMemorySourceUseLedger.summary)}
              </p>
              <div className="mt-3 space-y-3">
                {meetingMemorySourceUseLedger.entries
                  .slice(0, 3)
                  .map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3"
                    >
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="neutral">
                          {memoryText(entry.sourceClassLabel)}
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
                          {memoryText(entry.reviewStateLabel)}
                        </Badge>
                      </div>
                      <p className="mt-2 font-medium text-[color:var(--foreground)]">
                        {memoryText(entry.title)}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                        {memoryText(entry.sourcePointerLabel)}：
                        {memoryText(entry.sourcePointerSummary)}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                        {memoryText(entry.eligibilitySummary)}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
            <div className="theme-surface-panel rounded-2xl px-4 py-3">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "Manual governance actions" : "人工治理动作"}
              </p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                {english
                  ? "Use this only to keep a promoted meeting-memory item back behind review. This does not delete the item or silently rewrite object state."
                  : "这里的动作只用于把已提升会议记忆重新保留在复核后面，不会删除内容，也不会静默重写对象状态。"}
              </p>
              <div className="mt-3 space-y-3">
                {promotedMeetingMemoryEntries.length ? (
                  promotedMeetingMemoryEntries.map(({ item, governance }) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3"
                    >
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="success">
                          {memoryText(governance.visibilityLabel)}
                        </Badge>
                        <Badge variant="neutral">
                          {memoryText(governance.sourceClassLabel)}
                        </Badge>
                      </div>
                      <p className="mt-2 font-medium text-[color:var(--foreground)]">
                        {memoryText(item.title)}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                        {memoryText(governance.eligibilitySummary)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            movePromotedItemBackToReview(item.id, item.title)
                          }
                        >
                          {english ? "Move back to review" : "退回复核"}
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                    {english
                      ? "No promoted meeting-memory item is currently available for manual review hold."
                      : "当前没有可供人工回退到复核的已提升会议记忆项。"}
                  </p>
                )}
                {heldMeetingMemoryEntries.length ? (
                  <div className="space-y-3">
                    {heldMeetingMemoryEntries.map(({ item, governance }) => (
                      <div
                        key={`held-${item.id}`}
                        className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3"
                      >
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="approval">
                            {english ? "Manual review hold" : "人工保留复核"}
                          </Badge>
                          <Badge variant="neutral">
                            {memoryText(governance.sourceClassLabel)}
                          </Badge>
                        </div>
                        <p className="mt-2 font-medium text-[color:var(--foreground)]">
                          {memoryText(item.title)}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                          {memoryText(governance.eligibilitySummary)}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              restorePromotedItemPosture(item.id, item.title)
                            }
                          >
                            {english
                              ? "Restore promoted posture"
                              : "恢复已提升姿态"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {permissions.canExportMemory ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={exportMeetingMemoryBundle}
              >
                <Download className="h-4 w-4" />
                {english ? "Export bundle" : "导出记忆包"}
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" asChild>
              <a
                href={
                  objectType === "MEETING" && objectId
                    ? `/meetings/${objectId}`
                    : "/meetings"
                }
              >
                {english
                  ? objectType === "MEETING" && objectId
                    ? "Back to linked meeting"
                    : "Open meeting loop"
                  : objectType === "MEETING" && objectId
                    ? "回到相关会议"
                    : "打开会议主回路"}
              </a>
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setDimension("MEETING");
                applyFilters(search, "MEETING");
              }}
            >
              {english ? "Only show meeting memory" : "只看会议记忆"}
            </Button>
            <Button size="sm" variant="secondary" asChild>
              <a href="/dashboard">
                {english ? "Back to dashboard arbitration" : "回到工作台仲裁"}
              </a>
            </Button>
            <Button size="sm" variant="secondary" asChild>
              <a href="/approvals">
                {english ? "Open review boundary" : "打开复核与边界"}
              </a>
            </Button>
            <Button size="sm" variant="secondary" onClick={scrollToAuditReplay}>
              {english ? "Open audit replay" : "查看审计回放"}
            </Button>
          </div>
        </div>
        <div className="theme-surface-panel min-w-0 rounded-2xl px-4 py-4">
          <p className="text-xs font-medium break-words text-[color:var(--muted-foreground)]">
            {english ? "Workspace visibility" : "工作台可见性"}
          </p>
          <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
            {memoryText(meetingWorkspaceLightSummary.visibilityLabel)}
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
            {memoryText(meetingWorkspaceLightSummary.collaborationLine)}
          </p>
        </div>
        <div className="theme-surface-panel min-w-0 rounded-2xl px-4 py-4">
          <p className="text-xs font-medium break-words text-[color:var(--muted-foreground)]">
            {english ? "Promoted into object state" : "已提升进对象状态"}
          </p>
          <p className="mt-2 text-3xl font-semibold text-[color:var(--foreground)]">
            {meetingMemoryBundle.promotedCount}
          </p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
            {english
              ? `${meetingMemoryBundle.facts.length} facts, ${meetingMemoryBundle.commitments.length} commitments and ${meetingMemoryBundle.blockers.length} blockers are already visible in structured memory or downstream object state.`
              : `当前已有 ${meetingMemoryBundle.facts.length} 条事实、${meetingMemoryBundle.commitments.length} 条承诺和 ${meetingMemoryBundle.blockers.length} 条阻塞进入可复用记忆或下游对象状态。`}
          </p>
        </div>
        <div className="theme-surface-panel min-w-0 rounded-2xl px-4 py-4">
          <p className="text-xs font-medium break-words text-[color:var(--muted-foreground)]">
            {english ? "Ready for promotion" : "可继续提升"}
          </p>
          <p className="mt-2 text-3xl font-semibold text-[color:var(--foreground)]">
            {meetingMemoryBundle.readyCount}
          </p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
            {english
              ? `${meetingMemoryBundle.decisions.length} decisions and ${meetingMemoryBundle.openQuestions.length} open questions are currently the main candidates for careful promotion.`
              : `当前最主要的提升候选是 ${meetingMemoryBundle.decisions.length} 条决策和 ${meetingMemoryBundle.openQuestions.length} 条待确认问题。`}
          </p>
        </div>
        <div className="theme-surface-panel min-w-0 rounded-2xl px-4 py-4">
          <p className="text-xs font-medium break-words text-[color:var(--muted-foreground)]">
            {english ? "Still pending or conflicting" : "仍待复核或存在冲突"}
          </p>
          <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">
            {meetingMemoryBundle.conflictCount > 0
              ? english
                ? `${meetingMemoryBundle.conflictCount} conflict cues are visible`
                : `当前有 ${meetingMemoryBundle.conflictCount} 条冲突线索`
              : english
                ? `${meetingMemoryBundle.pendingReviewCount} items should stay behind review`
                : `当前有 ${meetingMemoryBundle.pendingReviewCount} 条项目应继续留在复核后面`}
          </p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
            {english
              ? `${meetingMemoryBundle.pendingReviewCount} items are still pressure-heavy, and ${meetingMemoryBundle.conflictCount} cues say the current meeting memory should remain explainable instead of silently overwriting object state.`
              : `当前有 ${meetingMemoryBundle.pendingReviewCount} 条项目仍然压力较高，另有 ${meetingMemoryBundle.conflictCount} 条线索提醒：这层会议记忆必须保持可解释，而不是静默覆盖对象状态。`}
          </p>
        </div>
      </CardContent>
    </Card>
  ) : null;

  return (
    <div className="workspace-surface-stack">
      <PageHeader
        eyebrow={pageStory.eyebrow}
        title={
          english
            ? "Customer asset timeline"
            : "客户资产时间线"
        }
        description={
          english
            ? "Customer facts, commitments, blockers and corrections that now shape follow-through."
            : "客户事实、承诺、阻塞和修正，都会继续影响后续动作。"
        }
        briefing={memoryHomeArrival.isHomeSurfaceArrival ? undefined : memoryBriefing}
        actions={
          permissions.canExportMemory ? (
            <Button asChild variant="secondary">
              <a
                href={`/api/memory/export?query=${encodeURIComponent(search)}&objectLevel=${dimension}&source=${sourceFilter}${objectType && objectId ? `&objectType=${objectType}&objectId=${objectId}` : ""}`}
              >
                <Download className="h-4 w-4" />
                {english ? "Export summary" : "导出摘要"}
              </a>
            </Button>
          ) : null
        }
      />

      <HomeSurfaceArrivalBanner
        kind="memory"
        english={english}
        contract={{
          ownership: english
            ? "Memory owns durable state, correction, and replay after the move leaves the live surface."
            : "经营记忆负责动作离开现场工作面之后的稳定状态、修正与回放。",
          nextStep:
            firstLoopModel.memoryWriteBack.status === "done"
              ? english
                ? "Start in audit replay to confirm what already became durable, then decide whether correction or reuse is needed."
                : "先从审计回放开始，确认哪些内容已经变成稳定状态，再判断是否需要修正或复用。"
              : english
                ? "Start in the work timeline, write back the fresh result, and leave the context readable for the next visit."
                : "先从工作时间线开始，把刚发生的结果写回去，并为下次进入留下可读上下文。",
          ctaLabel: memoryLandingCtaLabel,
          ctaHref: `#${memoryLandingAnchor}`,
          boundary: english
            ? "Memory can shape downstream judgement immediately, but durable correction and export still stay explicit and reviewable."
            : "经营记忆会立刻影响下游判断，但稳定修正和导出仍保持显式且可复核。",
        }}
      />

      <Card className="workspace-panel">
        <CardHeader>
          <CardTitle>
            {english ? "Customer-state ledger" : "客户状态清单"}
          </CardTitle>
          <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
            {english
              ? "Stable customer facts stay here; raw timeline details stay one layer lower."
              : "稳定客户事实留在这里，零散时间线放到下层。"}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-2">
          {objectStateSnapshots.map((snapshot) => (
            <div
              key={snapshot.id}
              className="theme-surface-panel rounded-2xl px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-[color:var(--foreground)]">
                      {memoryText(snapshot.label)}
                    </p>
                    <Badge
                      variant={
                        snapshot.status === "healthy"
                          ? "success"
                          : snapshot.status === "watch"
                            ? "warning"
                            : "danger"
                      }
                    >
                      {snapshot.status === "healthy"
                        ? english
                          ? "Stable"
                          : "稳定"
                        : snapshot.status === "watch"
                          ? english
                            ? "Watch"
                            : "观察"
                          : english
                            ? "Blocked"
                            : "受阻"}
                    </Badge>
                  </div>
                  <p className="text-sm leading-6 text-[color:var(--muted)]">
                    {memoryText(snapshot.summary)}
                  </p>
                </div>
                <div className="grid min-w-[112px] grid-cols-2 gap-2 text-xs text-[color:var(--muted-foreground)]">
                  <StateMetric
                    label={english ? "Facts" : "事实"}
                    value={snapshot.activeFacts}
                  />
                  <StateMetric
                    label={english ? "Commitments" : "承诺"}
                    value={snapshot.openCommitments}
                  />
                  <StateMetric
                    label={english ? "Blockers" : "阻塞"}
                    value={snapshot.openBlockers}
                  />
                  <StateMetric
                    label={english ? "Corrections" : "修正"}
                    value={snapshot.recentCorrections}
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {snapshot.suggestedSkillIds.map((skillId) => (
                  <Badge key={skillId} variant="info">
                    {memoryText(
                      getOperatingSkillById(skillId)?.name ?? skillId,
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {memoryHomeArrival.isHomeSurfaceArrival ? (
        <HomeSurfaceSecondaryDisclosure
          kind="memory"
          english={english}
          title={
            english
              ? "Open memory guidance, correction boundary and reflection history only when needed"
              : "只在需要时再打开记忆引导、修正边界和复盘历史"
          }
          summary={
            english
              ? "Keep presets, correction boundary notes and reflection history behind the next layer so the landing screen can stay focused on durable state and the live timeline."
              : "把预设、修正边界说明和复盘历史后置到下一层，让首屏继续聚焦稳定状态和正在发生的时间线。"
          }
        >
          <>
            {memoryLandingDeferredContext}
          </>
        </HomeSurfaceSecondaryDisclosure>
      ) : (
        <ControlledDisclosure
          className="workspace-panel-muted rounded-[24px] border border-[color:var(--border)]"
          summaryClassName="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-4"
          bodyClassName="space-y-4 border-t border-[color:var(--border)] px-4 py-4"
          summaryLabel={
            english
              ? "Review candidates and correction boundary"
              : "复核候选与修正边界"
          }
          summary={
            <>
              <div className="space-y-2">
                <p className="workspace-eyebrow">
                  {english ? "Review layer" : "复核层"}
                </p>
                <p className="text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
                  {english
                    ? "Open candidates only when memory needs a decision"
                    : "只有记忆需要判断时再打开候选区"}
                </p>
                <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                  {english
                    ? "Duplicate candidates, correction limits and reflection history stay here so the main screen can lead with customer assets."
                    : "重复候选、修正边界和复盘历史收在这里，主屏继续先露出客户经营资产。"}
                </p>
              </div>
              <span className="mt-1 rounded-full border border-[color:var(--border)] bg-[color:var(--background-elevated)] p-2 text-[color:var(--muted-foreground)]">
                <ChevronDown className="h-4 w-4" />
              </span>
            </>
          }
        >
          {memoryLandingDeferredContext}
        </ControlledDisclosure>
      )}

      {memoryMeetingWorkspaceContext ? (
        memoryHomeArrival.isHomeSurfaceArrival ? (
          <ControlledDisclosure
            className="workspace-panel-muted rounded-[24px] border border-[color:var(--border)]"
            data-memory-home-meeting-secondary="true"
            summaryClassName="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-4"
            bodyClassName="space-y-4 border-t border-[color:var(--border)] px-4 py-4"
            summaryLabel={
              english ? "Meeting-memory workspace" : "会议记忆工作区"
            }
            summary={
              <>
                <div className="space-y-2">
                  <p className="workspace-eyebrow">
                    {english ? "Meeting-memory workspace" : "会议记忆工作区"}
                  </p>
                  <p className="text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
                    {english
                      ? "Open meeting follow-through, governance and replay context only when needed"
                      : "只在需要时再打开会议会后动作、治理和回放上下文"}
                  </p>
                  <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                    {english
                      ? "Keep the meeting-memory wedge, governance ledger and manual hold actions behind the next layer so the landing screen can move from object state into the live timeline first."
                      : "把会议记忆入口、治理台账和人工保留动作继续后置到下一层，让首屏先从对象状态进入正在发生的时间线。"}
                  </p>
                </div>
                <span className="mt-1 rounded-full border border-[color:var(--border)] bg-[color:var(--background-elevated)] p-2 text-[color:var(--muted-foreground)]">
                  <ChevronDown className="h-4 w-4" />
                </span>
              </>
            }
          >
            {memoryMeetingWorkspaceContext}
          </ControlledDisclosure>
        ) : (
          memoryMeetingWorkspaceContext
        )
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label={english ? "General signals" : "通用线索"}
          value={summary.workspace}
          active={dimension === "WORKSPACE"}
          onClick={() => {
            setDimension("WORKSPACE");
            applyFilters(search, "WORKSPACE");
          }}
          detail={
            english
              ? "Imported context that is not tied to one customer yet"
              : "尚未归到单一客户的上下文"
          }
        />
        <StatCard
          label={english ? "Contact memory" : "联系人记忆"}
          value={summary.contacts}
          active={dimension === "CONTACT"}
          onClick={() => {
            setDimension("CONTACT");
            applyFilters(search, "CONTACT");
          }}
          detail={
            english
              ? "Preferences, relationship temperature and constraints"
              : "跟进偏好、关系温度、关键约束"
          }
        />
        <StatCard
          label={english ? "Company memory" : "公司记忆"}
          value={summary.companies}
          active={dimension === "COMPANY"}
          onClick={() => {
            setDimension("COMPANY");
            applyFilters(search, "COMPANY");
          }}
          detail={
            english
              ? "Account path, interaction summary and account insight"
              : "合作路径、互动摘要、账号洞察"
          }
        />
        <StatCard
          label={english ? "Opportunity memory" : "机会记忆"}
          value={summary.opportunities}
          active={dimension === "OPPORTUNITY"}
          onClick={() => {
            setDimension("OPPORTUNITY");
            applyFilters(search, "OPPORTUNITY");
          }}
          detail={
            english
              ? "Stage judgement, risk and next move"
              : "阶段判断、风险和下一步动作"
          }
        />
        <StatCard
          label={english ? "Meeting memory" : "会议记忆"}
          value={summary.meetings}
          active={dimension === "MEETING"}
          onClick={() => {
            setDimension("MEETING");
            applyFilters(search, "MEETING");
          }}
          detail={
            english
              ? "Notes, decisions and post-meeting actions"
              : "纪要、决策和会后行动"
          }
        />
      </div>

      {demoMode ? (
        <Card className="workspace-panel-muted">
          <CardContent className="grid gap-4 py-5 xl:grid-cols-[1.2fr_repeat(3,minmax(0,0.9fr))]">
            <div className="space-y-2">
              <Badge variant="approval">
                {english ? "Long-term value" : "长期价值"}
              </Badge>
              <p className="text-lg font-semibold text-[color:var(--foreground)]">
                {english
                  ? "The customer asset trail keeps accumulating."
                  : "客户资产脉络会持续沉淀。"}
              </p>
              <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                {english
                  ? "As contact preferences, meeting conclusions and opportunity signals accumulate, later AI suggestions begin to feel truly contextual instead of generic."
                  : "当联系人偏好、会议结论和机会判断沉淀下来，后续判断建议才会越来越像真的基于上下文。"}
              </p>
            </div>
            <MemoryStat
              label={english ? "Current filtered results" : "当前筛选结果"}
              value={visibleCount}
              active={category === "ALL"}
              onClick={() => setCategory("ALL")}
            />
            <MemoryStat
              label={english ? "Reusable facts" : "可复用事实"}
              value={memoryEntries.length + memoryFacts.length}
              active={category === "FACT"}
              onClick={() => setCategory("FACT")}
            />
            <MemoryStat
              label={english ? "Traceable audits" : "可追溯审计"}
              value={auditLogs.length}
              onClick={scrollToAuditReplay}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card className="workspace-panel">
        <CardContent className="space-y-4 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start">
            <form
              className="relative flex-1"
              onSubmit={(event) => {
                event.preventDefault();
                applyFilters();
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9 pr-24"
                placeholder={
                  english
                    ? "Search titles, content or sources"
                    : "搜索记忆标题、内容或来源"
                }
              />
              <Button
                type="submit"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                {english ? "Search" : "搜索"}
              </Button>
            </form>
            {objectType && objectId ? (
              <div className="workspace-panel-muted rounded-2xl px-4 py-3 text-sm text-[color:var(--muted)]">
                {english
                  ? `Viewing ${objectTypeLabel(objectType, objectTypeLabels)} memory`
                  : `当前正在查看 ${objectTypeLabel(objectType, objectTypeLabels)} 对象记忆`}
              </div>
            ) : null}
            {objectType && objectId && objectType !== "MEETING" ? (
              <Button
                variant="secondary"
                onClick={() =>
                  runAction(
                    () => generateObjectBriefingAction(objectType, objectId),
                    english ? "Object summary refreshed" : "对象摘要已刷新",
                  )
                }
              >
                {english ? "Refresh object summary" : "刷新对象摘要"}
              </Button>
            ) : null}
          </div>
          <div className="workspace-toolbar flex flex-wrap items-center gap-2 rounded-[24px] px-3 py-3">
            <p className="workspace-toolbar-label pr-1">
              {english ? "Source" : "来源"}
            </p>
            {(
              [
                ["ALL", english ? "All sources" : "全部来源"],
                ["HELM", "Helm"],
                ["OPENCLAW", "OpenClaw"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={sourceFilter === value ? "default" : "secondary"}
                onClick={() => {
                  const nextSource = value as typeof sourceFilter;
                  setSourceFilter(nextSource);
                  applyFilters(search, dimension, nextSource);
                }}
              >
                {label}
              </Button>
            ))}
            <div className="h-6 w-px bg-[color:var(--border)]" />
            <p className="workspace-toolbar-label pr-1">
              {english ? "Object scope" : "对象范围"}
            </p>
            {(
              [
                "ALL",
                "WORKSPACE",
                "CONTACT",
                "COMPANY",
                "OPPORTUNITY",
                "MEETING",
              ] as const
            ).map((item) => (
              <Button
                key={item}
                size="sm"
                variant={dimension === item ? "default" : "secondary"}
                onClick={() => {
                  const nextDimension = item as typeof dimension;
                  setDimension(nextDimension);
                  applyFilters(search, nextDimension);
                }}
              >
                {item === "ALL"
                  ? english
                    ? "All"
                    : "全部"
                  : objectTypeLabel(item, objectTypeLabels)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="workspace-panel-muted">
        <CardContent className="flex flex-col gap-3 py-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="workspace-eyebrow">
              {english ? "Timeline categories" : "时间线分类"}
            </p>
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {english
                ? "Keep one timeline, then narrow the evidence type."
                : "保持同一条时间线，再缩到想看的证据类型。"}
            </p>
            <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
              {english
                ? "Filter by note, fact, commitment, blocker or correction without leaving the same timeline."
                : "不用切标签页，直接在同一条时间线上按纪要、事实、承诺、阻塞或修正筛选。"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["ALL", english ? "All" : "全部"],
                ["NOTE", english ? "Notes" : "纪要"],
                ["FACT", english ? "Facts" : "事实"],
                ["COMMITMENT", english ? "Commitments" : "承诺"],
                ["BLOCKER", english ? "Blockers" : "阻塞"],
                ["CORRECTION", english ? "Corrections" : "修正"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={category === value ? "default" : "secondary"}
                onClick={() => setCategory(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div
          id={MEMORY_PAGE_ANCHORS.timeline}
          className="min-w-0 max-w-full overflow-hidden space-y-4"
        >
          {objectType && objectId ? (
            <Card
              className="workspace-panel-muted border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border)_72%)]"
              data-memory-approval-evidence-context={
                isApprovalEvidenceEntry ? "true" : "false"
              }
            >
              <CardContent className="space-y-4 py-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={isApprovalEvidenceEntry ? "approval" : "info"}
                  >
                    {isApprovalEvidenceEntry
                      ? english
                        ? "Review evidence landing"
                        : "复核证据落点"
                      : english
                        ? "Object memory landing"
                        : "对象记忆落点"}
                  </Badge>
                  <Badge variant="neutral">
                    {objectTypeLabel(objectType, objectTypeLabels)}
                  </Badge>
                </div>
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.45fr)]">
                  <div className="space-y-3">
                    <p className="text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
                      {isApprovalEvidenceEntry
                        ? english
                          ? `You are reviewing evidence for ${objectScopedMemoryLabel}.`
                          : `你正在看“${objectScopedMemoryLabel}”的复核证据。`
                        : english
                          ? `You are viewing ${objectScopedMemoryLabel} memory.`
                          : `你正在看“${objectScopedMemoryLabel}”的对象记忆。`}
                    </p>
                    <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                      {isApprovalEvidenceEntry
                        ? english
                          ? "This timeline is already narrowed to the object behind the approval draft. Read facts, commitments, blockers and corrections here before changing the draft's execution posture."
                          : "这条时间线已经收窄到审批草稿背后的对象。先在这里读事实、承诺、阻塞和修正，再决定草稿是放行、改写、拒绝还是继续拦住。"
                        : english
                          ? "This timeline is already narrowed to one object, so correction, export and audit replay should stay attached to this object before you widen the view again."
                          : "这条时间线已经收窄到一个对象，修正、导出和审计回放都应先围绕这个对象完成，再决定是否扩回全局视图。"}
                    </p>
                  </div>
                  <div className="grid gap-2 text-sm text-[color:var(--muted-foreground)]">
                    <div className="theme-surface-panel rounded-2xl px-4 py-3">
                      <p className="font-semibold text-[color:var(--foreground)]">
                        {english ? "Decide here" : "这里要判断"}
                      </p>
                      <p className="mt-1 leading-6">
                        {english
                          ? "Is the evidence stable enough to keep shaping the next action?"
                          : "这些证据是否已经稳定到可以继续影响下一步动作？"}
                      </p>
                    </div>
                    <div className="theme-surface-panel rounded-2xl px-4 py-3">
                      <p className="font-semibold text-[color:var(--foreground)]">
                        {english ? "Boundary" : "边界"}
                      </p>
                      <p className="mt-1 leading-6">
                        {english
                          ? "Memory can inform review, but it still does not approve, send or create a commitment."
                          : "记忆可以支撑复核，但不会替你批准、发送或形成承诺。"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isApprovalEvidenceEntry ? (
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={approvalEvidenceReturnHref}>
                        {returnToApprovalId
                          ? english
                            ? "Back to this review"
                            : "回到这条复核"
                          : english
                            ? "Back to review boundary"
                            : "回到复核边界"}
                      </Link>
                    </Button>
                  ) : null}
                  {objectScopedMemoryHref ? (
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={objectScopedMemoryHref}>
                        {english ? "Open linked object" : "打开关联对象"}
                      </Link>
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={scrollToAuditReplay}
                  >
                    {english ? "Open audit replay" : "查看审计回放"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
          {filteredTimeline.length ? (
            <>
              <Card className="workspace-panel-muted">
                <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">
                      {showFullTimeline
                        ? english
                          ? `Showing all ${filteredTimeline.length} timeline items`
                          : `已展开全部 ${filteredTimeline.length} 条时间线`
                        : english
                          ? `Showing the latest ${visibleTimeline.length} of ${filteredTimeline.length}`
                          : `先看最新 ${visibleTimeline.length} 条，共 ${filteredTimeline.length} 条`}
                    </p>
                    <p className="text-xs leading-5 text-[color:var(--muted-foreground)]">
                      {english
                        ? "Older records stay available, but the first read should start from the newest usable business facts."
                        : "历史记录仍可查看，但首次阅读先从最新、可复用的经营事实开始。"}
                    </p>
                  </div>
                  {hiddenTimelineCount > 0 || showFullTimeline ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setShowFullTimeline((current) => !current)}
                    >
                      {showFullTimeline
                        ? english
                          ? "Collapse"
                          : "收起"
                        : english
                          ? `Show ${hiddenTimelineCount} older`
                          : `展开余下 ${hiddenTimelineCount} 条`}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
              {visibleTimeline.map((item) => {
                const businessAssetHref = buildTimelineBusinessAssetHref(item);

                return (
                <div
                  key={item.id}
                  className="grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[116px_32px_minmax(0,1fr)] md:gap-4"
                >
                <div className="flex min-w-0 max-w-full flex-wrap items-center justify-between gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface-subtle)_82%,var(--surface)_18%)] px-4 py-3 md:block md:border-0 md:bg-transparent md:px-0 md:py-0">
                  <div className="min-w-0 space-y-1 text-xs text-[color:var(--muted-foreground)] md:text-right">
                    <p className="break-words font-medium text-[color:var(--muted-foreground)]">
                      {formatDateLabel(item.timestamp)}
                    </p>
                    <p className="break-words">
                      {memoryText(item.objectLabel)}
                    </p>
                  </div>
                  <Badge variant="info" className="md:hidden">
                    {timelineCategoryLabel(item.category, english)}
                  </Badge>
                </div>
                <div className="hidden md:flex md:flex-col md:items-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:color-mix(in_oklab,var(--accent)_18%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-subtle)_80%,var(--accent-soft)_20%)] text-[var(--accent)]">
                    <CircleDot className="h-4 w-4" />
                  </div>
                  <div className="mt-2 h-full w-px bg-[color:var(--border)]" />
                </div>
                <Card
                  id={getTimelineItemAnchorId(item)}
                  className="min-w-0 w-full max-w-full overflow-hidden"
                >
                  <CardContent className="min-w-0 space-y-4 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 break-words font-medium text-[color:var(--foreground)]">
                            {item.title}
                          </p>
                          <Badge variant="info">
                            {timelineCategoryLabel(item.category, english)}
                          </Badge>
                          <Badge variant="default">{item.sourceLabel}</Badge>
                        </div>
                        <p className="break-words text-sm leading-7 text-[color:var(--muted)]">
                          {item.summary}
                        </p>
                      </div>
                      {businessAssetHref ? (
                        <Button asChild size="sm" variant="secondary">
                          <Link href={businessAssetHref}>
                            {english ? "Open asset" : "打开经营资产"}
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      ) : null}
                    </div>

                    {item.category === "NOTE" ? (
                      <>
                        {item.externalRecord ? (
                          <div className="theme-surface-panel-soft rounded-2xl px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
                              <Badge variant="neutral">OpenClaw</Badge>
                              <Badge variant="neutral">
                                {english
                                  ? `Scope: ${item.externalRecord.scope}`
                                  : `范围：${memoryText(item.externalRecord.scope)}`}
                              </Badge>
                              <Badge variant="neutral">
                                {english
                                  ? `Category: ${item.externalRecord.category}`
                                  : `分类：${memoryText(item.externalRecord.category)}`}
                              </Badge>
                            </div>
                            <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                              {english
                                ? `Occurred ${formatDateLabel(item.externalRecord.occurredAt)} · Synced ${formatDateLabel(item.externalRecord.syncedAt)}`
                                : `原始时间 ${formatDateLabel(item.externalRecord.occurredAt)} · 同步时间 ${formatDateLabel(item.externalRecord.syncedAt)}`}
                            </p>
                          </div>
                        ) : null}
                        {permissions.canManageMemoryFacts ? (
                          editingId === item.entry.id ? (
                            <div className="space-y-3">
                              <Textarea
                                value={draft}
                                onChange={(event) =>
                                  setDraft(event.target.value)
                                }
                              />
                              <div className="flex gap-3">
                                <Button
                                  disabled={pending}
                                  onClick={() =>
                                    runAction(
                                      () =>
                                        correctMemoryAction({
                                          entryId: item.entry.id,
                                          content: draft,
                                        }),
                                      english
                                        ? "Memory corrected"
                                        : "记忆已修正",
                                    )
                                  }
                                >
                                  {english ? "Save correction" : "保存纠错"}
                                </Button>
                                <Button
                                  variant="secondary"
                                  onClick={() => {
                                    setEditingId(null);
                                    setDraft("");
                                  }}
                                >
                                  {english ? "Cancel" : "取消"}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setEditingId(item.entry.id);
                                  setDraft(item.entry.content);
                                }}
                              >
                                <PenSquare className="h-4 w-4" />
                                {english ? "Correct memory" : "记忆纠错"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      english
                                        ? "Delete this memory entry? This will still leave an audit record."
                                        : "确认删除这段记忆吗？该操作会写入审计日志。",
                                    )
                                  )
                                    return;
                                  runAction(
                                    () => deleteMemoryAction(item.entry.id),
                                    english ? "Memory deleted" : "记忆已删除",
                                  );
                                }}
                              >
                                <Eraser className="h-4 w-4" />
                                {english ? "Delete memory" : "删除记忆"}
                              </Button>
                            </div>
                          )
                        ) : null}
                      </>
                    ) : null}

                    {item.category === "FACT" ? (
                      <>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-[color:var(--muted-foreground)]">
                          <span>
                            {english ? "Object" : "对象"}：
                            {objectTypeLabels[item.fact.objectType] ??
                              item.fact.objectType}
                          </span>
                          <span>
                            {english ? "Confidence" : "置信度"}：
                            {item.fact.confidence}
                          </span>
                          <span>
                            {english ? "Importance" : "重要度"}：
                            {item.fact.importance}
                          </span>
                          <span>
                            {english ? "Status" : "状态"}：
                            {item.fact.status === "INVALID"
                              ? english
                                ? "Invalid"
                                : "已失效"
                              : item.fact.confirmedByUser
                                ? english
                                  ? "Confirmed"
                                  : "已确认"
                                : memoryStatus(item.fact.status)}
                          </span>
                        </div>
                        <div className="theme-surface-panel-soft rounded-2xl px-4 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english
                              ? "Business impact"
                              : "经营影响"}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                            {item.fact.importance >= 75
                              ? english
                                ? "This fact changes the next customer readout, risk level, or recommended move."
                                : "这条事实会改变下一次客户读板、风险级别或推荐动作。"
                              : item.fact.freshnessScore >= 70
                                ? english
                                  ? "This is a fresh signal, so it should be read before older notes."
                                  : "这是较新的信号，应优先于旧记录阅读。"
                                : english
                                  ? "Kept for context, but it sits below fresh meeting conclusions and open promises."
                                  : "保留作上下文，但优先级低于最新会议结论和未完成承诺。"}
                          </p>
                        </div>
                        {permissions.canManageMemoryFacts ? (
                          factEditingId === item.fact.id ? (
                            <div className="space-y-3">
                              <Textarea
                                value={factDraft}
                                onChange={(event) =>
                                  setFactDraft(event.target.value)
                                }
                              />
                              <div className="flex gap-3">
                                <Button
                                  disabled={pending}
                                  onClick={() =>
                                    runAction(
                                      () =>
                                        correctMemoryFactAction({
                                          factId: item.fact.id,
                                          content: factDraft,
                                        }),
                                      english
                                        ? "Fact corrected"
                                        : "记忆事实已修正",
                                    )
                                  }
                                >
                                  {english ? "Save correction" : "保存修正"}
                                </Button>
                                <Button
                                  variant="secondary"
                                  onClick={() => {
                                    setFactEditingId(null);
                                    setFactDraft("");
                                  }}
                                >
                                  {english ? "Cancel" : "取消"}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setFactEditingId(item.fact.id);
                                  setFactDraft(item.fact.content);
                                }}
                              >
                                <PenSquare className="h-4 w-4" />
                                {english ? "Correct fact" : "修正事实"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      english
                                        ? "Mark this fact as invalid?"
                                        : "确认将这条记忆事实设为失效吗？",
                                    )
                                  )
                                    return;
                                  runAction(
                                    () =>
                                      invalidateMemoryFactAction(item.fact.id),
                                    english
                                      ? "Fact marked invalid"
                                      : "记忆事实已失效",
                                  );
                                }}
                              >
                                <Eraser className="h-4 w-4" />
                                {english ? "Invalidate" : "设为失效"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      english
                                        ? "Delete this structured fact? Correction history will be kept."
                                        : "确认删除这条可复用记忆吗？Helm 会保留修正历史。",
                                    )
                                  )
                                    return;
                                  runAction(
                                    () => deleteMemoryFactAction(item.fact.id),
                                    english
                                      ? "Fact removed from main view"
                                      : "记忆事实已移出主视图",
                                  );
                                }}
                              >
                                {english ? "Delete" : "删除记忆"}
                              </Button>
                            </div>
                          )
                        ) : null}
                      </>
                    ) : null}

                    {item.category === "COMMITMENT" ? (
                      <>
                        <CommitmentCard
                          commitment={{
                            ...item.commitment,
                            title: memoryText(item.commitment.title),
                            commitmentText: memoryText(
                              item.commitment.commitmentText,
                            ),
                            sourceLabel: describeCommitmentSource(
                              item.commitment.sourceType,
                              memorySourceLabels,
                              english,
                            ),
                            ownerName: item.commitment.ownerUser?.name ?? null,
                            targetLabel: item.objectLabel,
                          }}
                        />
                        <div className="theme-surface-panel-soft rounded-2xl px-4 py-3 text-sm text-[color:var(--muted)]">
                          {item.commitment.overdueFlag
                            ? english
                              ? "This overdue promise should be handled before lower-pressure work."
                              : "这条逾期承诺应优先于低压力事项处理。"
                            : english
                              ? "This open promise stays attached to the customer state until it is closed."
                              : "这条未完成承诺会持续挂在客户状态上，直到关闭。"}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.commitment.status !== "FULFILLED" ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                runAction(
                                  () =>
                                    updateCommitmentStatusAction(
                                      item.commitment.id,
                                      "FULFILLED",
                                    ),
                                  english
                                    ? "Commitment fulfilled"
                                    : "承诺已标记为完成",
                                )
                              }
                            >
                              {english ? "Fulfill" : "完成承诺"}
                            </Button>
                          ) : null}
                          {item.commitment.status !== "IN_PROGRESS" &&
                          item.commitment.status !== "FULFILLED" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                runAction(
                                  () =>
                                    updateCommitmentStatusAction(
                                      item.commitment.id,
                                      "IN_PROGRESS",
                                    ),
                                  english
                                    ? "Commitment marked in progress"
                                    : "承诺已更新为进行中",
                                )
                              }
                            >
                              {english ? "Mark in progress" : "标记进行中"}
                            </Button>
                          ) : null}
                          {item.commitment.status === "FULFILLED" ||
                          item.commitment.status === "CANCELED" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                runAction(
                                  () =>
                                    updateCommitmentStatusAction(
                                      item.commitment.id,
                                      "OPEN",
                                    ),
                                  english
                                    ? "Commitment reopened"
                                    : "承诺已重新纳入推进",
                                )
                              }
                            >
                              {english ? "Reopen" : "重新打开"}
                            </Button>
                          ) : null}
                          {item.commitment.status !== "CANCELED" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                runAction(
                                  () =>
                                    updateCommitmentStatusAction(
                                      item.commitment.id,
                                      "CANCELED",
                                    ),
                                  english
                                    ? "Commitment canceled"
                                    : "承诺已标记为取消",
                                )
                              }
                            >
                              {english ? "Cancel commitment" : "取消承诺"}
                            </Button>
                          ) : null}
                        </div>
                      </>
                    ) : null}

                    {item.category === "BLOCKER" ? (
                      <>
                        <BlockerCard
                          blocker={{
                            ...item.blocker,
                            title: memoryText(item.blocker.title),
                            blockerText: memoryText(item.blocker.blockerText),
                            blockerType: memoryText(item.blocker.blockerType),
                            targetLabel: item.objectLabel,
                          }}
                        />
                        <div className="theme-surface-panel-soft rounded-2xl px-4 py-3 text-sm text-[color:var(--muted)]">
                          {item.blocker.severity >= 75
                            ? english
                              ? "This blocker is the risk pressure that should decide the next move."
                              : "这条阻塞就是当前风险压力，应直接决定下一步。"
                            : english
                              ? "This blocker stays attached to the customer state until it is handled."
                              : "这条阻塞会持续挂在客户状态上，直到被处理。"}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.blocker.status !== "RESOLVED" ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                runAction(
                                  () =>
                                    resolveBlockerAction(
                                      item.blocker.id,
                                      english
                                        ? "Handled inside the workflow"
                                        : "已在工作流中处理",
                                    ),
                                  english
                                    ? "Blocker resolved"
                                    : "阻塞已标记为解决",
                                )
                              }
                            >
                              {english ? "Resolve blocker" : "解决阻塞"}
                            </Button>
                          ) : null}
                          {item.blocker.status !== "MONITORING" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                runAction(
                                  () =>
                                    updateBlockerStatusAction(
                                      item.blocker.id,
                                      "MONITORING",
                                      english
                                        ? "Keep this under monitoring until more context arrives"
                                        : "先纳入观察，等待更多上下文",
                                    ),
                                  english
                                    ? "Blocker set to monitoring"
                                    : "阻塞已改为持续观察",
                                )
                              }
                            >
                              {english ? "Monitor" : "改为观察中"}
                            </Button>
                          ) : null}
                          {item.blocker.status !== "OPEN" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                runAction(
                                  () =>
                                    updateBlockerStatusAction(
                                      item.blocker.id,
                                      "OPEN",
                                      english
                                        ? "Treat this as an active blocker again"
                                        : "重新作为活跃阻塞处理",
                                    ),
                                  english
                                    ? "Blocker reopened"
                                    : "阻塞已重新打开",
                                )
                              }
                            >
                              {english ? "Reopen" : "重新打开"}
                            </Button>
                          ) : null}
                          {item.blocker.status !== "IGNORED" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                runAction(
                                  () =>
                                    updateBlockerStatusAction(
                                      item.blocker.id,
                                      "IGNORED",
                                      english
                                        ? "Ignore for now but keep it in replay"
                                        : "暂不处理，保留回放",
                                    ),
                                  english
                                    ? "Blocker ignored for now"
                                    : "阻塞已降级为暂不处理",
                                )
                              }
                            >
                              {english ? "Ignore for now" : "暂不处理"}
                            </Button>
                          ) : null}
                        </div>
                      </>
                    ) : null}

                    {item.category === "CORRECTION" ? (
                      <div className="space-y-3">
                        {item.correction.reason ? (
                          <p className="text-sm text-[color:var(--muted)]">
                            {english ? "Reason" : "原因"}：
                            {item.correction.reason}
                          </p>
                        ) : null}
                        <div className="grid gap-3 md:grid-cols-2">
                          <pre className="theme-surface-panel-soft overflow-hidden whitespace-pre-wrap break-words rounded-2xl p-4 text-xs leading-6 text-[color:var(--muted)]">
                            {formatMemoryVisibleText(
                              JSON.stringify(
                                safeParseJson(item.correction.beforeValue, {}),
                                null,
                                2,
                              ),
                              english,
                            )}
                          </pre>
                          <pre className="theme-surface-panel-soft overflow-hidden whitespace-pre-wrap break-words rounded-2xl p-4 text-xs leading-6 text-[color:var(--muted)]">
                            {formatMemoryVisibleText(
                              JSON.stringify(
                                safeParseJson(item.correction.afterValue, {}),
                                null,
                                2,
                              ),
                              english,
                            )}
                          </pre>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
                </div>
                );
              })}
            </>
          ) : (
            <EmptyState
              title={
                english
                  ? "No matching memory on the timeline"
                  : "这条时间线上还没有匹配内容"
              }
              description={
                english
                  ? "Adjust category or object filters, or add new work memory from contact, company or meeting pages."
                  : "可以调整分类或对象筛选，或从联系人、公司、会议页补充新的工作记忆。"
              }
            />
          )}
        </div>

        <div className="min-w-0 max-w-full space-y-4">
          <Card className="min-w-0 max-w-full overflow-hidden">
            <CardHeader>
              <CardTitle>
                {english ? "Timeline reading guide" : "时间线阅读方式"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-7 text-[color:var(--muted)]">
              <p>
                {english
                  ? "1. Read from top to bottom to see what changed most recently."
                  : "1. 从上到下读，先看最近发生了什么。"}
              </p>
              <p>
                {english
                  ? "2. Use category filters when you only want commitments, blockers or corrections."
                  : "2. 如果只想看承诺、阻塞或修正，再用顶部分类筛选。"}
              </p>
              <p>
                {english
                  ? "3. Correcting facts, fulfilling commitments or resolving blockers here will still refresh recommendations on related object pages."
                  : "3. 在这里修正事实、完成承诺、解决阻塞，相关对象页的判断建议仍会同步刷新。"}
              </p>
            </CardContent>
          </Card>

          <Card
            id={MEMORY_PAGE_ANCHORS.auditReplay}
            className="min-w-0 max-w-full overflow-hidden"
          >
            <CardHeader>
              <CardTitle>
                {english ? "Recent audit replay" : "最近审计回放"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {auditLogs.length ? (
                auditLogs.slice(0, 8).map((log) => (
                  <div
                    key={log.id}
                    id={buildMemoryItemAnchor("audit", log.id)}
                    className="workspace-panel min-w-0 rounded-2xl px-4 py-4"
                  >
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                      <p className="min-w-0 break-words font-medium text-[color:var(--foreground)]">
                        {memoryText(log.summary)}
                      </p>
                      <Badge variant="default">
                        {memoryText(log.actionType)}
                      </Badge>
                    </div>
                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
                      <span className="min-w-0 break-words">
                        {memoryText(log.actor)}
                      </span>
                      <span>·</span>
                      <span className="min-w-0 break-words">
                        {memoryText(log.targetType)}
                      </span>
                      <span>·</span>
                      <span>{formatDateLabel(log.createdAt)}</span>
                    </div>
                    <div className="mt-3 space-y-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3">
                      {buildAuditReasonChain(log, english).map((item) => (
                        <div key={item.id} className="space-y-1">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {memoryText(item.label)}
                          </p>
                          <p className="text-sm leading-6 text-[color:var(--muted)]">
                            {memoryText(item.summary)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState
                  title={english ? "No audit replay yet" : "还没有审计回放"}
                  description={
                    english
                      ? "Memory corrections, approvals and policy changes will accumulate here."
                      : "记忆修正、审批和策略变化会在这里留下回放。"
                  }
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StateMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-3 py-2">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}

function buildObjectScopedMemoryLabel({
  english,
  objectType,
  objectTypeLabels,
  memoryEntries,
  commitments,
  blockers,
}: {
  english: boolean;
  objectType: NonNullable<MemoryClientProps["objectType"]>;
  objectTypeLabels: Record<string, string>;
  memoryEntries: MemoryClientProps["memoryEntries"];
  commitments: MemoryClientProps["commitments"];
  blockers: MemoryClientProps["blockers"];
}) {
  const entryLabel =
    objectType === "CONTACT"
      ? memoryEntries.find((entry) => entry.contact?.name)?.contact?.name
      : objectType === "COMPANY"
        ? memoryEntries.find((entry) => entry.company?.name)?.company?.name
        : objectType === "OPPORTUNITY"
          ? memoryEntries.find((entry) => entry.opportunity?.title)?.opportunity
              ?.title
          : memoryEntries.find((entry) => entry.meeting?.title)?.meeting?.title;

  const commitmentLabel =
    objectType === "CONTACT"
      ? commitments.find((item) => item.relatedContact?.name)?.relatedContact
          ?.name
      : objectType === "COMPANY"
        ? commitments.find((item) => item.relatedCompany?.name)?.relatedCompany
            ?.name
        : objectType === "OPPORTUNITY"
          ? commitments.find((item) => item.relatedOpportunity?.title)
              ?.relatedOpportunity?.title
          : commitments.find((item) => item.relatedMeeting?.title)
              ?.relatedMeeting?.title;

  const blockerLabel =
    objectType === "CONTACT"
      ? blockers.find((item) => item.relatedContact?.name)?.relatedContact?.name
      : objectType === "COMPANY"
        ? blockers.find((item) => item.relatedCompany?.name)?.relatedCompany
            ?.name
        : objectType === "OPPORTUNITY"
          ? blockers.find((item) => item.relatedOpportunity?.title)
              ?.relatedOpportunity?.title
          : blockers.find((item) => item.relatedMeeting?.title)?.relatedMeeting
              ?.title;

  return (
    entryLabel ??
    commitmentLabel ??
    blockerLabel ??
    (english
      ? `${objectTypeLabel(objectType, objectTypeLabels)} object`
      : `${objectTypeLabel(objectType, objectTypeLabels)}对象`)
  );
}

function buildObjectScopedMemoryHref(
  objectType: NonNullable<MemoryClientProps["objectType"]>,
  objectId: string,
) {
  const businessAssetHref = buildBusinessAssetHrefFromObject(
    { objectType, objectId, source: "memory-scope" },
  );

  if (businessAssetHref) return businessAssetHref;
  if (objectType === "CONTACT") return `/contacts/${objectId}`;
  if (objectType === "MEETING") return `/meetings/${objectId}`;
  return "/memory";
}

function buildTimelineBusinessAssetHref(item: TimelineItem) {
  if (item.category === "FACT") {
    return buildBusinessAssetHrefFromObject(
      {
        objectType: item.fact.objectType,
        objectId: item.fact.objectId,
        source: "memory-timeline",
      },
    );
  }

  if (item.category === "COMMITMENT") {
    return buildCommitmentAssetHref(item.commitment.id, "memory-timeline");
  }

  if (item.category === "BLOCKER") {
    return buildRiskAssetHref(item.blocker.id, "memory-timeline");
  }

  return null;
}

function buildApprovalEvidenceReturnHref(approvalId: string | null) {
  return approvalId
    ? `/approvals?approvalId=${encodeURIComponent(approvalId)}&evidenceOpen=1#approval-preview`
    : "/approvals#approval-queue";
}

function objectTypeLabel(
  entityType:
    | MemoryClientProps["objectType"]
    | "ALL"
    | "WORKSPACE"
    | "CONTACT"
    | "COMPANY"
    | "OPPORTUNITY"
    | "MEETING",
  labels: Record<string, string>,
) {
  if (entityType === "ALL") return labels.WORKSPACE ?? "All";
  return entityType
    ? (labels[entityType] ?? entityType)
    : (labels.WORKSPACE ?? "Object");
}

function describeCommitmentSource(
  sourceType: string,
  labels: Record<string, string>,
  english: boolean,
) {
  return formatMemoryVisibleText(
    labels[sourceType] ?? labels.SYSTEM ?? sourceType,
    english,
  );
}

function getTimelineItemAnchorId(item: TimelineItem) {
  switch (item.category) {
    case "NOTE":
      return buildMemoryItemAnchor("note", item.entry.id);
    case "FACT":
      return buildMemoryItemAnchor("fact", item.fact.id);
    case "COMMITMENT":
      return buildMemoryItemAnchor("commitment", item.commitment.id);
    case "BLOCKER":
      return buildMemoryItemAnchor("blocker", item.blocker.id);
    case "CORRECTION":
      return buildMemoryItemAnchor("correction", item.correction.id);
    default:
      throw new Error("Unsupported memory timeline item category");
  }
}

function timelineCategoryLabel(category: TimelineCategory, english: boolean) {
  switch (category) {
    case "NOTE":
      return english ? "Note" : "纪要";
    case "FACT":
      return english ? "Fact" : "事实";
    case "COMMITMENT":
      return english ? "Commitment" : "承诺";
    case "BLOCKER":
      return english ? "Blocker" : "阻塞";
    case "CORRECTION":
      return english ? "Correction" : "修正";
    default:
      return english ? "Timeline" : "时间线";
  }
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

function MemoryStat({
  label,
  value,
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`workspace-panel block w-full rounded-[24px] px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_oklab,var(--accent)_28%,transparent)] ${active ? "border-[color:var(--border-strong)] shadow-[0_22px_40px_-26px_rgba(25,70,80,0.45)]" : "hover:-translate-y-0.5 hover:border-[color:var(--border-strong)] hover:shadow-[0_22px_40px_-26px_rgba(15,23,42,0.45)]"}`}
    >
      <p className="workspace-kpi-label">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">
        {value}
      </p>
    </button>
  );
}
