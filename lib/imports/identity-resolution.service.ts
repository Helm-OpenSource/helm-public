import type { ActorType, ImportSourceType, OpportunityStage, Prisma, RiskLevel } from "@prisma/client";
import { assertWorkspaceImportServiceAccess } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import {
  normalizeDomain,
  normalizeName,
  safeJsonString,
  type ExternalCompany,
  type ExternalMeeting,
  type ExternalOpportunity,
  type ExternalPerson,
} from "@/lib/imports/crm-types";

export type MatchDecision = {
  status: "EXACT" | "AUTO_LINKED" | "NEEDS_REVIEW" | "CREATE_NEW";
  internalObjectId?: string | null;
  reason: string;
  score: number;
};

export type IdentityMatchGovernanceInput = {
  userId?: string | null;
  actorType?: ActorType | null;
  english?: boolean;
};

async function assertIdentityResolutionServiceAccess(
  workspaceId: string,
  governance?: IdentityMatchGovernanceInput,
) {
  if (!governance || !governance.userId || (governance.actorType ?? "USER") !== "USER") {
    return;
  }

  await assertWorkspaceImportServiceAccess({
    workspaceId,
    userId: governance.userId,
    actorType: governance.actorType,
    english: governance.english ?? false,
  });
}

export async function resolveCompanyIdentity(input: {
  workspaceId: string;
  sourceType: ImportSourceType;
  company: ExternalCompany;
  governance?: IdentityMatchGovernanceInput;
}): Promise<MatchDecision> {
  await assertIdentityResolutionServiceAccess(input.workspaceId, input.governance);

  const exactByExternal = await db.company.findFirst({
    where: {
      workspaceId: input.workspaceId,
      externalSource: input.sourceType,
      externalObjectId: input.company.externalId,
    },
    select: { id: true },
  });

  if (exactByExternal) {
    return {
      status: "EXACT",
      internalObjectId: exactByExternal.id,
      reason: "外部对象 ID 精确匹配",
      score: 100,
    };
  }

  const domain = normalizeDomain(input.company.domain ?? input.company.website);
  if (domain) {
    const companies = await db.company.findMany({
      where: {
        workspaceId: input.workspaceId,
      },
      select: { id: true, name: true, website: true },
    });

    const company = companies.find((candidate) => {
      const candidateDomain = normalizeDomain(candidate.website);
      return candidateDomain === domain || normalizeName(candidate.name) === normalizeName(input.company.name);
    });

    if (company) {
      return {
        status: "AUTO_LINKED",
        internalObjectId: company.id,
        reason: `通过域名或公司名匹配到现有公司（${domain}）`,
        score: 92,
      };
    }
  }

  const normalized = normalizeName(input.company.name);
  const fuzzyCandidates = await db.company.findMany({
    where: {
      workspaceId: input.workspaceId,
    },
    select: {
      id: true,
      name: true,
    },
  });
  const fuzzy = fuzzyCandidates.find((candidate) => normalizeName(candidate.name) === normalized);

  if (fuzzy && normalizeName(fuzzy.name) === normalized) {
    return {
      status: "NEEDS_REVIEW",
      internalObjectId: fuzzy.id,
      reason: "公司名相同，但缺少强标识，需要人工确认是否合并",
      score: 68,
    };
  }

  return {
    status: "CREATE_NEW",
    reason: "未找到可信候选公司，建议创建新对象",
    score: 20,
  };
}

export async function resolveContactIdentity(input: {
  workspaceId: string;
  sourceType: ImportSourceType;
  contact: ExternalPerson;
  companyId?: string | null;
  governance?: IdentityMatchGovernanceInput;
}): Promise<MatchDecision> {
  await assertIdentityResolutionServiceAccess(input.workspaceId, input.governance);

  const exactByExternal = await db.contact.findFirst({
    where: {
      workspaceId: input.workspaceId,
      externalSource: input.sourceType,
      externalObjectId: input.contact.externalId,
    },
    select: { id: true },
  });

  if (exactByExternal) {
    return {
      status: "EXACT",
      internalObjectId: exactByExternal.id,
      reason: "外部对象 ID 精确匹配",
      score: 100,
    };
  }

  const email = String(input.contact.email ?? "").trim().toLowerCase();
  if (email) {
    const contacts = await db.contact.findMany({
      where: {
        workspaceId: input.workspaceId,
      },
      select: { id: true, email: true },
    });

    const existing = contacts.find((candidate) => String(candidate.email ?? "").trim().toLowerCase() === email);

    if (existing) {
      return {
        status: "AUTO_LINKED",
        internalObjectId: existing.id,
        reason: "通过邮箱匹配到现有联系人",
        score: 96,
      };
    }
  }

  const normalized = normalizeName(input.contact.fullName);
  const candidates = await db.contact.findMany({
    where: {
      workspaceId: input.workspaceId,
      companyId: input.companyId ?? undefined,
    },
    select: { id: true, name: true },
  });
  const candidate = candidates.find((item) => normalizeName(item.name) === normalized);

  if (candidate && normalizeName(candidate.name) === normalized) {
    return {
      status: "NEEDS_REVIEW",
      internalObjectId: candidate.id,
      reason: "联系人姓名接近且公司一致，但缺少邮箱级强标识",
      score: 66,
    };
  }

  return {
    status: "CREATE_NEW",
    reason: "未找到可信候选联系人，建议创建新对象",
    score: 18,
  };
}

export async function resolveOpportunityIdentity(input: {
  workspaceId: string;
  sourceType: ImportSourceType;
  opportunity: ExternalOpportunity;
  companyId?: string | null;
  governance?: IdentityMatchGovernanceInput;
}): Promise<MatchDecision> {
  await assertIdentityResolutionServiceAccess(input.workspaceId, input.governance);

  const exactByExternal = await db.opportunity.findFirst({
    where: {
      workspaceId: input.workspaceId,
      externalSource: input.sourceType,
      externalObjectId: input.opportunity.externalId,
    },
    select: { id: true },
  });

  if (exactByExternal) {
    return {
      status: "EXACT",
      internalObjectId: exactByExternal.id,
      reason: "外部对象 ID 精确匹配",
      score: 100,
    };
  }

  const opportunityCandidates = await db.opportunity.findMany({
    where: {
      workspaceId: input.workspaceId,
    },
    select: { id: true, title: true, companyId: true },
  });

  const normalizedTitle = normalizeName(input.opportunity.title);
  const sameTitleCompany = opportunityCandidates.find(
    (candidate) => normalizeName(candidate.title) === normalizedTitle && candidate.companyId === (input.companyId ?? null),
  );

  if (sameTitleCompany) {
    return {
      status: "AUTO_LINKED",
      internalObjectId: sameTitleCompany.id,
      reason: "机会标题与公司同时匹配到现有机会",
      score: 91,
    };
  }

  const sameTitle = opportunityCandidates.find((candidate) => normalizeName(candidate.title) === normalizedTitle);

  if (sameTitle) {
    return {
      status: "NEEDS_REVIEW",
      internalObjectId: sameTitle.id,
      reason: "机会标题相同，但缺少公司或负责人级强标识",
      score: 64,
    };
  }

  return {
    status: "CREATE_NEW",
    reason: "未找到可信候选机会，建议创建新对象",
    score: 25,
  };
}

export async function resolveMeetingIdentity(input: {
  workspaceId: string;
  sourceType: ImportSourceType;
  meeting: ExternalMeeting;
  governance?: IdentityMatchGovernanceInput;
}): Promise<MatchDecision> {
  await assertIdentityResolutionServiceAccess(input.workspaceId, input.governance);

  const exactByExternal = await db.meeting.findFirst({
    where: {
      workspaceId: input.workspaceId,
      externalSource: input.sourceType,
      externalObjectId: input.meeting.externalId,
    },
    select: { id: true },
  });

  if (exactByExternal) {
    return {
      status: "EXACT",
      internalObjectId: exactByExternal.id,
      reason: "外部对象 ID 精确匹配",
      score: 100,
    };
  }

  const meetings = await db.meeting.findMany({
    where: {
      workspaceId: input.workspaceId,
    },
    select: { id: true, title: true, startsAt: true },
  });
  const sameSlot = meetings.find(
    (candidate) =>
      normalizeName(candidate.title) === normalizeName(input.meeting.title) &&
      candidate.startsAt.getTime() === input.meeting.startsAt.getTime(),
  );

  if (sameSlot) {
    return {
      status: "AUTO_LINKED",
      internalObjectId: sameSlot.id,
      reason: "会议标题和开始时间匹配到现有会议",
      score: 94,
    };
  }

  return {
    status: "CREATE_NEW",
    reason: "未找到可信候选会议，建议创建新会议",
    score: 24,
  };
}

export async function recordIdentityMatch(input: {
  workspaceId: string;
  sourceId?: string | null;
  importItemId?: string | null;
  externalType: string;
  externalId: string;
  internalObjectType?: string | null;
  internalObjectId?: string | null;
  reason: string;
  score: number;
  status: "EXACT" | "AUTO_LINKED" | "NEEDS_REVIEW" | "RESOLVED_LINKED" | "RESOLVED_CREATED" | "IGNORED";
  governance?: IdentityMatchGovernanceInput;
}) {
  await assertIdentityResolutionServiceAccess(input.workspaceId, input.governance);

  return db.identityMatch.create({
    data: {
      workspaceId: input.workspaceId,
      sourceId: input.sourceId ?? null,
      importItemId: input.importItemId ?? null,
      externalType: input.externalType,
      externalId: input.externalId,
      internalObjectType: input.internalObjectType ?? null,
      internalObjectId: input.internalObjectId ?? null,
      matchScore: input.score,
      matchReason: input.reason,
      status: input.status,
    },
  });
}

export function normalizeOpportunityStage(label?: string | null): OpportunityStage {
  const normalized = String(label ?? "").trim().toLowerCase();

  if (["qualifiedtobuy", "closedwon", "contractsent", "appointmentscheduled", "decisionmakerboughtin", "advanced", "待推进"].some((item) => normalized.includes(item.toLowerCase()))) {
    return "ADVANCING";
  }

  if (["presentation", "waiting", "waiting_them", "等待"].some((item) => normalized.includes(item.toLowerCase()))) {
    return "WAITING_THEM";
  }

  if (["internal", "审批", "review"].some((item) => normalized.includes(item.toLowerCase()))) {
    return "INTERNAL_SYNC";
  }

  if (["won", "done", "closed won"].some((item) => normalized.includes(item.toLowerCase()))) {
    return "DONE";
  }

  if (["lost", "closed lost"].some((item) => normalized.includes(item.toLowerCase()))) {
    return "LOST";
  }

  if (["contact", "appointment", "qualification"].some((item) => normalized.includes(item.toLowerCase()))) {
    return "CONTACTED";
  }

  return "NEW";
}

export function mapPriorityToRisk(priority?: string | null): RiskLevel {
  const normalized = String(priority ?? "").trim().toLowerCase();
  if (["critical", "最高", "urgent"].some((item) => normalized.includes(item))) return "CRITICAL";
  if (["high", "高"].some((item) => normalized.includes(item))) return "HIGH";
  if (["low", "低"].some((item) => normalized.includes(item))) return "LOW";
  return "MEDIUM";
}

export function buildImportPayload(raw: Record<string, unknown>, normalized: Record<string, unknown>) {
  return {
    payload: safeJsonString(raw),
    normalizedPayload: safeJsonString(normalized),
  };
}

export function toNullableConnect(id?: string | null): Prisma.StringFieldUpdateOperationsInput | string | null | undefined {
  return id ?? null;
}
