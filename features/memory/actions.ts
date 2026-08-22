"use server";

import { ActorType, BlockerStatus, CommitmentStatus, MemoryCorrectionType, ObjectType, UsageType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { ensureWorkspaceProcessingAllowed, recordUsageLedgerEntry } from "@/lib/billing/foundation";
import { getCurrentWorkspace, getCurrentWorkspaceSession, requireCurrentUser } from "@/lib/auth/session";
import { isWorkspaceServiceGovernanceError } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import { resolveBlocker, updateBlockerStatus } from "@/lib/memory/blocker.service";
import { deleteMemoryFact, correctMemoryFact, invalidateMemoryFact } from "@/lib/memory/correction.service";
import { updateCommitmentStatus } from "@/lib/memory/commitment.service";
import {
  reviewMemoryDistillationCandidate as reviewMemoryDistillationCandidateInStore,
  type ReviewMemoryDistillationCandidateDecision,
} from "@/lib/memory/distillation-candidate-store";
import {
  canManageMemoryFacts,
  canManageWorkspaceMemory,
  getMemoryFactManagementDeniedMessage,
  getMemoryManagementDeniedMessage,
} from "@/lib/memory/permissions";
import {
  generateCompanyBriefingSnapshot,
  generateContactBriefingSnapshot,
  generateMeetingBriefingSnapshot,
  generateOpportunityBriefingSnapshot,
} from "@/lib/memory/briefing.service";
import { generateRecommendationsForObject } from "@/lib/recommendations/recommendation.service";
import {
  MemberSignalMemoryVerificationError,
  verifyMemberSignalMemoryCandidate,
  type MemberSignalMemoryVerificationErrorCode,
} from "@/lib/member-gateway/signal-candidate-memory-verification.service";

function getRecommendationAffectedPaths(objectType: ObjectType, objectId: string) {
  if (objectType === ObjectType.CONTACT) {
    return [`/contacts/${objectId}`];
  }
  if (objectType === ObjectType.COMPANY) {
    return [`/companies/${objectId}`];
  }
  if (objectType === ObjectType.MEETING) {
    return [`/meetings/${objectId}`];
  }
  if (objectType === ObjectType.OPPORTUNITY) {
    return ["/opportunities"];
  }
  return [];
}

async function refreshRecommendationAfterMemoryChange(input: {
  workspaceId: string;
  actorName: string;
  actorUserId: string;
  objectType: ObjectType;
  objectId: string;
  sourcePage: string;
}) {
  switch (input.objectType) {
    case ObjectType.CONTACT:
    case ObjectType.COMPANY:
    case ObjectType.MEETING:
    case ObjectType.OPPORTUNITY:
      break;
    default:
      return;
  }

  await generateRecommendationsForObject({
    workspaceId: input.workspaceId,
    actorName: input.actorName,
    actorUserId: input.actorUserId,
    actorType: ActorType.USER,
    sourcePage: input.sourcePage,
    objectType: input.objectType,
    objectId: input.objectId,
  }).catch(() => null);
}

function revalidateRecommendationRelatedPaths(objectType: ObjectType, objectId: string) {
  for (const path of getRecommendationAffectedPaths(objectType, objectId)) {
    revalidatePath(path);
  }

  revalidatePath("/dashboard");
  revalidatePath("/approvals");
  revalidatePath("/analytics");
}

const correctSchema = z.object({
  entryId: z.string(),
  content: z.string().min(2),
});

const reviewMemoryDistillationCandidateSchema = z.object({
  candidateId: z.string().min(1),
  decision: z.enum(["approve", "reject", "defer"]),
  reason: z.string().trim().max(1000).optional(),
});

export async function reviewMemoryDistillationCandidateAction(
  input: z.infer<typeof reviewMemoryDistillationCandidateSchema>,
) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";
  const parsed = reviewMemoryDistillationCandidateSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "Invalid candidate review decision" : "候选记忆复核决策无效",
    };
  }

  if (!canManageMemoryFacts(membership.role)) {
    return {
      ok: false,
      error: getMemoryFactManagementDeniedMessage(english),
    };
  }

  try {
    await reviewMemoryDistillationCandidateInStore({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      actorType: ActorType.USER,
      english,
      sourcePage: "/memory",
      candidateId: parsed.data.candidateId,
      decision: parsed.data.decision as ReviewMemoryDistillationCandidateDecision,
      reason: parsed.data.reason || null,
    });
  } catch {
    return {
      ok: false,
      error: english
        ? "Unable to review this distillation candidate"
        : "无法复核这条记忆浓缩候选",
    };
  }

  revalidatePath("/memory");
  return { ok: true };
}

const verifyMemberSignalMemoryCandidateSchema = z
  .object({
    candidateId: z.string().trim().min(1).max(191),
    decision: z.enum(["verify", "reject"]),
    note: z.string().trim().max(280).optional(),
  })
  .strict();

// Total, compiler-enforced bilingual mapping (Record over every code in
// MemberSignalMemoryVerificationErrorCode — a code added to the service
// without an entry here fails typecheck, not silently falls through).
const MEMBER_SIGNAL_MEMORY_VERIFICATION_ERROR_MESSAGES: Record<
  MemberSignalMemoryVerificationErrorCode,
  { en: string; zh: string }
> = {
  invalid_input: {
    en: "Invalid verification decision",
    zh: "验证决策无效",
  },
  memory_candidate_not_found: {
    en: "This memory candidate was not found",
    zh: "未找到这条记忆候选",
  },
  memory_candidate_not_member_anchored: {
    en: "This candidate is not a member-anchored signal and cannot be verified here",
    zh: "这条候选不是成员锚定信号，无法在这里验证",
  },
  memory_candidate_state_conflict: {
    en: "This candidate has already been decided and the decision cannot be reversed",
    zh: "这条候选已经完成决策，不能再次改判",
  },
};

// Verification here is decision-only (memory member-verification plan,
// ruling 3): it confirms a member-anchored MemoryCandidate as a genuine
// signal or rejects it. It never writes canonical memory — fact promotion
// (VERIFIED -> a memory write) is a separate, not-yet-built capability.
export async function verifyMemberSignalMemoryCandidateAction(input: unknown) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";
  const parsed = verifyMemberSignalMemoryCandidateSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "Invalid verification decision" : "验证决策无效",
    };
  }

  if (!canManageMemoryFacts(membership.role)) {
    return {
      ok: false,
      error: getMemoryFactManagementDeniedMessage(english),
    };
  }

  try {
    const result = await verifyMemberSignalMemoryCandidate({
      workspaceId: workspace.id,
      actorUserId: user.id,
      actorName: user.name,
      candidateId: parsed.data.candidateId,
      decision: parsed.data.decision,
      note: parsed.data.note,
    });
    revalidatePath("/memory");
    return { ok: true, outcome: result.outcome, status: result.status };
  } catch (error) {
    if (error instanceof MemberSignalMemoryVerificationError) {
      const message = MEMBER_SIGNAL_MEMORY_VERIFICATION_ERROR_MESSAGES[error.code];
      return {
        ok: false,
        error: english ? message.en : message.zh,
      };
    }
    if (isWorkspaceServiceGovernanceError(error)) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

export async function correctMemoryAction(input: z.infer<typeof correctSchema>) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";
  const parsed = correctSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: english ? "Please enter a correction" : "请输入纠错内容" };

  if (!canManageMemoryFacts(membership.role)) {
    return { ok: false, error: getMemoryFactManagementDeniedMessage(english) };
  }

  const existingEntry = await db.memoryEntry.findFirst({
    where: {
      id: parsed.data.entryId,
      workspaceId: workspace.id,
      deletedAt: null,
    },
  });

  if (!existingEntry) {
    return { ok: false, error: english ? "Memory entry not found" : "未找到对应记忆" };
  }

  const entry = await db.memoryEntry.update({
    where: { id: existingEntry.id },
    data: {
      content: parsed.data.content,
      correctedAt: new Date(),
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "MEMORY_CORRECTED",
    targetType: "MemoryEntry",
    targetId: entry.id,
    summary: english ? "Corrected a memory entry" : "修正了一条工作记忆",
    payload: parsed.data,
  });

  revalidatePath("/memory");
  return { ok: true };
}

export async function deleteMemoryAction(entryId: string) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageMemoryFacts(membership.role)) {
    return { ok: false, error: getMemoryFactManagementDeniedMessage(english) };
  }

  const existingEntry = await db.memoryEntry.findFirst({
    where: {
      id: entryId,
      workspaceId: workspace.id,
      deletedAt: null,
    },
  });

  if (!existingEntry) {
    return { ok: false, error: english ? "Memory entry not found" : "未找到对应记忆" };
  }

  await db.memoryEntry.update({
    where: { id: existingEntry.id },
    data: {
      deletedAt: new Date(),
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "MEMORY_DELETED",
    targetType: "MemoryEntry",
    targetId: entryId,
    summary: english ? "Deleted a memory entry" : "删除了一条工作记忆",
  });

  revalidatePath("/memory");
  return { ok: true };
}

const correctFactSchema = z.object({
  factId: z.string(),
  content: z.string().min(2),
  reason: z.string().optional(),
});

export async function correctMemoryFactAction(input: z.infer<typeof correctFactSchema>) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const parsed = correctFactSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: workspace.defaultLocale === "en-US" ? "Please enter the corrected content" : "请输入修正内容" };
  }

  if (!canManageMemoryFacts(membership.role)) {
    return {
      ok: false,
      error: getMemoryFactManagementDeniedMessage(workspace.defaultLocale === "en-US"),
    };
  }

  const result = await correctMemoryFact({
    workspaceId: workspace.id,
    actorName: user.name,
    actorUserId: user.id,
    actorType: ActorType.USER,
    sourcePage: "/memory",
    memoryFactId: parsed.data.factId,
    correctionType: MemoryCorrectionType.CONTENT_UPDATE,
    afterValue: {
      content: parsed.data.content,
    },
    reason: parsed.data.reason,
  });

  await refreshRecommendationAfterMemoryChange({
    workspaceId: workspace.id,
    actorName: user.name,
    actorUserId: user.id,
    objectType: result.fact.objectType,
    objectId: result.fact.objectId,
    sourcePage: "/memory",
  });

  revalidatePath("/memory");
  revalidateRecommendationRelatedPaths(result.fact.objectType, result.fact.objectId);
  return { ok: true };
}

export async function invalidateMemoryFactAction(factId: string, reason?: string) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;

  if (!canManageMemoryFacts(membership.role)) {
    return {
      ok: false,
      error: getMemoryFactManagementDeniedMessage(workspace.defaultLocale === "en-US"),
    };
  }

  const result = await invalidateMemoryFact({
    workspaceId: workspace.id,
    actorName: user.name,
    actorUserId: user.id,
    actorType: ActorType.USER,
    sourcePage: "/memory",
    memoryFactId: factId,
    reason,
  });

  await refreshRecommendationAfterMemoryChange({
    workspaceId: workspace.id,
    actorName: user.name,
    actorUserId: user.id,
    objectType: result.fact.objectType,
    objectId: result.fact.objectId,
    sourcePage: "/memory",
  });

  revalidatePath("/memory");
  revalidateRecommendationRelatedPaths(result.fact.objectType, result.fact.objectId);
  return { ok: true };
}

export async function deleteMemoryFactAction(factId: string, reason?: string) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;

  if (!canManageMemoryFacts(membership.role)) {
    return {
      ok: false,
      error: getMemoryFactManagementDeniedMessage(workspace.defaultLocale === "en-US"),
    };
  }

  const result = await deleteMemoryFact({
    workspaceId: workspace.id,
    actorName: user.name,
    actorUserId: user.id,
    actorType: ActorType.USER,
    sourcePage: "/memory",
    memoryFactId: factId,
    reason,
  });

  await refreshRecommendationAfterMemoryChange({
    workspaceId: workspace.id,
    actorName: user.name,
    actorUserId: user.id,
    objectType: result.fact.objectType,
    objectId: result.fact.objectId,
    sourcePage: "/memory",
  });

  revalidatePath("/memory");
  revalidateRecommendationRelatedPaths(result.fact.objectType, result.fact.objectId);
  return { ok: true };
}

export async function updateCommitmentStatusAction(commitmentId: string, status: CommitmentStatus, statusNote?: string) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;

  if (!canManageWorkspaceMemory(membership.role)) {
    return {
      ok: false,
      error: getMemoryManagementDeniedMessage(workspace.defaultLocale === "en-US"),
    };
  }

  const updated = await updateCommitmentStatus({
    workspaceId: workspace.id,
    actorName: user.name,
    actorUserId: user.id,
    actorType: ActorType.USER,
    sourcePage: "/memory",
    commitmentId,
    status,
    statusNote,
  });

  revalidatePath("/memory");
  if (updated.relatedOpportunityId) {
    await refreshRecommendationAfterMemoryChange({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      objectType: ObjectType.OPPORTUNITY,
      objectId: updated.relatedOpportunityId,
      sourcePage: "/memory",
    });
    revalidateRecommendationRelatedPaths(ObjectType.OPPORTUNITY, updated.relatedOpportunityId);
  }
  if (updated.relatedContactId) {
    await refreshRecommendationAfterMemoryChange({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      objectType: ObjectType.CONTACT,
      objectId: updated.relatedContactId,
      sourcePage: "/memory",
    });
    revalidateRecommendationRelatedPaths(ObjectType.CONTACT, updated.relatedContactId);
  }
  if (updated.relatedCompanyId) {
    await refreshRecommendationAfterMemoryChange({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      objectType: ObjectType.COMPANY,
      objectId: updated.relatedCompanyId,
      sourcePage: "/memory",
    });
    revalidateRecommendationRelatedPaths(ObjectType.COMPANY, updated.relatedCompanyId);
  }
  if (updated.relatedMeetingId) {
    await refreshRecommendationAfterMemoryChange({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      objectType: ObjectType.MEETING,
      objectId: updated.relatedMeetingId,
      sourcePage: "/memory",
    });
    revalidateRecommendationRelatedPaths(ObjectType.MEETING, updated.relatedMeetingId);
  }
  return { ok: true };
}

export async function resolveBlockerAction(blockerId: string, resolutionNote?: string) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;

  if (!canManageWorkspaceMemory(membership.role)) {
    return {
      ok: false,
      error: getMemoryManagementDeniedMessage(workspace.defaultLocale === "en-US"),
    };
  }

  const updated = await resolveBlocker({
    workspaceId: workspace.id,
    actorName: user.name,
    actorUserId: user.id,
    actorType: ActorType.USER,
    sourcePage: "/memory",
    blockerId,
    resolutionNote,
  });

  revalidatePath("/memory");
  if (updated.relatedOpportunityId) {
    await refreshRecommendationAfterMemoryChange({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      objectType: ObjectType.OPPORTUNITY,
      objectId: updated.relatedOpportunityId,
      sourcePage: "/memory",
    });
    revalidateRecommendationRelatedPaths(ObjectType.OPPORTUNITY, updated.relatedOpportunityId);
  }
  if (updated.relatedContactId) {
    await refreshRecommendationAfterMemoryChange({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      objectType: ObjectType.CONTACT,
      objectId: updated.relatedContactId,
      sourcePage: "/memory",
    });
    revalidateRecommendationRelatedPaths(ObjectType.CONTACT, updated.relatedContactId);
  }
  if (updated.relatedCompanyId) {
    await refreshRecommendationAfterMemoryChange({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      objectType: ObjectType.COMPANY,
      objectId: updated.relatedCompanyId,
      sourcePage: "/memory",
    });
    revalidateRecommendationRelatedPaths(ObjectType.COMPANY, updated.relatedCompanyId);
  }
  if (updated.relatedMeetingId) {
    await refreshRecommendationAfterMemoryChange({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      objectType: ObjectType.MEETING,
      objectId: updated.relatedMeetingId,
      sourcePage: "/memory",
    });
    revalidateRecommendationRelatedPaths(ObjectType.MEETING, updated.relatedMeetingId);
  }
  return { ok: true };
}

export async function updateBlockerStatusAction(blockerId: string, status: BlockerStatus, resolutionNote?: string) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;

  if (!canManageWorkspaceMemory(membership.role)) {
    return {
      ok: false,
      error: getMemoryManagementDeniedMessage(workspace.defaultLocale === "en-US"),
    };
  }

  const updated = await updateBlockerStatus({
    workspaceId: workspace.id,
    actorName: user.name,
    actorUserId: user.id,
    actorType: ActorType.USER,
    sourcePage: "/memory",
    blockerId,
    status,
    resolutionNote,
  });

  revalidatePath("/memory");
  if (updated.relatedOpportunityId) {
    await refreshRecommendationAfterMemoryChange({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      objectType: ObjectType.OPPORTUNITY,
      objectId: updated.relatedOpportunityId,
      sourcePage: "/memory",
    });
    revalidateRecommendationRelatedPaths(ObjectType.OPPORTUNITY, updated.relatedOpportunityId);
  }
  if (updated.relatedContactId) {
    await refreshRecommendationAfterMemoryChange({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      objectType: ObjectType.CONTACT,
      objectId: updated.relatedContactId,
      sourcePage: "/memory",
    });
    revalidateRecommendationRelatedPaths(ObjectType.CONTACT, updated.relatedContactId);
  }
  if (updated.relatedCompanyId) {
    await refreshRecommendationAfterMemoryChange({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      objectType: ObjectType.COMPANY,
      objectId: updated.relatedCompanyId,
      sourcePage: "/memory",
    });
    revalidateRecommendationRelatedPaths(ObjectType.COMPANY, updated.relatedCompanyId);
  }
  if (updated.relatedMeetingId) {
    await refreshRecommendationAfterMemoryChange({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      objectType: ObjectType.MEETING,
      objectId: updated.relatedMeetingId,
      sourcePage: "/memory",
    });
    revalidateRecommendationRelatedPaths(ObjectType.MEETING, updated.relatedMeetingId);
  }
  return { ok: true };
}

export async function generateMeetingBriefingAction(meetingId: string) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  await ensureWorkspaceProcessingAllowed({
    workspaceId: workspace.id,
    english: workspace.defaultLocale === "en-US",
    operation: "BRIEFING_GENERATION",
  });

  await generateMeetingBriefingSnapshot({
    workspaceId: workspace.id,
    actorName: user.name,
    actorUserId: user.id,
    actorType: ActorType.USER,
    sourcePage: `/meetings/${meetingId}`,
    meetingId,
  });

  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/memory");
  await recordUsageLedgerEntry({
    workspaceId: workspace.id,
    userId: user.id,
    usageType: UsageType.BRIEFING_GENERATION,
    sourcePage: `/meetings/${meetingId}`,
    metadata: {
      meetingId,
      objectType: ObjectType.MEETING,
    },
  });
  return { ok: true };
}

export async function generateObjectBriefingAction(objectType: ObjectType, objectId: string) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  await ensureWorkspaceProcessingAllowed({
    workspaceId: workspace.id,
    english: workspace.defaultLocale === "en-US",
    operation: "BRIEFING_GENERATION",
  });
  const sourcePage =
    objectType === ObjectType.CONTACT
      ? `/contacts/${objectId}`
      : objectType === ObjectType.COMPANY
        ? `/companies/${objectId}`
        : objectType === ObjectType.OPPORTUNITY
          ? `/opportunities?opportunityId=${objectId}`
          : `/memory`;

  if (objectType === ObjectType.CONTACT) {
    await generateContactBriefingSnapshot({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      actorType: ActorType.USER,
      sourcePage,
      contactId: objectId,
      force: true,
    });
    revalidatePath(`/contacts/${objectId}`);
  } else if (objectType === ObjectType.COMPANY) {
    await generateCompanyBriefingSnapshot({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      actorType: ActorType.USER,
      sourcePage,
      companyId: objectId,
      force: true,
    });
    revalidatePath(`/companies/${objectId}`);
  } else if (objectType === ObjectType.OPPORTUNITY) {
    await generateOpportunityBriefingSnapshot({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      actorType: ActorType.USER,
      sourcePage,
      opportunityId: objectId,
      force: true,
    });
    revalidatePath("/opportunities");
  }

  revalidatePath("/memory");
  await recordUsageLedgerEntry({
    workspaceId: workspace.id,
    userId: user.id,
    usageType: UsageType.BRIEFING_GENERATION,
    sourcePage,
    metadata: {
      objectType,
      objectId,
    },
  });
  return { ok: true };
}
