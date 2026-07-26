import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { ActorType, ExternalSyncProvider } from "@prisma/client";
import { evaluateExternalAgentArtifact } from "@/features/external-agent-intake/intake-decision";
import type { ExternalAgentObjectType } from "@/features/external-agent-intake/artifact-contract";
import { buildQoderWorkExternalAgentArtifact } from "@/features/qoderwork-intake/artifact-adapter";
import type {
  QoderWorkConnectionScope,
  QoderWorkMcpResponse,
  QoderWorkMcpToolName,
} from "@/features/qoderwork-intake/mcp-contract";
import { db } from "@/lib/db";

type AuthenticatedConnection = {
  connectionId: string;
  workspaceId: string;
  userId: string;
  deviceRef: string;
  observationProgramId: string;
  scopes: readonly QoderWorkConnectionScope[];
  allowedSourceIds: readonly string[];
  allowedObjectTypes: readonly string[];
  maxDataClassification: string;
  approvedModelProfileRefs: readonly string[];
};

type ProposalToolName = Extract<
  QoderWorkMcpToolName,
  "propose_evidence_manifest" | "propose_draft_artifact" | "propose_receipt_candidate"
>;

type ReadToolArguments = {
  schemaVersion: string;
  correlationRef: string;
  idempotencyKey: string;
  objectRef: { type: ExternalAgentObjectType; id: string };
  statuses?: string[];
  limit?: number;
  workPacketRef: string;
};

type ProposalArguments = {
  schemaVersion: string;
  correlationRef: string;
  idempotencyKey: string;
  objectRef: { type: ExternalAgentObjectType; id: string };
  summary: string;
  evidenceRefs: string[];
  contentHash: string;
  redactionStatus: "redacted" | "alias_only" | "unknown";
  sourceProgramRef: string;
  observationSourceRef: string;
  sourceRef: string;
  sourceKind: string;
  observedAt?: string;
  dataClassification: string;
  approvedModelProfileRef?: string;
  workPacketRef: string;
};

const CLASSIFICATION_RANK: Record<string, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
};

export async function executeQoderWorkTool(input: {
  auth: AuthenticatedConnection;
  toolName: QoderWorkMcpToolName;
  arguments: unknown;
  now?: Date;
}): Promise<QoderWorkMcpResponse> {
  const now = input.now ?? new Date();
  if (input.toolName.startsWith("propose_")) {
    return executeProposal({
      auth: input.auth,
      toolName: input.toolName as ProposalToolName,
      proposal: input.arguments as ProposalArguments,
      now,
    });
  }
  return executeRead({
    auth: input.auth,
    toolName: input.toolName as Exclude<QoderWorkMcpToolName, ProposalToolName>,
    arguments: input.arguments as ReadToolArguments,
    now,
  });
}

async function executeRead(input: {
  auth: AuthenticatedConnection;
  toolName: Exclude<QoderWorkMcpToolName, ProposalToolName>;
  arguments: ReadToolArguments;
  now: Date;
}): Promise<QoderWorkMcpResponse> {
  const boundaryWarnings = validateReadBinding(input.auth, input.arguments);
  if (boundaryWarnings.length > 0) {
    return rejectedRead(input, boundaryWarnings);
  }
  const observedObjectRef = canonicalObjectRef(input.arguments.objectRef);
  let data: unknown;
  let nextAllowedSurface: QoderWorkMcpResponse["nextAllowedSurface"] = "/dashboard";
  if (input.toolName === "list_decision_objects") {
    const statusFilter = Array.isArray(input.arguments.statuses) ? input.arguments.statuses : undefined;
    const limit = input.arguments.limit ?? 20;
    const records = await db.decisionRecord.findMany({
      where: { workspaceId: input.auth.workspaceId, ...(statusFilter ? { status: { in: statusFilter } } : {}) },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit * 5, 100),
      select: {
        id: true,
        decisionKey: true,
        decisionType: true,
        businessQuestion: true,
        evidenceRefs: true,
        factsJson: true,
        inferencesJson: true,
        unknownsJson: true,
        confidence: true,
        riskLevel: true,
        ownerGate: true,
        status: true,
        validUntil: true,
        createdAt: true,
        contextRefs: true,
      },
    });
    data = records
      .filter((record) => decisionReferencesObject(record.contextRefs, observedObjectRef))
      .slice(0, limit)
      .map(({ contextRefs: _contextRefs, ...record }) => record);
    nextAllowedSurface = "/approvals";
  } else if (input.toolName === "get_work_packet") {
    const claim = await db.decisionWorkPacketClaim.findFirst({
      where: {
        workspaceId: input.auth.workspaceId,
        OR: [
          { id: input.arguments.workPacketRef },
          { actionItemId: input.arguments.workPacketRef },
        ],
        decisionRecord: {
          ownerConfirmedAt: { not: null },
          status: { in: ["OWNER_CONFIRMED", "DISPATCHED"] },
        },
      },
      select: {
        id: true,
        actionItemId: true,
        ownerCommandJson: true,
        createdAt: true,
        decisionRecord: {
          select: {
            id: true,
            decisionKey: true,
            businessQuestion: true,
            evidenceRefs: true,
            contextRefs: true,
            ownerConclusion: true,
            ownerConfirmedAt: true,
            validUntil: true,
          },
        },
        actionItem: {
          select: { id: true, title: true, description: true, dueDate: true, status: true, ownerId: true },
        },
      },
    });
    if (claim && decisionReferencesObject(claim.decisionRecord.contextRefs, observedObjectRef)) {
      const { contextRefs: _contextRefs, ...decisionRecord } = claim.decisionRecord;
      data = { ...claim, decisionRecord };
    } else {
      data = null;
    }
    nextAllowedSurface = "/approvals";
  } else if (input.toolName === "get_supervision_summary") {
    data = await db.supervisionSignalRecord.findMany({
      where: { workspaceId: input.auth.workspaceId, observedObjectRef },
      orderBy: { createdAt: "desc" },
      take: input.arguments.limit ?? 20,
      select: {
        id: true,
        signalKey: true,
        signalType: true,
        observedObjectRef: true,
        evidenceRefs: true,
        severity: true,
        confidence: true,
        recommendedRoute: true,
        status: true,
        observedFact: true,
        interpretation: true,
        actualState: true,
        expectedState: true,
        deadlineOrSla: true,
        createdAt: true,
      },
    });
  } else {
    const [decisions, signals] = await Promise.all([
      db.decisionRecord.findMany({
        where: { workspaceId: input.auth.workspaceId },
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          id: true,
          decisionKey: true,
          businessQuestion: true,
          evidenceRefs: true,
          factsJson: true,
          inferencesJson: true,
          unknownsJson: true,
          confidence: true,
          riskLevel: true,
          status: true,
          validUntil: true,
          contextRefs: true,
        },
      }),
      db.supervisionSignalRecord.findMany({
        where: { workspaceId: input.auth.workspaceId, observedObjectRef },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          signalType: true,
          evidenceRefs: true,
          severity: true,
          status: true,
          observedFact: true,
          actualState: true,
          deadlineOrSla: true,
        },
      }),
    ]);
    data = {
      objectRef: input.arguments.objectRef,
      projectedAt: input.now.toISOString(),
      projectionAuthority: "read_only_no_action_authority",
      dataClassification: "internal",
      decisions: decisions
        .filter((record) => decisionReferencesObject(record.contextRefs, observedObjectRef))
        .slice(0, 5)
        .map(({ contextRefs: _contextRefs, ...record }) => record),
      supervisionSignals: signals,
    };
  }

  const requestRef = `request:${randomUUID()}`;
  const receipt = await db.auditLog.create({
    data: {
      workspaceId: input.auth.workspaceId,
      userId: input.auth.userId,
      actor: `QoderWork device ${input.auth.deviceRef}`,
      actorType: ActorType.AI,
      actionType: "QODERWORK_MCP_READ",
      targetType: "ExternalAgentConnection",
      targetId: input.auth.connectionId,
      summary: `QoderWork used governed read tool ${input.toolName}`,
      payload: JSON.stringify({
        toolName: input.toolName,
        noWrite: true,
        noExternalSend: true,
        auditRetainUntil: auditRetainUntil(input.now),
      }),
      sourcePage: "/api/mcp/qoderwork",
      traceId: input.arguments.correlationRef,
      requestId: requestRef,
    },
  });
  return {
    status: data ? "accepted" : "review_required",
    requestRef,
    correlationRef: input.arguments.correlationRef,
    acceptedArtifactRefs: [],
    receiptRef: receipt.id,
    warnings: data ? [] : ["object_not_found_or_not_owner_confirmed"],
    nextAllowedSurface,
    data,
  };
}

function validateReadBinding(
  auth: AuthenticatedConnection,
  args: ReadToolArguments,
) {
  const warnings: string[] = [];
  if (!auth.allowedObjectTypes.includes(args.objectRef.type)) {
    warnings.push("object_type_out_of_scope");
  }
  if ((CLASSIFICATION_RANK[auth.maxDataClassification] ?? -1) < CLASSIFICATION_RANK.internal) {
    warnings.push("internal_read_projection_not_authorized");
  }
  return warnings;
}

async function rejectedRead(
  input: {
    auth: AuthenticatedConnection;
    toolName: Exclude<QoderWorkMcpToolName, ProposalToolName>;
    arguments: ReadToolArguments;
    now: Date;
  },
  warnings: readonly string[],
): Promise<QoderWorkMcpResponse> {
  const requestRef = `request:${randomUUID()}`;
  const receipt = await db.auditLog.create({
    data: {
      workspaceId: input.auth.workspaceId,
      userId: input.auth.userId,
      actor: `QoderWork device ${input.auth.deviceRef}`,
      actorType: ActorType.AI,
      actionType: "QODERWORK_READ_REJECTED",
      targetType: "ExternalAgentConnection",
      targetId: input.auth.connectionId,
      summary: "QoderWork read rejected by server-derived scope policy",
      payload: JSON.stringify({
        toolName: input.toolName,
        warnings,
        noBusinessDataReturned: true,
        auditRetainUntil: auditRetainUntil(input.now),
      }),
      sourcePage: "/api/mcp/qoderwork",
      traceId: input.arguments.correlationRef,
      requestId: requestRef,
    },
  });
  return {
    status: "rejected",
    requestRef,
    correlationRef: input.arguments.correlationRef,
    acceptedArtifactRefs: [],
    receiptRef: receipt.id,
    warnings,
    nextAllowedSurface: "/settings",
  };
}

async function executeProposal(input: {
  auth: AuthenticatedConnection;
  toolName: ProposalToolName;
  proposal: ProposalArguments;
  now: Date;
}): Promise<QoderWorkMcpResponse> {
  const boundaryWarnings = await validateProposalBinding(input);
  if (boundaryWarnings.length > 0) {
    return rejectedProposal(input, boundaryWarnings);
  }
  const externalId = contentBoundId(input.auth.connectionId, input.proposal.idempotencyKey);
  const existing = await db.externalMemoryRecord.findUnique({
    where: {
      workspaceId_provider_externalId: {
        workspaceId: input.auth.workspaceId,
        provider: ExternalSyncProvider.QODERWORK,
        externalId,
      },
    },
  });
  if (existing) return replayOrConflict(input, existing);

  const artifact = buildQoderWorkExternalAgentArtifact({
    identity: input.auth,
    toolName: input.toolName,
    receivedAt: input.now.toISOString(),
    proposal: input.proposal,
  });
  const decision = evaluateExternalAgentArtifact(artifact, {
    expectedWorkspaceId: input.auth.workspaceId,
    referenceTimeIso: input.now.toISOString(),
  });
  const status = mapDisposition(decision.disposition);
  const candidateRetainUntil = new Date(input.now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const requestRef = `request:${randomUUID()}`;

  try {
    return await db.$transaction(async (tx) => {
      const record = await tx.externalMemoryRecord.create({
        data: {
          workspaceId: input.auth.workspaceId,
          provider: ExternalSyncProvider.QODERWORK,
          externalId,
          scope: artifact.objectRef?.type ?? "unknown",
          category: artifact.artifactKind,
          occurredAt: new Date(artifact.sourceTimestamp ?? artifact.createdAt),
          rawMetadata: JSON.stringify({
            schemaVersion: input.proposal.schemaVersion,
            correlationRef: input.proposal.correlationRef,
            idempotencyKeyHash: contentBoundId("idempotency", input.proposal.idempotencyKey),
            serverPayloadHash: serverProposalPayloadHash(input.proposal),
            artifactId: artifact.artifactId,
            objectRef: artifact.objectRef,
            evidenceRefs: artifact.citationsOrEvidenceRefs,
            sourceRef: artifact.providerArtifactRef,
            disposition: decision.disposition,
            reasonCodes: decision.reasonCodes,
            candidateRetainUntil: candidateRetainUntil.toISOString(),
            externalCandidateOnly: true,
            activeMemoryCreated: false,
          }),
          text: status === "quarantined" ? "Quarantined external candidate" : artifact.contentSummary,
          sourceFile: null,
          sourceLine: null,
          checksum: artifact.rawOutputHash,
        },
      });
      const receipt = await tx.auditLog.create({
        data: {
          workspaceId: input.auth.workspaceId,
          userId: input.auth.userId,
          actor: `QoderWork device ${input.auth.deviceRef}`,
          actorType: ActorType.AI,
          actionType: "QODERWORK_EXTERNAL_CANDIDATE_RECORDED",
          targetType: "ExternalMemoryRecord",
          targetId: record.id,
          summary: `QoderWork proposal recorded as ${decision.disposition}`,
          payload: JSON.stringify({
            toolName: input.toolName,
            contentHash: artifact.rawOutputHash,
            disposition: decision.disposition,
            reasonCodes: decision.reasonCodes,
            activeMemoryCreated: false,
            externalSendCreated: false,
            officialWriteCreated: false,
            auditRetainUntil: auditRetainUntil(input.now),
          }),
          sourcePage: "/api/mcp/qoderwork",
          traceId: input.proposal.correlationRef,
          requestId: requestRef,
        },
      });
      return {
        status,
        requestRef,
        correlationRef: input.proposal.correlationRef,
        acceptedArtifactRefs: [record.id],
        receiptRef: receipt.id,
        warnings: [...decision.reasonCodes],
        nextAllowedSurface: nextSurface(input.toolName),
      } satisfies QoderWorkMcpResponse;
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      const raced = await db.externalMemoryRecord.findUnique({
        where: {
          workspaceId_provider_externalId: {
            workspaceId: input.auth.workspaceId,
            provider: ExternalSyncProvider.QODERWORK,
            externalId,
          },
        },
      });
      if (raced) return replayOrConflict(input, raced);
    }
    throw error;
  }
}

async function validateProposalBinding(input: {
  auth: AuthenticatedConnection;
  toolName: ProposalToolName;
  proposal: ProposalArguments;
}) {
  const warnings: string[] = [];
  if (!input.auth.allowedObjectTypes.includes(input.proposal.objectRef.type)) {
    warnings.push("object_type_out_of_scope");
  }
  if (input.toolName === "propose_evidence_manifest") {
    const expectedProgramRefs = new Set([
      input.auth.observationProgramId,
      `program:${input.auth.observationProgramId}`,
    ]);
    if (!expectedProgramRefs.has(input.proposal.sourceProgramRef)) warnings.push("program_scope_mismatch");
    if (!input.auth.allowedSourceIds.includes(input.proposal.observationSourceRef)) {
      warnings.push("source_scope_mismatch");
    } else {
      const source = await db.observationSource.findFirst({
        where: {
          id: input.proposal.observationSourceRef,
          workspaceId: input.auth.workspaceId,
          programId: input.auth.observationProgramId,
          status: "ACTIVE",
        },
        select: { sourceKind: true, sensitivity: true },
      });
      if (!source) warnings.push("source_inactive_or_missing");
      else {
        if (source.sourceKind.toLowerCase() !== input.proposal.sourceKind) warnings.push("source_kind_mismatch");
        if (
          (CLASSIFICATION_RANK[input.proposal.dataClassification] ?? 99) <
          (CLASSIFICATION_RANK[source.sensitivity.toLowerCase()] ?? 99)
        ) warnings.push("source_classification_understated");
      }
    }
    if (
      (CLASSIFICATION_RANK[input.proposal.dataClassification] ?? 99) >
      (CLASSIFICATION_RANK[input.auth.maxDataClassification] ?? -1)
    ) warnings.push("data_classification_exceeds_connection");
    if (
      input.proposal.dataClassification === "confidential" &&
      !input.auth.approvedModelProfileRefs.includes(
        input.proposal.approvedModelProfileRef ?? "",
      )
    ) warnings.push("model_profile_not_approved");
  } else {
    const claim = await db.decisionWorkPacketClaim.findFirst({
      where: {
        workspaceId: input.auth.workspaceId,
        OR: [{ id: input.proposal.workPacketRef }, { actionItemId: input.proposal.workPacketRef }],
        decisionRecord: {
          ownerConfirmedAt: { not: null },
          status: { in: ["OWNER_CONFIRMED", "DISPATCHED"] },
        },
      },
      select: {
        id: true,
        decisionRecord: { select: { contextRefs: true } },
      },
    });
    if (!claim) warnings.push("confirmed_work_packet_required");
    else if (!decisionReferencesObject(
      claim.decisionRecord.contextRefs,
      canonicalObjectRef(input.proposal.objectRef),
    )) warnings.push("work_packet_object_scope_mismatch");
  }
  return warnings;
}

async function rejectedProposal(
  input: { auth: AuthenticatedConnection; toolName: ProposalToolName; proposal: ProposalArguments; now: Date },
  warnings: readonly string[],
): Promise<QoderWorkMcpResponse> {
  const requestRef = `request:${randomUUID()}`;
  const receipt = await db.auditLog.create({
    data: {
      workspaceId: input.auth.workspaceId,
      userId: input.auth.userId,
      actor: `QoderWork device ${input.auth.deviceRef}`,
      actorType: ActorType.AI,
      actionType: "QODERWORK_PROPOSAL_REJECTED",
      targetType: "ExternalAgentConnection",
      targetId: input.auth.connectionId,
      summary: "QoderWork proposal rejected by server-derived scope policy",
      payload: JSON.stringify({
        toolName: input.toolName,
        warnings,
        noPayloadStored: true,
        auditRetainUntil: auditRetainUntil(input.now),
      }),
      sourcePage: "/api/mcp/qoderwork",
      traceId: input.proposal.correlationRef,
      requestId: requestRef,
    },
  });
  return {
    status: "rejected",
    requestRef,
    correlationRef: input.proposal.correlationRef,
    acceptedArtifactRefs: [],
    receiptRef: receipt.id,
    warnings,
    nextAllowedSurface: "/settings",
  };
}

async function replayOrConflict(
  input: { auth: AuthenticatedConnection; toolName: ProposalToolName; proposal: ProposalArguments; now: Date },
  existing: { id: string; checksum: string | null; rawMetadata?: string | null },
): Promise<QoderWorkMcpResponse> {
  // Server-side full-payload equality: the stored candidate carries the
  // canonical hash the SERVER computed at record time; a replay is only a
  // replay when the recomputed hash of the incoming payload matches it.
  // The caller-declared contentHash stays a source declaration and, on its
  // own, proves nothing. Missing stored hash fails closed into CONFLICT.
  const storedPayloadHash = parseCandidateMetadata(
    existing.rawMetadata,
  ).serverPayloadHash;
  const sameContent =
    existing.checksum === input.proposal.contentHash &&
    typeof storedPayloadHash === "string" &&
    storedPayloadHash === serverProposalPayloadHash(input.proposal);
  if (!sameContent) {
    const requestRef = `request:${randomUUID()}`;
    const conflictReceipt = await db.auditLog.create({
      data: {
        workspaceId: input.auth.workspaceId,
        userId: input.auth.userId,
        actor: `QoderWork device ${input.auth.deviceRef}`,
        actorType: ActorType.AI,
        actionType: "QODERWORK_IDEMPOTENCY_CONFLICT",
        targetType: "ExternalMemoryRecord",
        targetId: existing.id,
        summary: "QoderWork idempotency key was reused with different content",
        payload: JSON.stringify({
          warning: "CONFLICT",
          existingContentHash: existing.checksum,
          submittedContentHash: input.proposal.contentHash,
          payloadStored: false,
          auditRetainUntil: auditRetainUntil(input.now),
        }),
        sourcePage: "/api/mcp/qoderwork",
        traceId: input.proposal.correlationRef,
        requestId: requestRef,
      },
    });
    return {
      status: "rejected",
      requestRef,
      correlationRef: input.proposal.correlationRef,
      acceptedArtifactRefs: [],
      receiptRef: conflictReceipt.id,
      warnings: ["CONFLICT"],
      nextAllowedSurface: "/settings",
    };
  }
  const receipt = await db.auditLog.findFirst({
    where: {
      workspaceId: input.auth.workspaceId,
      targetType: "ExternalMemoryRecord",
      targetId: existing.id,
      actionType: "QODERWORK_EXTERNAL_CANDIDATE_RECORDED",
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, requestId: true },
  });
  // Replays are observable: every DUPLICATE answer leaves its own audit
  // row (rate-limited upstream), so repeated replays never become an
  // invisible traffic pattern.
  await db.auditLog.create({
    data: {
      workspaceId: input.auth.workspaceId,
      userId: input.auth.userId,
      actor: `QoderWork device ${input.auth.deviceRef}`,
      actorType: ActorType.AI,
      actionType: "QODERWORK_PROPOSAL_REPLAYED",
      targetType: "ExternalMemoryRecord",
      targetId: existing.id,
      summary: "QoderWork idempotent replay answered with the recorded candidate",
      payload: JSON.stringify({
        payloadStored: false,
        originalReceiptRef: receipt?.id ?? null,
        auditRetainUntil: auditRetainUntil(input.now),
      }),
      sourcePage: "/api/mcp/qoderwork",
      traceId: input.proposal.correlationRef,
      requestId: `request:${randomUUID()}`,
    },
  });
  const metadata = parseCandidateMetadata(existing.rawMetadata);
  return {
    status: mapDisposition(metadata.disposition),
    requestRef: receipt?.requestId ?? `request:${randomUUID()}`,
    correlationRef: input.proposal.correlationRef,
    acceptedArtifactRefs: [existing.id],
    receiptRef: receipt?.id ?? "receipt:unavailable",
    warnings: [...metadata.reasonCodes, "DUPLICATE"],
    nextAllowedSurface: nextSurface(input.toolName),
  };
}

function parseCandidateMetadata(value: string | null | undefined) {
  try {
    const parsed: unknown = JSON.parse(value ?? "{}");
    if (!parsed || typeof parsed !== "object") throw new Error("invalid metadata");
    const record = parsed as {
      disposition?: unknown;
      reasonCodes?: unknown;
      serverPayloadHash?: unknown;
    };
    return {
      disposition: typeof record.disposition === "string" ? record.disposition : "review_required",
      reasonCodes: Array.isArray(record.reasonCodes)
        ? record.reasonCodes.filter((reason): reason is string => typeof reason === "string")
        : [],
      serverPayloadHash:
        typeof record.serverPayloadHash === "string"
          ? record.serverPayloadHash
          : null,
    };
  } catch {
    return {
      disposition: "review_required",
      reasonCodes: [] as string[],
      serverPayloadHash: null,
    };
  }
}

function canonicalObjectRef(objectRef: { type: ExternalAgentObjectType; id: string }) {
  return objectRef.id.startsWith(`${objectRef.type}:`)
    ? objectRef.id
    : `${objectRef.type}:${objectRef.id}`;
}

function decisionReferencesObject(contextRefsJson: string, observedObjectRef: string) {
  try {
    const parsed: unknown = JSON.parse(contextRefsJson);
    return Array.isArray(parsed) && parsed.includes(observedObjectRef);
  } catch {
    return false;
  }
}

function mapDisposition(disposition: string): QoderWorkMcpResponse["status"] {
  if (disposition === "accept_as_evidence_candidate" || disposition === "accept_as_draft_candidate") return "accepted";
  if (disposition === "quarantine") return "quarantined";
  if (disposition === "reject") return "rejected";
  return "review_required";
}

function nextSurface(toolName: ProposalToolName): QoderWorkMcpResponse["nextAllowedSurface"] {
  if (toolName === "propose_draft_artifact") return "/approvals";
  if (toolName === "propose_receipt_candidate") return "/dashboard";
  return "/memory";
}

function contentBoundId(namespace: string, value: string) {
  return `sha256:${createHash("sha256").update(`${namespace}\0${value}`).digest("hex")}`;
}

// Replay equality is judged on a SERVER-computed hash over the canonical
// full proposal payload — never on the caller-declared contentHash alone.
// A caller reusing an idempotency key with the same declared hash but a
// divergent payload (summary, evidence refs, object ref, ...) must land in
// the CONFLICT path, not be silently answered with the old artifact.
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [
          key,
          canonicalize((value as Record<string, unknown>)[key]),
        ]),
    );
  }
  return value;
}

export function serverProposalPayloadHash(proposal: unknown): string {
  return `sha256:${createHash("sha256")
    .update(`qoderwork-proposal\0${JSON.stringify(canonicalize(proposal))}`)
    .digest("hex")}`;
}

function auditRetainUntil(now: Date) {
  return new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString();
}

function isUniqueConstraintViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "P2002");
}
