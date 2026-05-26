"use server";

import { ActorType, OpportunityStage, OpportunityType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import {
  getCurrentWorkspace,
  getCurrentWorkspaceSession,
  requireCurrentUser,
} from "@/lib/auth/session";
import {
  canManageWorkspaceRecords,
  getWorkspaceRecordManagementDeniedMessage,
  getWorkspaceScopedRecordUnavailableMessage,
} from "@/lib/auth/workspace-data-governance";
import { db } from "@/lib/db";
import {
  buildCompanyDefinitionSuggestion,
  fetchCompanyWebsiteScan,
  type CompanyDefinitionSuggestion,
} from "@/lib/definitions/company-definition";

const companyDefinitionAcceptSchema = z.object({
  companyId: z.string().min(1),
  identity: z.string().trim().min(1).max(400),
  offering: z.string().trim().min(1).max(400),
  customerType: z.string().trim().min(1).max(400),
  stageGuess: z.string().trim().min(1).max(400),
  operatingConstraints: z.string().trim().min(1).max(400),
  likelySuccessDefinition: z.string().trim().min(1).max(400),
  likelyRiskDefinition: z.string().trim().min(1).max(400),
  evidenceRefs: z.array(z.string().trim().min(1).max(200)).min(1).max(10),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  boundaryNote: z.string().trim().min(1).max(400),
  websiteScan: z.object({
    sourceUrl: z.string().trim().nullable(),
    pageTitle: z.string().trim().nullable(),
    metaDescription: z.string().trim().nullable(),
    heading: z.string().trim().nullable(),
    fetched: z.boolean(),
    error: z.string().trim().nullable(),
  }),
});

export async function createCompanyQuickOpportunityAction(companyId: string) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceRecords(membership.role)) {
    return {
      ok: false,
      error: getWorkspaceRecordManagementDeniedMessage(english),
    };
  }

  const company = await db.company.findFirst({
    where: {
      id: companyId,
      workspaceId: workspace.id,
    },
  });

  if (!company) {
    return {
      ok: false,
      error: getWorkspaceScopedRecordUnavailableMessage(english, "company"),
    };
  }

  const opportunity = await db.opportunity.create({
    data: {
      workspaceId: workspace.id,
      companyId: company.id,
      ownerId: user.id,
      title: english
        ? `${company.name} new momentum opportunity`
        : `${company.name} 新推进机会`,
      type: OpportunityType.CLIENT,
      stage: OpportunityStage.NEW,
      riskLevel: "MEDIUM",
      nextAction: english
        ? "Define the first outreach strategy"
        : "定义第一步接触策略",
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      priorityScore: 60,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "COMPANY_QUICK_OPPORTUNITY_CREATED",
    targetType: "Company",
    targetId: company.id,
    summary: english
      ? `Created a quick opportunity for ${company.name}`
      : `为 ${company.name} 新建了一个快速机会`,
    payload: { opportunityId: opportunity.id },
  });

  revalidatePath(`/companies/${company.id}`);
  revalidatePath("/opportunities");
  return { ok: true, opportunityId: opportunity.id };
}

export async function generateCompanyBriefAction(companyId: string) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const english = workspace.defaultLocale === "en-US";
  const company = await db.company.findFirst({
    where: { id: companyId, workspaceId: workspace.id },
    include: {
      contacts: true,
      opportunities: true,
      meetings: true,
    },
  });

  if (!company)
    return { ok: false, error: english ? "Company not found" : "公司不存在" };

  const brief = [
    english
      ? `${company.name} is currently at the cooperation maturity level of ${company.cooperationMaturity ?? "needs review"}.`
      : `${company.name} 当前合作成熟度为 ${company.cooperationMaturity ?? "待判断"}。`,
    english
      ? `${company.contacts.length} contacts, ${company.opportunities.length} active opportunities and ${company.meetings.length} recent meetings are linked right now.`
      : `当前关联联系人 ${company.contacts.length} 位，活跃机会 ${company.opportunities.length} 个，最近会议 ${company.meetings.length} 场。`,
    english
      ? `Recommended path: ${company.recommendedPath ?? "Clarify the key relationships and internal push path first."}`
      : `推荐推进路径：${company.recommendedPath ?? "先厘清关键关系人与内部推进路径。"}`,
  ].join("\n");

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: "Helm AI",
    actorType: ActorType.AI,
    actionType: "AI_GENERATED_COMPANY_BRIEF",
    targetType: "Company",
    targetId: company.id,
    summary: english
      ? `Generated a company brief for ${company.name}`
      : `为 ${company.name} 生成了公司简报`,
    payload: { brief },
  });

  return { ok: true, brief };
}

export async function generateCompanyDefinitionSuggestionAction(
  companyId: string,
) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceRecords(membership.role)) {
    return {
      ok: false,
      error: getWorkspaceRecordManagementDeniedMessage(english),
    };
  }

  const company = await db.company.findFirst({
    where: { id: companyId, workspaceId: workspace.id },
    include: {
      contacts: {
        select: { id: true },
      },
      opportunities: {
        select: { type: true },
      },
      meetings: {
        select: { id: true },
      },
      commitments: {
        where: { relatedCompanyId: companyId },
        select: { title: true },
        orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
        take: 1,
      },
      blockers: {
        where: { relatedCompanyId: companyId },
        select: { title: true },
        orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
        take: 1,
      },
    },
  });

  if (!company) {
    return {
      ok: false,
      error: getWorkspaceScopedRecordUnavailableMessage(english, "company"),
    };
  }

  const memoryFacts = await db.memoryFact.findMany({
    where: {
      workspaceId: workspace.id,
      objectType: "COMPANY",
      objectId: companyId,
      status: { in: ["ACTIVE", "OBSERVED"] },
    },
    select: { title: true },
    orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    take: 3,
  });
  const websiteScan = await fetchCompanyWebsiteScan(company.website);
  const suggestion = buildCompanyDefinitionSuggestion({
    locale: workspace.defaultLocale === "en-US" ? "en-US" : "zh-CN",
    company: {
      name: company.name,
      website: company.website,
      industry: company.industry,
      description: company.description,
      cooperationMaturity: company.cooperationMaturity,
      recommendedPath: company.recommendedPath,
    },
    operatingSignals: {
      contactCount: company.contacts.length,
      opportunityCount: company.opportunities.length,
      opportunityTypes: company.opportunities.map((item) => item.type),
      meetingCount: company.meetings.length,
      memoryFactTitles: memoryFacts.map((item) => item.title),
      topCommitmentTitle: company.commitments[0]?.title ?? null,
      topBlockerTitle: company.blockers[0]?.title ?? null,
    },
    websiteScan,
  });

  await db.company.update({
    where: { id: company.id },
    data: {
      definitionSuggestionJson: JSON.stringify(suggestion),
      definitionSuggestedAt: new Date(),
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "COMPANY_DEFINITION_SUGGESTED",
    targetType: "Company",
    targetId: company.id,
    summary: english
      ? `Generated a company definition suggestion for ${company.name}`
      : `为 ${company.name} 生成了公司定义建议`,
    payload: {
      confidence: suggestion.confidence,
      evidenceRefs: suggestion.evidenceRefs,
    },
    sourcePage: `/companies/${company.id}`,
  });

  revalidatePath(`/companies/${company.id}`);
  revalidatePath("/memory");
  return { ok: true, suggestion };
}

export async function acceptCompanyDefinitionSuggestionAction(
  input: z.infer<typeof companyDefinitionAcceptSchema>,
) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";
  const parsed = companyDefinitionAcceptSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "Definition input is incomplete" : "定义输入不完整",
    };
  }

  if (!canManageWorkspaceRecords(membership.role)) {
    return {
      ok: false,
      error: getWorkspaceRecordManagementDeniedMessage(english),
    };
  }

  const company = await db.company.findFirst({
    where: { id: parsed.data.companyId, workspaceId: workspace.id },
    select: { id: true, name: true },
  });

  if (!company) {
    return {
      ok: false,
      error: getWorkspaceScopedRecordUnavailableMessage(english, "company"),
    };
  }

  const acceptedDefinition: CompanyDefinitionSuggestion = {
    version: 1,
    locale: workspace.defaultLocale === "en-US" ? "en-US" : "zh-CN",
    generatedAt: new Date().toISOString(),
    posture: "ACCEPTED",
    companyName: company.name,
    identity: parsed.data.identity,
    offering: parsed.data.offering,
    customerType: parsed.data.customerType,
    stageGuess: parsed.data.stageGuess,
    operatingConstraints: parsed.data.operatingConstraints,
    likelySuccessDefinition: parsed.data.likelySuccessDefinition,
    likelyRiskDefinition: parsed.data.likelyRiskDefinition,
    evidenceRefs: parsed.data.evidenceRefs,
    confidence: parsed.data.confidence,
    boundaryNote: parsed.data.boundaryNote,
    websiteScan: parsed.data.websiteScan,
  };

  await db.company.update({
    where: { id: company.id },
    data: {
      definitionSuggestionJson: JSON.stringify(acceptedDefinition),
      definitionAcceptedJson: JSON.stringify(acceptedDefinition),
      definitionAcceptedAt: new Date(),
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "COMPANY_DEFINITION_ACCEPTED",
    targetType: "Company",
    targetId: company.id,
    summary: english
      ? `Accepted the active company definition for ${company.name}`
      : `已接受 ${company.name} 的公司定义`,
    payload: {
      confidence: parsed.data.confidence,
      evidenceRefs: parsed.data.evidenceRefs,
    },
    sourcePage: `/companies/${company.id}`,
  });

  revalidatePath(`/companies/${company.id}`);
  revalidatePath("/memory");
  return { ok: true };
}
