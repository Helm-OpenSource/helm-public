import "server-only";

import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { safeParseJson } from "@/lib/utils";

export type Stage1OwnerDecisionQueueItem = {
  id: string;
  decisionKey: string;
  businessQuestion: string;
  alternatives: string[];
  recommendedOption: string | null;
  facts: Array<{ statement: string; evidenceRefs: string[] }>;
  inferences: Array<{ statement: string; evidenceRefs: string[] }>;
  unknowns: string[];
  risks: string[];
  contextRefs: string[];
  knowledgeRefs: string[];
  evidenceRefs: string[];
  policyRefs: string[];
  receiptRefs: string[];
  confidence: string;
  riskLevel: string;
  allowedActionLevel: string;
  rollbackPath: string | null;
  status: string;
  validUntil: string | null;
  ownerConclusion: string | null;
  workPacket: {
    id: string;
    actionItemId: string;
    title: string;
    status: string;
    dueDate: string | null;
  } | null;
  qoderDrafts: Array<{
    id: string;
    summary: string;
    disposition: string;
    evidenceRefs: string[];
    occurredAt: string;
  }>;
};

export async function loadStage1OwnerDecisionQueue(): Promise<{
  available: boolean;
  decisions: Stage1OwnerDecisionQueueItem[];
}> {
  const { membership, workspace } = await getCurrentWorkspaceSession();
  if (membership.role !== "OWNER") return { available: false, decisions: [] };

  const [decisions, draftCandidates] = await Promise.all([
    db.decisionRecord.findMany({
      where: { workspaceId: workspace.id },
      orderBy: [{ createdAt: "desc" }],
      take: 30,
      include: {
        workPacketClaim: {
          include: {
            actionItem: {
              select: { id: true, title: true, status: true, dueDate: true },
            },
          },
        },
      },
    }),
    db.externalMemoryRecord.findMany({
      where: {
        workspaceId: workspace.id,
        provider: "QODERWORK",
        category: "draft_candidate",
      },
      orderBy: { occurredAt: "desc" },
      take: 50,
      select: {
        id: true,
        text: true,
        occurredAt: true,
        rawMetadata: true,
      },
    }),
  ]);

  const drafts = draftCandidates.map((candidate) => {
    const metadata = safeParseJson<{
      sourceRef?: string;
      disposition?: string;
      evidenceRefs?: string[];
    }>(candidate.rawMetadata, {});
    return { candidate, metadata };
  });

  return {
    available: true,
    decisions: decisions.map((decision) => {
      const workPacketRef = decision.workPacketClaim?.id;
      const actionItemId = decision.workPacketClaim?.actionItemId;
      return {
        id: decision.id,
        decisionKey: decision.decisionKey,
        businessQuestion: decision.businessQuestion,
        alternatives: safeParseJson<string[]>(decision.alternatives, []),
        recommendedOption: decision.recommendedOption,
        facts: safeParseJson(decision.factsJson, []),
        inferences: safeParseJson(decision.inferencesJson, []),
        unknowns: safeParseJson<string[]>(decision.unknownsJson, []),
        risks: safeParseJson<string[]>(decision.risksJson, []),
        contextRefs: safeParseJson<string[]>(decision.contextRefs, []),
        knowledgeRefs: safeParseJson<string[]>(decision.knowledgeRefs, []),
        evidenceRefs: safeParseJson<string[]>(decision.evidenceRefs, []),
        policyRefs: safeParseJson<string[]>(decision.policyRefs, []),
        receiptRefs: safeParseJson<string[]>(decision.receiptRefs, []),
        confidence: decision.confidence,
        riskLevel: decision.riskLevel,
        allowedActionLevel: decision.allowedActionLevel,
        rollbackPath: decision.rollbackPath,
        status: decision.status,
        validUntil: decision.validUntil?.toISOString() ?? null,
        ownerConclusion: decision.ownerConclusion,
        workPacket: decision.workPacketClaim
          ? {
              id: decision.workPacketClaim.id,
              actionItemId: decision.workPacketClaim.actionItem.id,
              title: decision.workPacketClaim.actionItem.title,
              status: decision.workPacketClaim.actionItem.status,
              dueDate:
                decision.workPacketClaim.actionItem.dueDate?.toISOString() ??
                null,
            }
          : null,
        qoderDrafts: drafts
          .filter(
            ({ metadata }) =>
              metadata.sourceRef === workPacketRef ||
              metadata.sourceRef === actionItemId,
          )
          .map(({ candidate, metadata }) => ({
            id: candidate.id,
            summary: candidate.text,
            disposition: metadata.disposition ?? "review_required",
            evidenceRefs: metadata.evidenceRefs ?? [],
            occurredAt: candidate.occurredAt.toISOString(),
          })),
      };
    }),
  };
}
