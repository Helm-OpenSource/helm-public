import {
  ActionExecutionMode,
  ActionStatus,
  ActionType,
  ActorType,
  ImportConflictStatus,
  ImportJobStatus,
  ImportJobType,
  ImportMatchStatus,
  MeetingStatus,
  NoteKind,
  type ImportSource,
  type Prisma,
} from "@prisma/client";
import { addMinutes } from "date-fns";
import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import {
  assertWorkspaceImportConflictServiceAccess,
  assertWorkspaceImportServiceAccess,
} from "@/lib/auth/service-governance";
import {
  assertWorkspaceImportConflictOwnership,
  assertWorkspaceImportItemOwnership,
} from "@/lib/auth/tenant-ownership";
import { db } from "@/lib/db";
import {
  normalizeDomain,
  safeJsonString,
  type CrmDataset,
  type CrmPreview,
  type ExternalCompany,
  type ExternalMeeting,
  type ExternalNote,
  type ExternalOpportunity,
  type ExternalPerson,
  type ExternalTask,
  type ImportSummary,
} from "@/lib/imports/crm-types";
import {
  buildImportPayload,
  type IdentityMatchGovernanceInput,
  mapPriorityToRisk,
  normalizeOpportunityStage,
  recordIdentityMatch,
  resolveCompanyIdentity,
  resolveContactIdentity,
  resolveMeetingIdentity,
  resolveOpportunityIdentity,
} from "@/lib/imports/identity-resolution.service";
import { runImportWarmup } from "@/lib/imports/warmup.service";

type RunCrmImportInput = {
  workspaceId: string;
  userId?: string | null;
  source: ImportSource;
  dataset: CrmDataset;
  jobType: ImportJobType;
  english?: boolean;
};

type ResolveImportConflictInput = {
  workspaceId: string;
  userId?: string | null;
  actorName?: string | null;
  identityMatchId: string;
  resolution: "LINK" | "CREATE_NEW" | "IGNORE";
  english?: boolean;
};

type ImportServiceGovernanceInput = IdentityMatchGovernanceInput;

export function buildCrmPreview(dataset: CrmDataset): CrmPreview {
  return {
    sourceType: dataset.sourceType,
    accountLabel: dataset.accountLabel ?? dataset.sourceType,
    objectCounts: {
      contacts: dataset.contacts.length,
      companies: dataset.companies.length,
      opportunities: dataset.opportunities.length,
      meetings: dataset.meetings.length,
      notes: dataset.notes.length,
      tasks: dataset.tasks.length,
      associations: dataset.associations.length,
    },
    samples: {
      contacts: dataset.contacts.slice(0, 5),
      companies: dataset.companies.slice(0, 5),
      opportunities: dataset.opportunities.slice(0, 5),
      meetings: dataset.meetings.slice(0, 3),
      notes: dataset.notes.slice(0, 3),
      tasks: dataset.tasks.slice(0, 3),
    },
    usedMock: dataset.usedMock,
  };
}

async function createImportJob(input: {
  workspaceId: string;
  sourceId: string;
  userId?: string | null;
  jobType: ImportJobType;
}) {
  return db.importJob.create({
    data: {
      workspaceId: input.workspaceId,
      sourceId: input.sourceId,
      createdByUserId: input.userId ?? null,
      jobType: input.jobType,
      status: ImportJobStatus.RUNNING,
    },
  });
}

async function resolveOwnerUserId(workspaceId: string, owner: { email?: string | null; name?: string | null }) {
  const email = String(owner.email ?? "").trim().toLowerCase();
  if (email) {
    const memberships = await db.membership.findMany({
      where: {
        workspaceId,
      },
      select: { userId: true, user: { select: { email: true, name: true } } },
    });
    const membership = memberships.find((item) => String(item.user.email ?? "").trim().toLowerCase() === email);

    if (membership) return membership.userId;
  }

  const name = String(owner.name ?? "").trim();
  if (!name) return null;

  const memberships = await db.membership.findMany({
    where: {
      workspaceId,
    },
    select: { userId: true, user: { select: { name: true } } },
  });
  const normalized = name.trim().toLowerCase();
  const membership = memberships.find((item) => String(item.user.name ?? "").trim().toLowerCase() === normalized);

  return membership?.userId ?? null;
}

async function createImportItem(input: {
  workspaceId: string;
  importJobId: string;
  externalType: string;
  externalId: string;
  mappedObjectType?: string | null;
  mappedObjectId?: string | null;
  matchStatus: ImportMatchStatus;
  conflictStatus?: ImportConflictStatus;
  payload?: string | null;
  normalizedPayload?: string | null;
  errorMessage?: string | null;
  warningMessage?: string | null;
}) {
  return db.importItem.create({
    data: {
      workspaceId: input.workspaceId,
      importJobId: input.importJobId,
      externalType: input.externalType,
      externalId: input.externalId,
      mappedObjectType: input.mappedObjectType ?? null,
      mappedObjectId: input.mappedObjectId ?? null,
      matchStatus: input.matchStatus,
      conflictStatus: input.conflictStatus ?? ImportConflictStatus.NONE,
      payload: input.payload ?? null,
      normalizedPayload: input.normalizedPayload ?? null,
      errorMessage: input.errorMessage ?? null,
      warningMessage: input.warningMessage ?? null,
    },
  });
}

async function upsertCompanyFromExternal(input: {
  workspaceId: string;
  source: ImportSource;
  importJobId: string;
  ownerUserId?: string | null;
  company: ExternalCompany;
  governance?: ImportServiceGovernanceInput;
}) {
  const decision = await resolveCompanyIdentity({
    workspaceId: input.workspaceId,
    sourceType: input.source.sourceType,
    company: input.company,
    governance: input.governance,
  });

  const payloads = buildImportPayload(input.company.raw, {
    name: input.company.name,
    domain: normalizeDomain(input.company.domain ?? input.company.website),
    website: input.company.website,
    industry: input.company.industry,
    ownerExternalId: input.company.ownerExternalId,
  });

  if (decision.status === "NEEDS_REVIEW") {
    const item = await createImportItem({
      workspaceId: input.workspaceId,
      importJobId: input.importJobId,
      externalType: "HUB_COMPANY",
      externalId: input.company.externalId,
      mappedObjectType: "Company",
      mappedObjectId: decision.internalObjectId,
      matchStatus: ImportMatchStatus.NEEDS_REVIEW,
      conflictStatus: ImportConflictStatus.NEEDS_REVIEW,
      warningMessage: decision.reason,
      ...payloads,
    });

    await recordIdentityMatch({
      workspaceId: input.workspaceId,
      sourceId: input.source.id,
      importItemId: item.id,
      externalType: "COMPANY",
      externalId: input.company.externalId,
      internalObjectType: "Company",
      internalObjectId: decision.internalObjectId,
      reason: decision.reason,
      score: decision.score,
      status: "NEEDS_REVIEW",
      governance: input.governance,
    });

    return { companyId: null, item, reviewed: true, created: false, updated: false };
  }

  const nextData: Prisma.CompanyUncheckedCreateInput = {
    workspaceId: input.workspaceId,
    name: input.company.name,
    industry: input.company.industry ?? null,
    website: input.company.website ?? null,
    externalSource: input.source.sourceType,
    externalObjectType: "COMPANY",
    externalObjectId: input.company.externalId,
    externalOwnerId: input.company.ownerExternalId ?? null,
    externalSyncedAt: input.company.updatedAt ?? new Date(),
    lastInteractionAt: input.company.updatedAt ?? null,
  };

  const company =
    decision.internalObjectId
      ? await db.company.update({
          where: { id: decision.internalObjectId },
          data: {
            name: input.company.name,
            industry: input.company.industry ?? null,
            website: input.company.website ?? null,
            externalSource: input.source.sourceType,
            externalObjectType: "COMPANY",
            externalObjectId: input.company.externalId,
            externalOwnerId: input.company.ownerExternalId ?? null,
            externalSyncedAt: input.company.updatedAt ?? new Date(),
            lastInteractionAt: input.company.updatedAt ?? undefined,
          },
        })
      : await db.company.create({
          data: nextData,
        });

  const item = await createImportItem({
    workspaceId: input.workspaceId,
    importJobId: input.importJobId,
    externalType: "COMPANY",
    externalId: input.company.externalId,
    mappedObjectType: "Company",
    mappedObjectId: company.id,
    matchStatus: decision.status === "CREATE_NEW" ? ImportMatchStatus.CREATED : ImportMatchStatus.UPDATED,
    ...payloads,
  });

  await recordIdentityMatch({
    workspaceId: input.workspaceId,
    sourceId: input.source.id,
    importItemId: item.id,
    externalType: "COMPANY",
    externalId: input.company.externalId,
    internalObjectType: "Company",
    internalObjectId: company.id,
    reason: decision.reason,
    score: decision.score,
    status: decision.status === "CREATE_NEW" ? "RESOLVED_CREATED" : decision.status === "EXACT" ? "EXACT" : "AUTO_LINKED",
    governance: input.governance,
  });

  return {
    companyId: company.id,
    item,
    reviewed: false,
    created: decision.status === "CREATE_NEW",
    updated: decision.status !== "CREATE_NEW",
  };
}

async function upsertContactFromExternal(input: {
  workspaceId: string;
  source: ImportSource;
  importJobId: string;
  ownerUserId?: string | null;
  contact: ExternalPerson;
  companyId?: string | null;
  governance?: ImportServiceGovernanceInput;
}) {
  const decision = await resolveContactIdentity({
    workspaceId: input.workspaceId,
    sourceType: input.source.sourceType,
    contact: input.contact,
    companyId: input.companyId,
    governance: input.governance,
  });

  const payloads = buildImportPayload(input.contact.raw, {
    fullName: input.contact.fullName,
    email: input.contact.email,
    phone: input.contact.phone,
    title: input.contact.title,
    companyId: input.companyId,
  });

  if (decision.status === "NEEDS_REVIEW") {
    const item = await createImportItem({
      workspaceId: input.workspaceId,
      importJobId: input.importJobId,
      externalType: "CONTACT",
      externalId: input.contact.externalId,
      mappedObjectType: "Contact",
      mappedObjectId: decision.internalObjectId,
      matchStatus: ImportMatchStatus.NEEDS_REVIEW,
      conflictStatus: ImportConflictStatus.NEEDS_REVIEW,
      warningMessage: decision.reason,
      ...payloads,
    });

    await recordIdentityMatch({
      workspaceId: input.workspaceId,
      sourceId: input.source.id,
      importItemId: item.id,
      externalType: "CONTACT",
      externalId: input.contact.externalId,
      internalObjectType: "Contact",
      internalObjectId: decision.internalObjectId,
      reason: decision.reason,
      score: decision.score,
      status: "NEEDS_REVIEW",
      governance: input.governance,
    });

    return { contactId: null, item, reviewed: true, created: false, updated: false };
  }

  const contact =
    decision.internalObjectId
      ? await db.contact.update({
          where: { id: decision.internalObjectId },
          data: {
            companyId: input.companyId ?? undefined,
            ownerId: input.ownerUserId ?? undefined,
            name: input.contact.fullName,
            title: input.contact.title ?? null,
            email: input.contact.email ?? null,
            phone: input.contact.phone ?? null,
            externalSource: input.source.sourceType,
            externalObjectType: "CONTACT",
            externalObjectId: input.contact.externalId,
            externalOwnerId: input.contact.ownerExternalId ?? null,
            externalSyncedAt: input.contact.updatedAt ?? new Date(),
            lastInteractionAt: input.contact.updatedAt ?? undefined,
          },
        })
      : await db.contact.create({
          data: {
            workspaceId: input.workspaceId,
            companyId: input.companyId ?? null,
            ownerId: input.ownerUserId ?? null,
            name: input.contact.fullName,
            title: input.contact.title ?? null,
            email: input.contact.email ?? null,
            phone: input.contact.phone ?? null,
            externalSource: input.source.sourceType,
            externalObjectType: "CONTACT",
            externalObjectId: input.contact.externalId,
            externalOwnerId: input.contact.ownerExternalId ?? null,
            externalSyncedAt: input.contact.updatedAt ?? new Date(),
            lastInteractionAt: input.contact.updatedAt ?? null,
          },
        });

  const item = await createImportItem({
    workspaceId: input.workspaceId,
    importJobId: input.importJobId,
    externalType: "CONTACT",
    externalId: input.contact.externalId,
    mappedObjectType: "Contact",
    mappedObjectId: contact.id,
    matchStatus: decision.status === "CREATE_NEW" ? ImportMatchStatus.CREATED : ImportMatchStatus.UPDATED,
    ...payloads,
  });

  await recordIdentityMatch({
    workspaceId: input.workspaceId,
    sourceId: input.source.id,
    importItemId: item.id,
    externalType: "CONTACT",
    externalId: input.contact.externalId,
    internalObjectType: "Contact",
    internalObjectId: contact.id,
    reason: decision.reason,
    score: decision.score,
    status: decision.status === "CREATE_NEW" ? "RESOLVED_CREATED" : decision.status === "EXACT" ? "EXACT" : "AUTO_LINKED",
    governance: input.governance,
  });

  return {
    contactId: contact.id,
    item,
    reviewed: false,
    created: decision.status === "CREATE_NEW",
    updated: decision.status !== "CREATE_NEW",
  };
}

async function upsertOpportunityFromExternal(input: {
  workspaceId: string;
  source: ImportSource;
  importJobId: string;
  ownerUserId?: string | null;
  opportunity: ExternalOpportunity;
  companyId?: string | null;
  governance?: ImportServiceGovernanceInput;
}) {
  const decision = await resolveOpportunityIdentity({
    workspaceId: input.workspaceId,
    sourceType: input.source.sourceType,
    opportunity: input.opportunity,
    companyId: input.companyId,
    governance: input.governance,
  });

  const payloads = buildImportPayload(input.opportunity.raw, {
    title: input.opportunity.title,
    stageLabel: input.opportunity.stageLabel,
    amount: input.opportunity.amount,
    dueDate: input.opportunity.dueDate?.toISOString() ?? null,
    companyId: input.companyId,
  });

  if (decision.status === "NEEDS_REVIEW") {
    const item = await createImportItem({
      workspaceId: input.workspaceId,
      importJobId: input.importJobId,
      externalType: "OPPORTUNITY",
      externalId: input.opportunity.externalId,
      mappedObjectType: "Opportunity",
      mappedObjectId: decision.internalObjectId,
      matchStatus: ImportMatchStatus.NEEDS_REVIEW,
      conflictStatus: ImportConflictStatus.NEEDS_REVIEW,
      warningMessage: decision.reason,
      ...payloads,
    });

    await recordIdentityMatch({
      workspaceId: input.workspaceId,
      sourceId: input.source.id,
      importItemId: item.id,
      externalType: "OPPORTUNITY",
      externalId: input.opportunity.externalId,
      internalObjectType: "Opportunity",
      internalObjectId: decision.internalObjectId,
      reason: decision.reason,
      score: decision.score,
      status: "NEEDS_REVIEW",
      governance: input.governance,
    });

    return { opportunityId: null, item, reviewed: true, created: false, updated: false };
  }

  const stage = normalizeOpportunityStage(input.opportunity.stageLabel);
  const opportunity =
    decision.internalObjectId
      ? await db.opportunity.update({
          where: { id: decision.internalObjectId },
          data: {
            companyId: input.companyId ?? undefined,
            ownerId: input.ownerUserId ?? undefined,
            title: input.opportunity.title,
            type: input.opportunity.type,
            stage,
            dueDate: input.opportunity.dueDate ?? null,
            nextAction: input.opportunity.note ?? undefined,
            externalSource: input.source.sourceType,
            externalObjectType: "OPPORTUNITY",
            externalObjectId: input.opportunity.externalId,
            externalOwnerId: input.opportunity.ownerExternalId ?? null,
            externalSyncedAt: input.opportunity.updatedAt ?? new Date(),
            lastProgressAt: input.opportunity.updatedAt ?? undefined,
          },
        })
      : await db.opportunity.create({
          data: {
            workspaceId: input.workspaceId,
            companyId: input.companyId ?? null,
            ownerId: input.ownerUserId ?? null,
            title: input.opportunity.title,
            type: input.opportunity.type,
            stage,
            dueDate: input.opportunity.dueDate ?? null,
            nextAction: input.opportunity.note ?? null,
            priorityScore: input.opportunity.amount ? Math.min(95, Math.max(60, Math.round(input.opportunity.amount / 1000))) : 70,
            externalSource: input.source.sourceType,
            externalObjectType: "OPPORTUNITY",
            externalObjectId: input.opportunity.externalId,
            externalOwnerId: input.opportunity.ownerExternalId ?? null,
            externalSyncedAt: input.opportunity.updatedAt ?? new Date(),
            lastProgressAt: input.opportunity.updatedAt ?? null,
          },
        });

  const item = await createImportItem({
    workspaceId: input.workspaceId,
    importJobId: input.importJobId,
    externalType: "OPPORTUNITY",
    externalId: input.opportunity.externalId,
    mappedObjectType: "Opportunity",
    mappedObjectId: opportunity.id,
    matchStatus: decision.status === "CREATE_NEW" ? ImportMatchStatus.CREATED : ImportMatchStatus.UPDATED,
    ...payloads,
  });

  await recordIdentityMatch({
    workspaceId: input.workspaceId,
    sourceId: input.source.id,
    importItemId: item.id,
    externalType: "OPPORTUNITY",
    externalId: input.opportunity.externalId,
    internalObjectType: "Opportunity",
    internalObjectId: opportunity.id,
    reason: decision.reason,
    score: decision.score,
    status: decision.status === "CREATE_NEW" ? "RESOLVED_CREATED" : decision.status === "EXACT" ? "EXACT" : "AUTO_LINKED",
    governance: input.governance,
  });

  return {
    opportunityId: opportunity.id,
    item,
    reviewed: false,
    created: decision.status === "CREATE_NEW",
    updated: decision.status !== "CREATE_NEW",
  };
}

async function upsertMeetingFromExternal(input: {
  workspaceId: string;
  source: ImportSource;
  importJobId: string;
  ownerUserId?: string | null;
  meeting: ExternalMeeting;
  companyId?: string | null;
  opportunityId?: string | null;
  governance?: ImportServiceGovernanceInput;
}) {
  const decision = await resolveMeetingIdentity({
    workspaceId: input.workspaceId,
    sourceType: input.source.sourceType,
    meeting: input.meeting,
    companyId: input.companyId,
    governance: input.governance,
  });

  const payloads = buildImportPayload(input.meeting.raw, {
    title: input.meeting.title,
    startsAt: input.meeting.startsAt.toISOString(),
    endsAt: input.meeting.endsAt.toISOString(),
    companyId: input.companyId,
    opportunityId: input.opportunityId,
  });

  const meeting =
    decision.internalObjectId
      ? await db.meeting.update({
          where: { id: decision.internalObjectId },
          data: {
            companyId: input.companyId ?? undefined,
            opportunityId: input.opportunityId ?? undefined,
            ownerId: input.ownerUserId ?? undefined,
            title: input.meeting.title,
            location: input.meeting.location ?? null,
            status: MeetingStatus.COMPLETED,
            startsAt: input.meeting.startsAt,
            endsAt: input.meeting.endsAt,
            externalSource: input.source.sourceType,
            externalObjectType: "MEETING",
            externalObjectId: input.meeting.externalId,
            externalOwnerId: input.meeting.ownerExternalId ?? null,
            externalSyncedAt: input.meeting.updatedAt ?? new Date(),
          },
        })
      : await db.meeting.create({
          data: {
            workspaceId: input.workspaceId,
            companyId: input.companyId ?? null,
            opportunityId: input.opportunityId ?? null,
            ownerId: input.ownerUserId ?? null,
            title: input.meeting.title,
            location: input.meeting.location ?? null,
            status: MeetingStatus.COMPLETED,
            startsAt: input.meeting.startsAt,
            endsAt: input.meeting.endsAt,
            externalSource: input.source.sourceType,
            externalObjectType: "MEETING",
            externalObjectId: input.meeting.externalId,
            externalOwnerId: input.meeting.ownerExternalId ?? null,
            externalSyncedAt: input.meeting.updatedAt ?? new Date(),
          },
        });

  if (input.meeting.noteBody?.trim()) {
    await db.meetingNote.upsert({
      where: { meetingId: meeting.id },
      create: {
        workspaceId: input.workspaceId,
        meetingId: meeting.id,
        noteKind: NoteKind.SUMMARY,
        summary: input.meeting.noteBody,
        liveTranscript: input.meeting.noteBody,
        keyDecisions: input.meeting.noteBody,
      },
      update: {
        summary: input.meeting.noteBody,
        liveTranscript: input.meeting.noteBody,
        keyDecisions: input.meeting.noteBody,
      },
    });
  }

  const item = await createImportItem({
    workspaceId: input.workspaceId,
    importJobId: input.importJobId,
    externalType: "MEETING",
    externalId: input.meeting.externalId,
    mappedObjectType: "Meeting",
    mappedObjectId: meeting.id,
    matchStatus: decision.status === "CREATE_NEW" ? ImportMatchStatus.CREATED : ImportMatchStatus.UPDATED,
    ...payloads,
  });

  await recordIdentityMatch({
    workspaceId: input.workspaceId,
    sourceId: input.source.id,
    importItemId: item.id,
    externalType: "MEETING",
    externalId: input.meeting.externalId,
    internalObjectType: "Meeting",
    internalObjectId: meeting.id,
    reason: decision.reason,
    score: decision.score,
    status: decision.status === "CREATE_NEW" ? "RESOLVED_CREATED" : decision.status === "EXACT" ? "EXACT" : "AUTO_LINKED",
    governance: input.governance,
  });

  return {
    meetingId: meeting.id,
    created: decision.status === "CREATE_NEW",
    updated: decision.status !== "CREATE_NEW",
  };
}

async function createMeetingFromNote(input: {
  workspaceId: string;
  source: ImportSource;
  importJobId: string;
  note: ExternalNote;
  ownerUserId?: string | null;
  companyId?: string | null;
  opportunityId?: string | null;
  contactIds: string[];
  governance?: ImportServiceGovernanceInput;
}) {
  const syntheticMeeting: ExternalMeeting = {
    externalId: input.note.externalId,
    sourceType: input.note.sourceType,
    title: input.note.title,
    startsAt: input.note.occurredAt,
    endsAt: addMinutes(input.note.occurredAt, 30),
    ownerExternalId: input.note.ownerExternalId,
    companyExternalIds: [],
    contactExternalIds: [],
    opportunityExternalIds: [],
    noteBody: input.note.body,
    updatedAt: input.note.occurredAt,
    raw: input.note.raw,
  };

  const result = await upsertMeetingFromExternal({
    workspaceId: input.workspaceId,
    source: input.source,
    importJobId: input.importJobId,
    ownerUserId: input.ownerUserId,
    meeting: syntheticMeeting,
    companyId: input.companyId,
    opportunityId: input.opportunityId,
    governance: input.governance,
  });

  if (result.meetingId && input.contactIds.length) {
    await db.meeting.update({
      where: { id: result.meetingId },
      data: {
        contacts: {
          connect: input.contactIds.map((id) => ({ id })),
        },
      },
    });
  }

  return result;
}

async function createTaskFromExternal(input: {
  workspaceId: string;
  source: ImportSource;
  importJobId: string;
  task: ExternalTask;
  ownerUserId?: string | null;
  opportunityId?: string | null;
  contactId?: string | null;
}) {
  const actionItem = await db.actionItem.create({
    data: {
      workspaceId: input.workspaceId,
      opportunityId: input.opportunityId ?? null,
      contactId: input.contactId ?? null,
      ownerId: input.ownerUserId ?? null,
      actionType: ActionType.CREATE_TASK,
      title: input.task.title,
      description: input.task.body ?? null,
      aiReason: "从客户关系系统任务导入，作为后续经营动作输入",
      metadata: safeJsonString(input.task.raw),
      sourceType: input.source.sourceType === "HUBSPOT" ? "MEETING_NOTE" : "ACTION_ITEM",
      sourceId: input.task.externalId,
      riskLevel: input.task.priority ?? mapPriorityToRisk(input.task.raw.priority as string | undefined),
      dueDate: input.task.dueDate ?? null,
      executionMode: ActionExecutionMode.SUGGEST_ONLY,
      requiresApproval: false,
      status: input.task.completed ? ActionStatus.EXECUTED : ActionStatus.MANUAL,
      executionStatus: input.task.completed ? "done" : "imported",
      statusReason: "从外部客户关系系统任务导入",
    },
  });

  await db.memoryEntry.create({
    data: {
      workspaceId: input.workspaceId,
      contactId: input.contactId ?? null,
      opportunityId: input.opportunityId ?? null,
      entityType: input.opportunityId ? "OPPORTUNITY" : input.contactId ? "CONTACT" : "WORKSPACE",
      memoryType: "NOTE",
      title: `导入客户关系系统任务：${input.task.title}`,
      content: input.task.body ?? "已从客户关系系统导入一条待处理任务",
      source: input.source.sourceType === "HUBSPOT" ? "HubSpot 任务导入" : "Salesforce 任务导入",
    },
  });

  await createImportItem({
    workspaceId: input.workspaceId,
    importJobId: input.importJobId,
    externalType: "TASK",
    externalId: input.task.externalId,
    mappedObjectType: "ActionItem",
    mappedObjectId: actionItem.id,
    matchStatus: ImportMatchStatus.CREATED,
    ...buildImportPayload(input.task.raw, {
      title: input.task.title,
      dueDate: input.task.dueDate?.toISOString() ?? null,
      completed: input.task.completed ?? false,
    }),
  });

  return actionItem.id;
}

async function applyAssociations(input: {
  opportunityByExternalId: Map<string, string>;
  companyByExternalId: Map<string, string>;
  contactByExternalId: Map<string, string>;
  dataset: CrmDataset;
}) {
  let contactCompanyLinks = 0;
  let opportunityCompanyLinks = 0;
  let opportunityContactLinks = 0;

  for (const association of input.dataset.associations) {
    if (association.fromType === "CONTACT" && association.toType === "COMPANY") {
      const contactId = input.contactByExternalId.get(association.fromId);
      const companyId = input.companyByExternalId.get(association.toId);
      if (contactId && companyId) {
        await db.contact.update({
          where: { id: contactId },
          data: { companyId },
        });
        contactCompanyLinks += 1;
      }
    }

    if (association.fromType === "OPPORTUNITY" && association.toType === "COMPANY") {
      const opportunityId = input.opportunityByExternalId.get(association.fromId);
      const companyId = input.companyByExternalId.get(association.toId);
      if (opportunityId && companyId) {
        await db.opportunity.update({
          where: { id: opportunityId },
          data: { companyId },
        });
        opportunityCompanyLinks += 1;
      }
    }

    if (association.fromType === "OPPORTUNITY" && association.toType === "CONTACT") {
      const opportunityId = input.opportunityByExternalId.get(association.fromId);
      const contactId = input.contactByExternalId.get(association.toId);
      if (opportunityId && contactId) {
        await db.opportunity.update({
          where: { id: opportunityId },
          data: {
            contacts: {
              connect: [{ id: contactId }],
            },
          },
        });
        opportunityContactLinks += 1;
      }
    }
  }

  return {
    contactCompanyLinks,
    opportunityCompanyLinks,
    opportunityContactLinks,
  };
}

export async function runCrmImport(input: RunCrmImportInput): Promise<ImportSummary> {
  const importServiceGovernance: ImportServiceGovernanceInput = {
    userId: input.userId ?? null,
    actorType: input.userId ? ActorType.USER : ActorType.SYSTEM,
    english: input.english ?? false,
  };

  await assertWorkspaceImportServiceAccess({
    workspaceId: input.workspaceId,
    userId: importServiceGovernance.userId,
    actorType: importServiceGovernance.actorType,
    english: importServiceGovernance.english ?? false,
  });

  const job = await createImportJob({
    workspaceId: input.workspaceId,
    sourceId: input.source.id,
    userId: input.userId ?? null,
    jobType: input.jobType,
  });

  const ownerEntries = await Promise.all(
    input.dataset.owners.map(
      async (owner): Promise<[string, string | null]> => [owner.externalId, await resolveOwnerUserId(input.workspaceId, owner)],
    ),
  );
  const ownerMap = new Map<string, string | null>(ownerEntries);

  const companyByExternalId = new Map<string, string>();
  const contactByExternalId = new Map<string, string>();
  const opportunityByExternalId = new Map<string, string>();
  const meetingIds: string[] = [];
  const contactIds: string[] = [];
  const companyIds: string[] = [];
  const opportunityIds: string[] = [];
  const actionItemIds: string[] = [];
  let reviewCount = 0;
  let successRecords = 0;
  let warningRecords = 0;
  let failedRecords = 0;
  let generatedMeetingNotes = 0;

  try {
    for (const company of input.dataset.companies) {
      const result = await upsertCompanyFromExternal({
        workspaceId: input.workspaceId,
        source: input.source,
        importJobId: job.id,
        company,
        ownerUserId: company.ownerExternalId ? (ownerMap.get(company.ownerExternalId) ?? null) : null,
        governance: importServiceGovernance,
      });
      if (result.companyId) {
        companyByExternalId.set(company.externalId, result.companyId);
        companyIds.push(result.companyId);
        successRecords += 1;
      } else {
        reviewCount += 1;
        warningRecords += 1;
      }
    }

    for (const contact of input.dataset.contacts) {
      const companyId = contact.companyExternalIds?.map((id) => companyByExternalId.get(id)).find(Boolean) ?? null;
      const result = await upsertContactFromExternal({
        workspaceId: input.workspaceId,
        source: input.source,
        importJobId: job.id,
        contact,
        companyId,
        ownerUserId: contact.ownerExternalId ? (ownerMap.get(contact.ownerExternalId) ?? null) : null,
        governance: importServiceGovernance,
      });
      if (result.contactId) {
        contactByExternalId.set(contact.externalId, result.contactId);
        contactIds.push(result.contactId);
        successRecords += 1;
      } else {
        reviewCount += 1;
        warningRecords += 1;
      }
    }

    for (const opportunity of input.dataset.opportunities) {
      const companyId = opportunity.companyExternalIds?.map((id) => companyByExternalId.get(id)).find(Boolean) ?? null;
      const result = await upsertOpportunityFromExternal({
        workspaceId: input.workspaceId,
        source: input.source,
        importJobId: job.id,
        opportunity,
        companyId,
        ownerUserId: opportunity.ownerExternalId ? (ownerMap.get(opportunity.ownerExternalId) ?? null) : null,
        governance: importServiceGovernance,
      });
      if (result.opportunityId) {
        opportunityByExternalId.set(opportunity.externalId, result.opportunityId);
        opportunityIds.push(result.opportunityId);
        successRecords += 1;
      } else {
        reviewCount += 1;
        warningRecords += 1;
      }
    }

    for (const meeting of input.dataset.meetings) {
      const companyId = meeting.companyExternalIds?.map((id) => companyByExternalId.get(id)).find(Boolean) ?? null;
      const opportunityId = meeting.opportunityExternalIds?.map((id) => opportunityByExternalId.get(id)).find(Boolean) ?? null;
      const result = await upsertMeetingFromExternal({
        workspaceId: input.workspaceId,
        source: input.source,
        importJobId: job.id,
        meeting,
        companyId,
        opportunityId,
        ownerUserId: meeting.ownerExternalId ? (ownerMap.get(meeting.ownerExternalId) ?? null) : null,
        governance: importServiceGovernance,
      });
      if (result.meetingId) {
        meetingIds.push(result.meetingId);
        successRecords += 1;
        if (meeting.noteBody?.trim()) {
          generatedMeetingNotes += 1;
        }
      }
    }

    for (const note of input.dataset.notes) {
      const companyId = note.companyExternalIds?.map((id) => companyByExternalId.get(id)).find(Boolean) ?? null;
      const opportunityId = note.opportunityExternalIds?.map((id) => opportunityByExternalId.get(id)).find(Boolean) ?? null;
      const relatedContacts = note.contactExternalIds?.map((id) => contactByExternalId.get(id)).filter((value): value is string => Boolean(value)) ?? [];
      const result = await createMeetingFromNote({
        workspaceId: input.workspaceId,
        source: input.source,
        importJobId: job.id,
        note,
        companyId,
        opportunityId,
        contactIds: relatedContacts,
        ownerUserId: note.ownerExternalId ? (ownerMap.get(note.ownerExternalId) ?? null) : null,
        governance: importServiceGovernance,
      });
      if (result.meetingId) {
        meetingIds.push(result.meetingId);
        successRecords += 1;
        generatedMeetingNotes += 1;
      }
    }

    for (const task of input.dataset.tasks) {
      const opportunityId = task.opportunityExternalIds?.map((id) => opportunityByExternalId.get(id)).find(Boolean) ?? null;
      const contactId = task.contactExternalIds?.map((id) => contactByExternalId.get(id)).find(Boolean) ?? null;
      const actionItemId = await createTaskFromExternal({
        workspaceId: input.workspaceId,
        source: input.source,
        importJobId: job.id,
        task,
        opportunityId,
        contactId,
        ownerUserId: task.ownerExternalId ? (ownerMap.get(task.ownerExternalId) ?? null) : null,
      });
      actionItemIds.push(actionItemId);
      successRecords += 1;
    }

    const linkedCounts = await applyAssociations({
      opportunityByExternalId,
      companyByExternalId,
      contactByExternalId,
      dataset: input.dataset,
    });

    const warmup = await runImportWarmup({
      workspaceId: input.workspaceId,
      userId: input.userId ?? null,
      sourceType: input.source.sourceType,
      jobId: job.id,
      meetingIds,
      contactIds,
      companyIds,
      opportunityIds,
    });

    const summary: ImportSummary = {
      jobId: job.id,
      sourceType: input.source.sourceType,
      importedCounts: {
        contacts: contactIds.length,
        companies: companyIds.length,
        opportunities: opportunityIds.length,
        meetings: meetingIds.length,
        notes: input.dataset.notes.length,
        tasks: actionItemIds.length,
      },
      linkedCounts,
      reviewCount,
      createdActionCount: actionItemIds.length,
      generatedMeetingNotes,
      warmup,
      usedMock: input.dataset.usedMock,
    };

    await db.importJob.update({
      where: { id: job.id },
      data: {
        totalRecords:
          input.dataset.contacts.length +
          input.dataset.companies.length +
          input.dataset.opportunities.length +
          input.dataset.meetings.length +
          input.dataset.notes.length +
          input.dataset.tasks.length,
        successRecords,
        failedRecords,
        warningRecords,
        status: reviewCount > 0 ? ImportJobStatus.COMPLETED_WITH_WARNINGS : ImportJobStatus.COMPLETED,
        finishedAt: new Date(),
        summaryJson: safeJsonString(summary),
      },
    });

    await db.importSource.update({
      where: { id: input.source.id },
      data: {
        status: "CONNECTED",
        lastSyncedAt: new Date(),
        configJson: safeJsonString({
          ...(input.source.configJson ? JSON.parse(input.source.configJson) : {}),
          incrementalCursor: input.dataset.nextCursor ?? null,
        }),
      },
    });

    await logEvent({
      workspaceId: input.workspaceId,
      userId: input.userId ?? null,
      eventName: "crm_import_completed",
      eventCategory: "import",
      targetType: "ImportJob",
      targetId: job.id,
      metadata: {
        sourceType: input.source.sourceType,
        usedMock: input.dataset.usedMock,
        reviewCount,
        summary,
      },
      sourcePage: "/imports/crm",
    });

    await writeAuditLog({
      workspaceId: input.workspaceId,
      userId: input.userId ?? null,
      actor: "客户关系系统导入",
      actorType: ActorType.SYSTEM,
      actionType: "CRM_IMPORT_COMPLETED",
      targetType: "ImportJob",
      targetId: job.id,
      summary: `已完成 ${input.source.sourceType} 导入，导入 ${successRecords} 条对象并生成 ${warmup.generatedRecommendations} 条 recommendation。`,
      payload: summary,
      sourcePage: "/imports/crm",
      relatedObjectType: "ImportSource",
      relatedObjectId: input.source.id,
    });

    return summary;
  } catch (error) {
    failedRecords += 1;
    await db.importJob.update({
      where: { id: job.id },
      data: {
        status: ImportJobStatus.FAILED,
        failedRecords,
        finishedAt: new Date(),
        errorSummary: error instanceof Error ? error.message : "客户关系系统导入失败",
      },
    });

    await db.importSource.update({
      where: { id: input.source.id },
      data: {
        status: "ERROR",
      },
    });

    throw error;
  }
}

function parseNormalizedPayload(value?: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function resolveImportConflict(input: ResolveImportConflictInput) {
  await assertWorkspaceImportConflictServiceAccess({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actorType: input.userId ? ActorType.USER : ActorType.SYSTEM,
    english: input.english ?? false,
  });

  await assertWorkspaceImportConflictOwnership(input.workspaceId, input.identityMatchId);

  const match = await db.identityMatch.findFirst({
    where: {
      id: input.identityMatchId,
      workspaceId: input.workspaceId,
    },
  });

  if (!match) {
    throw new Error("待处理冲突不存在");
  }

  const item = match.importItemId
    ? await (async () => {
        await assertWorkspaceImportItemOwnership(input.workspaceId, match.importItemId!);

        return db.importItem.findFirst({
          where: {
            id: match.importItemId!,
            workspaceId: input.workspaceId,
          },
        });
      })()
    : null;

  const normalized = parseNormalizedPayload(item?.normalizedPayload);

  if (!item || !normalized) {
    throw new Error("冲突缺少可恢复的导入载荷");
  }

  const actor = input.actorName ?? "导入冲突处理";
  const baseAuditPayload = {
    resolution: input.resolution,
    externalType: item.externalType,
    externalId: item.externalId,
    internalObjectType: match.internalObjectType,
    internalObjectId: match.internalObjectId,
  };

  if (input.resolution === "IGNORE") {
    await db.identityMatch.update({
      where: { id: match.id },
      data: {
        status: "IGNORED",
      },
    });
    await db.importItem.update({
      where: { id: item.id },
      data: {
        conflictStatus: "RESOLVED_IGNORED",
      },
    });
    await writeAuditLog({
      workspaceId: input.workspaceId,
      userId: input.userId ?? null,
      actor,
      actorType: ActorType.USER,
      actionType: "IMPORT_CONFLICT_RESOLVED",
      targetType: "IdentityMatch",
      targetId: match.id,
      summary: `Ignored import conflict for ${item.externalType} ${item.externalId}`,
      payload: baseAuditPayload,
      sourcePage: "/imports/conflicts",
      relatedObjectType: "ImportItem",
      relatedObjectId: item.id,
    });
    return { ok: true };
  }

  if (input.resolution === "LINK") {
    if (!match.internalObjectId || !match.internalObjectType) {
      throw new Error("当前冲突没有可链接的候选对象");
    }

    await db.identityMatch.update({
      where: { id: match.id },
      data: {
        status: "RESOLVED_LINKED",
      },
    });
    await db.importItem.update({
      where: { id: item.id },
      data: {
        mappedObjectType: match.internalObjectType,
        mappedObjectId: match.internalObjectId,
        matchStatus: "LINKED",
        conflictStatus: "RESOLVED_LINKED",
      },
    });
    await writeAuditLog({
      workspaceId: input.workspaceId,
      userId: input.userId ?? null,
      actor,
      actorType: ActorType.USER,
      actionType: "IMPORT_CONFLICT_RESOLVED",
      targetType: "IdentityMatch",
      targetId: match.id,
      summary: `Linked import conflict ${item.externalType} ${item.externalId} to ${match.internalObjectType} ${match.internalObjectId}`,
      payload: baseAuditPayload,
      sourcePage: "/imports/conflicts",
      relatedObjectType: "ImportItem",
      relatedObjectId: item.id,
    });
    return { ok: true, mappedObjectId: match.internalObjectId };
  }

  if (item.externalType === "COMPANY") {
    const company = await db.company.create({
      data: {
        workspaceId: input.workspaceId,
        name: String(normalized.name ?? "未命名公司"),
        website: (normalized.website as string | null | undefined) ?? null,
        industry: (normalized.industry as string | null | undefined) ?? null,
      },
    });

    await db.identityMatch.update({
      where: { id: match.id },
      data: {
        status: "RESOLVED_CREATED",
        internalObjectType: "Company",
        internalObjectId: company.id,
      },
    });
    await db.importItem.update({
      where: { id: item.id },
      data: {
        mappedObjectType: "Company",
        mappedObjectId: company.id,
        matchStatus: "CREATED",
        conflictStatus: "RESOLVED_NEW",
      },
    });
    await writeAuditLog({
      workspaceId: input.workspaceId,
      userId: input.userId ?? null,
      actor,
      actorType: ActorType.USER,
      actionType: "IMPORT_CONFLICT_RESOLVED",
      targetType: "IdentityMatch",
      targetId: match.id,
      summary: `Created new company ${company.id} from import conflict ${item.externalId}`,
      payload: {
        ...baseAuditPayload,
        createdObjectType: "Company",
        createdObjectId: company.id,
      },
      sourcePage: "/imports/conflicts",
      relatedObjectType: "ImportItem",
      relatedObjectId: item.id,
    });
    return { ok: true, mappedObjectId: company.id };
  }

  if (item.externalType === "CONTACT") {
    const contact = await db.contact.create({
      data: {
        workspaceId: input.workspaceId,
        name: String(normalized.fullName ?? "未命名联系人"),
        email: (normalized.email as string | null | undefined) ?? null,
        phone: (normalized.phone as string | null | undefined) ?? null,
        title: (normalized.title as string | null | undefined) ?? null,
      },
    });

    await db.identityMatch.update({
      where: { id: match.id },
      data: {
        status: "RESOLVED_CREATED",
        internalObjectType: "Contact",
        internalObjectId: contact.id,
      },
    });
    await db.importItem.update({
      where: { id: item.id },
      data: {
        mappedObjectType: "Contact",
        mappedObjectId: contact.id,
        matchStatus: "CREATED",
        conflictStatus: "RESOLVED_NEW",
      },
    });
    await writeAuditLog({
      workspaceId: input.workspaceId,
      userId: input.userId ?? null,
      actor,
      actorType: ActorType.USER,
      actionType: "IMPORT_CONFLICT_RESOLVED",
      targetType: "IdentityMatch",
      targetId: match.id,
      summary: `Created new contact ${contact.id} from import conflict ${item.externalId}`,
      payload: {
        ...baseAuditPayload,
        createdObjectType: "Contact",
        createdObjectId: contact.id,
      },
      sourcePage: "/imports/conflicts",
      relatedObjectType: "ImportItem",
      relatedObjectId: item.id,
    });
    return { ok: true, mappedObjectId: contact.id };
  }

  if (item.externalType === "OPPORTUNITY") {
    const opportunity = await db.opportunity.create({
      data: {
        workspaceId: input.workspaceId,
        title: String(normalized.title ?? "未命名机会"),
        type: "CLIENT",
        stage: normalizeOpportunityStage(normalized.stageLabel as string | undefined),
        dueDate: normalized.dueDate ? new Date(String(normalized.dueDate)) : null,
      },
    });

    await db.identityMatch.update({
      where: { id: match.id },
      data: {
        status: "RESOLVED_CREATED",
        internalObjectType: "Opportunity",
        internalObjectId: opportunity.id,
      },
    });
    await db.importItem.update({
      where: { id: item.id },
      data: {
        mappedObjectType: "Opportunity",
        mappedObjectId: opportunity.id,
        matchStatus: "CREATED",
        conflictStatus: "RESOLVED_NEW",
      },
    });
    await writeAuditLog({
      workspaceId: input.workspaceId,
      userId: input.userId ?? null,
      actor,
      actorType: ActorType.USER,
      actionType: "IMPORT_CONFLICT_RESOLVED",
      targetType: "IdentityMatch",
      targetId: match.id,
      summary: `Created new opportunity ${opportunity.id} from import conflict ${item.externalId}`,
      payload: {
        ...baseAuditPayload,
        createdObjectType: "Opportunity",
        createdObjectId: opportunity.id,
      },
      sourcePage: "/imports/conflicts",
      relatedObjectType: "ImportItem",
      relatedObjectId: item.id,
    });
    return { ok: true, mappedObjectId: opportunity.id };
  }

  throw new Error("当前冲突类型还不支持手动创建");
}
