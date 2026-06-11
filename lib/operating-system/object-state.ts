import { ObjectType } from "@prisma/client";
import type {
  OperatingMeetingMemoryExportPayload,
  OperatingMeetingMemorySourceUseLedger,
  OperatingMeetingMemorySourceUseLedgerEntry,
  OperatingMeetingMemoryAffectedObject,
  OperatingMeetingMemoryBundle,
  OperatingMeetingMemoryGovernanceCue,
  OperatingMeetingMemoryGovernanceSummary,
  OperatingMeetingMemoryItem,
  OperatingMeetingMemoryItemGovernanceSummary,
  OperatingMeetingMemoryLifecycle,
  OperatingMeetingMemoryReviewState,
  OperatingMeetingMemorySourceClass,
  OperatingMeetingTemplateSummary,
  OperatingMeetingWorkspaceLightSummary,
  OperatingObjectState,
  OperatingSkillId,
} from "@/lib/operating-system/types";

type ObjectStateInput = {
  objectType: ObjectType | "WORKSPACE";
  label: string;
  activeFacts: number;
  openCommitments: number;
  overdueCommitments: number;
  openBlockers: number;
  maxBlockerSeverity?: number;
  recentCorrections: number;
  recentAudits: number;
};

function deriveStatus(input: ObjectStateInput): OperatingObjectState["status"] {
  if (input.overdueCommitments > 0 || (input.maxBlockerSeverity ?? 0) >= 75) {
    return "blocked";
  }

  if (input.openBlockers > 0 || input.recentCorrections > 0) {
    return "watch";
  }

  return "healthy";
}

function getSuggestedSkillIds(input: ObjectStateInput): OperatingSkillId[] {
  const skillIds = new Set<OperatingSkillId>();

  if (
    input.objectType === ObjectType.MEETING &&
    (input.activeFacts > 0 ||
      input.openCommitments > 0 ||
      input.openBlockers > 0)
  ) {
    skillIds.add("meeting-briefing");
    skillIds.add("meeting-follow-through");
  }

  if (
    input.objectType === ObjectType.CONTACT ||
    input.objectType === ObjectType.COMPANY
  ) {
    skillIds.add("relationship-revival");
  }

  if (input.objectType === ObjectType.OPPORTUNITY) {
    skillIds.add("opportunity-push");
  }

  if (input.recentCorrections > 0) {
    skillIds.add("memory-correction");
  }

  if (input.overdueCommitments > 0 || (input.maxBlockerSeverity ?? 0) >= 75) {
    skillIds.add("approval-review");
  }

  if (!skillIds.size) {
    skillIds.add("memory-correction");
  }

  return Array.from(skillIds);
}

function buildSummary(input: ObjectStateInput, english = false) {
  const status = deriveStatus(input);

  if (status === "blocked") {
    return english
      ? `${input.label} is already carrying overdue commitments or high-severity blockers, so the next action should leave the note layer and enter explicit execution or review.`
      : `${input.label} 当前已经挂着逾期承诺或高严重度阻塞，下一步不该再停在纪要层，而要进入明确执行或复核。`;
  }

  if (status === "watch") {
    return english
      ? `${input.label} is still accumulating context, but open blockers or recent corrections mean the system should keep it visible before treating it as stable memory.`
      : `${input.label} 还在继续积累上下文，但开放阻塞或最近修正说明它还需要保持可见，不能太早当成稳定记忆。`;
  }

  return english
    ? `${input.label} already has enough stable facts and a relatively clean follow-through state, so the system can safely reuse it downstream.`
    : `${input.label} 已经具备相对稳定的事实和较干净的后续状态，系统可以更放心地在下游复用它。`;
}

export function buildOperatingObjectState(
  input: ObjectStateInput,
  english = false,
): OperatingObjectState {
  return {
    id: `${input.objectType}:${input.label}`,
    label: input.label,
    objectType: input.objectType,
    status: deriveStatus(input),
    summary: buildSummary(input, english),
    activeFacts: input.activeFacts,
    openCommitments: input.openCommitments,
    openBlockers: input.openBlockers,
    overdueCommitments: input.overdueCommitments,
    recentCorrections: input.recentCorrections,
    recentAudits: input.recentAudits,
    suggestedSkillIds: getSuggestedSkillIds(input),
  };
}

type MemoryStateSnapshotInput = {
  memoryEntries: Array<{
    entityType: "CONTACT" | "COMPANY" | "OPPORTUNITY" | "MEETING" | "WORKSPACE";
  }>;
  memoryFacts: Array<{
    objectType:
      | "CONTACT"
      | "COMPANY"
      | "OPPORTUNITY"
      | "MEETING"
      | "WORKSPACE"
      | "ACTION_ITEM"
      | "APPROVAL_TASK"
      | "POLICY_RULE"
      | "EMAIL_THREAD";
  }>;
  commitments: Array<{
    overdueFlag: boolean;
    relatedContact?: { name: string } | null;
    relatedCompany?: { name: string } | null;
    relatedOpportunity?: { title: string } | null;
    relatedMeeting?: { title: string } | null;
  }>;
  blockers: Array<{
    severity: number;
    relatedContact?: { name: string } | null;
    relatedCompany?: { name: string } | null;
    relatedOpportunity?: { title: string } | null;
    relatedMeeting?: { title: string } | null;
  }>;
  corrections: Array<unknown>;
  auditLogs: Array<unknown>;
};

export function buildMemoryObjectStateSnapshots(
  input: MemoryStateSnapshotInput,
  english = false,
) {
  const objectTypes: Array<{
    objectType: ObjectType;
    label: string;
  }> = [
    { objectType: ObjectType.CONTACT, label: english ? "Contacts" : "联系人" },
    { objectType: ObjectType.COMPANY, label: english ? "Companies" : "公司" },
    {
      objectType: ObjectType.OPPORTUNITY,
      label: english ? "Opportunities" : "机会",
    },
    { objectType: ObjectType.MEETING, label: english ? "Meetings" : "会议" },
  ];

  return objectTypes.map(({ objectType, label }) => {
    const activeFacts = input.memoryFacts.filter(
      (fact) => fact.objectType === objectType,
    ).length;
    const openCommitments = input.commitments.filter((commitment) => {
      if (objectType === ObjectType.CONTACT)
        return Boolean(commitment.relatedContact);
      if (objectType === ObjectType.COMPANY)
        return Boolean(commitment.relatedCompany);
      if (objectType === ObjectType.OPPORTUNITY)
        return Boolean(commitment.relatedOpportunity);
      return Boolean(commitment.relatedMeeting);
    }).length;
    const overdueCommitments = input.commitments.filter((commitment) => {
      const matches =
        objectType === ObjectType.CONTACT
          ? Boolean(commitment.relatedContact)
          : objectType === ObjectType.COMPANY
            ? Boolean(commitment.relatedCompany)
            : objectType === ObjectType.OPPORTUNITY
              ? Boolean(commitment.relatedOpportunity)
              : Boolean(commitment.relatedMeeting);

      return matches && commitment.overdueFlag;
    }).length;
    const matchingBlockers = input.blockers.filter((blocker) => {
      if (objectType === ObjectType.CONTACT)
        return Boolean(blocker.relatedContact);
      if (objectType === ObjectType.COMPANY)
        return Boolean(blocker.relatedCompany);
      if (objectType === ObjectType.OPPORTUNITY)
        return Boolean(blocker.relatedOpportunity);
      return Boolean(blocker.relatedMeeting);
    });

    return buildOperatingObjectState(
      {
        objectType,
        label,
        activeFacts:
          activeFacts +
          input.memoryEntries.filter((entry) => entry.entityType === objectType)
            .length,
        openCommitments,
        overdueCommitments,
        openBlockers: matchingBlockers.length,
        maxBlockerSeverity: Math.max(
          0,
          ...matchingBlockers.map((blocker) => blocker.severity),
        ),
        recentCorrections: input.corrections.length,
        recentAudits: input.auditLogs.length,
      },
      english,
    );
  });
}

type MeetingMemoryBundleInput = {
  meeting: {
    id: string;
    title: string;
    summary?: string | null;
    keyDecisions?: string | null;
    openQuestions?: string | null;
    startsAt?: Date | null;
    location?: string | null;
    attendeeNames?: string[];
  };
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
    objectId?: string;
    title: string;
    content: string;
    confidence?: number;
    sourceType?: string | null;
    sourceId?: string | null;
  }>;
  commitments: Array<{
    id: string;
    title: string;
    commitmentText: string;
    status: string;
    dueDate?: Date | null;
    overdueFlag: boolean;
    sourceType?: string | null;
    relatedContact?: { id?: string; name: string } | null;
    relatedCompany?: { id?: string; name: string } | null;
    relatedOpportunity?: { id?: string; title: string } | null;
    relatedMeeting?: { id?: string; title: string } | null;
  }>;
  blockers: Array<{
    id: string;
    title: string;
    blockerType: string;
    blockerText: string;
    severity: number;
    status: string;
    relatedContact?: { id?: string; name: string } | null;
    relatedCompany?: { id?: string; name: string } | null;
    relatedOpportunity?: { id?: string; title: string } | null;
    relatedMeeting?: { id?: string; title: string } | null;
  }>;
  corrections?: Array<{
    id: string;
    correctionType?: string;
    reason?: string | null;
    beforeValue?: string | null;
    afterValue?: string | null;
    memoryFact?: { title: string | null } | null;
  }>;
  memoryEntries?: Array<{
    id: string;
    title: string;
    content: string;
  }>;
  affectedObjects?: OperatingMeetingMemoryAffectedObject[];
};

export function buildMeetingMemoryBundle(
  input: MeetingMemoryBundleInput,
  english = false,
): OperatingMeetingMemoryBundle {
  const affectedObjects = buildAffectedObjectList(
    input.affectedObjects ?? [],
    input.commitments,
    input.blockers,
  );
  const correctionTexts = (input.corrections ?? []).flatMap((correction) =>
    [
      correction.memoryFact?.title,
      correction.reason,
      correction.beforeValue,
      correction.afterValue,
    ].filter((value): value is string => Boolean(value)),
  );
  const relatedThreadFactCount = input.memoryFacts.filter(
    (fact) =>
      fact.objectType === "EMAIL_THREAD" || fact.sourceType === "EMAIL_THREAD",
  ).length;
  const relatedThreadCommitmentCount = input.commitments.filter(
    (commitment) => commitment.sourceType === "EMAIL_THREAD",
  ).length;
  const baseSourcePointer = {
    id: input.meeting.id,
    label: input.meeting.title,
    summary: buildMeetingNoteSourceSummary(input.meeting, english),
  };
  const calendarSourcePointer =
    input.meeting.startsAt ||
    input.meeting.location ||
    (input.meeting.attendeeNames?.length ?? 0) > 0
      ? {
          id: `calendar:${input.meeting.id}`,
          label: english ? "Calendar / event context" : "日程 / 会议上下文",
          summary: buildMeetingCalendarSourceSummary(input.meeting, english),
        }
      : null;
  const threadSourcePointer =
    relatedThreadFactCount > 0 || relatedThreadCommitmentCount > 0
      ? {
          id: `thread:${input.meeting.id}`,
          label: english ? "Related thread context" : "相关邮件线程上下文",
          summary: buildMeetingThreadSourceSummary(
            relatedThreadFactCount,
            relatedThreadCommitmentCount,
            english,
          ),
        }
      : null;
  const affectedObjectSourcePointer = affectedObjects.length
    ? {
        id: `objects:${input.meeting.id}`,
        label: english ? "Affected objects" : "受影响对象",
        summary: buildAffectedObjectSourceSummary(affectedObjects, english),
      }
    : null;

  const facts: OperatingMeetingMemoryItem[] = input.memoryFacts.map((fact) => {
    const lifecycle = hasCorrectionConflict(correctionTexts, [
      fact.title,
      fact.content,
    ])
      ? "conflict"
      : "promoted";
    return {
      id: `fact:${fact.id}`,
      kind: "fact",
      title: fact.title,
      summary: fact.content,
      lifecycle,
      reasonChainSummary:
        lifecycle === "conflict"
          ? english
            ? "This fact is already visible in memory, but a later correction is signaling that it should not be treated as settled yet."
            : "这条事实已经进入记忆层，但后续 修正 说明它还不能被当成稳定结论。"
          : english
            ? "This meeting output is already stored as reusable operating memory and can keep shaping later judgement."
            : "这条会议产出已经进入可复用的 operating 经营记忆，会继续影响后续判断。",
      sourcePointer:
        fact.sourceType === "MEETING_NOTE" || fact.sourceId === input.meeting.id
          ? baseSourcePointer
          : fact.objectType === "EMAIL_THREAD" ||
              fact.sourceType === "EMAIL_THREAD"
            ? (threadSourcePointer ?? baseSourcePointer)
            : {
                id: `${fact.sourceType ?? "memory"}:${fact.sourceId ?? fact.id}`,
                label:
                  fact.sourceType ??
                  (english ? "Structured memory" : "结构化记忆"),
                summary: english
                  ? "Promoted from meeting-adjacent structured memory"
                  : "来自会议相关的结构化记忆",
              },
      affectedObjects: matchAffectedObjects(
        affectedObjects,
        fact.objectType,
        fact.objectId,
      ),
      conflictSummary:
        lifecycle === "conflict"
          ? english
            ? "A correction already touched this fact or an overlapping statement."
            : "已有 修正 命中了这条事实或它的重叠表述。"
          : null,
    };
  });

  const commitments: OperatingMeetingMemoryItem[] = input.commitments.map(
    (commitment) => {
      const hasDownstreamObject = Boolean(
        commitment.relatedOpportunity ||
        commitment.relatedCompany ||
        commitment.relatedContact,
      );
      const lifecycle: OperatingMeetingMemoryLifecycle = commitment.overdueFlag
        ? "pending-review"
        : hasDownstreamObject
          ? "promoted"
          : "ready";
      const targetLabel =
        commitment.relatedOpportunity?.title ??
        commitment.relatedCompany?.name ??
        commitment.relatedContact?.name ??
        commitment.relatedMeeting?.title ??
        input.meeting.title;
      return {
        id: `commitment:${commitment.id}`,
        kind: "commitment",
        title: commitment.title,
        summary: commitment.commitmentText,
        lifecycle,
        reasonChainSummary:
          lifecycle === "promoted"
            ? english
              ? `This commitment is already tied to ${targetLabel} and can keep shaping follow-through there.`
              : `这条承诺已经挂到“${targetLabel}”上，可以继续在该对象里推动 follow-through。`
            : lifecycle === "ready"
              ? english
                ? "The commitment is visible, but it is still mostly attached to the meeting itself and should be promoted into a downstream object carefully."
                : "这条承诺已经可见，但目前还主要挂在会议本身，需要保守地提升到下游对象。"
              : english
                ? "The commitment already exists, but it is still overdue or pressure-heavy, so it should stay visible behind review before being treated as stable memory."
                : "这条承诺虽已存在，但当前仍逾期或压力较高，所以应继续留在复核视野里，而不是当成稳定记忆。",
        sourcePointer: baseSourcePointer,
        affectedObjects: buildRelatedAffectedObjects(
          affectedObjects,
          commitment.relatedContact,
          commitment.relatedCompany,
          commitment.relatedOpportunity,
        ),
        conflictSummary: null,
      };
    },
  );

  const blockers: OperatingMeetingMemoryItem[] = input.blockers.map(
    (blocker) => {
      const hasDownstreamObject = Boolean(
        blocker.relatedOpportunity ||
        blocker.relatedCompany ||
        blocker.relatedContact,
      );
      const lifecycle: OperatingMeetingMemoryLifecycle =
        blocker.severity >= 75
          ? "pending-review"
          : hasDownstreamObject
            ? "promoted"
            : "ready";
      const targetLabel =
        blocker.relatedOpportunity?.title ??
        blocker.relatedCompany?.name ??
        blocker.relatedContact?.name ??
        blocker.relatedMeeting?.title ??
        input.meeting.title;
      return {
        id: `blocker:${blocker.id}`,
        kind: "blocker",
        title: blocker.title,
        summary: blocker.blockerText,
        lifecycle,
        reasonChainSummary:
          lifecycle === "promoted"
            ? english
              ? `This blocker is already attached to ${targetLabel}, so it will continue to shape recommendation and review posture there.`
              : `这条阻塞已经挂到“${targetLabel}”上，所以会继续影响判断建议和复核姿态。`
            : lifecycle === "ready"
              ? english
                ? "The blocker is visible, but it still needs clearer object attribution before it should rewrite downstream state."
                : "这条阻塞已经可见，但在改写下游对象状态之前还需要更清楚的对象归属。"
              : english
                ? "The blocker is severe enough that it should stay explicit behind review before it is treated as settled operating memory."
                : "这条阻塞的严重度已经高到需要继续显式留在复核视野里，不能过早当成稳定经营记忆。",
        sourcePointer: baseSourcePointer,
        affectedObjects: buildRelatedAffectedObjects(
          affectedObjects,
          blocker.relatedContact,
          blocker.relatedCompany,
          blocker.relatedOpportunity,
        ),
        conflictSummary: null,
      };
    },
  );

  const decisionCandidates = parseDecisionLines(input.meeting.keyDecisions);
  const decisions: OperatingMeetingMemoryItem[] = decisionCandidates.map(
    (decision, index) => {
      const hasFactMatch = input.memoryFacts.some((fact) =>
        overlapsMeaning(decision, [fact.title, fact.content]),
      );
      const hasEntryMatch = (input.memoryEntries ?? []).some((entry) =>
        overlapsMeaning(decision, [entry.title, entry.content]),
      );
      const lifecycle: OperatingMeetingMemoryLifecycle = hasCorrectionConflict(
        correctionTexts,
        [decision],
      )
        ? "conflict"
        : hasFactMatch || hasEntryMatch
          ? "promoted"
          : affectedObjects.length
            ? "ready"
            : "pending-review";
      return {
        id: `decision:${index}`,
        kind: "decision",
        title: english ? `Decision ${index + 1}` : `决策 ${index + 1}`,
        summary: decision,
        lifecycle,
        reasonChainSummary:
          lifecycle === "promoted"
            ? english
              ? "The meeting decision already has a matching structured memory trace, so it can be reused downstream."
              : "这条会议决策已经有匹配的结构化记忆痕迹，可以继续被下游复用。"
            : lifecycle === "ready"
              ? english
                ? "The decision is clear, but it has not fully landed in structured memory yet."
                : "这条决策已经清楚，但还没有完全落进结构化记忆。"
              : lifecycle === "conflict"
                ? english
                  ? "A later correction is challenging this decision or its memory trace."
                  : "后续 修正 正在挑战这条决策或它的记忆痕迹。"
                : english
                  ? "The decision is visible in notes, but it should stay explicit until the memory layer catches up."
                  : "这条决策虽然已经在纪要里出现，但在记忆层追上之前仍应保持显式可见。",
        sourcePointer: baseSourcePointer,
        affectedObjects,
        conflictSummary:
          lifecycle === "conflict"
            ? english
              ? "A correction overlaps with this decision statement."
              : "已有 修正 与这条决策表述发生重叠。"
            : null,
      };
    },
  );

  const openQuestions: OperatingMeetingMemoryItem[] = parseDecisionLines(
    input.meeting.openQuestions,
  ).map((question, index) => ({
    id: `open-question:${index}`,
    kind: "open-question",
    title: english ? `Open question ${index + 1}` : `待确认问题 ${index + 1}`,
    summary: question,
    lifecycle: "pending-review",
    reasonChainSummary: english
      ? "This still reads as an unresolved prompt, so it should stay visible before Helm promotes it into object state."
      : "这条内容目前仍更像待确认问题，在 Helm 把它提升成对象状态之前应继续保持可见。",
    sourcePointer: baseSourcePointer,
    affectedObjects,
    conflictSummary: null,
  }));

  const corrections: OperatingMeetingMemoryItem[] = (
    input.corrections ?? []
  ).map((correction) => ({
    id: `correction:${correction.id}`,
    kind: "correction",
    title:
      correction.memoryFact?.title ??
      (english ? "Meeting memory correction" : "会议记忆修正"),
    summary:
      correction.reason ??
      correction.afterValue ??
      correction.beforeValue ??
      (english
        ? "A meeting-derived memory item was corrected."
        : "一条会议相关记忆被修正。"),
    lifecycle: "promoted",
    reasonChainSummary: english
      ? "The correction is already part of the memory trail, so later readers can see why the meeting-derived state changed."
      : "这条 修正 已经进入记忆轨迹，后来的阅读者可以看到会议相关状态为什么会变化。",
    sourcePointer: baseSourcePointer,
    affectedObjects,
    conflictSummary: null,
  }));

  const items = [
    ...facts,
    ...commitments,
    ...blockers,
    ...decisions,
    ...openQuestions,
    ...corrections,
  ];
  const promotedCount = items.filter(
    (item) => item.lifecycle === "promoted",
  ).length;
  const readyCount = items.filter((item) => item.lifecycle === "ready").length;
  const pendingReviewCount = items.filter(
    (item) => item.lifecycle === "pending-review",
  ).length;
  const conflictCount = items.filter(
    (item) => item.lifecycle === "conflict",
  ).length;

  return {
    meetingId: input.meeting.id,
    meetingLabel: input.meeting.title,
    summary: buildMeetingBundleSummary(
      {
        promotedCount,
        readyCount,
        pendingReviewCount,
        conflictCount,
      },
      english,
    ),
    lifecycleSummary: buildMeetingBundleLifecycleSummary(
      {
        commitments: commitments.length,
        blockers: blockers.length,
        decisions: decisions.length,
        corrections: corrections.length,
      },
      english,
    ),
    affectedObjects,
    sourcePointers: uniqueSourcePointers([
      ...items.map((item) => item.sourcePointer),
      ...(calendarSourcePointer ? [calendarSourcePointer] : []),
      ...(threadSourcePointer ? [threadSourcePointer] : []),
      ...(affectedObjectSourcePointer ? [affectedObjectSourcePointer] : []),
    ]),
    facts,
    commitments,
    blockers,
    decisions,
    openQuestions,
    corrections,
    items,
    promotedCount,
    readyCount,
    pendingReviewCount,
    conflictCount,
  };
}

export function buildMeetingMemoryLoopSummary(
  bundle: OperatingMeetingMemoryBundle,
  english = false,
) {
  const dominantState: "promoted" | "pending-review" | "conflict" =
    bundle.conflictCount > 0
      ? "conflict"
      : bundle.pendingReviewCount > 0 || bundle.readyCount > 0
        ? "pending-review"
        : "promoted";
  const blockingLifecycle: OperatingMeetingMemoryLifecycle | null =
    bundle.conflictCount > 0
      ? "conflict"
      : bundle.pendingReviewCount > 0
        ? "pending-review"
        : bundle.readyCount > 0
          ? "ready"
          : null;
  const affectedLabels = bundle.affectedObjects
    .slice(0, 3)
    .map((item) => item.label);
  const lifecycleLabel =
    dominantState === "conflict"
      ? english
        ? "Conflict visible"
        : "存在冲突"
      : dominantState === "pending-review"
        ? english
          ? "Still behind review"
          : "仍在复核后面"
        : english
          ? "Promoted into memory"
          : "已进入对象记忆";
  const blockingLabel =
    blockingLifecycle === "conflict"
      ? english
        ? "Conflict"
        : "冲突"
      : blockingLifecycle === "pending-review"
        ? english
          ? "Pending review"
          : "待复核"
        : blockingLifecycle === "ready"
          ? english
            ? "Ready for promotion"
            : "可继续提升"
          : english
            ? "Already promoted"
            : "已完成提升";

  return {
    dominantState,
    blockingLifecycle,
    lifecycleLabel,
    blockingLabel,
    affectedObjectsLine: affectedLabels.length
      ? english
        ? `Affected objects: ${affectedLabels.join(", ")}.`
        : `受影响对象：${affectedLabels.join("、")}。`
      : english
        ? "No downstream object has been attached yet."
        : "当前还没有挂到明确的下游对象上。",
    nextStepLine:
      blockingLifecycle === "conflict"
        ? english
          ? "Do not silently merge this writeback yet. Keep the correction cue visible and review the meeting-derived memory first."
          : "先不要静默合并这层写回，保留更正线索并先复核会议记忆。"
        : blockingLifecycle === "pending-review"
          ? english
            ? "The next move is still a human review decision, because pressure-heavy meeting memory should stay explicit before it becomes object state."
            : "下一步仍然是人工复核，因为压力较高的会议记忆应继续保持显式，再决定是否进入对象状态。"
          : blockingLifecycle === "ready"
            ? english
              ? "The next move is to confirm whether this meeting-derived memory should be promoted into downstream object state."
              : "下一步是确认这条会议记忆是否该继续提升进下游对象状态。"
            : english
              ? "The meeting writeback is already shaping downstream state, so the next move is to keep the operating loop moving instead of re-explaining the note."
              : "这层会议写回已经开始影响下游对象状态，下一步应继续推进主回路，而不是重新解释纪要。",
    readinessDependencyLine:
      blockingLifecycle === "conflict"
        ? english
          ? "Readiness is currently lowered by visible meeting-memory conflict cues."
          : "当前准备度被会议记忆里的显式冲突线索拉低。"
        : blockingLifecycle === "pending-review"
          ? english
            ? "Readiness is still being held back by meeting memory that should remain behind review."
            : "当前准备度仍被应该留在复核后面的会议记忆拖住。"
          : blockingLifecycle === "ready"
            ? english
              ? "Readiness still depends on whether the ready-to-promote meeting memory is explained clearly enough."
              : "当前准备度仍取决于“可继续提升的会议记忆”是否解释得足够清楚。"
            : english
              ? "Meeting memory is currently helping this loop read as stable and reusable."
              : "当前会议记忆正在帮助这条回路读成稳定且可复用的系统。",
  };
}

export function buildMeetingMemoryGovernanceSummary(
  bundle: OperatingMeetingMemoryBundle,
  english = false,
): OperatingMeetingMemoryGovernanceSummary {
  const visibilityCue: OperatingMeetingMemoryGovernanceCue =
    bundle.conflictCount > 0 || bundle.pendingReviewCount > 0
      ? "review-only"
      : bundle.promotedCount > 0
        ? "promoted-to-object-state"
        : bundle.affectedObjects.length > 0
          ? "shared-with-team"
          : "personal";
  const reviewState: OperatingMeetingMemoryReviewState =
    bundle.conflictCount > 0
      ? "conflict"
      : bundle.pendingReviewCount > 0
        ? "pending-review"
        : bundle.readyCount > 0
          ? "missing-clarity"
          : "promoted-but-boundary-limited";
  const sourceClasses = uniqueSourceClasses(
    bundle.items.map((item) =>
      deriveMeetingMemorySourceClass(item, bundle.meetingId),
    ),
  );

  return {
    visibilityCue,
    visibilityLabel: formatMeetingMemoryGovernanceCue(visibilityCue, english),
    ownershipSummary: buildMeetingMemoryOwnershipSummary(
      visibilityCue,
      english,
    ),
    reviewState,
    reviewStateLabel: formatMeetingMemoryReviewState(reviewState, english),
    reviewSummary: buildMeetingMemoryReviewSummary(reviewState, english),
    sourceClasses,
    sourceClassLabels: sourceClasses.map((item) =>
      formatMeetingMemorySourceClass(item, english),
    ),
    sourceSummary: buildMeetingMemorySourceSummary(sourceClasses, english),
    eligibilitySummary: buildMeetingMemoryEligibilitySummary(
      visibilityCue,
      reviewState,
      bundle,
      english,
    ),
  };
}

export function buildMeetingMemoryItemGovernanceSummary(
  item: OperatingMeetingMemoryItem,
  meetingId: string,
  english = false,
): OperatingMeetingMemoryItemGovernanceSummary {
  const visibilityCue = deriveMeetingMemoryGovernanceCue(item);
  const sourceClass = deriveMeetingMemorySourceClass(item, meetingId);

  return {
    visibilityCue,
    visibilityLabel: formatMeetingMemoryGovernanceCue(visibilityCue, english),
    sourceClass,
    sourceClassLabel: formatMeetingMemorySourceClass(sourceClass, english),
    sourceSummary: buildMeetingMemoryItemSourceSummary(
      sourceClass,
      item,
      english,
    ),
    eligibilitySummary: buildMeetingMemoryItemEligibilitySummary(
      visibilityCue,
      item,
      english,
    ),
  };
}

export function applyMeetingMemoryReviewOnlyOverrides(
  bundle: OperatingMeetingMemoryBundle,
  reviewOnlyItemIds: string[],
  english = false,
): OperatingMeetingMemoryBundle {
  if (!reviewOnlyItemIds.length) {
    return bundle;
  }

  const reviewOnlyItemIdSet = new Set(reviewOnlyItemIds);
  const applyOverride = (item: OperatingMeetingMemoryItem) => {
    if (!reviewOnlyItemIdSet.has(item.id) || item.lifecycle !== "promoted") {
      return item;
    }

    return {
      ...item,
      lifecycle: "pending-review" as const,
      reasonChainSummary: english
        ? `${item.reasonChainSummary} Manual governance hold moved this item back behind review before it can continue shaping object-state memory.`
        : `${item.reasonChainSummary} 当前已由人工治理退回复核后面，在继续影响对象状态记忆前需要再次确认。`,
    };
  };

  const facts = bundle.facts.map(applyOverride);
  const commitments = bundle.commitments.map(applyOverride);
  const blockers = bundle.blockers.map(applyOverride);
  const decisions = bundle.decisions.map(applyOverride);
  const openQuestions = bundle.openQuestions.map(applyOverride);
  const corrections = bundle.corrections.map(applyOverride);
  const items = [
    ...facts,
    ...commitments,
    ...blockers,
    ...decisions,
    ...openQuestions,
    ...corrections,
  ];
  const promotedCount = items.filter(
    (item) => item.lifecycle === "promoted",
  ).length;
  const readyCount = items.filter((item) => item.lifecycle === "ready").length;
  const pendingReviewCount = items.filter(
    (item) => item.lifecycle === "pending-review",
  ).length;
  const conflictCount = items.filter(
    (item) => item.lifecycle === "conflict",
  ).length;

  return {
    ...bundle,
    summary: buildMeetingBundleSummary(
      {
        promotedCount,
        readyCount,
        pendingReviewCount,
        conflictCount,
      },
      english,
    ),
    facts,
    commitments,
    blockers,
    decisions,
    openQuestions,
    corrections,
    items,
    promotedCount,
    readyCount,
    pendingReviewCount,
    conflictCount,
  };
}

export function buildMeetingMemorySourceUseLedger(
  bundle: OperatingMeetingMemoryBundle,
  english = false,
): OperatingMeetingMemorySourceUseLedger {
  const entries = bundle.items.map((item) =>
    buildMeetingMemorySourceUseLedgerEntry(item, bundle.meetingId, english),
  );

  return {
    summary: english
      ? `Helm is currently using ${entries.length} meeting-derived memory traces with explicit source class, review posture and object-state eligibility.`
      : `当前 Helm 正在使用 ${entries.length} 条会议衍生记忆痕迹，并显式标出来源类别、复核姿态和对象状态资格。`,
    entries,
  };
}

export function buildMeetingMemoryExportPayload(
  bundle: OperatingMeetingMemoryBundle,
  english = false,
): OperatingMeetingMemoryExportPayload {
  const governance = buildMeetingMemoryGovernanceSummary(bundle, english);
  const sourceUseLedger = buildMeetingMemorySourceUseLedger(bundle, english);

  return {
    schemaVersion: "meeting-memory-governance-export-v1",
    exportedAt: new Date().toISOString(),
    meeting: {
      id: bundle.meetingId,
      label: bundle.meetingLabel,
      summary: bundle.summary,
      lifecycleSummary: bundle.lifecycleSummary,
    },
    lifecycleCounts: {
      promoted: bundle.promotedCount,
      ready: bundle.readyCount,
      pendingReview: bundle.pendingReviewCount,
      conflict: bundle.conflictCount,
    },
    governance: {
      visibilityCue: governance.visibilityCue,
      visibilityLabel: governance.visibilityLabel,
      ownershipSummary: governance.ownershipSummary,
      reviewState: governance.reviewState,
      reviewStateLabel: governance.reviewStateLabel,
      reviewSummary: governance.reviewSummary,
      sourceClassLabels: governance.sourceClassLabels,
      sourceSummary: governance.sourceSummary,
      eligibilitySummary: governance.eligibilitySummary,
    },
    sourcePointers: bundle.sourcePointers,
    items: sourceUseLedger.entries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      kind: entry.kind,
      kindLabel: entry.kindLabel,
      summary: bundle.items.find((item) => item.id === entry.id)?.summary ?? "",
      lifecycle: entry.lifecycle,
      lifecycleLabel: entry.lifecycleLabel,
      visibilityCue: entry.visibilityCue,
      visibilityLabel: entry.visibilityLabel,
      reviewState: entry.reviewState,
      reviewStateLabel: entry.reviewStateLabel,
      sourceClass: entry.sourceClass,
      sourceClassLabel: entry.sourceClassLabel,
      sourcePointer: {
        id:
          bundle.items.find((item) => item.id === entry.id)?.sourcePointer.id ??
          entry.id,
        label: entry.sourcePointerLabel,
        summary: entry.sourcePointerSummary,
      },
      affectedObjects: entry.affectedObjectLabels,
      reasonChainSummary: entry.reasonChainSummary,
      eligibilitySummary: entry.eligibilitySummary,
      conflictSummary: entry.conflictSummary,
    })),
  };
}

type MeetingTemplateInput = {
  title: string;
  summary?: string | null;
  goal?: string | null;
  opportunityType?: string | null;
  attendeeCount?: number;
  hasOpenFollowThrough?: boolean;
  hasBlockers?: boolean;
};

export function buildMeetingTemplateSummary(
  input: MeetingTemplateInput,
  english = false,
): OperatingMeetingTemplateSummary {
  const normalizedText = [input.title, input.summary, input.goal]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const templateId =
    input.opportunityType === "RECRUITING" ||
    containsMeetingTemplateKeyword(normalizedText, [
      "interview",
      "candidate",
      "候选",
      "面试",
      "shortlist",
      "招聘",
    ])
      ? "interview"
      : containsMeetingTemplateKeyword(normalizedText, [
            "vendor",
            "supplier",
            "procurement",
            "采购",
            "供应商",
            "报价",
            "比选",
          ])
        ? "vendor-review"
        : input.opportunityType === "INTERNAL" ||
            containsMeetingTemplateKeyword(normalizedText, [
              "decision",
              "priority",
              "内部",
              "决策",
              "优先级",
              "治理",
            ])
          ? "internal-decision"
          : containsMeetingTemplateKeyword(normalizedText, [
                "follow-up",
                "follow up",
                "sync",
                "同步",
                "跟进",
                "复盘",
              ]) || input.hasOpenFollowThrough
            ? "follow-up-sync"
            : "customer-call";

  if (templateId === "interview") {
    return {
      templateId,
      label: english ? "Interview" : "面试 / 候选人推进",
      summary: english
        ? "This meeting should read like an interview workspace: candidate signal, loop judgement, and next-step clarity matter more than generic note capture."
        : "这场会议应被读成面试工作台：候选人信号、流程判断和下一步清晰度，比泛化纪要更重要。",
      objectEmphasisLine: english
        ? "Default object emphasis: role, candidate state, interview commitments and interview blockers."
        : "默认对象重心：职位、候选人状态、面试承诺和面试阻塞。",
      nextStepLine: english
        ? "Default next-step frame: lock the strongest interview follow-through without pretending scheduling can auto-run."
        : "默认下一步框架：先锁定最关键的面试 follow-through，但不要假装排期会自动执行。",
      reviewLine: english
        ? "Default review language: candidate-facing or coordination-heavy changes should stay explicit and review-aware."
        : "默认复核语言：面向候选人或协同成本高的变化应继续显式、并保持复核感知。",
    };
  }

  if (templateId === "vendor-review") {
    return {
      templateId,
      label: english ? "Vendor review" : "供应商 / 采购评估",
      summary: english
        ? "This meeting should read like a vendor-review wedge: procurement timing, constraint clarity and commercial risk matter more than generic conversation replay."
        : "这场会议应被读成供应商 / 采购评估 wedge：采购时点、约束清晰度和商业风险，比泛化对话回放更重要。",
      objectEmphasisLine: english
        ? "Default object emphasis: company posture, procurement blockers, decision chain and commercial follow-through."
        : "默认对象重心：公司姿态、采购阻塞、决策链和商业推进。",
      nextStepLine: english
        ? "Default next-step frame: translate the meeting into one explicit procurement-safe follow-through."
        : "默认下一步框架：把会议结论先翻成一条采购安全的显式 follow-through。",
      reviewLine: english
        ? "Default review language: commercial and vendor-facing changes stay boundary-aware by default."
        : "默认复核语言：商业和对供应商可见的变化默认保持边界感知。",
    };
  }

  if (templateId === "internal-decision") {
    return {
      templateId,
      label: english ? "Internal decision" : "内部决策",
      summary: english
        ? "This meeting should read like a decision workspace: decision chain, ownership and blocker relief matter more than polished note-taking."
        : "这场会议应被读成决策工作台：决策链、责任归属和阻塞缓解，比漂亮纪要更重要。",
      objectEmphasisLine: english
        ? "Default object emphasis: decision-linked objects, blocker ownership and downstream review gates."
        : "默认对象重心：与决策相连的对象、阻塞责任归属和下游复核关口。",
      nextStepLine: english
        ? "Default next-step frame: turn the decision into one accountable follow-through before the context diffuses."
        : "默认下一步框架：先把决策收成一条可追责的 follow-through，再防止上下文扩散。",
      reviewLine: english
        ? "Default review language: promoted memory can become shared state, but formal review remains explicit where trust boundaries still matter."
        : "默认复核语言：已提升记忆可以变成共享状态，但只要信任边界仍然重要，正式复核就要继续显式存在。",
    };
  }

  if (templateId === "follow-up-sync") {
    return {
      templateId,
      label: english ? "Follow-up sync" : "跟进同步",
      summary: english
        ? "This meeting should read like a follow-up sync: continuity, pressure carry-over and commitment closure matter more than a fresh blank-page meeting read."
        : "这场会议应被读成跟进同步：连续性、压力延续和承诺收口，比把它当成一场全新的空白会议更重要。",
      objectEmphasisLine: english
        ? "Default object emphasis: continuity across objects, existing commitments and what is still blocking writeback."
        : "默认对象重心：对象连续性、已有承诺，以及还在阻塞写回的部分。",
      nextStepLine: english
        ? "Default next-step frame: close the strongest carry-over item first, then let the loop write back with confidence."
        : "默认下一步框架：先收口最强的延续项，再让回路更有把握地写回。",
      reviewLine: english
        ? "Default review language: review stays explicit when continuity is still pressure-heavy or conflict-sensitive."
        : "默认复核语言：只要连续性仍然压力较高或冲突敏感，复核就必须继续显式存在。",
    };
  }

  return {
    templateId,
    label: english ? "Customer call" : "客户沟通",
    summary: english
      ? "This meeting should read like a customer-call wedge: relationship signal, commercial momentum and the safest next customer-facing move matter first."
      : "这场会议应被读成客户沟通 wedge：关系信号、商业推进节奏和最安全的下一步客户动作最重要。",
    objectEmphasisLine: english
      ? "Default object emphasis: customer-facing objects, opportunity momentum and follow-through blockers."
      : "默认对象重心：面向客户的对象、机会推进节奏和会后阻塞。",
    nextStepLine: english
      ? "Default next-step frame: prepare the sharpest customer-safe follow-through before momentum falls back into notes."
      : "默认下一步框架：先准备最清楚、最客户安全的 follow-through，再避免节奏退回纪要里。",
    reviewLine: english
      ? "Default review language: anything that could look externally committal should remain review-aware."
      : "默认复核语言：任何可能形成对外承诺感的内容，都应继续保持复核感知。",
  };
}

export function buildMeetingWorkspaceLightSummary(
  bundle: OperatingMeetingMemoryBundle,
  english = false,
): OperatingMeetingWorkspaceLightSummary {
  const cues = bundle.items.map(
    (item) =>
      buildMeetingMemoryItemGovernanceSummary(item, bundle.meetingId, english)
        .visibilityCue,
  );
  const personalCount = cues.filter((cue) => cue === "personal").length;
  const sharedCount = cues.filter((cue) => cue === "shared-with-team").length;
  const promotedCount = cues.filter(
    (cue) => cue === "promoted-to-object-state",
  ).length;
  const reviewOnlyCount = cues.filter((cue) => cue === "review-only").length;
  const visibilityCue: OperatingMeetingMemoryGovernanceCue =
    reviewOnlyCount > 0
      ? "review-only"
      : promotedCount > 0
        ? "promoted-to-object-state"
        : sharedCount > 0
          ? "shared-with-team"
          : "personal";

  return {
    visibilityCue,
    visibilityLabel: formatMeetingMemoryGovernanceCue(visibilityCue, english),
    personalCount,
    sharedCount,
    promotedCount,
    reviewOnlyCount,
    summary:
      visibilityCue === "review-only"
        ? english
          ? "This meeting is already team-visible, but the visible workspace still leans on review-only memory. Private by default remains true until the important items clear review."
          : "这场会议已经对团队可读，但当前可见工作台仍以仅复核记忆为主。默认仍是私有起点，只有重要内容越过复核后才会稳定共享。"
        : visibilityCue === "promoted-to-object-state"
          ? english
            ? "This meeting already behaves like shared operating memory: the strongest items have moved beyond local notes into reusable object state."
            : "这场会议已经开始像共享运营记忆：最关键的条目已经越过局部纪要，进入可复用对象状态。"
          : visibilityCue === "shared-with-team"
            ? english
              ? "This meeting has already moved beyond personal notes into shared team context, even though not everything is yet promoted."
              : "这场会议已经越过个人笔记，进入团队共享上下文，只是还不是所有内容都已经提升。"
            : english
              ? "This meeting still starts private-by-default, so readers should treat it as local context before assuming shared state."
              : "这场会议当前仍以默认私有起点为主，所以阅读者应先把它当成本地上下文，而不是直接当成共享状态。",
    collaborationLine:
      visibilityCue === "review-only"
        ? english
          ? "Collaborators can already read the shared context here, but the strongest meeting-derived items should still be discussed as review posture, not as settled shared memory."
          : "协作者现在已经能读到共享上下文，但最关键的会议产出仍应被读成复核姿态，而不是已经稳定的共享记忆。"
        : visibilityCue === "promoted-to-object-state"
          ? english
            ? "Collaborators can already use this meeting as a shared workspace because promoted items are shaping downstream object state."
            : "协作者现在已经可以把这场会议当成共享工作台，因为已提升条目正在影响下游对象状态。"
          : visibilityCue === "shared-with-team"
            ? english
              ? "Collaborators can read the meeting together now, but some of the shared context still needs clearer wording before it becomes trusted memory."
              : "协作者已经可以一起读这场会议，但部分共享上下文在变成可信记忆前仍需要更清楚的措辞。"
            : english
              ? "This meeting still reads mostly as local context, so collaboration should start from clarification before assuming team-wide memory."
              : "这场会议当前仍主要像局部上下文，所以协作应先从澄清开始，而不是直接假设它已经是团队记忆。",
  };
}

function buildMeetingMemorySourceUseLedgerEntry(
  item: OperatingMeetingMemoryItem,
  meetingId: string,
  english: boolean,
): OperatingMeetingMemorySourceUseLedgerEntry {
  const governance = buildMeetingMemoryItemGovernanceSummary(
    item,
    meetingId,
    english,
  );
  const reviewState = deriveMeetingMemoryItemReviewState(item);

  return {
    id: item.id,
    title: item.title,
    kind: item.kind,
    kindLabel: formatMeetingMemoryKind(item.kind, english),
    lifecycle: item.lifecycle,
    lifecycleLabel: formatMeetingMemoryLifecycle(item.lifecycle, english),
    visibilityCue: governance.visibilityCue,
    visibilityLabel: governance.visibilityLabel,
    reviewState,
    reviewStateLabel: formatMeetingMemoryReviewState(reviewState, english),
    sourceClass: governance.sourceClass,
    sourceClassLabel: governance.sourceClassLabel,
    sourcePointerLabel: item.sourcePointer.label,
    sourcePointerSummary: item.sourcePointer.summary,
    affectedObjectLabels: item.affectedObjects.map(
      (affected) => affected.label,
    ),
    reasonChainSummary: item.reasonChainSummary,
    eligibilitySummary: governance.eligibilitySummary,
    conflictSummary: item.conflictSummary,
  };
}

function buildMeetingBundleSummary(
  input: {
    promotedCount: number;
    readyCount: number;
    pendingReviewCount: number;
    conflictCount: number;
  },
  english: boolean,
) {
  return english
    ? `This meeting already produced ${input.promotedCount} promoted memory items, ${input.readyCount} items ready for promotion, ${input.pendingReviewCount} items that should stay behind review, and ${input.conflictCount} visible conflict cues.`
    : `这场会议当前已经产出 ${input.promotedCount} 条已提升记忆、${input.readyCount} 条可继续提升项目、${input.pendingReviewCount} 条仍应留在复核后面的项目，以及 ${input.conflictCount} 条显式冲突线索。`;
}

function buildMeetingBundleLifecycleSummary(
  input: {
    commitments: number;
    blockers: number;
    decisions: number;
    corrections: number;
  },
  english: boolean,
) {
  return english
    ? `${input.commitments} commitments, ${input.blockers} blockers, ${input.decisions} decisions and ${input.corrections} corrections are now part of the meeting memory lifecycle.`
    : `当前已有 ${input.commitments} 条承诺、${input.blockers} 条阻塞、${input.decisions} 条决策和 ${input.corrections} 条修正进入会议记忆生命周期。`;
}

function deriveMeetingMemoryGovernanceCue(
  item: OperatingMeetingMemoryItem,
): OperatingMeetingMemoryGovernanceCue {
  if (item.lifecycle === "promoted") {
    return "promoted-to-object-state";
  }
  if (item.lifecycle === "pending-review" || item.lifecycle === "conflict") {
    return "review-only";
  }
  if (item.affectedObjects.length > 0) {
    return "shared-with-team";
  }
  return "personal";
}

function deriveMeetingMemoryItemReviewState(
  item: OperatingMeetingMemoryItem,
): OperatingMeetingMemoryReviewState {
  if (item.lifecycle === "conflict") {
    return "conflict";
  }
  if (item.lifecycle === "pending-review") {
    return "pending-review";
  }
  if (item.lifecycle === "ready") {
    return "missing-clarity";
  }
  return "promoted-but-boundary-limited";
}

function formatMeetingMemoryLifecycle(
  lifecycle: OperatingMeetingMemoryLifecycle,
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
  kind: OperatingMeetingMemoryItem["kind"],
  english: boolean,
) {
  if (kind === "fact") return english ? "Fact" : "事实";
  if (kind === "commitment") return english ? "Commitment" : "承诺";
  if (kind === "blocker") return english ? "Blocker" : "阻塞";
  if (kind === "decision") return english ? "Decision" : "决策";
  if (kind === "open-question") {
    return english ? "Open question" : "待确认问题";
  }
  return english ? "Correction" : "修正";
}

function deriveMeetingMemorySourceClass(
  item: OperatingMeetingMemoryItem,
  meetingId: string,
): OperatingMeetingMemorySourceClass {
  if (
    item.kind === "commitment" ||
    item.kind === "blocker" ||
    item.kind === "decision" ||
    item.kind === "open-question"
  ) {
    return "blockers-commitments-decisions";
  }
  if (item.lifecycle === "promoted") {
    return "promoted-meeting-memory";
  }
  if (
    item.sourcePointer.id === meetingId ||
    /会议纪要|Meeting note/i.test(item.sourcePointer.summary)
  ) {
    return "meeting-notes";
  }
  if (item.affectedObjects.length > 0) {
    return "connected-objects";
  }
  return "meeting-notes";
}

function formatMeetingMemoryGovernanceCue(
  cue: OperatingMeetingMemoryGovernanceCue,
  english: boolean,
) {
  if (cue === "personal") {
    return english ? "Personal" : "个人可见";
  }
  if (cue === "shared-with-team") {
    return english ? "Shared with team" : "团队可见";
  }
  if (cue === "promoted-to-object-state") {
    return english ? "Promoted to object state" : "已提升进对象状态";
  }
  return english ? "Review-only" : "仅供复核";
}

function formatMeetingMemoryReviewState(
  state: OperatingMeetingMemoryReviewState,
  english: boolean,
) {
  if (state === "conflict") {
    return english ? "Conflict-sensitive" : "冲突敏感";
  }
  if (state === "pending-review") {
    return english ? "Pending review" : "待复核";
  }
  if (state === "missing-clarity") {
    return english ? "Missing clarity" : "仍缺清晰度";
  }
  return english
    ? "Promoted but still boundary-limited"
    : "已提升但仍受边界限制";
}

function formatMeetingMemorySourceClass(
  sourceClass: OperatingMeetingMemorySourceClass,
  english: boolean,
) {
  if (sourceClass === "meeting-notes") {
    return english ? "Meeting notes" : "会议纪要";
  }
  if (sourceClass === "connected-objects") {
    return english ? "Connected objects" : "关联对象";
  }
  if (sourceClass === "promoted-meeting-memory") {
    return english ? "Promoted meeting memory" : "已提升会议记忆";
  }
  return english ? "Blockers / commitments / decisions" : "阻塞 / 承诺 / 决策";
}

function buildMeetingMemoryOwnershipSummary(
  cue: OperatingMeetingMemoryGovernanceCue,
  english: boolean,
) {
  if (cue === "personal") {
    return english
      ? "This meeting-derived item still reads like local meeting context and should not yet be treated as team-facing operating state."
      : "这条会议产出当前更像局部会议上下文，还不应被当成团队可复用的运营状态。";
  }
  if (cue === "shared-with-team") {
    return english
      ? "This meeting-derived item is already connected to downstream objects, so collaborators can read it as shared operating context."
      : "这条会议产出已经挂到下游对象上，所以协作者可以把它当成共享运营上下文来读。";
  }
  if (cue === "promoted-to-object-state") {
    return english
      ? "This meeting-derived item is already promoted into object-state memory, so later readers should see it as reusable workspace judgement."
      : "这条会议产出已经进入对象状态记忆，后续阅读者应把它视为可复用的工作台判断。";
  }
  return english
    ? "This meeting-derived item should stay visible for review, not be mistaken for settled team memory."
    : "这条会议产出当前应留在复核视野里，不能误读成已经稳定的团队记忆。";
}

function buildMeetingMemoryReviewSummary(
  state: OperatingMeetingMemoryReviewState,
  english: boolean,
) {
  if (state === "conflict") {
    return english
      ? "A later correction or overlapping statement is challenging the current writeback, so this item should remain explicit until the conflict is reviewed."
      : "后续更正或重叠表述正在挑战当前写回，所以这条内容要继续显式保留，直到冲突完成复核。";
  }
  if (state === "pending-review") {
    return english
      ? "This item is still pressure-heavy enough that it should remain review-only before it becomes trusted operating memory."
      : "这条内容当前压力仍然较高，所以在它变成可信运营记忆之前，应继续停留在仅复核状态。";
  }
  if (state === "missing-clarity") {
    return english
      ? "The item may be promotable, but object attribution or wording is still not clear enough to treat it as settled state."
      : "这条内容也许已经接近可提升，但对象归属或措辞还不够清楚，不能直接当成稳定状态。";
  }
  return english
    ? "The memory itself is already promoted, but downstream actions can still remain behind boundary review."
    : "这层记忆本身虽然已经提升成功，但下游动作仍可能继续停在边界复核后面。";
}

function buildMeetingMemorySourceSummary(
  sourceClasses: OperatingMeetingMemorySourceClass[],
  english: boolean,
) {
  if (!sourceClasses.length) {
    return english
      ? "No explicit source posture is visible yet."
      : "当前还没有显式来源姿态。";
  }

  return english
    ? `Helm is currently using ${sourceClasses
        .map((item) => formatMeetingMemorySourceClass(item, true))
        .join(", ")} inside this meeting wedge.`
    : `当前 Helm 在这条会议切片里使用的来源包括：${sourceClasses
        .map((item) => formatMeetingMemorySourceClass(item, false))
        .join("、")}。`;
}

function buildMeetingMemoryEligibilitySummary(
  cue: OperatingMeetingMemoryGovernanceCue,
  reviewState: OperatingMeetingMemoryReviewState,
  bundle: OperatingMeetingMemoryBundle,
  english: boolean,
) {
  if (cue === "promoted-to-object-state") {
    return english
      ? `This bundle is already eligible for object-state use because ${bundle.promotedCount} meeting-derived items have landed in reusable memory.`
      : `这组会议记忆当前已经具备对象状态使用资格，因为已有 ${bundle.promotedCount} 条会议产出落进了可复用记忆。`;
  }
  if (reviewState === "missing-clarity") {
    return english
      ? "This bundle is only partly eligible right now: promotion candidates are visible, but their object-state explanation still needs tightening."
      : "这组会议记忆当前只算部分可用：提升候选已经可见，但它们进入对象状态的解释还需要继续收紧。";
  }
  if (reviewState === "conflict") {
    return english
      ? "This bundle is not yet safely eligible for object-state use, because visible conflict cues mean the writeback should not be treated as settled."
      : "这组会议记忆当前还不能安全进入对象状态，因为显式冲突线索说明它的写回还不能算稳定。";
  }
  return english
    ? "This bundle is still review-first, so only the clearly grounded parts should shape downstream object-state use."
    : "这组会议记忆当前仍以先复核为主，所以只有依据足够明确的部分才应继续影响下游对象状态。";
}

function buildMeetingMemoryItemSourceSummary(
  sourceClass: OperatingMeetingMemorySourceClass,
  item: OperatingMeetingMemoryItem,
  english: boolean,
) {
  if (sourceClass === "meeting-notes") {
    return english
      ? `This item is still mainly justified by meeting-note evidence: ${item.sourcePointer.label}.`
      : `这条内容当前主要由会议纪要证据支撑：${item.sourcePointer.label}。`;
  }
  if (sourceClass === "connected-objects") {
    return english
      ? "This item is already leaning on connected downstream objects, so collaborators can read it as shared operating context."
      : "这条内容已经开始依赖关联下游对象，因此协作者可以把它读成共享运营上下文。";
  }
  if (sourceClass === "promoted-meeting-memory") {
    return english
      ? "This item already has a structured memory trace, so Helm is reusing promoted meeting memory instead of raw note text."
      : "这条内容已经有结构化记忆痕迹，所以 Helm 用的是已提升的会议记忆，而不只是原始纪要文本。";
  }
  return english
    ? "This item is grounded in blockers, commitments or decisions that already shape the meeting follow-through loop."
    : "这条内容当前由阻塞、承诺或决策支撑，并且已经在影响会议后续动作回路。";
}

function buildMeetingMemoryItemEligibilitySummary(
  cue: OperatingMeetingMemoryGovernanceCue,
  item: OperatingMeetingMemoryItem,
  english: boolean,
) {
  if (cue === "promoted-to-object-state") {
    return english
      ? "This item is already eligible for object-state use because it has landed in promoted meeting memory."
      : "这条内容当前已经具备对象状态使用资格，因为它已经进入已提升的会议记忆。";
  }
  if (cue === "review-only") {
    return english
      ? "This item is not yet eligible for direct object-state use because it should remain behind review."
      : "这条内容当前还不适合直接用于对象状态，因为它仍应继续停留在复核后面。";
  }
  if (cue === "shared-with-team") {
    return english
      ? "This item is already team-visible, but it still needs clearer wording before being treated as settled object-state memory."
      : "这条内容当前已经对团队可见，但在被当成稳定对象状态前仍需要更清楚的措辞。";
  }
  return english
    ? "This item is still meeting-local and should not yet be treated as shared object-state memory."
    : "这条内容当前仍停留在会议局部范围里，还不应被当成共享对象状态记忆。";
}

function buildMeetingNoteSourceSummary(
  meeting: MeetingMemoryBundleInput["meeting"],
  english: boolean,
) {
  const parts = [
    formatMeetingIngressDate(meeting.startsAt, english),
    meeting.location,
  ].filter(Boolean);

  return parts.length
    ? english
      ? `Meeting note source for this scheduled event: ${parts.join(" · ")}.`
      : `这条会议纪要来源于当前日程事件：${parts.join(" · ")}。`
    : english
      ? "Meeting note source"
      : "会议纪要来源";
}

function buildMeetingCalendarSourceSummary(
  meeting: MeetingMemoryBundleInput["meeting"],
  english: boolean,
) {
  const parts = [
    formatMeetingIngressDate(meeting.startsAt, english),
    meeting.location,
    (meeting.attendeeNames?.length ?? 0) > 0
      ? english
        ? `${meeting.attendeeNames?.length ?? 0} attendees`
        : `${meeting.attendeeNames?.length ?? 0} 位参与者`
      : null,
  ].filter(Boolean);

  return parts.length
    ? english
      ? `Calendar/event context already visible: ${parts.join(" · ")}.`
      : `当前已可见日程 / 会议上下文：${parts.join(" · ")}。`
    : english
      ? "Calendar/event context is available for this meeting."
      : "当前这场会议已经带着日程 / 会议上下文。";
}

function buildMeetingThreadSourceSummary(
  relatedThreadFactCount: number,
  relatedThreadCommitmentCount: number,
  english: boolean,
) {
  return english
    ? `Related inbox pressure is visible through ${relatedThreadFactCount} thread-linked facts and ${relatedThreadCommitmentCount} thread-linked commitments.`
    : `当前已能看到相关邮件线程压力：${relatedThreadFactCount} 条线程事实，${relatedThreadCommitmentCount} 条线程承诺。`;
}

function buildAffectedObjectSourceSummary(
  affectedObjects: OperatingMeetingMemoryAffectedObject[],
  english: boolean,
) {
  const labels = affectedObjects.slice(0, 4).map((item) => item.label);

  return labels.length
    ? english
      ? `This meeting is already writing toward ${labels.join(", ")}.`
      : `这场会议当前已经在朝这些对象写回：${labels.join("、")}。`
    : english
      ? "No affected object is visible yet."
      : "当前还没有显式受影响对象。";
}

function formatMeetingIngressDate(
  date: Date | null | undefined,
  english: boolean,
) {
  if (!date || Number.isNaN(date.getTime())) {
    // A Date parsed from a malformed ingress timestamp is non-null but NaN;
    // toLocaleString would render the literal "Invalid Date" into the
    // user-facing meeting-note / calendar source summary. Drop it instead.
    return null;
  }

  return date.toLocaleString(english ? "en-US" : "zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function containsMeetingTemplateKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function uniqueSourceClasses(items: OperatingMeetingMemorySourceClass[]) {
  return Array.from(new Set(items));
}

function buildAffectedObjectList(
  seedObjects: OperatingMeetingMemoryAffectedObject[],
  commitments: MeetingMemoryBundleInput["commitments"],
  blockers: MeetingMemoryBundleInput["blockers"],
) {
  const map = new Map<string, OperatingMeetingMemoryAffectedObject>();

  seedObjects.forEach((item) => {
    map.set(`${item.objectType}:${item.id}`, item);
  });

  commitments.forEach((commitment) => {
    if (commitment.relatedOpportunity?.id) {
      map.set(`OPPORTUNITY:${commitment.relatedOpportunity.id}`, {
        id: commitment.relatedOpportunity.id,
        objectType: ObjectType.OPPORTUNITY,
        label: commitment.relatedOpportunity.title,
      });
    }
    if (commitment.relatedCompany?.id) {
      map.set(`COMPANY:${commitment.relatedCompany.id}`, {
        id: commitment.relatedCompany.id,
        objectType: ObjectType.COMPANY,
        label: commitment.relatedCompany.name,
      });
    }
    if (commitment.relatedContact?.id) {
      map.set(`CONTACT:${commitment.relatedContact.id}`, {
        id: commitment.relatedContact.id,
        objectType: ObjectType.CONTACT,
        label: commitment.relatedContact.name,
      });
    }
  });

  blockers.forEach((blocker) => {
    if (blocker.relatedOpportunity?.id) {
      map.set(`OPPORTUNITY:${blocker.relatedOpportunity.id}`, {
        id: blocker.relatedOpportunity.id,
        objectType: ObjectType.OPPORTUNITY,
        label: blocker.relatedOpportunity.title,
      });
    }
    if (blocker.relatedCompany?.id) {
      map.set(`COMPANY:${blocker.relatedCompany.id}`, {
        id: blocker.relatedCompany.id,
        objectType: ObjectType.COMPANY,
        label: blocker.relatedCompany.name,
      });
    }
    if (blocker.relatedContact?.id) {
      map.set(`CONTACT:${blocker.relatedContact.id}`, {
        id: blocker.relatedContact.id,
        objectType: ObjectType.CONTACT,
        label: blocker.relatedContact.name,
      });
    }
  });

  return Array.from(map.values());
}

function buildRelatedAffectedObjects(
  availableObjects: OperatingMeetingMemoryAffectedObject[],
  relatedContact?: { id?: string; name: string } | null,
  relatedCompany?: { id?: string; name: string } | null,
  relatedOpportunity?: { id?: string; title: string } | null,
) {
  const objectKeys = [
    relatedContact?.id ? `CONTACT:${relatedContact.id}` : null,
    relatedCompany?.id ? `COMPANY:${relatedCompany.id}` : null,
    relatedOpportunity?.id ? `OPPORTUNITY:${relatedOpportunity.id}` : null,
  ].filter((value): value is string => Boolean(value));

  if (!objectKeys.length) {
    return availableObjects;
  }

  const selected = availableObjects.filter((item) =>
    objectKeys.includes(`${item.objectType}:${item.id}`),
  );
  return selected.length ? selected : availableObjects;
}

function matchAffectedObjects(
  availableObjects: OperatingMeetingMemoryAffectedObject[],
  objectType?: string,
  objectId?: string,
) {
  if (!objectType || !objectId) {
    return availableObjects;
  }

  const matched = availableObjects.filter(
    (item) => item.objectType === objectType && item.id === objectId,
  );
  return matched.length ? matched : availableObjects;
}

function parseDecisionLines(input?: string | null) {
  return (input ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueSourcePointers(
  items: OperatingMeetingMemoryItem["sourcePointer"][],
) {
  const map = new Map<string, OperatingMeetingMemoryItem["sourcePointer"]>();
  items.forEach((item) => {
    map.set(item.id, item);
  });
  return Array.from(map.values());
}

function hasCorrectionConflict(correctionTexts: string[], values: string[]) {
  return correctionTexts.some((correctionText) =>
    overlapsMeaning(correctionText, values),
  );
}

function overlapsMeaning(
  baseText: string,
  comparisons: Array<string | null | undefined>,
) {
  const base = normalizeMeaning(baseText);
  if (!base) return false;

  return comparisons.some((comparison) => {
    const normalized = normalizeMeaning(comparison);
    if (!normalized) return false;
    if (base.length >= 8 && normalized.includes(base)) return true;
    if (normalized.length >= 8 && base.includes(normalized)) return true;
    return false;
  });
}

function normalizeMeaning(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[《》"'`“”‘’：:，,。.!?？、；;\s]/g, "")
    .trim();
}
