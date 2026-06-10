"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowRight,
  CalendarPlus,
  Mail,
  MessagesSquare,
  Sparkles,
  Users2,
} from "lucide-react";
import { toast } from "sonner";
import { RecommendationJudgementCard } from "@/components/recommendations/recommendation-judgement-card";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { BlockerCard } from "@/components/shared/blocker-card";
import { CommitmentCard } from "@/components/shared/commitment-card";
import { EmptyState } from "@/components/shared/empty-state";
import { HomeSurfaceArrivalBanner } from "@/components/shared/home-surface-arrival-banner";
import { ObjectContextOperatingSummary } from "@/components/shared/object-context-operating-summary";
import { PageHeader } from "@/components/shared/page-header";
import { StageBadge } from "@/components/shared/status-badges";
import { WorkspaceGuidancePanel } from "@/components/shared/workspace-guidance-panel";
import { WorkspaceSurfacePreferences } from "@/components/shared/workspace-surface-preferences";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  blockerStatusLabels,
  commitmentStatusLabels,
  opportunityTypeLabels,
  stageLabels,
  warmthLabels,
} from "@/data/constants";
import {
  getLocalizedBlockerStatusLabels,
  getLocalizedCommitmentStatusLabels,
  getLocalizedMemorySourceLabels,
  getLocalizedOpportunityTypeLabels,
  getLocalizedStageLabels,
  getLocalizedWarmthLabels,
} from "@/lib/i18n/labels";
import { getWorkspaceStory } from "@/lib/presentation/workspace-story";
import {
  formatDateLabel,
  formatRelative,
  safeParseJson,
  trimText,
} from "@/lib/utils";
import { generateContactNextSteps } from "@/lib/ai";
import {
  addWorkingMemoryAction,
  addContactToOpportunityAction,
  archiveContactAction,
  createMeetingForContactAction,
  generateContactFollowUpAction,
  mergeContactsAction,
} from "@/features/contacts/actions";
import {
  formatContactDateLabel,
  formatContactRelativeLabel,
} from "@/features/contacts/contact-date-labels";
import { generateObjectBriefingAction } from "@/features/memory/actions";
import { createActionFromRecommendationAction } from "@/features/recommendations/actions";
import { StartRecordingButton } from "@/features/conversation-capture/start-recording-button";
import { formatRoleDetailDisplayText } from "@/lib/presentation/role-detail-display-copy";

type ContactDetailClientProps = {
  contact: {
    id: string;
    name: string;
    title: string | null;
    email: string | null;
    tags: string | null;
    notes: string | null;
    relationshipStage: string | null;
    relationshipWarmth: keyof typeof warmthLabels;
    lastInteractionAt: Date | null;
    company: { id: string; name: string } | null;
    opportunities: Array<{
      id: string;
      title: string;
      type: keyof typeof opportunityTypeLabels;
      stage: keyof typeof stageLabels;
      nextAction: string | null;
      company: { id: string; name: string } | null;
    }>;
    meetings: Array<{
      id: string;
      title: string;
      startsAt: Date;
      note: { summary: string | null } | null;
      opportunity: { title: string } | null;
    }>;
    actionItems: Array<{
      id: string;
      title: string;
      status: string;
      updatedAt: Date;
    }>;
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
      relatedOpportunity: { id: string; title: string } | null;
      relatedCompany: { id: string; name: string } | null;
      relatedMeeting: { id: string; title: string } | null;
    }>;
    blockers: Array<{
      id: string;
      title: string;
      blockerText: string;
      blockerType: string;
      severity: number;
      status: string;
      firstSeenAt: Date;
      updatedAt: Date;
      relatedOpportunity: { id: string; title: string } | null;
      relatedCompany: { id: string; name: string } | null;
      relatedMeeting: { id: string; title: string } | null;
    }>;
    memoryEntries: Array<{
      id: string;
      title: string;
      content: string;
      createdAt: Date;
      source: string | null;
    }>;
    briefingSnapshot: {
      id: string;
      payload: {
        summary?: string;
        openCommitments?: Array<Record<string, unknown>>;
        activeBlockers?: Array<Record<string, unknown>>;
        recommendedNextSteps?: string[];
      };
    } | null;
  };
  opportunities: Array<{ id: string; title: string }>;
  contacts: Array<{ id: string; name: string }>;
  recommendations: Array<{
    recommendationId: string;
    actionType: string;
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

export function ContactDetailClient({
  contact,
  opportunities,
  contacts,
  recommendations,
}: ContactDetailClientProps) {
  const router = useRouter();
  const { locale, demoMode } = useWorkspaceUi();
  const english = locale === "en-US";
  const normalizeVisibleText = (value: string) =>
    value
      .replace(/。{2,}/g, "。")
      .replace(/\.。/g, ".")
      .replace(/！。/g, "！")
      .replace(/？。/g, "？")
      .trim();
  const text = (value: string | null | undefined) =>
    normalizeVisibleText(formatRoleDetailDisplayText(value, english));
  const actionStatusLabel = (status: string) => {
    if (english) return status;
    const labels: Record<string, string> = {
      PENDING_APPROVAL: "待复核",
      PENDING: "待处理",
      APPROVED: "已批准",
      EXECUTED: "已执行",
      REJECTED: "已拒绝",
      WITHDRAWN: "已撤回",
      SUGGESTED: "建议中",
      BLOCKED: "已阻断",
      MANUAL: "人工处理",
    };
    return labels[status] ?? status;
  };
  const pageStory = getWorkspaceStory("contacts", locale, demoMode);
  const warmthLabelsByLocale = getLocalizedWarmthLabels(locale);
  const stageLabelsByLocale = getLocalizedStageLabels(locale);
  const opportunityTypeLabelsByLocale =
    getLocalizedOpportunityTypeLabels(locale);
  const commitmentLabelsByLocale = getLocalizedCommitmentStatusLabels(locale);
  const blockerLabelsByLocale = getLocalizedBlockerStatusLabels(locale);
  const memorySourceLabels = getLocalizedMemorySourceLabels(locale);
  const [pending, startTransition] = useTransition();
  const [selectedOpportunityId, setSelectedOpportunityId] = useState(
    opportunities[0]?.id,
  );
  const [mergeTargetId, setMergeTargetId] = useState(contacts[0]?.id);
  const [memoryDraft, setMemoryDraft] = useState("");

  const aiSuggestions = generateContactNextSteps({
    contact: {
      name: contact.name,
      relationshipWarmth: contact.relationshipWarmth,
    },
    opportunities: contact.opportunities.map((opportunity) => ({
      type: opportunity.type,
    })),
    meetingsCount: contact.meetings.length,
  });
  const memoryBackedSuggestions = [
    contact.commitments.find((item) => item.overdueFlag)
      ? english
        ? `Close the overdue commitment first: ${contact.commitments.find((item) => item.overdueFlag)?.title}`
        : `先补齐逾期承诺：${contact.commitments.find((item) => item.overdueFlag)?.title}`
      : null,
    contact.blockers[0]
      ? english
        ? `Address the current blocker first: ${contact.blockers[0].title}`
        : `先处理当前卡点：${contact.blockers[0].title}`
      : null,
    contact.memoryFacts[0]
      ? english
        ? `Use the known memory to steer the next move around "${contact.memoryFacts[0].content}"`
        : `基于已知记忆，建议围绕“${contact.memoryFacts[0].content}”推进`
      : null,
  ].filter(Boolean) as string[];

  const groupedTimeline = {
    [english ? "Meetings" : "会议"]: contact.meetings.map((meeting) => ({
      id: meeting.id,
      title: text(meeting.title),
      description: text(
        meeting.note?.summary ??
          meeting.opportunity?.title ??
          (english ? "Open meeting detail" : "查看会议详情"),
      ),
      createdAt: meeting.startsAt,
      href: `/meetings/${meeting.id}`,
    })),
    [english ? "Commitments" : "承诺与兑现"]: contact.commitments.map(
      (item) => ({
        id: item.id,
        title: text(item.title),
        description: text(
          `${commitmentLabelsByLocale[item.status as keyof typeof commitmentStatusLabels] ?? item.status} · ${trimText(item.commitmentText, 72)}`,
        ),
        createdAt: item.updatedAt,
        href: `/memory?objectType=CONTACT&objectId=${contact.id}`,
      }),
    ),
    [english ? "Actions" : "动作"]: contact.actionItems.map((item) => ({
      id: item.id,
      title: text(item.title),
      description: english
        ? `Status: ${item.status}`
        : `状态：${actionStatusLabel(item.status)}`,
      createdAt: item.updatedAt,
      href: "/approvals",
    })),
    [english ? "Blockers" : "阻塞"]: contact.blockers.map((item) => ({
      id: item.id,
      title: text(item.title),
      description: text(
        `${blockerLabelsByLocale[item.status as keyof typeof blockerStatusLabels] ?? item.status} · ${trimText(item.blockerText, 72)}`,
      ),
      createdAt: item.updatedAt,
      href: `/memory?objectType=CONTACT&objectId=${contact.id}`,
    })),
    [english ? "Memory" : "记忆"]: contact.memoryEntries.map((entry) => ({
      id: entry.id,
      title: text(entry.title),
      description: text(entry.content),
      createdAt: entry.createdAt,
      href: "/memory",
    })),
  };

  const currentOpportunity = contact.opportunities[0];
  const relationshipStageLabel = contact.relationshipStage
    ? text(contact.relationshipStage)
    : currentOpportunity
      ? stageLabel(currentOpportunity.stage, stageLabelsByLocale)
      : english
        ? "Needs review"
        : "待识别";
  const briefingPayload = contact.briefingSnapshot?.payload;
  const topBlocker = contact.blockers[0];
  const topCommitment =
    contact.commitments.find((item) => item.overdueFlag) ??
    contact.commitments[0];
  const normalizeBriefingSummary = (value?: string | null) => {
    if (!value) return null;
    const parsed = safeParseJson<Record<string, unknown> | null>(value, null);
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.summary === "string") {
        return text(parsed.summary);
      }
      const recentFactCount = Array.isArray(parsed.recentFacts)
        ? parsed.recentFacts.length
        : 0;
      const nextStepCount = Array.isArray(parsed.recommendedNextSteps)
        ? parsed.recommendedNextSteps.length
        : 0;
      return english
        ? `Object brief is ready with ${recentFactCount} recent signals and ${nextStepCount} prepared next steps.`
        : `对象摘要已生成，包含 ${recentFactCount} 条近期信号和 ${nextStepCount} 个备选下一步。`;
    }
    return text(value);
  };
  const displayBriefingSummary = normalizeBriefingSummary(
    briefingPayload?.summary,
  );
  const relationshipPressureLine = topCommitment
    ? english
      ? `The most urgent thing now is to fulfill "${topCommitment.title}". Layering on new asks first will feel like spending trust too early.`
      : `当前最需要先兑现的是“${topCommitment.title}”，继续叠加新动作会让这段关系更像在透支信任。`
    : topBlocker
      ? english
        ? `The clearest friction right now is "${topBlocker.title}", so recommendation will prioritize actions that restore relationship momentum first.`
        : `当前最明显的推进阻力是“${topBlocker.title}”，判断建议会优先挑选更容易恢复关系节奏的动作。`
      : english
        ? `Relationship warmth is currently "${warmthLabelsByLocale[contact.relationshipWarmth]}". The system will prioritize lower-friction actions that keep recent momentum going.`
        : `当前关系温度是“${warmthLabelsByLocale[contact.relationshipWarmth]}”，优先选择成本更低、最能延续最近互动节奏的动作。`;
  const relationshipReasonLine = topBlocker
    ? english
      ? `Because the current blocker is "${topBlocker.title}", the system will not stack more new asks first. It prioritizes actions that lower friction.`
      : `因为当前卡点是“${topBlocker.title}”，先不要堆更多新承诺，优先选择能降低阻力的动作。`
    : topCommitment
      ? english
        ? `Because "${topCommitment.title}" is still open, the system prioritizes actions that repair trust and close commitments before asking for more.`
        : `因为当前还有“${topCommitment.title}”这类未兑现承诺，先选修复信任和补齐承诺的动作。`
      : english
        ? `Because the current relationship stage is "${relationshipStageLabel}", the system combines recent interaction context with your historical handling style and prefers lower-friction moves.`
        : `因为当前关系阶段是“${relationshipStageLabel}”，结合最近互动和你过去的处理偏好，优先选择阻力更低的动作。`;
  const contactOperatingTitle =
    topCommitment || topBlocker || currentOpportunity
      ? english
        ? `${contact.name} should be treated as a live relationship object, not just profile data`
        : `${contact.name} 现在应该被当成活跃关系对象，而不只是联系人资料`
      : english
        ? `${contact.name} still needs a stronger work context before the next move becomes obvious`
        : `${contact.name} 还需要更强的工作上下文，下一步才会更明显`;
  const contactOperatingItems = [
    {
      label: english ? "Object state" : "当前对象状态",
      value: `${relationshipStageLabel} · ${warmthLabelsByLocale[contact.relationshipWarmth]} · ${contact.company?.name ?? (english ? "Independent contact" : "独立联系人")}`,
    },
    {
      label: english ? "Single next step" : "最重要下一步",
      value:
        briefingPayload?.recommendedNextSteps?.[0] ??
        topCommitment?.title ??
        topBlocker?.title ??
        currentOpportunity?.nextAction ??
        (english
          ? "Open the contact timeline and choose the next low-friction move."
          : "先打开联系人时间线，确认下一步低摩擦动作。"),
    },
    {
      label: english ? "Boundary posture" : "当前边界状态",
      value: recommendations.some(
        (item) => item.policyResult === "REQUIRES_APPROVAL",
      )
        ? english
          ? "A suggested move needs approval — keep review visible."
          : "有建议触到审批——保持可复核。"
        : topCommitment?.overdueFlag
          ? english
            ? "Overdue commitment — repair trust before adding new asks."
            : "有过期承诺——先修复信任，再加新请求。"
          : topBlocker
            ? english
              ? "Blocker still here — lower friction before pushing harder."
              : "阻塞还在——先降阻，不要强推。"
            : english
              ? "Safe to move at the contact level. Outward commitments still need review."
              : "可以在联系人层面推进。对外承诺仍要复核。",
    },
    {
      label: english ? "Source context" : "支撑上下文",
      value:
        contact.memoryFacts[0]?.content ??
        contact.meetings[0]?.note?.summary ??
        topCommitment?.commitmentText ??
        topBlocker?.blockerText ??
        (english
          ? "Recent meetings, memory and commitments will make the next move easier to trust."
          : "最近会议、记忆和承诺会继续为下一步动作提供可信依据。"),
    },
  ];
  const contactOperatingConnections = [
    contact.company
      ? {
          label: english ? "Linked company" : "关联公司",
          value: contact.company.name,
          description: english
            ? "Open the account view to confirm whether this relationship still has room to expand."
            : "打开公司页，确认这段关系背后的账户上下文是否还支持继续推进。",
          href: `/companies/${contact.company.id}`,
        }
      : undefined,
    currentOpportunity
      ? {
          label: english ? "Active opportunity" : "活跃机会",
          value: currentOpportunity.title,
          description: english
            ? "The current relationship move should stay aligned with this opportunity's next step."
            : "当前关系动作最好和这条机会的下一步保持一致。",
          href: `/opportunities?opportunityId=${currentOpportunity.id}`,
        }
      : undefined,
    contact.meetings[0]
      ? {
          label: english ? "Recent meeting" : "最近会议",
          value: contact.meetings[0].title,
          description: english
            ? "Use the latest meeting to confirm what changed before taking the next relationship move."
            : "先回看最近会议，再决定这段关系的下一步是否该推进。",
          href: `/meetings/${contact.meetings[0].id}`,
        }
      : undefined,
    recommendations.some((item) => item.policyResult === "REQUIRES_APPROVAL")
      ? {
          label: english ? "Review handoff" : "复核去向",
          value: english
            ? "A relationship move is already waiting in approvals."
            : "当前已有关系动作进入复核队列。",
          description: english
            ? "Use the formal review surface before treating this as an external commitment."
            : "先经过正式复核，再把它读成真正对外动作。",
          href: "/approvals",
        }
      : contact.memoryFacts[0]
        ? {
            label: english ? "Memory source" : "记忆依据",
            value: contact.memoryFacts[0].title,
            description: trimText(contact.memoryFacts[0].content, 72),
            href: `/memory?objectType=CONTACT&objectId=${contact.id}`,
          }
        : topCommitment
          ? {
              label: english ? "Commitment chain" : "承诺链",
              value: topCommitment.title,
              description: trimText(topCommitment.commitmentText, 72),
              href: `/memory?objectType=CONTACT&objectId=${contact.id}`,
            }
          : topBlocker
            ? {
                label: english ? "Blocker source" : "阻塞依据",
                value: topBlocker.title,
                description: trimText(topBlocker.blockerText, 72),
                href: `/memory?objectType=CONTACT&objectId=${contact.id}`,
              }
            : undefined,
  ].filter(
    (
      item,
    ): item is {
      label: string;
      value: string;
      description: string;
      href: string;
    } => Boolean(item),
  );
  const contactGuidanceRecommendations = [
    topCommitment
      ? {
          title: english ? "Close the trust debt first" : "先补齐信任债务",
          body: english
            ? `Fulfill "${topCommitment.title}" before asking this relationship to carry a heavier next move.`
            : `先兑现“${topCommitment.title}”，再让这段关系承接更重的下一步动作。`,
          href: `/memory?objectType=CONTACT&objectId=${contact.id}`,
          meta: english ? "Commitment pressure" : "承诺压力",
        }
      : undefined,
    topBlocker
      ? {
          title: english ? "Reduce the visible blocker" : "先降低当前卡点",
          body: english
            ? `The current friction is "${topBlocker.title}", so the next move should lower resistance before pushing outward.`
            : `当前阻力是“${topBlocker.title}”，下一步应先降阻，再考虑向外推进。`,
          href: `/memory?objectType=CONTACT&objectId=${contact.id}`,
          meta: english ? "Blocker review" : "阻塞复核",
        }
      : undefined,
    currentOpportunity
      ? {
          title: english
            ? "Stay aligned with the live opportunity"
            : "和当前机会保持同向",
          body: english
            ? `Keep the relationship move aligned with "${currentOpportunity.title}" before creating a new branch of work.`
            : `先让关系动作和“${currentOpportunity.title}”保持同向，再决定是否拆出新的推进支线。`,
          href: `/opportunities?opportunityId=${currentOpportunity.id}`,
          meta: english ? "Opportunity alignment" : "机会对齐",
        }
      : undefined,
  ].filter(
    (
      item,
    ): item is {
      title: string;
      body: string;
      href: string;
      meta: string;
    } => Boolean(item),
  );
  const contactGuidanceReminders = [
    {
      title: english ? "Current relationship judgement" : "当前关系判断",
      body: relationshipPressureLine,
      meta: english ? "Judgement" : "判断",
    },
    {
      title: english ? "Why the system leans this way" : "系统为什么会这样判断",
      body: relationshipReasonLine,
      meta: english ? "Reason line" : "判断依据",
    },
    displayBriefingSummary
      ? {
          title: english ? "Object summary already exists" : "对象级摘要已存在",
          body: trimText(displayBriefingSummary, 112),
          meta: english ? "Memory brief" : "记忆摘要",
        }
      : undefined,
  ].filter(
    (
      item,
    ): item is {
      title: string;
      body: string;
      meta: string;
    } => Boolean(item),
  );
  const contactLastInteractionRelative = formatContactRelativeLabel(
    contact.lastInteractionAt,
    english,
    formatRelative,
  );
  const pageHeaderDescription = [
    pageStory.description,
    contact.company?.name ?? (english ? "Independent contact" : "独立联系人"),
    `${english ? "Last interaction" : "最近互动"} ${contactLastInteractionRelative}`,
  ].join(" · ");
  const lastMeaningfulInteractionExplanation = english
    ? `The last meaningful interaction was ${contactLastInteractionRelative}. That means the system is not looking only at profile fields; it is using interaction cadence, active blockers, open commitments and your handling preferences as recommendation context.`
    : `最近一次互动是 ${formatRelative(contact.lastInteractionAt)}。这意味着判断不能只盯着资料字段，而要把最近互动节奏、当前卡点、未兑现承诺和你的处理偏好一起看。`;

  function runAction(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
    pushTo?: string,
  ) {
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
  }

  const contactSecondaryContext = (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_360px]">
      <WorkspaceGuidancePanel
        eyebrow={english ? "Relationship guidance" : "关系引导"}
        title={
          english
            ? "Read the relationship first, then pick the next move."
            : "先看关系，再挑下一步。"
        }
        summary={
          english
            ? "Trust carrying forward, what's blocked, the lowest-friction move."
            : "信任延续的、卡住的、最省力的下一步。"
        }
        recommendations={contactGuidanceRecommendations}
        reminders={contactGuidanceReminders}
        recommendationsLabel={english ? "Recommended next moves" : "建议先处理"}
        remindersLabel={english ? "Relationship reminders" : "关系提醒"}
        boundaryLabel={english ? "Boundary" : "边界"}
        boundary={
          english
            ? "Prepares follow-up and memory. Doesn't make external commitments on its own."
            : "准备跟进和记忆。不会替你对外承诺。"
        }
      />
      <div className="workspace-surface-stack">
        <WorkspaceSurfacePreferences />
        <Card className="workspace-form-assist workspace-panel-muted">
          <CardContent className="space-y-3 py-5">
            <p className="workspace-eyebrow">
              {english ? "Relationship assist" : "关系辅助"}
            </p>
            <p className="text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
              {english
                ? "Use quick presets before editing the relationship narrative."
                : "先用快捷辅助收敛判断，再修改关系叙事。"}
            </p>
            <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
              {english
                ? "Refresh the summary, draft a follow-up, then handle memory or approvals."
                : "刷新摘要、起草跟进，再去处理记忆或审批。"}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  runAction(
                    () => generateObjectBriefingAction("CONTACT", contact.id),
                    english ? "Contact summary refreshed" : "联系人摘要已刷新",
                  )
                }
              >
                <Sparkles className="h-4 w-4" />
                {english ? "Refresh summary" : "刷新摘要"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  runAction(
                    () => generateContactFollowUpAction(contact.id),
                    english
                      ? "Follow-up email draft generated"
                      : "已生成跟进邮件草稿",
                    "/approvals",
                  )
                }
              >
                <Mail className="h-4 w-4" />
                {english ? "Draft follow-up" : "起草跟进"}
              </Button>
              <Button type="button" variant="secondary" asChild>
                <Link
                  href={`/memory?objectType=CONTACT&objectId=${contact.id}`}
                >
                  {english ? "Open memory" : "查看记忆"}
                </Link>
              </Button>
              {currentOpportunity ? (
                <Button type="button" variant="secondary" asChild>
                  <Link
                    href={`/opportunities?opportunityId=${currentOpportunity.id}`}
                  >
                    {english ? "Open live opportunity" : "查看当前机会"}
                  </Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="workspace-surface-stack">
      <PageHeader
        showBreadcrumb={false}
        titleAs="h2"
        eyebrow={pageStory.eyebrow}
        title={contact.name}
        description={pageHeaderDescription}
        actions={
          <>
            <StartRecordingButton
              variant="secondary"
              objectType="CONTACT"
              objectId={contact.id}
              objectLabel={contact.name}
              defaultTitle={
                english
                  ? `${contact.name} live capture`
                  : `${contact.name} 现场记录`
              }
            />
            <Button
              onClick={() =>
                runAction(
                  () => generateContactFollowUpAction(contact.id),
                  english
                    ? "Follow-up email draft generated"
                    : "已生成跟进邮件草稿",
                  "/approvals",
                )
              }
            >
              <Mail className="h-4 w-4" />
              {english ? "Draft follow-up email" : "起草跟进邮件"}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                runAction(
                  () => generateContactFollowUpAction(contact.id, "message"),
                  english ? "Message draft generated" : "已生成消息文案",
                  "/approvals",
                )
              }
            >
              <MessagesSquare className="h-4 w-4" />
              {english ? "Draft message" : "起草微信 / 短信"}
            </Button>
          </>
        }
      />

      <HomeSurfaceArrivalBanner
        kind="detail"
        english={english}
        contract={{
          ownership: english
            ? "Contact detail owns the current relationship state, next-step judgement and relationship workspace."
            : "联系人详情负责当前关系状态、下一步判断和关系工作区。",
          nextStep: english
            ? "Start in the relationship workspace, then decide whether the next move belongs in follow-up, memory, or approvals."
            : "先从关系工作区开始，再决定下一步应该落在跟进、记忆还是复核队列。",
          boundary: english
            ? "This page can shape follow-up and memory work, but it still does not grant external commitment or autonomous send authority."
            : "这个页面可以整形跟进和记忆动作，但不会获得对外承诺或自动发送权限。",
        }}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric
          label={english ? "Relationship warmth" : "关系温度"}
          value={warmthLabelsByLocale[contact.relationshipWarmth]}
        />
        <Metric
          label={english ? "Current stage" : "当前关系阶段"}
          value={relationshipStageLabel}
        />
        <Metric
          label={english ? "Last interaction" : "最近互动"}
          value={formatContactDateLabel(
            contact.lastInteractionAt,
            english,
            formatDateLabel,
          )}
        />
        <Metric
          label={english ? "Open commitments" : "未完成承诺"}
          value={
            english
              ? `${contact.commitments.length}`
              : `${contact.commitments.length} 条`
          }
        />
        <Metric
          label={english ? "Current blocker" : "当前卡点"}
          value={
            topBlocker
              ? topBlocker.title
              : english
                ? "No major blocker"
                : "暂无显著卡点"
          }
        />
      </div>

      <div id="contact-workspace">
        <ObjectContextOperatingSummary
          label={english ? "Relationship operating summary" : "关系操作摘要"}
          title={text(contactOperatingTitle)}
          summary={text(relationshipPressureLine)}
          items={contactOperatingItems.map((item) => ({
            label: text(item.label),
            value: text(item.value),
          }))}
          connectionsLabel={english ? "Connected loop" : "关联对象与回路"}
          connections={contactOperatingConnections.map((connection) => ({
            ...connection,
            label: text(connection.label),
            value: text(connection.value),
            description: connection.description
              ? text(connection.description)
              : connection.description,
          }))}
        />
      </div>

      {contactSecondaryContext}

      {demoMode ? (
        <Card className="workspace-panel-muted">
          <CardContent className="grid gap-4 py-5 xl:grid-cols-[1.15fr_repeat(3,minmax(0,0.9fr))]">
            <div className="space-y-2">
              <Badge variant="approval">
                {english ? "Living work profile" : "动态工作档案"}
              </Badge>
              <p className="text-lg font-semibold text-[color:var(--foreground)]">
                {english
                  ? "This person is not just contact info. It is a real work context stitched together by opportunities, meetings, actions and memory."
                  : "这位联系人不只是联系方式，而是被机会、会议、行动和记忆串起来的真实工作上下文。"}
              </p>
              <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                {english
                  ? "Use this page to explain why relationship warmth, recent interaction and next-step recommendations are believable."
                  : "演示时可以从这里讲清楚关系温度、最近互动和下一步建议为什么可信。"}
              </p>
            </div>
            <Info
              label={english ? "Company" : "公司"}
              value={
                contact.company?.name ??
                (english ? "Independent contact" : "独立联系人")
              }
            />
            <Info
              label={english ? "Active opportunities" : "活跃机会"}
              value={
                english
                  ? `${contact.opportunities.length}`
                  : `${contact.opportunities.length} 条`
              }
            />
            <Info
              label={english ? "Work memory" : "工作记忆"}
              value={
                english
                  ? `${contact.memoryEntries.length + contact.memoryFacts.length}`
                  : `${contact.memoryEntries.length + contact.memoryFacts.length} 条`
              }
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)] 2xl:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)_minmax(360px,0.88fr)]">
        <div className="space-y-6">
          <Card className="workspace-panel-muted">
            <CardHeader>
              <CardTitle>
                {english ? "Relationship judgement" : "关系判断"}
              </CardTitle>
              <CardDescription>
                {english
                  ? "Stage, recent interaction, open commitments, blockers."
                  : "阶段、最近互动、未兑现承诺、卡点。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <Info
                  label={english ? "Current stage" : "当前关系阶段"}
                  value={relationshipStageLabel}
                />
                <Info
                  label={english ? "Relationship warmth" : "关系温度"}
                  value={warmthLabelsByLocale[contact.relationshipWarmth]}
                />
                <Info
                  label={english ? "Main blocker" : "最大卡点"}
                  value={
                    topBlocker
                      ? trimText(topBlocker.title, 22)
                      : english
                        ? "No major blocker"
                        : "暂无显著卡点"
                  }
                />
                <Info
                  label={english ? "Most urgent commitment" : "最急承诺"}
                  value={
                    topCommitment
                      ? trimText(topCommitment.title, 22)
                      : english
                        ? "No open commitment"
                        : "暂无未兑现承诺"
                  }
                />
              </div>
              <div className="workspace-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                  {english ? "Current relationship judgement" : "当前关系判断"}
                </p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--foreground)]">
                  {text(relationshipPressureLine)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {english ? "Contact profile" : "联系人信息"}
              </CardTitle>
              <CardDescription>
                {english
                  ? "Current state, tags, work context."
                  : "当前状态、标签、工作上下文。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Info
                  label={english ? "Email" : "邮箱"}
                  value={contact.email ?? (english ? "Not set" : "未填写")}
                />
                <Info
                  label={english ? "Tags" : "标签"}
                  value={
                    safeParseJson<string[]>(contact.tags, [])
                      .map((tag) => text(tag))
                      .join(" · ") ||
                    (english ? "No tags" : "暂无标签")
                  }
                />
                <Info
                  label={english ? "Company" : "所属公司"}
                  value={
                    contact.company?.name ??
                    (english ? "Independent contact" : "独立联系人")
                  }
                />
                <Info
                  label={english ? "Active opportunities" : "活跃机会"}
                  value={
                    english
                      ? `${contact.opportunities.length}`
                      : `${contact.opportunities.length} 条`
                  }
                />
              </div>
              <div className="workspace-panel-muted rounded-2xl p-4">
                <p className="text-sm font-medium text-[color:var(--foreground)]">
                  {english ? "Relationship summary" : "关系摘要"}
                </p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
                  {text(
                    contact.notes ?? (english ? "No notes yet" : "暂无备注"),
                  )}
                </p>
              </div>
              <div className="workspace-panel-muted rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    {english ? "Object memory summary" : "对象级记忆摘要"}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        runAction(
                          () =>
                            generateObjectBriefingAction("CONTACT", contact.id),
                          english
                            ? "Contact summary refreshed"
                            : "联系人摘要已刷新",
                        )
                      }
                    >
                      <Sparkles className="h-4 w-4" />
                      {english ? "Refresh summary" : "刷新摘要"}
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <Link
                        href={`/memory?objectType=CONTACT&objectId=${contact.id}`}
                      >
                        {english ? "Open memory" : "去记忆页"}
                      </Link>
                    </Button>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-7 text-[color:var(--foreground)]">
                  {displayBriefingSummary ??
                    (english
                      ? "Recent meetings, open commitments, blockers and preferences — summarized into one paragraph."
                      : "最近会议、未兑现承诺、卡点和对方偏好——汇成一段。")}
                </p>
                {briefingPayload?.recommendedNextSteps?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {briefingPayload.recommendedNextSteps
                      .slice(0, 2)
                      .map((item) => (
                        <Badge key={item} variant="info">
                          {text(item)}
                        </Badge>
                      ))}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{english ? "Key memory" : "关键记忆"}</CardTitle>
              <CardDescription>
                {english
                  ? "Preferences, concerns, where this stands."
                  : "偏好、关切、当前在哪一步。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {contact.memoryFacts.length ? (
                contact.memoryFacts.map((fact) => (
                  <div
                    key={fact.id}
                    className="theme-surface-panel rounded-2xl px-4 py-4"
                  >
                    <p className="font-medium text-[color:var(--foreground)]">
                      {text(fact.title)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                      {trimText(text(fact.content), 120)}
                    </p>
                    <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                      {english ? "Confidence" : "置信度"} {fact.confidence} ·{" "}
                      {formatContactDateLabel(
                        fact.updatedAt,
                        english,
                        formatDateLabel,
                      )}
                    </p>
                  </div>
                ))
              ) : (
                <EmptyState
                  title={
                    english
                      ? "No structured key memory yet"
                      : "还没有结构化关键记忆"
                  }
                  description={
                    english
                      ? "Import meeting notes or add memory manually — preferences and concerns will show up here."
                      : "导入会议纪要或手动补充——偏好和关切会出现在这里。"
                  }
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{english ? "Timeline" : "时间线"}</CardTitle>
              <CardDescription>
                {english
                  ? "Grouped by event type."
                  : "按事件类型分组。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(groupedTimeline).map(([group, entries]) => (
                <div key={group} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{group}</Badge>
                    <p className="text-sm text-[color:var(--muted-foreground)]">
                      {english
                        ? `${entries.length} items`
                        : `${entries.length} 条`}
                    </p>
                  </div>
                  {entries.length ? (
                    entries.map((item) => (
                      <Link
                        key={`${group}-${item.id}`}
                        href={item.href}
                        aria-label={item.title}
                        className="block rounded-2xl border border-[color:var(--border)] px-4 py-4 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2">
                            <p className="font-medium text-[color:var(--foreground)]">
                              {item.title}
                            </p>
                            <p className="text-sm text-[color:var(--muted-foreground)]">
                              {trimText(item.description, 110)}
                            </p>
                          </div>
                          <p className="text-xs text-[color:var(--muted-foreground)]">
                            {formatContactDateLabel(
                              item.createdAt,
                              english,
                              formatDateLabel,
                            )}
                          </p>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <EmptyState
                      title={
                        english
                          ? `No ${group.toLowerCase()} yet`
                          : `暂无${group}记录`
                      }
                      description={
                        english
                          ? "New meetings, actions and memory will appear here automatically."
                          : "新的会议、动作和记忆会自动补到这里。"
                      }
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {english ? "Open commitments" : "未完成承诺"}
              </CardTitle>
              <CardDescription>
                {english
                  ? "Still open from previous meetings."
                  : "之前承诺、还没兑现的。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {contact.commitments.length ? (
                contact.commitments.map((commitment) => (
                  <CommitmentCard
                    key={commitment.id}
                    commitment={{
                      ...commitment,
                      sourceLabel: describeCommitmentSource(
                        commitment.sourceType,
                        memorySourceLabels,
                      ),
                      ownerName: commitment.ownerUser?.name ?? null,
                      targetLabel:
                        commitment.relatedOpportunity?.title ??
                        commitment.relatedMeeting?.title ??
                        commitment.relatedCompany?.name ??
                        contact.name,
                    }}
                    compact
                  />
                ))
              ) : (
                <EmptyState
                  title={english ? "No open commitments" : "还没有未完成承诺"}
                  description={
                    english
                      ? "Import meeting notes — commitments are tracked automatically."
                      : "导入会议纪要——承诺会自动进入跟踪。"
                  }
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{english ? "Current blockers" : "当前卡点"}</CardTitle>
              <CardDescription>
                {english
                  ? "What's keeping this contact stuck."
                  : "正在压住这条线的卡点。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {contact.blockers.length ? (
                contact.blockers.map((blocker) => (
                  <BlockerCard
                    key={blocker.id}
                    blocker={{
                      ...blocker,
                      targetLabel:
                        blocker.relatedOpportunity?.title ??
                        blocker.relatedMeeting?.title ??
                        blocker.relatedCompany?.name ??
                        contact.name,
                    }}
                    compact
                  />
                ))
              ) : (
                <EmptyState
                  title={
                    english
                      ? "No obvious blocker right now"
                      : "当前没有明显卡点"
                  }
                  description={
                    english
                      ? "Budget, pace, preference blockers show up here first."
                      : "预算、节奏、偏好类卡点会先出现在这里。"
                  }
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {english ? "Related opportunities" : "相关机会"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contact.opportunities.length ? (
                contact.opportunities.map((opportunity) => (
                  <Link
                    key={opportunity.id}
                    href={`/opportunities?opportunityId=${opportunity.id}`}
                    aria-label={opportunity.title}
                    className="block rounded-2xl border border-[color:var(--border)] px-4 py-4 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-[color:var(--foreground)]">
                        {opportunity.title}
                      </p>
                      <Badge variant="default">
                        {opportunityTypeLabelsByLocale[opportunity.type]}
                      </Badge>
                      <StageBadge stage={opportunity.stage} />
                    </div>
                    <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                      {trimText(text(opportunity.nextAction), 88)}
                    </p>
                  </Link>
                ))
              ) : (
                <EmptyState
                  title={
                    english ? "No related opportunities yet" : "还没有关联机会"
                  }
                  description={
                    english
                      ? "You can add this person to an opportunity on the right, or create a new one first."
                      : "可以在右侧把联系人加入某条机会，或先新建一条机会。"
                  }
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{english ? "Related meetings" : "相关会议"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contact.meetings.length ? (
                contact.meetings.map((meeting) => (
                  <Link
                    key={meeting.id}
                    href={`/meetings/${meeting.id}`}
                    aria-label={meeting.title}
                    className="block rounded-2xl border border-[color:var(--border)] px-4 py-4 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                  >
                    <p className="font-medium text-[color:var(--foreground)]">
                      {meeting.title}
                    </p>
                    <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                      {formatContactDateLabel(
                        meeting.startsAt,
                        english,
                        formatDateLabel,
                      )}
                    </p>
                    <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                      {trimText(
                        text(
                          meeting.note?.summary ??
                            (english
                              ? "Open briefing and post-meeting actions"
                              : "查看会前简报与会后行动"),
                        ),
                        90,
                      )}
                    </p>
                  </Link>
                ))
              ) : (
                <EmptyState
                  title={english ? "No related meetings yet" : "还没有相关会议"}
                  description={
                    english
                      ? "You can generate a follow-up meeting action for this person directly from the right side."
                      : "可以直接从右侧为这位联系人生成后续会议动作。"
                  }
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {english ? "Add work memory" : "补充工作记忆"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={memoryDraft}
                onChange={(event) => setMemoryDraft(event.target.value)}
                placeholder={
                  english
                    ? "Add a work-memory note, for example: They prefer reviewing a one-page brief before the meeting."
                    : "补充一条工作域记忆，例如：对方更愿意先看 1 页简报再开会。"
                }
              />
              <Button
                className="w-full"
                disabled={!memoryDraft.trim() || pending}
                onClick={() =>
                  runAction(
                    () =>
                      addWorkingMemoryAction(contact.id, memoryDraft).then(
                        (result) => {
                          if (result.ok) setMemoryDraft("");
                          return result;
                        },
                      ),
                    english ? "Work memory recorded" : "已记录工作记忆",
                  )
                }
              >
                {english ? "Add to timeline" : "记录到时间线"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="theme-judgement-panel">
            <CardHeader>
              <CardTitle>
                {english
                  ? "Relationship judgement and recommended moves"
                  : "关系判断与推荐动作"}
              </CardTitle>
              <CardDescription>
                {english
                  ? "Why this move fits this person — not just what to do."
                  : "为什么这一步适合这个人——不只是「做什么」。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="theme-judgement-panel-inset rounded-2xl p-4">
                <p className="text-sm font-medium text-[color:var(--foreground)]">
                  {english
                    ? "Why this suggestion fits this person"
                    : "为什么这条建议适合这个人"}
                </p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  {text(relationshipReasonLine)}
                </p>
              </div>
              <div className="theme-judgement-panel-inset rounded-2xl p-4 text-sm leading-6 text-[color:var(--muted)]">
                {lastMeaningfulInteractionExplanation}
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
                            ? "Best action for this person"
                            : "最适合这位联系人的动作"
                          : english
                            ? "Second-best action"
                            : "次优动作"
                      }
                      sourcePage={`/contacts/${contact.id}`}
                      className={
                        index === 0
                          ? "border-[color:var(--border)] bg-[color:color-mix(in_oklab,white_84%,var(--surface-subtle)_16%)] shadow-none dark:border-white/10 dark:bg-white/10"
                          : "border-[color:var(--border)] bg-[color:color-mix(in_oklab,white_88%,var(--surface-subtle)_12%)] shadow-none dark:border-white/10 dark:bg-white/5"
                      }
                      cta={
                        <Button
                          className="theme-primary-action"
                          onClick={() =>
                            runAction(
                              () =>
                                createActionFromRecommendationAction(
                                  item.recommendationId,
                                  `/contacts/${contact.id}`,
                                ),
                              english
                                ? "Action created from recommendation"
                                : "已按建议生成动作",
                              "/approvals",
                            )
                          }
                        >
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
                            href={`/memory?objectType=CONTACT&objectId=${contact.id}`}
                          >
                            {english
                              ? "View supporting memory"
                              : "查看依据记忆"}
                          </Link>
                        </Button>
                      }
                      footer={
                        <p className="text-xs text-[color:var(--muted-foreground)] dark:text-white/60">
                          {english
                            ? "If this suggestion is not right, later approval feedback will help the system learn your handling preference."
                            : "如果这条建议不合适，后续可以在审批反馈里沉淀你的处理偏好。"}
                        </p>
                      }
                    />
                  ))
                : null}
              {[...memoryBackedSuggestions, ...aiSuggestions]
                .slice(0, 4)
                .map((suggestion) => (
                  <div
                    key={suggestion}
                    className="theme-judgement-panel-inset rounded-2xl p-4"
                  >
                    <div className="flex items-start gap-3">
                      <Sparkles className="mt-0.5 h-4 w-4 text-[color:var(--accent)]" />
                      <p className="text-sm leading-6 text-[color:var(--muted)]">
                        {text(suggestion)}
                      </p>
                    </div>
                  </div>
                ))}
              <div className="theme-judgement-panel-inset rounded-2xl px-4 py-3 text-sm leading-6 text-[color:var(--muted)]">
                {english
                  ? "Recommendations for this person simultaneously reference recent interaction, open commitments, current blockers, object-level memory and how you handled similar relationships in the past."
                  : "这位联系人当前的判断建议会同时参考最近互动、未完成承诺、当前卡点、对象级记忆摘要，以及你过去处理类似关系时的习惯。"}
              </div>
              <div className="grid gap-2 pt-2">
                <Button
                  className="theme-primary-action"
                  onClick={() =>
                    runAction(
                      () => generateContactFollowUpAction(contact.id),
                      english ? "Follow-up draft generated" : "已生成跟进草稿",
                      "/approvals",
                    )
                  }
                >
                  {english
                    ? "Draft email and send to approvals"
                    : "起草邮件并送审"}
                </Button>
                <Button
                  variant="secondary"
                  className="border border-[color:var(--border)] bg-[color:color-mix(in_oklab,white_84%,var(--surface-subtle)_16%)] text-[color:var(--foreground)] hover:bg-[color:color-mix(in_oklab,white_72%,var(--surface-subtle)_28%)] dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                  onClick={() =>
                    runAction(
                      () => createMeetingForContactAction(contact.id),
                      english ? "Meeting action created" : "已生成会议动作",
                      "/approvals",
                    )
                  }
                >
                  {english ? "Create meeting" : "创建会议"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{english ? "Quick actions" : "快捷动作"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <p className="text-sm font-medium text-[color:var(--foreground)]">
                  {english ? "Add to opportunity" : "加入机会"}
                </p>
                <Select
                  value={selectedOpportunityId}
                  onValueChange={setSelectedOpportunityId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={english ? "Select opportunity" : "选择机会"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {opportunities.map((opportunity) => (
                      <SelectItem key={opportunity.id} value={opportunity.id}>
                        {opportunity.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full"
                  variant="secondary"
                  disabled={!selectedOpportunityId}
                  onClick={() =>
                    runAction(
                      () =>
                        addContactToOpportunityAction(
                          contact.id,
                          selectedOpportunityId,
                        ),
                      english ? "Added to opportunity" : "已加入机会",
                    )
                  }
                >
                  <ArrowRight className="h-4 w-4" />
                  {english ? "Add to selected opportunity" : "加入当前机会"}
                </Button>
              </div>
              <Button
                className="w-full justify-start"
                variant="secondary"
                onClick={() =>
                  runAction(
                    () => createMeetingForContactAction(contact.id),
                    english ? "Meeting action created" : "已创建会议动作",
                    "/approvals",
                  )
                }
              >
                <CalendarPlus className="h-4 w-4" />
                {english ? "Create meeting" : "创建会议"}
              </Button>
              <div className="space-y-2">
                <p className="text-sm font-medium text-[color:var(--foreground)]">
                  {english ? "Merge contacts" : "合并联系人"}
                </p>
                <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        english ? "Select target contact" : "选择目标联系人"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full"
                  variant="secondary"
                  disabled={!mergeTargetId}
                  onClick={() => {
                    if (
                      !window.confirm(
                        english
                          ? "Merge this contact into the selected contact? Opportunities, meetings and memory will be reassigned."
                          : "确认把当前联系人合并到目标联系人吗？该操作会回写机会、会议和记忆。",
                      )
                    )
                      return;
                    runAction(
                      () => mergeContactsAction(contact.id, mergeTargetId),
                      english ? "Contacts merged" : "联系人已合并",
                      `/contacts/${mergeTargetId}`,
                    );
                  }}
                >
                  <Users2 className="h-4 w-4" />
                  {english ? "Merge now" : "执行合并"}
                </Button>
              </div>
              <Button
                className="w-full justify-start"
                variant="ghost"
                onClick={() => {
                  if (
                    !window.confirm(
                      english
                        ? "Archive this contact?"
                        : "确认归档这个联系人吗？",
                    )
                  )
                    return;
                  runAction(
                    () => archiveContactAction(contact.id),
                    english ? "Contact archived" : "联系人已归档",
                  );
                }}
              >
                <Archive className="h-4 w-4" />
                {english ? "Archive contact" : "归档联系人"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="workspace-panel rounded-2xl px-4 py-3">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-medium text-[color:var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="space-y-2 py-5">
        <p className="text-sm text-[color:var(--muted-foreground)]">{label}</p>
        <p className="break-words text-xl font-semibold text-[color:var(--foreground)]">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function stageLabel(
  stage: keyof typeof stageLabels,
  labels: Record<string, string>,
) {
  return labels[stage] ?? stage;
}

function describeCommitmentSource(
  sourceType: string,
  labels: Record<string, string>,
) {
  return labels[sourceType] ?? labels.SYSTEM ?? sourceType;
}
