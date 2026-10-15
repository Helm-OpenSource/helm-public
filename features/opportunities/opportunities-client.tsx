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
import { ArrowRight, Paperclip, Plus, Rows3, Table2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
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
import {
  opportunityTypeLabels,
  riskLabels,
  stageLabels,
} from "@/data/constants";
import { useConsoleStore } from "@/hooks/use-console-store";
import { buildOpportunityAssetHref } from "@/features/business-assets/hrefs";
import { formatOpportunityDateLabel } from "@/features/opportunities/opportunity-date-labels";
import {
  getLocalizedOpportunityTypeLabels,
  getLocalizedRiskLabels,
  getLocalizedStageLabels,
} from "@/lib/i18n/labels";
import { getWorkspaceStory } from "@/lib/presentation/workspace-story";
import {
  OPPORTUNITY_PAGE_ANCHORS,
  scrollToWindowHashTarget,
} from "@/lib/presentation/page-section-anchors";
import { buildBusinessLoopGapReadout } from "@/lib/presentation/business-loop-gap-readout";
import {
  cn,
  formatDateLabel,
  toDateTimeLocalInput,
  trimText,
} from "@/lib/utils";
import type { BusinessLoopGapSummary } from "@/lib/operating-system/operating-gap";
import {
  bulkUpdateOpportunitiesAction,
  createActionFromDingTalkSignalAction,
  loadEarlierOpportunityThreadMessagesAction,
  loadMoreOpportunityEmailThreadsAction,
  moveOpportunityStageAction,
  saveOpportunityAction,
} from "@/features/opportunities/actions";
import {
  addWorkingMemoryAction,
  createMeetingForContactAction,
} from "@/features/contacts/actions";
import { scheduleMeetingFromThreadAction } from "@/features/inbox/actions";
import { formatInboxMessageBody } from "@/features/inbox/message-formatting";
import { formatOpportunityDisplayText } from "@/features/opportunities/display-copy";
import {
  buildOriginalDemandThreads,
  buildSystemJudgementLines,
  describeDueChip,
  firstContactAt,
  formatMonthDayTime,
  formatTimestamp,
  getOpportunitySourceLabel,
  getReplyStatus,
  isOpenAndOverdue,
  resolveOpportunitySourceKind,
  resolveReplyTarget,
  selectOriginalDemandText,
  summarizeOpportunityCounts,
  type CustomerFirstContact,
  type CustomerFirstEmailActivity,
  type CustomerFirstEmailMessage,
  type CustomerFirstEmailThread,
} from "@/features/opportunities/customer-first";
import { OpportunityCustomerCard } from "@/features/opportunities/opportunity-customer-card";
import {
  OpportunityHandlingCard,
  type OpportunityHandlingDraft,
} from "@/features/opportunities/opportunity-handling-card";
import { OpportunityListCard } from "@/features/opportunities/opportunity-list-card";
import { OpportunityOriginalDemand } from "@/features/opportunities/opportunity-original-demand";
import { StartRecordingButton } from "@/features/conversation-capture/start-recording-button";

type OpportunityItem = {
  id: string;
  title: string;
  description: string | null;
  nextStepSummary: string | null;
  externalSource: string | null;
  type: keyof typeof opportunityTypeLabels;
  stage: keyof typeof stageLabels;
  riskLevel: keyof typeof riskLabels;
  nextAction: string | null;
  dueDate: Date | null;
  lossReason: string | null;
  priorityScore: number;
  createdAt: Date;
  updatedAt: Date;
  company: { id: string; name: string } | null;
  contacts: CustomerFirstContact[];
  owner: { id: string; name: string } | null;
  actionItems: Array<{ id: string; status: string }>;
  /** Latest-active threads (first page), each with its latest messages. */
  emailThreads: CustomerFirstEmailThread[];
  emailThreadCount: number;
  /** Aggregate over every visible message; drives reply state. */
  emailActivity: CustomerFirstEmailActivity;
  openBlockerCount: number;
  overdueCommitmentCount: number;
  dingtalkSignalSummary?: {
    totalSignals: number;
    convertedActionCount: number;
    pendingApprovalCount: number;
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
const OPPORTUNITIES_BOARD_DND_ID = "opportunities-board";
const OWNER_SELECT_ID = "opportunity-handling-owner";

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
  const [note, setNote] = useState("");
  const [detailDraft, setDetailDraft] = useState<DetailDraft>(() =>
    createDraftFromOpportunity(
      opportunities.find((item) => item.id === initialOpportunityId),
      memberships[0]?.user.id,
    ),
  );
  const [recommendation, setRecommendation] = useState<{
    opportunityId: string;
    title: string | null;
  } | null>(null);
  const recommendationTitle =
    recommendation && recommendation.opportunityId === detailDraft.id
      ? recommendation.title
      : null;
  // Older pages fetched on demand: messages by thread, threads by opportunity.
  const [olderMessages, setOlderMessages] = useState<
    Record<string, CustomerFirstEmailMessage[]>
  >({});
  const [moreThreads, setMoreThreads] = useState<
    Record<string, CustomerFirstEmailThread[]>
  >({});
  const [emailLoadingKey, setEmailLoadingKey] = useState<string | null>(null);
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

  // Fresh server data (router.refresh) replaces local items and drops the
  // older email pages fetched for the previous snapshot.
  const [syncedOpportunities, setSyncedOpportunities] = useState(opportunities);
  if (syncedOpportunities !== opportunities) {
    setSyncedOpportunities(opportunities);
    setItems(opportunities);
    setOlderMessages({});
    setMoreThreads({});
  }

  // Opening a card puts ?opportunityId= in the URL; a new id opens its sheet.
  const [syncedInitialId, setSyncedInitialId] = useState(initialOpportunityId);
  if (syncedInitialId !== initialOpportunityId) {
    setSyncedInitialId(initialOpportunityId);
    const target = initialOpportunityId
      ? opportunities.find((item) => item.id === initialOpportunityId)
      : undefined;
    if (target) {
      setDetailDraft(createDraftFromOpportunity(target, memberships[0]?.user.id));
      setQueuedFiles([]);
      setFileInputKey((value) => value + 1);
      setNote("");
      setSheetOpen(true);
    }
  }

  useEffect(() => {
    const opportunityId = detailDraft.id;
    if (!opportunityId) return;

    let active = true;
    fetch(
      `/api/recommendations/next-actions?objectType=OPPORTUNITY&objectId=${opportunityId}&limit=1`,
      { cache: "no-store" },
    )
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        const title = payload?.success
          ? payload.data?.recommendations?.[0]?.title
          : null;
        setRecommendation({
          opportunityId,
          title: typeof title === "string" ? title : null,
        });
      })
      .catch(() => {
        if (active) setRecommendation({ opportunityId, title: null });
      });

    return () => {
      active = false;
    };
  }, [detailDraft.id]);

  useEffect(() => {
    if (!sheetOpen || !detailDraft.id) return;
    scrollToWindowHashTarget(Object.values(OPPORTUNITY_PAGE_ANCHORS));
  }, [detailDraft.id, sheetOpen]);

  const summaryBase = useMemo(() => {
    return items.filter((item) => {
      const needle = search.toLowerCase();
      const matchSearch =
        !search ||
        item.title.toLowerCase().includes(needle) ||
        item.company?.name.toLowerCase().includes(needle) ||
        item.contacts.some(
          (contact) =>
            contact.name.toLowerCase().includes(needle) ||
            contact.email?.toLowerCase().includes(needle) ||
            contact.phone?.includes(search),
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
    const now = new Date();
    const scoped = summaryBase.filter((item) => {
      if (summaryScope === "mine") {
        return item.owner?.id === currentUserId;
      }
      if (summaryScope === "overdue") {
        return isOpenAndOverdue(item, now);
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

  const counts = summarizeOpportunityCounts(summaryBase, {
    currentUserId,
    now: new Date(),
  });
  const withLoadedEmail = (opportunity: OpportunityItem): OpportunityItem => {
    const extraThreads = (moreThreads[opportunity.id] ?? []).filter(
      (thread) =>
        !opportunity.emailThreads.some((existing) => existing.id === thread.id),
    );
    return {
      ...opportunity,
      emailThreads: [...opportunity.emailThreads, ...extraThreads].map(
        (thread) => {
          const older = (olderMessages[thread.id] ?? []).filter(
            (message) =>
              !thread.messages.some((existing) => existing.id === message.id),
          );
          return older.length
            ? { ...thread, messages: [...older, ...thread.messages] }
            : thread;
        },
      ),
    };
  };
  const activeRawOpportunity =
    items.find((item) => item.id === detailDraft.id) ?? null;
  const activeOpportunity = activeRawOpportunity
    ? withLoadedEmail(activeRawOpportunity)
    : null;
  const businessLoopGapReadout = buildBusinessLoopGapReadout({
    english,
    businessLoopGapSummary,
    fallbackHref: "/operating",
  });

  const describeCard = (opportunity: OpportunityItem) => {
    const now = new Date();
    const sourceKind = resolveOpportunitySourceKind(opportunity);
    const demand = selectOriginalDemandText(opportunity);
    return {
      title: displayText(opportunity.title),
      stageLabel: stageLabelsByLocale[opportunity.stage],
      sourceKind,
      sourceLabel: getOpportunitySourceLabel(sourceKind, english),
      dueChip: describeDueChip(opportunity.dueDate, {
        stage: opportunity.stage,
        now,
        english,
      }),
      firstContactAt: firstContactAt(opportunity),
      hasInboundMail: Boolean(opportunity.emailActivity.firstInboundAt),
      replyStatus: getReplyStatus(opportunity.emailActivity),
      demand,
      demandExcerpt: demand.text
        ? formatInboxMessageBody(demand.text, english)
        : null,
      replyTarget: resolveReplyTarget(opportunity),
    };
  };

  const renderListCard = (
    opportunity: OpportunityItem,
    leading: React.ReactNode,
  ) => {
    const card = describeCard(opportunity);
    return (
      <OpportunityListCard
        english={english}
        title={card.title}
        stageLabel={card.stageLabel}
        sourceLabel={card.sourceLabel}
        dueChip={card.dueChip}
        replyStatus={card.replyStatus}
        receivedAt={
          card.hasInboundMail ? formatMonthDayTime(card.firstContactAt) : null
        }
        contact={opportunity.contacts[0] ?? null}
        companyName={opportunity.company?.name ?? null}
        demandExcerpt={card.demandExcerpt}
        nextAction={displayOptionalText(opportunity.nextAction) || null}
        ownerName={opportunity.owner?.name ?? null}
        replyTarget={card.replyTarget}
        onOpen={() => openDetail(opportunity)}
        leading={leading}
      />
    );
  };

  const selectionProps = (opportunity: OpportunityItem) => ({
    label: english
      ? `Select opportunity: ${opportunity.title}`
      : `选择机会：${displayText(opportunity.title)}`,
    checked: selectedIds.includes(opportunity.id),
    onCheckedChange: (checked: boolean) =>
      setSelectedIds((previous) =>
        checked
          ? [...new Set([...previous, opportunity.id])]
          : previous.filter((id) => id !== opportunity.id),
      ),
  });

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

  const handleScheduleMeeting = (
    threadId: string | null,
    contactId: string | null,
  ) => {
    if (!threadId && !contactId) return;
    startTransition(async () => {
      const result = threadId
        ? await scheduleMeetingFromThreadAction(threadId)
        : await createMeetingForContactAction(contactId!);
      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Failed to schedule the meeting" : "安排会议失败"),
        );
        return;
      }
      toast.success(
        english
          ? "Meeting request created and routed to approvals"
          : "已生成会议安排，进入审批",
      );
      router.push("/approvals");
      router.refresh();
    });
  };

  const handleLoadEarlierMessages = (
    threadId: string,
    beforeMessageId: string,
  ) => {
    setEmailLoadingKey(`thread:${threadId}`);
    void loadEarlierOpportunityThreadMessagesAction({ threadId, beforeMessageId })
      .then((result) => {
        if (!result.ok) {
          toast.error(
            result.error ??
              (english ? "Failed to load earlier mail" : "更早的邮件加载失败"),
          );
          return;
        }
        setOlderMessages((current) => ({
          ...current,
          [threadId]: [...result.messages, ...(current[threadId] ?? [])],
        }));
      })
      .catch(() =>
        toast.error(english ? "Failed to load earlier mail" : "更早的邮件加载失败"),
      )
      .finally(() => setEmailLoadingKey(null));
  };

  const handleLoadMoreThreads = (opportunityId: string, offset: number) => {
    setEmailLoadingKey("threads");
    void loadMoreOpportunityEmailThreadsAction({ opportunityId, offset })
      .then((result) => {
        if (!result.ok) {
          toast.error(
            result.error ??
              (english ? "Failed to load earlier threads" : "更早的线程加载失败"),
          );
          return;
        }
        setMoreThreads((current) => ({
          ...current,
          [opportunityId]: [...(current[opportunityId] ?? []), ...result.threads],
        }));
      })
      .catch(() =>
        toast.error(
          english ? "Failed to load earlier threads" : "更早的线程加载失败",
        ),
      )
      .finally(() => setEmailLoadingKey(null));
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

    const noteText = note.trim();
    const noteContact = activeOpportunity?.contacts[0] ?? null;

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

      if (noteText && noteContact) {
        const noteResult = await addWorkingMemoryAction(
          noteContact.id,
          noteText,
        );
        if (!noteResult.ok) {
          toast.error(
            noteResult.error ??
              (english ? "The note was not saved" : "备注未保存"),
          );
          router.refresh();
          return;
        }
        toast.success(
          english ? "Note saved to the contact's memory" : "备注已记入联系人记忆",
        );
      }

      setNote("");
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
    setNote("");
    setSheetOpen(true);
    if (opportunity?.id) {
      router.replace(`/opportunities?opportunityId=${opportunity.id}`);
    }
  };

  const updateDraft = (patch: Partial<DetailDraft>) =>
    setDetailDraft((state) => ({ ...state, ...patch }));
  const handlingDraft: OpportunityHandlingDraft = {
    nextAction: detailDraft.nextAction,
    dueDate: detailDraft.dueDate,
    stage: detailDraft.stage,
    ownerId: detailDraft.ownerId,
    lossReason: detailDraft.lossReason,
  };
  const onHandlingDraftChange = (patch: Partial<OpportunityHandlingDraft>) =>
    updateDraft({
      ...patch,
      ...(patch.stage ? { stage: patch.stage as DetailDraft["stage"] } : {}),
    } as Partial<DetailDraft>);
  const stageOptions = Object.entries(stageLabelsByLocale) as Array<
    [string, string]
  >;
  const ownerOptions = memberships.map(
    (membership) =>
      [membership.user.id, membership.user.name] as [string, string],
  );
  const activeCard = activeOpportunity ? describeCard(activeOpportunity) : null;

  const buildJudgementLines = (opportunity: OpportunityItem) => {
    const card = describeCard(opportunity);
    const index = filtered.findIndex((item) => item.id === opportunity.id);
    const reasons = [
      card.dueChip?.overdue ? (english ? "overdue" : "已逾期") : null,
      opportunity.company ? null : english ? "no linked company" : "未关联公司",
      opportunity.owner ? null : english ? "no owner" : "未分配负责人",
      card.replyStatus === "awaiting"
        ? english
          ? "customer mail not answered"
          : "客户来信未回复"
        : null,
      opportunity.openBlockerCount
        ? english
          ? `${opportunity.openBlockerCount} open blocker(s)`
          : `${opportunity.openBlockerCount} 个阻塞未解除`
        : null,
      opportunity.overdueCommitmentCount
        ? english
          ? `${opportunity.overdueCommitmentCount} overdue commitment(s)`
          : `${opportunity.overdueCommitmentCount} 条承诺逾期`
        : null,
      opportunity.actionItems.some(
        (actionItem) => actionItem.status === "PENDING_APPROVAL",
      )
        ? english
          ? "an action is awaiting approval"
          : "有动作待审批"
        : null,
    ].filter((reason): reason is string => Boolean(reason));

    return buildSystemJudgementLines({
      english,
      rank: index >= 0 ? index + 1 : null,
      total: filtered.length,
      priorityLabel: getPriorityLabel(opportunity.priorityScore),
      priorityScore: opportunity.priorityScore,
      dueChip: card.dueChip,
      riskLabel: riskLabelsByLocale[opportunity.riskLevel],
      riskReasons: reasons,
      kpiNote: businessLoopGapReadout.blocker ?? null,
      recommendationTitle: recommendationTitle
        ? displayText(recommendationTitle)
        : null,
    });
  };

  const renderAttachments = () => (
    <div className="space-y-2">
      <p className="text-sm font-medium text-[color:var(--foreground)]">
        {english ? "Attachments" : "附件"}
      </p>
      <div className="workspace-panel-muted rounded-2xl px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              document.getElementById("opportunity-attachment-input")?.click()
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
              const selectedFiles = Array.from(event.target.files ?? []);
              if (!selectedFiles.length) return;
              setQueuedFiles((existing) => [...existing, ...selectedFiles]);
            }}
          />
          <p className="text-xs text-[color:var(--muted-foreground)]">
            {english
              ? "Up to 10MB per file. Files upload after saving."
              : "单文件最多 10MB，保存后上传。"}
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
  );

  const renderRecordFields = (includeCompany: boolean) => (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-[color:var(--foreground)]">
          {english ? "Title" : "标题"}
        </label>
        <Input
          aria-label={english ? "Opportunity title" : "机会标题"}
          value={detailDraft.title}
          onChange={(event) => updateDraft({ title: event.target.value })}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <FieldSelect
          label={english ? "Type" : "类型"}
          value={detailDraft.type}
          options={Object.entries(typeLabels)}
          onChange={(value) =>
            updateDraft({ type: value as DetailDraft["type"] })
          }
        />
        <FieldSelect
          label={english ? "Risk level" : "风险等级"}
          value={detailDraft.riskLevel}
          options={Object.entries(riskLabelsByLocale)}
          onChange={(value) =>
            updateDraft({ riskLevel: value as DetailDraft["riskLevel"] })
          }
        />
        {includeCompany ? (
          <FieldSelect
            label={english ? "Company" : "关联公司"}
            value={detailDraft.companyId || "__none__"}
            options={[
              ["__none__", english ? "No linked company" : "未关联公司"],
              ...companies.map(
                (company) => [company.id, company.name] as [string, string],
              ),
            ]}
            onChange={(value) =>
              updateDraft({ companyId: value === "__none__" ? "" : value })
            }
          />
        ) : null}
      </div>
      {renderAttachments()}
    </div>
  );

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

      <Card id="opportunity-workspace" className="workspace-panel">
        <CardContent className="space-y-4 py-4">
          <div
            className="flex flex-wrap gap-x-7 gap-y-2 text-sm text-[color:var(--muted-foreground)]"
            data-opportunity-counts
          >
            {[
              [counts.pending, english ? "Pending" : "待处理"],
              [counts.overdue, english ? "Overdue" : "已逾期"],
              [counts.wonThisWeek, english ? "Won this week" : "本周成交"],
              [counts.mine, english ? "Mine" : "我负责的"],
            ].map(([value, label]) => (
              <span key={label}>
                <b className="mr-1 text-lg font-semibold tabular-nums text-[color:var(--foreground)]">
                  {value}
                </b>
                {label}
              </span>
            ))}
          </div>

          <details
            className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--background-elevated)]"
            data-testid="opportunity-filter-disclosure"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-sm font-semibold text-[color:var(--foreground)]">
                {english ? "Filter and sort" : "筛选和排序"}
              </span>
              <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-xs font-medium text-[color:var(--foreground)]">
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
                        ? "Search title, company, contact or email"
                        : "搜索标题、公司、联系人或邮箱"
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

          <div className="workspace-toolbar flex flex-wrap items-center gap-2 rounded-[20px] px-3 py-2">
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
            <Button
              size="sm"
              variant={summaryScope === "high-risk" ? "default" : "secondary"}
              onClick={() =>
                setSummaryScope((value) =>
                  value === "high-risk" ? "all" : "high-risk",
                )
              }
            >
              {english ? "High risk only" : "只看高风险"}
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
                      <DraggableOpportunity
                        key={opportunity.id}
                        opportunityId={opportunity.id}
                        moveLabel={
                          english
                            ? `Move opportunity card: ${opportunity.title}`
                            : `移动机会卡片：${displayText(opportunity.title)}`
                        }
                      >
                        {(dragHandle) =>
                          renderListCard(
                            opportunity,
                            <>
                              {dragHandle}
                              <SelectionCheckbox
                                className="h-5 w-5 shrink-0 cursor-pointer accent-[color:var(--accent)]"
                                {...selectionProps(opportunity)}
                              />
                            </>,
                          )
                        }
                      </DraggableOpportunity>
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
        <div className="space-y-3" data-opportunity-list>
          {filtered.map((opportunity) => (
            <div key={opportunity.id}>
              {renderListCard(
                opportunity,
                <SelectionCheckbox
                  className="h-5 w-5 cursor-pointer accent-[color:var(--accent)]"
                  {...selectionProps(opportunity)}
                />,
              )}
            </div>
          ))}
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
              {activeOpportunity
                ? displayText(activeOpportunity.title)
                : english
                  ? "New opportunity"
                  : "新建机会"}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {english
                ? "Customer, what the customer said, and the next step."
                : "客户、客户原话与下一步。"}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-5">
            {activeOpportunity && activeCard ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info">{activeCard.stageLabel}</Badge>
                  <Badge variant="success">{activeCard.sourceLabel}</Badge>
                  {activeCard.dueChip ? (
                    <Badge
                      variant={activeCard.dueChip.overdue ? "danger" : "warning"}
                    >
                      {activeCard.dueChip.label}
                    </Badge>
                  ) : null}
                </div>

                <OpportunityCustomerCard
                  english={english}
                  anchorId={OPPORTUNITY_PAGE_ANCHORS.briefing}
                  contacts={activeOpportunity.contacts}
                  companies={companies}
                  companyId={detailDraft.companyId}
                  onCompanyChange={(companyId) => updateDraft({ companyId })}
                  sourceLabel={activeCard.sourceLabel}
                  sourceDetail={
                    activeCard.sourceKind === "website-inquiry" &&
                    activeCard.replyTarget?.kind === "thread"
                      ? ((
                          activeOpportunity.emailThreads.find(
                            (thread) =>
                              activeCard.replyTarget?.kind === "thread" &&
                              thread.id === activeCard.replyTarget.threadId,
                          ) ?? activeOpportunity.emailThreads[0]
                        )?.counterpart ?? null)
                      : null
                  }
                  firstContactAt={formatTimestamp(activeCard.firstContactAt)}
                  ownerName={
                    memberships.find(
                      (membership) => membership.user.id === detailDraft.ownerId,
                    )?.user.name ??
                    activeOpportunity.owner?.name ??
                    null
                  }
                  onEditOwner={() => {
                    const trigger = document.getElementById(OWNER_SELECT_ID);
                    trigger?.scrollIntoView({ behavior: "smooth", block: "center" });
                    trigger?.focus();
                  }}
                />

                <OpportunityOriginalDemand
                  english={english}
                  threads={buildOriginalDemandThreads(activeOpportunity)}
                  threadTotal={activeOpportunity.emailThreadCount}
                  fallback={activeCard.demand}
                  replyStatus={activeCard.replyStatus}
                  loadingKey={emailLoadingKey}
                  onLoadEarlierMessages={handleLoadEarlierMessages}
                  onLoadMoreThreads={() =>
                    handleLoadMoreThreads(
                      activeOpportunity.id,
                      activeOpportunity.emailThreads.length,
                    )
                  }
                />

                <OpportunityHandlingCard
                  english={english}
                  anchorId={OPPORTUNITY_PAGE_ANCHORS.actionWorkspace}
                  ownerSelectId={OWNER_SELECT_ID}
                  draft={handlingDraft}
                  onDraftChange={onHandlingDraftChange}
                  stageOptions={stageOptions}
                  ownerOptions={ownerOptions}
                  note={note}
                  onNoteChange={setNote}
                  noteContactName={activeOpportunity.contacts[0]?.name ?? null}
                  pending={pending}
                  onSave={handleSaveDetail}
                  saveLabel={english ? "Save" : "保存"}
                  replyTarget={activeCard.replyTarget}
                  onScheduleMeeting={() =>
                    handleScheduleMeeting(
                      activeCard.replyTarget?.kind === "thread"
                        ? activeCard.replyTarget.threadId
                        : null,
                      activeOpportunity.contacts[0]?.id ?? null,
                    )
                  }
                  meetingDisabled={
                    activeCard.replyTarget?.kind !== "thread" &&
                    !activeOpportunity.contacts[0]
                  }
                  judgementAnchorId={OPPORTUNITY_PAGE_ANCHORS.judgementWorkspace}
                  judgementLines={buildJudgementLines(activeOpportunity)}
                  judgementExtra={
                    activeOpportunity.dingtalkSignalSummary?.totalSignals ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
                        <span>
                          {english
                            ? `DingTalk signals (7d): ${activeOpportunity.dingtalkSignalSummary.totalSignals} · converted ${activeOpportunity.dingtalkSignalSummary.convertedActionCount} · pending approval ${activeOpportunity.dingtalkSignalSummary.pendingApprovalCount}`
                            : `钉钉执行信号（近7天）：${activeOpportunity.dingtalkSignalSummary.totalSignals} 条 · 已转动作 ${activeOpportunity.dingtalkSignalSummary.convertedActionCount} 条 · 待审批 ${activeOpportunity.dingtalkSignalSummary.pendingApprovalCount} 条`}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            handleConvertDingTalkSignal(activeOpportunity.id)
                          }
                        >
                          {english ? "Convert DingTalk signal" : "转换钉钉信号"}
                        </Button>
                      </div>
                    ) : null
                  }
                />

                <details
                  id={OPPORTUNITY_PAGE_ANCHORS.recordSettings}
                  className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3"
                >
                  <summary className="cursor-pointer text-xs text-[color:var(--muted-foreground)]">
                    {english ? "Record and attachments" : "记录与附件"}
                  </summary>
                  <div className="mt-4 space-y-4">
                    {renderRecordFields(false)}
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="secondary">
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
                  </div>
                </details>
              </>
            ) : (
              <>
                <section className="space-y-4 rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
                  {renderRecordFields(true)}
                </section>
                <OpportunityHandlingCard
                  english={english}
                  anchorId={OPPORTUNITY_PAGE_ANCHORS.actionWorkspace}
                  ownerSelectId={OWNER_SELECT_ID}
                  draft={handlingDraft}
                  onDraftChange={onHandlingDraftChange}
                  stageOptions={stageOptions}
                  ownerOptions={ownerOptions}
                  note={note}
                  onNoteChange={setNote}
                  noteContactName={null}
                  pending={pending}
                  onSave={handleSaveDetail}
                  saveLabel={
                    detailDraft.id
                      ? english
                        ? "Save"
                        : "保存"
                      : english
                        ? "Create opportunity"
                        : "创建机会"
                  }
                />
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SelectionCheckbox({
  className,
  label,
  checked,
  onCheckedChange,
}: {
  className: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      className={className}
      aria-label={label}
      checked={checked}
      onChange={(event) => onCheckedChange(event.target.checked)}
      onClick={(event) => event.stopPropagation()}
    />
  );
}

function DraggableOpportunity({
  opportunityId,
  moveLabel,
  children,
}: {
  opportunityId: string;
  moveLabel: string;
  children: (dragHandle: React.ReactNode) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: opportunityId,
    });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn("min-w-0 transition", isDragging ? "opacity-70" : "")}
    >
      {children(
        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-xl border border-[color:var(--border)] text-[color:var(--muted-foreground)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] active:cursor-grabbing"
          {...listeners}
          {...attributes}
          aria-label={moveLabel}
          onClick={(event) => event.stopPropagation()}
        >
          <Rows3 className="h-4 w-4" />
        </button>,
      )}
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

function FieldSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-[color:var(--foreground)]">
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

const riskOrder = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};
