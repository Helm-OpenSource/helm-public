import {
  auditAskHelmContextPacket,
  buildAskHelmContextPacket,
  type AskHelmContextPacket,
  type AskHelmContextPacketAuditSummary,
  type AskHelmContextPacketMemorySummary,
  type AskHelmContextPacketObjectSummary,
} from "@/features/search/ask-helm-context-packet";
import type {
  AskHelmGroundedObject,
  AskHelmResponse,
} from "@/features/search/ask-helm-interpreter";
import type { AskHelmBusinessSignalDraft } from "@/features/search/ask-helm-business-signals";

export type AskHelmRuntimeContextLayerStatus =
  | "included"
  | "bounded"
  | "reserved"
  | "excluded";

export type AskHelmRuntimeContextLayer = {
  id:
    | "tenant_facts"
    | "helm_semantics"
    | "helm_global_patterns"
    | "public_knowledge"
    | "llm_reasoning";
  authorityRank: 1 | 2 | 3 | 4 | 5;
  status: AskHelmRuntimeContextLayerStatus;
  itemCount: number;
  evidenceRefs: string[];
  note: string;
  summaryItems: string[];
};

export type AskHelmRuntimeContextAssembly = {
  packet: AskHelmContextPacket;
  audit: AskHelmContextPacketAuditSummary;
  layers: AskHelmRuntimeContextLayer[];
};

export type AskHelmRuntimeContextInput = {
  rawQuery: string;
  workspace: {
    workspaceId: string;
    workspaceSlug?: string;
    membershipRole?: string;
    focusAreas: string[];
  };
  response: AskHelmResponse;
  relatedObjects: AskHelmGroundedObject[];
  inputMode: "typed" | "voice";
  transcriptConfirmed?: boolean;
  transcriptConfidence?: "high" | "medium" | "low";
  searchDegraded?: boolean;
  businessSignals?: AskHelmBusinessSignalDraft[];
  memoryCandidates?: AskHelmContextPacketMemorySummary[];
};

export function assembleAskHelmRuntimeContext(
  input: AskHelmRuntimeContextInput,
): AskHelmRuntimeContextAssembly {
  const objectContext = input.relatedObjects
    .slice(0, 6)
    .map((object) => toContextObject(object, input.workspace.workspaceId));
  const knowledgePackLabels = resolveKnowledgePackLabels(input.response);
  const excludedContext = [
    {
      source: "external_agent_unreviewed" as const,
      reason:
        "Helm global patterns require redaction and reviewer approval before tenant answer injection.",
    },
    {
      source: "open_domain_web" as const,
      reason:
        "Public web and LLM common knowledge are not authoritative runtime sources in Ask Helm v1.",
    },
    ...(input.searchDegraded
      ? [
          {
            source: "external_agent_unreviewed" as const,
            reason:
              "Object search degraded; object-level evidence must be verified on the target page after recovery.",
          },
        ]
      : []),
  ];

  const packet = buildAskHelmContextPacket({
    workspace: input.workspace,
    rawQuery: input.rawQuery,
    redactedQuery: redactQueryForPacket(input.rawQuery),
    inputMode: input.inputMode,
    transcriptConfirmed: input.transcriptConfirmed,
    transcriptConfidence: input.transcriptConfidence,
    currentPage: "/search",
    relatedObjects: objectContext,
    memoryCandidates: input.memoryCandidates,
    workspaceContext: input.response.grounding.workspaceContext,
    knowledgePackLabels,
    boundaryMessage: input.response.boundaryNote?.message,
    excludedContext,
    replay: {
      redactionPosture: "redacted_replay_ready",
      retentionMode: "review_required",
    },
  });
  const audit = auditAskHelmContextPacket(packet);

  return {
    packet,
    audit,
    layers: buildRuntimeContextLayers({
      packet,
      objectContext,
      knowledgePackLabels,
      response: input.response,
      businessSignals: input.businessSignals ?? [],
    }),
  };
}

function toContextObject(
  object: AskHelmGroundedObject,
  workspaceId: string,
): AskHelmContextPacketObjectSummary {
  return {
    ...object,
    workspaceId,
    evidenceRefs: [
      `workspace:${workspaceId}`,
      `${object.objectType}:${object.objectId}`,
      `search:${object.objectType}:${object.objectId}`,
    ],
    summaryToken: `${object.objectType}:${object.displayName}:${object.status}`,
  };
}

function resolveKnowledgePackLabels(response: AskHelmResponse) {
  const labels = new Set<string>(["boundary_contract", "next_step_routing"]);
  if (response.grounding.systemKnowledgeUsed) {
    labels.add("helm_page_responsibilities");
    labels.add("review_before_commitment_policy");
  }
  if (response.plan) labels.add("action_plan_contract");
  if (response.preparedArtifact) labels.add("draft_or_review_packet_contract");
  return Array.from(labels);
}

function buildRuntimeContextLayers({
  packet,
  objectContext,
  knowledgePackLabels,
  response,
  businessSignals,
}: {
  packet: AskHelmContextPacket;
  objectContext: AskHelmContextPacketObjectSummary[];
  knowledgePackLabels: string[];
  response: AskHelmResponse;
  businessSignals: AskHelmBusinessSignalDraft[];
}): AskHelmRuntimeContextLayer[] {
  const tenantEvidenceRefs = objectContext.flatMap((object) => object.evidenceRefs);
  const tenantSummaryItems: string[] = [];
  for (const signal of businessSignals.slice(0, 3)) {
    tenantSummaryItems.push(signal.title);
  }
  for (const memory of packet.includedContext.memory.slice(0, 2)) {
    tenantSummaryItems.push(memory.summaryToken);
  }
  for (const object of objectContext.slice(0, 2)) {
    if (tenantSummaryItems.length >= 5) break;
    tenantSummaryItems.push(`${object.displayName} · ${object.status}`);
  }

  return [
    {
      id: "tenant_facts",
      authorityRank: 1,
      status: "included",
      itemCount:
        businessSignals.length +
        objectContext.length +
        packet.includedContext.memory.length +
        packet.includedContext.workspaceContext.length,
      evidenceRefs: [
        ...tenantEvidenceRefs,
        ...businessSignals.flatMap((signal) => signal.evidenceRefs),
      ],
      note:
        "Current-workspace objects, reviewed memory and workspace scope have the highest authority.",
      summaryItems: tenantSummaryItems,
    },
    {
      id: "helm_semantics",
      authorityRank: 2,
      status: "included",
      itemCount: knowledgePackLabels.length,
      evidenceRefs: knowledgePackLabels.map((label) => `helm:${label}`),
      note:
        "Helm semantics route the answer through page responsibility, review posture and non-commitment boundaries.",
      summaryItems: knowledgePackLabels,
    },
    {
      id: "helm_global_patterns",
      authorityRank: 3,
      status: "reserved",
      itemCount: 0,
      evidenceRefs: [],
      note:
        "Cross-tenant patterns are reserved until redacted, reviewed and approved as reusable Helm knowledge.",
      summaryItems: [],
    },
    {
      id: "public_knowledge",
      authorityRank: 4,
      status:
        response.classification.intentType === "unsupported_open_domain"
          ? "excluded"
          : "reserved",
      itemCount: 0,
      evidenceRefs: [],
      note:
        "Public knowledge and web context cannot override tenant facts; Ask Helm v1 excludes them from runtime answers.",
      summaryItems: [],
    },
    {
      id: "llm_reasoning",
      authorityRank: 5,
      status: "bounded",
      itemCount: 1,
      evidenceRefs: [`packet:${packet.packetId}`],
      note:
        "LLM reasoning is allowed only to explain, summarize, route or prepare drafts from the audited packet.",
      summaryItems: [
        "explain · summarize · route · prepare_draft only",
      ],
    },
  ];
}

function redactQueryForPacket(query: string) {
  return query
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[email]")
    .replace(/1[3-9]\d{9}/gu, "[phone]")
    .trim();
}
