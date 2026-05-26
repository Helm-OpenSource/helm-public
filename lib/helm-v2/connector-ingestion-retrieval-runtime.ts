import { MemoryItemStatus, MemoryItemVerification, type MemoryItem } from "@prisma/client";
import { db } from "@/lib/db";
import type {
  HelmV2ConnectorIngestionContract,
  HelmV2MemoryNamespace,
  HelmV2RetrievalLoadRef,
  HelmV2RetrievalPolicyMode,
  HelmV2RetrievalTraceContract,
  HelmV2SourceType,
  HelmV2TrustPromotionStatus,
} from "@/lib/helm-v2/contracts";
import {
  buildConnectorIngestionContract,
  getConnectorSourcePolicy,
  HELM_V2_MEMORY_LOADING_PRIORITY,
  HELM_V2_MEMORY_LOAD_PLAN,
  resolveMemoryConflict,
  resolveRetrievalPlan,
} from "@/lib/helm-v2/layered-memory";
import { jsonStringify, safeParseJson, trimText } from "@/lib/utils";

const STALE_MEMORY_DAYS = 45;
const INGESTION_BOUNDARY_NOTE =
  "Richer connector ingestion stays boundary-first: untrusted sources remain draft-only until explicit confirm or system-of-record validation.";
const RETRIEVAL_BOUNDARY_NOTE =
  "Retrieval policy stays selective and auditable: Helm does not dump all history into context, and untrusted input cannot silently promote itself.";

type MeetingIngestionRuntime = NonNullable<Awaited<ReturnType<typeof loadMeetingIngestionRuntime>>>;

type MeetingConnectorArtifactPayload = {
  facts?: Array<{ content?: string | null }>;
  inferred?: Array<{ summary?: string | null }>;
};

type OpportunityDeltaArtifactPayload = {
  inferredAssumptions?: string[];
  nextBestAction?: string | null;
  stageRationale?: string | null;
};

type IngestionRuntimeItem = HelmV2ConnectorIngestionContract & {
  trustPromotionStatus: HelmV2TrustPromotionStatus;
  directObjectFactAllowed: boolean;
  requiresHumanConfirm: boolean;
  systemOfRecord: boolean;
};

export type IngestionRecordSummary = IngestionRuntimeItem & {
  id: string;
  createdAt: Date;
};

export type RetrievalTraceSummary = HelmV2RetrievalTraceContract & {
  id: string;
  createdAt: Date;
  runtimeLabel: string;
  workerId: string | null;
};

export type MeetingConnectorIngestionRetrievalSummary = {
  latestRuntimeEvent: {
    id: string;
    eventType: string;
    createdAt: Date;
  } | null;
  sourceCoverage: {
    total: number;
    trusted: number;
    untrusted: number;
    draftOnly: number;
    promotionEligible: number;
    systemOfRecord: number;
  };
  sources: IngestionRecordSummary[];
  traces: RetrievalTraceSummary[];
  loadingStrategy: {
    alwaysOn: string[];
    stageTriggered: string[];
    eventTriggered: string[];
    onDemand: string[];
    priorities: string[];
    conflictRules: string[];
  };
  boundaryNotes: string[];
};

export type Sprint7EvalResult = {
  ingestionTrustClassificationPass: boolean;
  promotionEligibilityPass: boolean;
  retrievalRelevancePass: boolean;
  staleMemorySuppressionPass: boolean;
  policyLoadingCorrectnessPass: boolean;
  objectSummaryLoadingCorrectnessPass: boolean;
  evidenceProvenanceCompletenessPass: boolean;
};

function snippetLines(...values: Array<string | null | undefined>) {
  return values
    .flatMap((value) =>
      (value ?? "")
        .split(/\n|。|；|;/)
        .map((line) => trimText(line, 140).trim()),
    )
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
    .slice(0, 6);
}

function isStaleMemoryItem(item: Pick<MemoryItem, "createdAt" | "lastValidatedAt" | "verification">) {
  if (item.verification === MemoryItemVerification.SYSTEM_OF_RECORD) return false;
  const reference = item.lastValidatedAt ?? item.createdAt;
  const ageMs = Date.now() - reference.getTime();
  return ageMs > STALE_MEMORY_DAYS * 24 * 60 * 60 * 1000;
}

function toMemoryTrustStatus(item: Pick<MemoryItem, "verification" | "status">): HelmV2TrustPromotionStatus {
  if (item.verification === MemoryItemVerification.SYSTEM_OF_RECORD) return "system_of_record";
  if (item.verification === MemoryItemVerification.HUMAN_CONFIRMED || item.status === MemoryItemStatus.PROMOTED) {
    return "human_confirmed";
  }
  if (item.verification === MemoryItemVerification.DEPRECATED) return "deprecated";
  if (item.verification === MemoryItemVerification.DRAFT || item.status === MemoryItemStatus.DRAFT) return "draft_only";
  return "untrusted";
}

function buildLoadRef(input: {
  key: string;
  label: string;
  reason: string;
  loaded: boolean;
  sourceType?: HelmV2RetrievalLoadRef["sourceType"];
  trustPromotionStatus?: HelmV2TrustPromotionStatus;
}): HelmV2RetrievalLoadRef {
  return {
    key: input.key,
    label: input.label,
    reason: input.reason,
    loaded: input.loaded,
    sourceType: input.sourceType,
    trustPromotionStatus: input.trustPromotionStatus,
  };
}

function buildTraceRow(input: {
  runtimeLabel: string;
  workerId: string | null;
  mode: HelmV2RetrievalPolicyMode;
  bucket: HelmV2RetrievalTraceContract["bucket"];
  triggerKey: string;
  rationale: string;
  loadedRefs: HelmV2RetrievalLoadRef[];
  skippedRefs: HelmV2RetrievalLoadRef[];
  evidenceRefs: string[];
  sourceProvenance: Array<Record<string, unknown>>;
}): Omit<RetrievalTraceSummary, "id" | "createdAt"> {
  return {
    runtimeLabel: input.runtimeLabel,
    workerId: input.workerId,
    mode: input.mode,
    bucket: input.bucket,
    triggerKey: input.triggerKey,
    rationale: input.rationale,
    loadedRefs: input.loadedRefs,
    skippedRefs: input.skippedRefs,
    evidenceRefs: input.evidenceRefs,
    sourceProvenance: input.sourceProvenance,
  };
}

async function loadMeetingIngestionRuntime(workspaceId: string, meetingId: string) {
  return db.meeting.findFirst({
    where: {
      workspaceId,
      id: meetingId,
    },
    include: {
      workspace: true,
      company: {
        include: {
          emailThreads: {
            orderBy: { updatedAt: "desc" },
            take: 1,
          },
        },
      },
      opportunity: {
        include: {
          emailThreads: {
            orderBy: { updatedAt: "desc" },
            take: 1,
          },
        },
      },
      contacts: true,
      note: true,
      memoryEntries: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });
}

export function buildMeetingConnectorSources(input: {
  meeting: MeetingIngestionRuntime;
  inferredMeetingFacts: string[];
  inferredOpportunityNotes: string[];
}) {
  const { meeting } = input;
  const objectRefs = {
    workspaceId: meeting.workspaceId,
    meetingId: meeting.id,
    opportunityId: meeting.opportunityId ?? null,
    customerId: meeting.companyId ?? null,
  };
  const sources: IngestionRuntimeItem[] = [];

  sources.push({
    ...buildConnectorIngestionContract({
      sourceType: "calendar_event",
      sourceId: meeting.id,
      objectRefs,
      evidenceRef: `calendar:${meeting.id}`,
      extractedFacts: [
        meeting.title,
        meeting.company?.name ?? "",
        ...meeting.contacts.map((contact) => contact.name),
      ].filter(Boolean),
      draftPayload: {
        title: meeting.title,
        startsAt: meeting.startsAt.toISOString(),
        endsAt: meeting.endsAt.toISOString(),
        attendees: meeting.contacts.map((contact) => contact.name),
      },
      summary: "Structured calendar context for the current meeting runtime.",
    }),
    trustPromotionStatus: getConnectorSourcePolicy("calendar_event").defaultTrustPromotionStatus,
    directObjectFactAllowed: getConnectorSourcePolicy("calendar_event").directObjectFactAllowed,
    requiresHumanConfirm: getConnectorSourcePolicy("calendar_event").requiresHumanConfirm,
    systemOfRecord: getConnectorSourcePolicy("calendar_event").systemOfRecord,
  });

  if (meeting.note?.liveTranscript) {
    sources.push({
      ...buildConnectorIngestionContract({
        sourceType: "meeting_transcript",
        sourceId: meeting.note.id,
        objectRefs,
        evidenceRef: `meeting-transcript:${meeting.note.id}`,
        extractedFacts: snippetLines(meeting.note.liveTranscript),
        draftPayload: {
          liveTranscript: trimText(meeting.note.liveTranscript, 1200),
        },
        summary: "Raw transcript input stays untrusted and draft-only.",
      }),
      trustPromotionStatus: getConnectorSourcePolicy("meeting_transcript").defaultTrustPromotionStatus,
      directObjectFactAllowed: getConnectorSourcePolicy("meeting_transcript").directObjectFactAllowed,
      requiresHumanConfirm: getConnectorSourcePolicy("meeting_transcript").requiresHumanConfirm,
      systemOfRecord: getConnectorSourcePolicy("meeting_transcript").systemOfRecord,
    });
  }

  if (meeting.note && snippetLines(meeting.note.summary, meeting.note.keyDecisions, meeting.note.confirmations, meeting.note.meetingGoal, meeting.note.riskAlerts).length > 0) {
    sources.push({
      ...buildConnectorIngestionContract({
        sourceType: "meeting_note",
        sourceId: meeting.note.id,
        objectRefs,
        evidenceRef: `meeting-note:${meeting.note.id}`,
        extractedFacts: snippetLines(
          meeting.note.summary,
          meeting.note.keyDecisions,
          meeting.note.confirmations,
          meeting.note.meetingGoal,
          meeting.note.riskAlerts,
        ),
        draftPayload: {
          summary: meeting.note.summary,
          keyDecisions: meeting.note.keyDecisions,
          confirmations: meeting.note.confirmations,
          meetingGoal: meeting.note.meetingGoal,
          riskAlerts: meeting.note.riskAlerts,
        },
        summary: "Meeting note content can inform extraction, but it still requires confirm before promotion.",
      }),
      trustPromotionStatus: getConnectorSourcePolicy("meeting_note").defaultTrustPromotionStatus,
      directObjectFactAllowed: getConnectorSourcePolicy("meeting_note").directObjectFactAllowed,
      requiresHumanConfirm: getConnectorSourcePolicy("meeting_note").requiresHumanConfirm,
      systemOfRecord: getConnectorSourcePolicy("meeting_note").systemOfRecord,
    });
  }

  if (meeting.opportunity || meeting.company) {
    sources.push({
      ...buildConnectorIngestionContract({
        sourceType: "crm_snapshot",
        sourceId: meeting.opportunityId ?? meeting.companyId ?? meeting.id,
        objectRefs,
        evidenceRef: `crm:${meeting.opportunityId ?? meeting.companyId ?? meeting.id}`,
        extractedFacts: snippetLines(
          meeting.opportunity?.title,
          meeting.opportunity?.stage,
          meeting.opportunity?.nextAction,
          meeting.company?.name,
        ),
        draftPayload: {
          opportunityTitle: meeting.opportunity?.title,
          stage: meeting.opportunity?.stage,
          riskLevel: meeting.opportunity?.riskLevel,
          nextAction: meeting.opportunity?.nextAction,
          companyName: meeting.company?.name,
        },
        summary: "Current CRM snapshot remains the most reliable object-fact source for official posture.",
      }),
      trustPromotionStatus: getConnectorSourcePolicy("crm_snapshot").defaultTrustPromotionStatus,
      directObjectFactAllowed: getConnectorSourcePolicy("crm_snapshot").directObjectFactAllowed,
      requiresHumanConfirm: getConnectorSourcePolicy("crm_snapshot").requiresHumanConfirm,
      systemOfRecord: getConnectorSourcePolicy("crm_snapshot").systemOfRecord,
    });
  }

  const latestEmailThread = meeting.opportunity?.emailThreads[0] ?? meeting.company?.emailThreads[0] ?? null;
  if (latestEmailThread) {
    sources.push({
      ...buildConnectorIngestionContract({
        sourceType: "email_thread",
        sourceId: latestEmailThread.id,
        objectRefs,
        evidenceRef: `email-thread:${latestEmailThread.id}`,
        extractedFacts: snippetLines(latestEmailThread.subject, latestEmailThread.summary, latestEmailThread.waitingOn),
        draftPayload: {
          subject: latestEmailThread.subject,
          summary: latestEmailThread.summary,
          counterpart: latestEmailThread.counterpart,
          waitingOn: latestEmailThread.waitingOn,
        },
        summary: "Email thread content remains useful retrieval context, but it stays untrusted for direct promotion.",
      }),
      trustPromotionStatus: getConnectorSourcePolicy("email_thread").defaultTrustPromotionStatus,
      directObjectFactAllowed: getConnectorSourcePolicy("email_thread").directObjectFactAllowed,
      requiresHumanConfirm: getConnectorSourcePolicy("email_thread").requiresHumanConfirm,
      systemOfRecord: getConnectorSourcePolicy("email_thread").systemOfRecord,
    });
  }

  if (meeting.memoryEntries.length > 0) {
    sources.push({
      ...buildConnectorIngestionContract({
        sourceType: "human_edit",
        sourceId: meeting.memoryEntries[0]!.id,
        objectRefs,
        evidenceRef: `human-edit:${meeting.memoryEntries[0]!.id}`,
        extractedFacts: meeting.memoryEntries.map((entry) => entry.title),
        draftPayload: {
          entries: meeting.memoryEntries.map((entry) => ({
            id: entry.id,
            title: entry.title,
            content: trimText(entry.content, 240),
          })),
        },
        summary: "Recent human edits stay the strongest non-CRM promotion candidate in this meeting scope.",
      }),
      trustPromotionStatus: getConnectorSourcePolicy("human_edit").defaultTrustPromotionStatus,
      directObjectFactAllowed: getConnectorSourcePolicy("human_edit").directObjectFactAllowed,
      requiresHumanConfirm: getConnectorSourcePolicy("human_edit").requiresHumanConfirm,
      systemOfRecord: getConnectorSourcePolicy("human_edit").systemOfRecord,
    });
  }

  if (input.inferredMeetingFacts.length > 0 || input.inferredOpportunityNotes.length > 0) {
    sources.push({
      ...buildConnectorIngestionContract({
        sourceType: "agent_inference",
        sourceId: `agent-inference:${meeting.id}`,
        objectRefs,
        evidenceRef: `artifact:${meeting.id}:agent_inference`,
        extractedFacts: [...input.inferredMeetingFacts, ...input.inferredOpportunityNotes].slice(0, 6),
        draftPayload: {
          meetingInferred: input.inferredMeetingFacts,
          opportunityInferred: input.inferredOpportunityNotes,
        },
        summary: "Agent inference remains draft-only and can never replace fact without confirm.",
      }),
      trustPromotionStatus: getConnectorSourcePolicy("agent_inference").defaultTrustPromotionStatus,
      directObjectFactAllowed: getConnectorSourcePolicy("agent_inference").directObjectFactAllowed,
      requiresHumanConfirm: getConnectorSourcePolicy("agent_inference").requiresHumanConfirm,
      systemOfRecord: getConnectorSourcePolicy("agent_inference").systemOfRecord,
    });
  }

  return sources;
}

export function buildMeetingRetrievalTraces(input: {
  meeting: MeetingIngestionRuntime;
  runtimeEventId: string | null;
  sources: IngestionRuntimeItem[];
  memoryItems: Array<Pick<MemoryItem, "id" | "summary" | "status" | "verification" | "createdAt" | "lastValidatedAt">>;
  hasDraftCommsRuntime: boolean;
  hasOfficialWriteRuntime: boolean;
}) {
  const evidenceRefs = [
    `meeting:${input.meeting.id}`,
    ...(input.meeting.opportunityId ? [`opportunity:${input.meeting.opportunityId}`] : []),
    ...(input.meeting.companyId ? [`company:${input.meeting.companyId}`] : []),
  ];
  const sourceProvenance = input.sources.map((source) => ({
    sourceType: source.ingestionSourceType,
    sourceId: source.ingestionSourceId,
    trustLevel: source.ingestionTrustLevel,
    promotionEligibility: source.ingestionPromotionEligibility,
  }));
  const activeMemory = input.memoryItems.filter(
    (item) => item.status === MemoryItemStatus.PROMOTED || item.verification === MemoryItemVerification.HUMAN_CONFIRMED,
  );
  const staleMemory = activeMemory.filter(isStaleMemoryItem);
  const freshMemory = activeMemory.filter((item) => !isStaleMemoryItem(item));

  const traces: Array<Omit<RetrievalTraceSummary, "id" | "createdAt">> = [];
  const runtimeDefinitions: Array<{
    runtimeLabel: string;
    workerId: string | null;
    eventType: "meeting.ended" | "proposal.requested" | "official.write_intent_created";
    namespace: HelmV2MemoryNamespace;
    enabled: boolean;
  }> = [
    {
      runtimeLabel: "Meeting Analyst",
      workerId: "meeting-analyst",
      eventType: "meeting.ended",
      namespace: "meeting",
      enabled: true,
    },
    {
      runtimeLabel: "Proposal Composer / Comms",
      workerId: "proposal-composer",
      eventType: "proposal.requested",
      namespace: "proposal",
      enabled: input.hasDraftCommsRuntime,
    },
    {
      runtimeLabel: "Official Write Review",
      workerId: "risk-promise-guard",
      eventType: "official.write_intent_created",
      namespace: "approval",
      enabled: input.hasOfficialWriteRuntime,
    },
  ];

  for (const definition of runtimeDefinitions) {
    if (!definition.enabled) continue;

    const plan = resolveRetrievalPlan({
      workerId: definition.workerId ?? "helm-core",
      eventType: definition.eventType,
      namespace: definition.namespace,
    });

    traces.push(
      buildTraceRow({
        runtimeLabel: definition.runtimeLabel,
        workerId: definition.workerId,
        mode: "always_on",
        bucket: "policy_memory",
        triggerKey: `${definition.runtimeLabel.toLowerCase().replace(/\s+/g, "_")}.always_on.policy`,
        rationale: "Always-on policy memory keeps boundary, approval and non-commitment rules visible.",
        loadedRefs: plan.buckets.always_on
          .filter((item) => item.key.includes("policy"))
          .map((item) =>
            buildLoadRef({
              ...item,
              loaded: true,
            }),
          ),
        skippedRefs: [],
        evidenceRefs,
        sourceProvenance,
      }),
      buildTraceRow({
        runtimeLabel: definition.runtimeLabel,
        workerId: definition.workerId,
        mode: "always_on",
        bucket: "object_memory",
        triggerKey: `${definition.runtimeLabel.toLowerCase().replace(/\s+/g, "_")}.always_on.object`,
        rationale: "Always-on object summaries anchor the current workspace, meeting and primary opportunity before any inference.",
        loadedRefs: [
          buildLoadRef({
            key: "workspace-summary",
            label: "workspace-summary",
            reason: "Current workspace summary stays always-on for every runtime.",
            loaded: true,
            sourceType: "summary",
            trustPromotionStatus: "trusted",
          }),
          buildLoadRef({
            key: "primary-opportunity-summary",
            label: "primary-opportunity-summary",
            reason: input.meeting.opportunity
              ? "Current primary opportunity summary is relevant to this meeting runtime."
              : "No linked opportunity is available for this meeting.",
            loaded: Boolean(input.meeting.opportunity),
            sourceType: "summary",
            trustPromotionStatus: input.meeting.opportunity ? "trusted" : "draft_only",
          }),
        ].filter((item) => item.loaded),
        skippedRefs: input.meeting.opportunity
          ? []
          : [
              buildLoadRef({
                key: "primary-opportunity-summary",
                label: "primary-opportunity-summary",
                reason: "Skipped because this meeting has no linked opportunity.",
                loaded: false,
                sourceType: "summary",
                trustPromotionStatus: "draft_only",
              }),
            ],
        evidenceRefs,
        sourceProvenance,
      }),
      buildTraceRow({
        runtimeLabel: definition.runtimeLabel,
        workerId: definition.workerId,
        mode: "event_triggered",
        bucket: "policy_memory",
        triggerKey: definition.eventType,
        rationale: `Event-triggered retrieval keeps only the extra policy and stage packages needed for ${definition.eventType}.`,
        loadedRefs: plan.buckets.event_triggered.map((item) =>
          buildLoadRef({
            ...item,
            loaded: true,
          }),
        ),
        skippedRefs: [],
        evidenceRefs,
        sourceProvenance,
      }),
      buildTraceRow({
        runtimeLabel: definition.runtimeLabel,
        workerId: definition.workerId,
        mode: "event_triggered",
        bucket: "object_memory",
        triggerKey: definition.eventType,
        rationale: `Event-triggered connector retrieval is scoped to ${definition.eventType} so the runtime loads only the normalized sources needed for this step.`,
        loadedRefs: input.sources.map((source) =>
          buildLoadRef({
            key: `${source.ingestionSourceType}:${source.ingestionSourceId}`,
            label: source.ingestionSummary,
            reason: source.ingestionBoundaryNote,
            loaded: true,
            sourceType: source.ingestionSourceType,
            trustPromotionStatus: source.trustPromotionStatus,
          }),
        ),
        skippedRefs: staleMemory.map((item) =>
          buildLoadRef({
            key: `memory:${item.id}`,
            label: trimText(item.summary, 80),
            reason: "Skipped because the memory looks stale and has not been recently validated.",
            loaded: false,
            sourceType: "memory_item",
            trustPromotionStatus: toMemoryTrustStatus(item),
          }),
        ),
        evidenceRefs,
        sourceProvenance,
      }),
      buildTraceRow({
        runtimeLabel: definition.runtimeLabel,
        workerId: definition.workerId,
        mode: "stage_triggered",
        bucket: "handoff_checkpoint_memory",
        triggerKey: definition.namespace,
        rationale: "Stage-triggered memory pulls only the summaries needed for the current business stage, not the entire history.",
        loadedRefs: [
          ...plan.buckets.stage_triggered.map((item) =>
            buildLoadRef({
              ...item,
              loaded: true,
            }),
          ),
          ...freshMemory.slice(0, 3).map((item) =>
            buildLoadRef({
              key: `memory:${item.id}`,
              label: trimText(item.summary, 80),
              reason: "Recent promoted memory stays eligible as checkpoint context.",
              loaded: true,
              sourceType: "memory_item",
              trustPromotionStatus: toMemoryTrustStatus(item),
            }),
          ),
        ],
        skippedRefs: [],
        evidenceRefs,
        sourceProvenance,
      }),
      buildTraceRow({
        runtimeLabel: definition.runtimeLabel,
        workerId: definition.workerId,
        mode: "on_demand",
        bucket: "learned_memory",
        triggerKey: `${definition.runtimeLabel.toLowerCase().replace(/\s+/g, "_")}.on_demand.learned`,
        rationale: "Historical meetings, learned patterns and older proposals remain on-demand to avoid prompt stuffing.",
        loadedRefs: [],
        skippedRefs: plan.buckets.on_demand.map((item) =>
          buildLoadRef({
            ...item,
            loaded: false,
          }),
        ),
        evidenceRefs,
        sourceProvenance,
      }),
    );
  }

  return traces;
}

async function loadMeetingArtifacts(workspaceId: string, meetingId: string) {
  const bundles = await db.artifactBundle.findMany({
    where: {
      workspaceId,
      meetingId,
      artifactType: {
        in: ["meeting_facts.json", "opportunity_delta.json", "draft_comms_bundle.json"],
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const meetingFacts = bundles.find((bundle) => bundle.artifactType === "meeting_facts.json") ?? null;
  const opportunityDelta = bundles.find((bundle) => bundle.artifactType === "opportunity_delta.json") ?? null;
  const draftComms = bundles.find((bundle) => bundle.artifactType === "draft_comms_bundle.json") ?? null;

  return {
    meetingFacts: safeParseJson<MeetingConnectorArtifactPayload>(meetingFacts?.artifactsJson, {}),
    opportunityDelta: safeParseJson<OpportunityDeltaArtifactPayload>(opportunityDelta?.artifactsJson, {}),
    hasDraftCommsRuntime: draftComms?.status === "CONFIRMED" || draftComms?.status === "CONSUMED" || draftComms?.status === "DRAFT",
  };
}

export async function syncMeetingConnectorIngestionRetrievalRuntime(input: {
  workspaceId: string;
  meetingId: string;
}) {
  const meeting = await loadMeetingIngestionRuntime(input.workspaceId, input.meetingId);
  if (!meeting) return null;

  const [latestRuntimeEvent, memoryItems, officialWriteCount, artifacts] = await Promise.all([
    db.runtimeEvent.findFirst({
      where: {
        workspaceId: input.workspaceId,
        meetingId: input.meetingId,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.memoryItem.findMany({
      where: {
        workspaceId: input.workspaceId,
        OR: [
          { meetingId: input.meetingId },
          ...(meeting.opportunityId ? [{ opportunityId: meeting.opportunityId }] : []),
          ...(meeting.companyId ? [{ companyId: meeting.companyId }] : []),
        ],
        verification: {
          not: MemoryItemVerification.DEPRECATED,
        },
      },
      orderBy: [{ promotedAt: "desc" }, { createdAt: "desc" }],
      take: 12,
    }),
    db.officialWriteIntent.count({
      where: {
        workspaceId: input.workspaceId,
        meetingId: input.meetingId,
      },
    }),
    loadMeetingArtifacts(input.workspaceId, input.meetingId),
  ]);

  const inferredMeetingFacts = (artifacts.meetingFacts.inferred ?? [])
    .map((item) => trimText(item.summary ?? "", 120))
    .filter(Boolean);
  const inferredOpportunityNotes = [
    ...safeParseJson<string[]>(jsonStringify(artifacts.opportunityDelta.inferredAssumptions ?? []), []),
    trimText(artifacts.opportunityDelta.stageRationale ?? "", 120),
  ].filter(Boolean);

  const sources = buildMeetingConnectorSources({
    meeting,
    inferredMeetingFacts,
    inferredOpportunityNotes,
  });
  const traces = buildMeetingRetrievalTraces({
    meeting,
    runtimeEventId: latestRuntimeEvent?.id ?? null,
    sources,
    memoryItems,
    hasDraftCommsRuntime: artifacts.hasDraftCommsRuntime,
    hasOfficialWriteRuntime: officialWriteCount > 0,
  });

  await db.connectorIngestionRecord.deleteMany({
    where: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
    },
  });
  await db.retrievalTrace.deleteMany({
    where: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
    },
  });

  if (sources.length > 0) {
    await db.connectorIngestionRecord.createMany({
      data: sources.map((source) => ({
        workspaceId: input.workspaceId,
        runtimeEventId: latestRuntimeEvent?.id,
        meetingId: meeting.id,
        opportunityId: meeting.opportunityId,
        companyId: meeting.companyId,
        sourceType: source.ingestionSourceType,
        sourceId: source.ingestionSourceId,
        sourceScope: source.ingestionScope,
        trustLevel: source.ingestionTrustLevel,
        trustPromotionStatus: source.trustPromotionStatus,
        sensitivity: source.ingestionSensitivity,
        normalizationStatus: source.ingestionNormalizationStatus,
        promotionEligibility: source.ingestionPromotionEligibility,
        objectRefs: jsonStringify(source.ingestionObjectRefs),
        evidenceRef: source.ingestionEvidenceRef,
        extractedFacts: jsonStringify(source.ingestionExtractedFacts),
        draftPayload: jsonStringify(source.ingestionDraftPayload),
        sourceSummary: source.ingestionSummary,
        boundaryNote: source.ingestionBoundaryNote,
      })),
    });
  }

  if (traces.length > 0) {
    await db.retrievalTrace.createMany({
      data: traces.map((trace) => ({
        workspaceId: input.workspaceId,
        runtimeEventId: latestRuntimeEvent?.id,
        meetingId: meeting.id,
        opportunityId: meeting.opportunityId,
        companyId: meeting.companyId,
        runtimeLabel: trace.runtimeLabel,
        workerId: trace.workerId,
        triggerMode: trace.mode,
        triggerKey: trace.triggerKey,
        bucket: trace.bucket,
        rationale: trace.rationale,
        loadedRefs: jsonStringify(trace.loadedRefs),
        skippedRefs: jsonStringify(trace.skippedRefs),
        evidenceRefs: jsonStringify(trace.evidenceRefs),
        sourceProvenance: jsonStringify(trace.sourceProvenance),
      })),
    });
  }

  return {
    sourceCount: sources.length,
    traceCount: traces.length,
  };
}

export async function getMeetingConnectorIngestionRetrievalSummary(
  workspaceId: string,
  meetingId: string,
): Promise<MeetingConnectorIngestionRetrievalSummary | null> {
  const [latestRuntimeEvent, sourceRows, traceRows] = await Promise.all([
    db.runtimeEvent.findFirst({
      where: {
        workspaceId,
        meetingId,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.connectorIngestionRecord.findMany({
      where: {
        workspaceId,
        meetingId,
      },
      orderBy: [{ createdAt: "asc" }],
    }),
    db.retrievalTrace.findMany({
      where: {
        workspaceId,
        meetingId,
      },
      orderBy: [{ createdAt: "asc" }],
    }),
  ]);

  if (!latestRuntimeEvent && sourceRows.length === 0 && traceRows.length === 0) {
    return null;
  }

  const sources = sourceRows.map<IngestionRecordSummary>((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    ingestionSourceType: row.sourceType as HelmV2SourceType,
    ingestionSourceId: row.sourceId,
    ingestionScope: row.sourceScope as IngestionRuntimeItem["ingestionScope"],
    ingestionTrustLevel: row.trustLevel as IngestionRuntimeItem["ingestionTrustLevel"],
    ingestionSensitivity: row.sensitivity as IngestionRuntimeItem["ingestionSensitivity"],
    ingestionNormalizationStatus: row.normalizationStatus as IngestionRuntimeItem["ingestionNormalizationStatus"],
    ingestionPromotionEligibility: row.promotionEligibility as IngestionRuntimeItem["ingestionPromotionEligibility"],
    ingestionObjectRefs: safeParseJson(row.objectRefs, { workspaceId }),
    ingestionEvidenceRef: row.evidenceRef,
    ingestionExtractedFacts: safeParseJson<string[]>(row.extractedFacts, []),
    ingestionDraftPayload: safeParseJson<Record<string, unknown>>(row.draftPayload, {}),
    ingestionBoundaryNote: row.boundaryNote,
    ingestionSummary: row.sourceSummary,
    trustPromotionStatus: row.trustPromotionStatus as HelmV2TrustPromotionStatus,
    directObjectFactAllowed: getConnectorSourcePolicy(row.sourceType as HelmV2SourceType).directObjectFactAllowed,
    requiresHumanConfirm: getConnectorSourcePolicy(row.sourceType as HelmV2SourceType).requiresHumanConfirm,
    systemOfRecord: getConnectorSourcePolicy(row.sourceType as HelmV2SourceType).systemOfRecord,
  }));

  const traces = traceRows.map<RetrievalTraceSummary>((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    runtimeLabel: row.runtimeLabel,
    workerId: row.workerId,
    mode: row.triggerMode as HelmV2RetrievalPolicyMode,
    bucket: row.bucket as HelmV2RetrievalTraceContract["bucket"],
    triggerKey: row.triggerKey,
    rationale: row.rationale,
    loadedRefs: safeParseJson<HelmV2RetrievalLoadRef[]>(row.loadedRefs, []),
    skippedRefs: safeParseJson<HelmV2RetrievalLoadRef[]>(row.skippedRefs, []),
    evidenceRefs: safeParseJson<string[]>(row.evidenceRefs, []),
    sourceProvenance: safeParseJson<Array<Record<string, unknown>>>(row.sourceProvenance, []),
  }));

  return {
    latestRuntimeEvent: latestRuntimeEvent
      ? {
          id: latestRuntimeEvent.id,
          eventType: latestRuntimeEvent.eventType,
          createdAt: latestRuntimeEvent.createdAt,
        }
      : null,
    sourceCoverage: {
      total: sources.length,
      trusted: sources.filter((source) => source.ingestionTrustLevel === "trusted").length,
      untrusted: sources.filter((source) => source.ingestionTrustLevel === "untrusted").length,
      draftOnly: sources.filter((source) => source.ingestionPromotionEligibility === "draft_only").length,
      promotionEligible: sources.filter((source) =>
        ["human_confirmed", "system_of_record"].includes(source.ingestionPromotionEligibility),
      ).length,
      systemOfRecord: sources.filter((source) => source.systemOfRecord).length,
    },
    sources,
    traces,
    loadingStrategy: {
      alwaysOn: HELM_V2_MEMORY_LOAD_PLAN.alwaysOn.map((item) => item.key),
      stageTriggered: HELM_V2_MEMORY_LOAD_PLAN.stageTriggered.map((item) => item.key),
      eventTriggered: HELM_V2_MEMORY_LOAD_PLAN.eventTriggered.map((item) => item.key),
      onDemand: HELM_V2_MEMORY_LOAD_PLAN.onDemand.map((item) => item.key),
      priorities: Object.values(HELM_V2_MEMORY_LOADING_PRIORITY),
      conflictRules: [
        resolveMemoryConflict({
          field: "official_stage",
          currentStatus: "system_of_record",
          incomingStatus: "human_confirmed",
        }).reason,
        resolveMemoryConflict({
          field: "next_action",
          currentStatus: "human_confirmed",
          incomingStatus: "draft_only",
        }).reason,
      ],
    },
    boundaryNotes: [INGESTION_BOUNDARY_NOTE, RETRIEVAL_BOUNDARY_NOTE],
  };
}

export function evaluateSprint7IngestionRetrieval(input: {
  sources: IngestionRuntimeItem[];
  traces: Array<Omit<RetrievalTraceSummary, "id" | "createdAt">>;
  expected: {
    sourceExpectations: Array<{
      sourceType: HelmV2SourceType;
      trustLevel: "trusted" | "untrusted";
      promotionEligibility: "draft_only" | "human_confirmed" | "system_of_record";
    }>;
    requiredLoadedKeys: string[];
    requiredSkippedKeys: string[];
    staleSuppressedKeys: string[];
  };
}): Sprint7EvalResult {
  const loadedKeys = input.traces.flatMap((trace) => trace.loadedRefs.map((item) => item.key));
  const skippedKeys = input.traces.flatMap((trace) => trace.skippedRefs.map((item) => item.key));

  return {
    ingestionTrustClassificationPass: input.expected.sourceExpectations.every((expected) => {
      const source = input.sources.find((item) => item.ingestionSourceType === expected.sourceType);
      return source?.ingestionTrustLevel === expected.trustLevel;
    }),
    promotionEligibilityPass: input.expected.sourceExpectations.every((expected) => {
      const source = input.sources.find((item) => item.ingestionSourceType === expected.sourceType);
      return source?.ingestionPromotionEligibility === expected.promotionEligibility;
    }),
    retrievalRelevancePass: input.expected.requiredLoadedKeys.every((key) => loadedKeys.includes(key)),
    staleMemorySuppressionPass: input.expected.staleSuppressedKeys.every((key) => skippedKeys.includes(key)),
    policyLoadingCorrectnessPass: loadedKeys.includes("policy-summary"),
    objectSummaryLoadingCorrectnessPass: loadedKeys.includes("workspace-summary"),
    evidenceProvenanceCompletenessPass:
      input.sources.every((source) => Boolean(source.ingestionEvidenceRef)) &&
      input.traces.every((trace) => trace.evidenceRefs.length > 0 && trace.sourceProvenance.length > 0),
  };
}
