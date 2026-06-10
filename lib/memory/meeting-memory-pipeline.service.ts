import { ActionExecutionMode, ActionStatus, ActionType, ActorType, MemoryEntityType, MemoryRelationType, MemoryType, type ObjectType, RiskLevel, SourceType } from "@prisma/client";
import { assertWorkspaceMemoryServiceAccess } from "@/lib/auth/service-governance";
import { generatePostMeetingActionSuggestions } from "@/lib/ai";
import { db } from "@/lib/db";
import { processMeetingMemoryWithLLM } from "@/lib/llm-workflows/process-meeting-memory.workflow";
import { generateMeetingBriefingSnapshot } from "@/lib/memory/briefing.service";
import { createBlocker } from "@/lib/memory/blocker.service";
import { extractMeetingBlockerDrafts } from "@/lib/memory/blocker-extraction.service";
import { createCommitment } from "@/lib/memory/commitment.service";
import { extractMeetingCommitmentDrafts } from "@/lib/memory/commitment-extraction.service";
import { syncMemoryDistillationCandidatesForObject } from "@/lib/memory/distillation-candidate-store";
import { extractMeetingFactDrafts } from "@/lib/memory/fact-extraction.service";
import { createMemoryFactsWithWriteResult } from "@/lib/memory/memory-fact.service";
import { type MemoryActorContext, writeMemoryAuditAndEvent } from "@/lib/memory/shared";
import { buildMemoryFactWritePlan } from "@/lib/memory/write-dedupe";

const DISTILLATION_SYNC_OBJECT_LIMIT = 8;
const DISTILLATION_SYNC_BOUNDARY_NOTE =
  "Memory distillation candidate sync only writes review-required candidate records; " +
  "it does not write canonical facts, does not auto-promote memory, and does not change recommendation ranking.";

type MemoryFactObjectRef = {
  objectType: ObjectType;
  objectId: string | null;
};

type MeetingMemoryDistillationCandidateSyncSummary = {
  objectCount: number;
  candidateCount: number;
  createdCount: number;
  updatedCount: number;
  omittedCount: number;
  skippedReviewedCount: number;
  failureCount: number;
  failures: Array<{
    objectType: ObjectType;
    objectId: string;
    reason: string;
  }>;
  boundaryNote: string;
};

function trimSummary(input?: string | null) {
  return input?.trim() || "会议已处理为结构化工作记忆。";
}

function uniqueFactObjectRefs(facts: MemoryFactObjectRef[]) {
  const seen = new Set<string>();
  const refs: Array<{ objectType: ObjectType; objectId: string }> = [];

  for (const fact of facts) {
    if (!fact.objectId) continue;
    const key = `${fact.objectType}:${fact.objectId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ objectType: fact.objectType, objectId: fact.objectId });
    if (refs.length >= DISTILLATION_SYNC_OBJECT_LIMIT) break;
  }

  return refs;
}

async function syncDistillationCandidatesForMeetingFacts(
  input: MemoryActorContext,
  facts: MemoryFactObjectRef[],
): Promise<MeetingMemoryDistillationCandidateSyncSummary> {
  const objectRefs = uniqueFactObjectRefs(facts);
  const summary: MeetingMemoryDistillationCandidateSyncSummary = {
    objectCount: objectRefs.length,
    candidateCount: 0,
    createdCount: 0,
    updatedCount: 0,
    omittedCount: 0,
    skippedReviewedCount: 0,
    failureCount: 0,
    failures: [],
    boundaryNote: DISTILLATION_SYNC_BOUNDARY_NOTE,
  };

  for (const objectRef of objectRefs) {
    try {
      const objectSummary = await syncMemoryDistillationCandidatesForObject({
        ...input,
        objectType: objectRef.objectType,
        objectId: objectRef.objectId,
      });
      summary.candidateCount += objectSummary.candidateCount;
      summary.createdCount += objectSummary.createdCount;
      summary.updatedCount += objectSummary.updatedCount;
      summary.omittedCount += objectSummary.omittedCount;
      summary.skippedReviewedCount += objectSummary.skippedReviewedCount;
    } catch (error) {
      summary.failureCount += 1;
      summary.failures.push({
        objectType: objectRef.objectType,
        objectId: objectRef.objectId,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return summary;
}

export async function processMeetingMemory(input: MemoryActorContext & { meetingId: string; force?: boolean }) {
  await assertWorkspaceMemoryServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    actorType: input.actorType,
    english: input.english ?? false,
  });

  const meeting = await db.meeting.findFirst({
    where: {
      workspaceId: input.workspaceId,
      id: input.meetingId,
    },
    include: {
      contacts: true,
      note: true,
      opportunity: true,
      company: true,
      actionItems: true,
    },
  });

  if (!meeting || !meeting.note) {
    throw new Error("会议纪要不存在");
  }

  const [existingFacts, existingCommitments, existingBlockers] = await Promise.all([
    db.memoryFact.findMany({
      where: {
        workspaceId: input.workspaceId,
        sourceType: SourceType.MEETING_NOTE,
        sourceId: meeting.id,
      },
    }),
    db.commitment.findMany({
      where: {
        workspaceId: input.workspaceId,
        sourceType: SourceType.MEETING_NOTE,
        sourceId: meeting.id,
      },
    }),
    db.blocker.findMany({
      where: {
        workspaceId: input.workspaceId,
        sourceType: SourceType.MEETING_NOTE,
        sourceId: meeting.id,
      },
    }),
  ]);

  const fallbackFactDrafts = extractMeetingFactDrafts({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType ?? ActorType.SYSTEM,
    sourcePage: input.sourcePage,
    meeting: {
      id: meeting.id,
      title: meeting.title,
      startsAt: meeting.startsAt,
      companyId: meeting.companyId,
      opportunityId: meeting.opportunityId,
      contacts: meeting.contacts.map((contact) => ({ id: contact.id, name: contact.name })),
      note: meeting.note,
    },
  });
  const fallbackCommitmentDrafts = extractMeetingCommitmentDrafts({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType ?? ActorType.SYSTEM,
    sourcePage: input.sourcePage,
    meeting: {
      id: meeting.id,
      startsAt: meeting.startsAt,
      companyId: meeting.companyId,
      opportunityId: meeting.opportunityId,
      ownerId: meeting.ownerId,
      contacts: meeting.contacts.map((contact) => ({ id: contact.id, name: contact.name })),
      note: meeting.note,
    },
  });
  const fallbackBlockerDrafts = extractMeetingBlockerDrafts({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType ?? ActorType.SYSTEM,
    sourcePage: input.sourcePage,
    meeting: {
      id: meeting.id,
      opportunityId: meeting.opportunityId,
      companyId: meeting.companyId,
      contacts: meeting.contacts.map((contact) => ({ id: contact.id, name: contact.name })),
      note: meeting.note,
    },
  });
  const fallbackActionSuggestions =
    meeting.actionItems.length === 0
      ? generatePostMeetingActionSuggestions({
          opportunity: meeting.opportunity
            ? {
                type: meeting.opportunity.type,
                stage: meeting.opportunity.stage,
                riskLevel: meeting.opportunity.riskLevel,
                nextAction: meeting.opportunity.nextAction,
              }
            : null,
          note: meeting.note,
        })
      : [];

  const llmExtraction = await processMeetingMemoryWithLLM({
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    meeting: {
      id: meeting.id,
      title: meeting.title,
      startsAt: meeting.startsAt,
      companyId: meeting.companyId,
      companyName: meeting.company?.name,
      opportunityId: meeting.opportunityId,
      opportunityTitle: meeting.opportunity?.title,
      ownerId: meeting.ownerId,
      contacts: meeting.contacts.map((contact) => ({ id: contact.id, name: contact.name })),
      note: meeting.note,
    },
    fallback: {
      summary: trimSummary(meeting.note.summary ?? meeting.note.keyDecisions ?? meeting.note.confirmations),
      facts: fallbackFactDrafts,
      commitments: fallbackCommitmentDrafts,
      blockers: fallbackBlockerDrafts,
      candidateActions: fallbackActionSuggestions,
    },
  });

  const factDrafts = llmExtraction.output.facts;
  const factWritePlan = buildMemoryFactWritePlan({
    drafts: factDrafts.map((draft) => ({
      ...draft,
      english: input.english,
    })),
    existingFacts,
  });
  const factWriteResult = await createMemoryFactsWithWriteResult({
    facts: factWritePlan.createDrafts,
  });
  const createdFacts = factWriteResult.created;

  if (factWriteResult.failures.length > 0) {
    await writeMemoryAuditAndEvent({
      workspaceId: input.workspaceId,
      actorName: input.actorName,
      actorUserId: input.actorUserId,
      actorType: input.actorType ?? ActorType.SYSTEM,
      sourcePage: input.sourcePage,
      actionType: "MEETING_MEMORY_FACT_WRITE_FAILED",
      targetType: "Meeting",
      targetId: meeting.id,
      summary: `会议记忆事实写入失败：${meeting.title}`,
      eventName: "meeting_memory_fact_write_failed",
      eventCategory: "memory",
      metadata: {
        meetingId: meeting.id,
        memoryWriteGuard: factWritePlan.summary,
        memoryWriteBatch: factWriteResult.summary,
        duplicateSuppressions: factWritePlan.duplicateSuppressions.slice(0, 12),
        conflictCandidates: factWritePlan.conflictCandidates.slice(0, 12),
        factWriteFailures: factWriteResult.failures.slice(0, 12),
        boundaryNote:
          "Fact write failures block the remaining meeting memory pipeline until retry or operator review; this does not rewrite canonical facts or change recommendation / commitment authority.",
      },
    }).catch(() => null);

    const firstFailure = factWriteResult.failures[0];
    throw new Error(
      input.english
        ? `Meeting memory fact write failed (${firstFailure.failureClass}:${firstFailure.reason})`
        : `会议记忆事实写入失败（${firstFailure.failureClass}:${firstFailure.reason}）`,
    );
  }

  const commitmentDrafts = llmExtraction.output.commitments;
  const existingCommitmentKeys = new Set(existingCommitments.map((item) => item.commitmentText));
  const createdCommitments = [];
  for (const draft of commitmentDrafts) {
    if (existingCommitmentKeys.has(draft.commitmentText)) continue;
    // Track within-batch too: two LLM drafts with identical text would both
    // pass the DB-only check and be persisted as duplicates otherwise.
    existingCommitmentKeys.add(draft.commitmentText);
    createdCommitments.push(
      await createCommitment({
        ...draft,
        english: input.english,
        suppressEvolutionRefresh: input.suppressEvolutionRefresh,
      }),
    );
  }

  const blockerDrafts = llmExtraction.output.blockers;
  const existingBlockerKeys = new Set(existingBlockers.map((item) => item.blockerText));
  const createdBlockers = [];
  for (const draft of blockerDrafts) {
    if (existingBlockerKeys.has(draft.blockerText)) continue;
    existingBlockerKeys.add(draft.blockerText);
    createdBlockers.push(
      await createBlocker({
        ...draft,
        english: input.english,
        suppressEvolutionRefresh: input.suppressEvolutionRefresh,
      }),
    );
  }

  const actionSuggestions = meeting.actionItems.length === 0 ? llmExtraction.output.candidateActions : [];

  const createdActionItems = [];
  for (const suggestion of actionSuggestions.slice(0, 3)) {
    createdActionItems.push(
      await db.actionItem.create({
        data: {
          workspaceId: input.workspaceId,
          meetingId: meeting.id,
          opportunityId: meeting.opportunityId ?? undefined,
          contactId: meeting.contacts[0]?.id ?? undefined,
          ownerId: meeting.ownerId ?? input.actorUserId ?? undefined,
          actionType: ActionType.CREATE_TASK,
          title: suggestion.length > 26 ? `${suggestion.slice(0, 26)}...` : suggestion,
          description: suggestion,
          aiReason: "会议记忆链路已识别出明确下一步动作，建议先作为任务进入工作流。",
          sourceType: SourceType.SYSTEM_INFERENCE,
          sourceId: meeting.id,
          riskLevel: meeting.opportunity?.riskLevel ?? RiskLevel.MEDIUM,
          executionMode: ActionExecutionMode.SUGGEST_ONLY,
          requiresApproval: false,
          status: ActionStatus.SUGGESTED,
          executionStatus: "suggested",
          policyName: "会议记忆建议",
          policySnapshot: JSON.stringify({
            source: "meeting_memory_pipeline",
          }),
          statusReason: "由会议记忆处理链生成，等待人工确认。",
        },
      }),
    );
  }

  const summary = trimSummary(llmExtraction.output.summary);
  const timelineTasks = [
    db.memoryEntry.create({
      data: {
        workspaceId: input.workspaceId,
        meetingId: meeting.id,
        companyId: meeting.companyId ?? undefined,
        opportunityId: meeting.opportunityId ?? undefined,
        entityType: MemoryEntityType.MEETING,
        memoryType: MemoryType.SUMMARY,
        title: "会议记忆已更新",
        content: summary,
        source: "记忆生成链路",
      },
    }),
    ...(meeting.contacts[0]
      ? [
          db.memoryEntry.create({
            data: {
              workspaceId: input.workspaceId,
              contactId: meeting.contacts[0].id,
              meetingId: meeting.id,
              companyId: meeting.companyId ?? undefined,
              opportunityId: meeting.opportunityId ?? undefined,
              entityType: MemoryEntityType.CONTACT,
              memoryType: MemoryType.RELATIONSHIP,
              title: `${meeting.contacts[0].name} 相关会议记忆已更新`,
              content: summary,
              source: "记忆生成链路",
            },
          }),
        ]
      : []),
    ...(meeting.companyId
      ? [
          db.memoryEntry.create({
            data: {
              workspaceId: input.workspaceId,
              companyId: meeting.companyId,
              meetingId: meeting.id,
              opportunityId: meeting.opportunityId ?? undefined,
              entityType: MemoryEntityType.COMPANY,
              memoryType: MemoryType.SUMMARY,
              title: `${meeting.company?.name ?? "公司"} 会议记忆已更新`,
              content: summary,
              source: "记忆生成链路",
            },
          }),
        ]
      : []),
    ...(meeting.opportunityId
      ? [
          db.memoryEntry.create({
            data: {
              workspaceId: input.workspaceId,
              opportunityId: meeting.opportunityId,
              meetingId: meeting.id,
              companyId: meeting.companyId ?? undefined,
              entityType: MemoryEntityType.OPPORTUNITY,
              memoryType: MemoryType.NEXT_STEP,
              title: `${meeting.opportunity?.title ?? "机会"} 会议记忆已更新`,
              content: summary,
              source: "记忆生成链路",
            },
          }),
        ]
      : []),
  ];
  await Promise.all(timelineTasks);

  const allFacts = [...existingFacts, ...createdFacts];
  const distillationCandidateSync = await syncDistillationCandidatesForMeetingFacts(input, allFacts);
  if (allFacts[0]) {
    for (const fact of allFacts.slice(1, 6)) {
      await db.memoryLink
        .create({
          data: {
            workspaceId: input.workspaceId,
            fromFactId: fact.id,
            toFactId: allFacts[0].id,
            relationType: MemoryRelationType.DERIVED_FROM,
            weight: 60,
          },
        })
        .catch(() => null);
    }
  }

  await db.meeting.update({
    where: { id: meeting.id },
    data: {
      postMeetingSummary: summary,
    },
  });

  if (meeting.companyId) {
    await db.company
      .update({
        where: { id: meeting.companyId },
        data: {
          lastInteractionAt: meeting.startsAt,
        },
      })
      .catch(() => null);
  }

  if (meeting.opportunityId) {
    await db.opportunity
      .update({
        where: { id: meeting.opportunityId },
        data: {
          lastProgressAt: meeting.startsAt,
          nextStepSummary: createdCommitments[0]?.commitmentText ?? meeting.opportunity?.nextAction ?? undefined,
        },
      })
      .catch(() => null);
  }

  if (meeting.contacts.length) {
    await db.contact.updateMany({
      where: {
        id: {
          in: meeting.contacts.map((contact) => contact.id),
        },
      },
      data: {
        lastInteractionAt: meeting.startsAt,
      },
    });
  }

  const briefing = await generateMeetingBriefingSnapshot({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType ?? ActorType.SYSTEM,
    english: input.english,
    sourcePage: input.sourcePage,
    meetingId: meeting.id,
    force: true,
  });

  await writeMemoryAuditAndEvent({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: input.actorType ?? ActorType.SYSTEM,
    sourcePage: input.sourcePage,
    actionType: "MEETING_MEMORY_PROCESSED",
    targetType: "Meeting",
    targetId: meeting.id,
    summary: `处理会议记忆链路：${meeting.title}`,
    eventName: "meeting_memory_processed",
    eventCategory: "memory",
    metadata: {
      meetingId: meeting.id,
      factCount: allFacts.length,
      commitmentCount: existingCommitments.length + createdCommitments.length,
      blockerCount: existingBlockers.length + createdBlockers.length,
      createdFactCount: createdFacts.length,
      memoryWriteGuard: factWritePlan.summary,
      memoryWriteBatch: factWriteResult.summary,
      duplicateSuppressions: factWritePlan.duplicateSuppressions.slice(0, 12),
      conflictCandidates: factWritePlan.conflictCandidates.slice(0, 12),
      createdCommitmentCount: createdCommitments.length,
      createdBlockerCount: createdBlockers.length,
      createdActionItemCount: createdActionItems.length,
      briefingSnapshotId: briefing.snapshot.id,
      llmProvider: llmExtraction.provider,
      llmModel: llmExtraction.model,
      llmFallbackUsed: llmExtraction.fallbackUsed,
      llmSuccess: llmExtraction.success,
      distillationCandidateSync,
    },
  });

  return {
    facts: allFacts,
    commitments: [...existingCommitments, ...createdCommitments],
    blockers: [...existingBlockers, ...createdBlockers],
    createdActionItems,
    briefing,
    memoryWriteGuard: factWritePlan.summary,
    memoryWriteBatch: factWriteResult.summary,
    distillationCandidateSync,
  };
}

export const hydrateMeetingMemoryFromNote = processMeetingMemory;
