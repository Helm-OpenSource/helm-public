import { db } from "@/lib/db";
import type {
  AskHelmBusinessApprovalRecord,
  AskHelmBusinessMemoryFactRecord,
  AskHelmBusinessOpportunityRecord,
} from "@/features/search/ask-helm-business-signals";

export type AskHelmBusinessContextRecords = {
  opportunities: AskHelmBusinessOpportunityRecord[];
  pendingApprovals: AskHelmBusinessApprovalRecord[];
  memoryFacts: AskHelmBusinessMemoryFactRecord[];
};

export function buildEmptyAskHelmBusinessContextRecords(): AskHelmBusinessContextRecords {
  return {
    opportunities: [],
    pendingApprovals: [],
    memoryFacts: [],
  };
}

const OPEN_STAGES = ["NEW", "CONTACTED", "ADVANCING", "WAITING_THEM", "INTERNAL_SYNC"] as const;

export async function loadAskHelmBusinessContextRecords(
  workspaceId: string,
): Promise<AskHelmBusinessContextRecords> {
  const [opportunities, pendingApprovals, memoryFacts] = await Promise.all([
    db.opportunity.findMany({
      where: {
        workspaceId,
        stage: { in: [...OPEN_STAGES] },
      },
      include: {
        company: true,
        owner: true,
      },
      orderBy: [{ priorityScore: "desc" }, { updatedAt: "desc" }],
      take: 24,
    }),
    db.approvalTask.findMany({
      where: {
        workspaceId,
        status: "PENDING",
      },
      include: {
        actionItem: {
          include: {
            opportunity: {
              include: { company: true, owner: true },
            },
            owner: true,
          },
        },
      },
      orderBy: [{ isHighRisk: "desc" }, { createdAt: "desc" }],
      take: 16,
    }),
    db.memoryFact.findMany({
      where: {
        workspaceId,
        status: "ACTIVE",
        confirmedByUser: true,
      },
      orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
      take: 32,
    }),
  ]);

  return {
    opportunities: opportunities.map((opportunity) => ({
      id: opportunity.id,
      workspaceId: opportunity.workspaceId,
      title: opportunity.title,
      stage: String(opportunity.stage),
      riskLevel: String(opportunity.riskLevel),
      nextAction: opportunity.nextAction,
      nextStepSummary: opportunity.nextStepSummary,
      dueDate: opportunity.dueDate,
      lastProgressAt: opportunity.lastProgressAt,
      priorityScore: opportunity.priorityScore,
      shadowManagerAttentionFlag: opportunity.shadowManagerAttentionFlag,
      company: opportunity.company ? { name: opportunity.company.name } : null,
      owner: opportunity.owner
        ? { name: opportunity.owner.name, email: opportunity.owner.email ?? null }
        : null,
    })),
    pendingApprovals: pendingApprovals.map((approval) => ({
      id: approval.id,
      isHighRisk: approval.isHighRisk,
      reasoning: approval.reasoning,
      createdAt: approval.createdAt,
      actionItem: {
        id: approval.actionItem.id,
        title: approval.actionItem.title,
        description: approval.actionItem.description,
        aiReason: approval.actionItem.aiReason,
        riskLevel: String(approval.actionItem.riskLevel),
        dueDate: approval.actionItem.dueDate,
        opportunityId: approval.actionItem.opportunityId,
        contactId: approval.actionItem.contactId,
        meetingId: approval.actionItem.meetingId,
        opportunity: approval.actionItem.opportunity
          ? {
              id: approval.actionItem.opportunity.id,
              workspaceId: approval.actionItem.opportunity.workspaceId,
              title: approval.actionItem.opportunity.title,
              stage: String(approval.actionItem.opportunity.stage),
              riskLevel: String(approval.actionItem.opportunity.riskLevel),
              nextAction: approval.actionItem.opportunity.nextAction,
              nextStepSummary: approval.actionItem.opportunity.nextStepSummary,
              dueDate: approval.actionItem.opportunity.dueDate,
              lastProgressAt: approval.actionItem.opportunity.lastProgressAt,
              priorityScore: approval.actionItem.opportunity.priorityScore,
              shadowManagerAttentionFlag:
                approval.actionItem.opportunity.shadowManagerAttentionFlag,
              company: approval.actionItem.opportunity.company
                ? { name: approval.actionItem.opportunity.company.name }
                : null,
              owner: approval.actionItem.opportunity.owner
                ? {
                    name: approval.actionItem.opportunity.owner.name,
                    email: approval.actionItem.opportunity.owner.email ?? null,
                  }
                : null,
            }
          : null,
        owner: approval.actionItem.owner
          ? {
              name: approval.actionItem.owner.name,
              email: approval.actionItem.owner.email ?? null,
            }
          : null,
      },
    })),
    memoryFacts: memoryFacts.map((fact) => ({
      id: fact.id,
      workspaceId: fact.workspaceId,
      objectType: String(fact.objectType),
      objectId: fact.objectId,
      factType: String(fact.factType),
      title: fact.title,
      content: fact.content,
      sourceType: String(fact.sourceType),
      sourceId: fact.sourceId,
      confidence: fact.confidence,
      importance: fact.importance,
      freshnessScore: fact.freshnessScore,
      status: String(fact.status),
      updatedAt: fact.updatedAt,
    })),
  };
}
