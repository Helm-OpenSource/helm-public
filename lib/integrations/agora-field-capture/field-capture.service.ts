import { randomInt, randomUUID } from "node:crypto";
import {
  ActorType,
  CaptureConsentMethod,
  CaptureProcessingStatus,
  CaptureProviderSessionStatus,
  CaptureSessionStatus,
  CaptureSourceType,
  TranscriptSourceType,
  UsageType,
  type CaptureTranscriptRetentionMode,
} from "@prisma/client";
import { safeWriteAuditLog } from "@/lib/audit";
import {
  ensureWorkspaceProcessingAllowed,
  recordUsageLedgerEntry,
} from "@/lib/billing/foundation";
import {
  startCaptureSession,
  stopCaptureSession,
} from "@/lib/conversation-capture/capture-session.service";
import { db } from "@/lib/db";
import {
  AgoraSttClient,
  type AgoraSttStartInput,
} from "@/lib/integrations/agora-field-capture/agora-stt-client";
import {
  normalizeFinalTranscriptSegments,
  orderTranscriptSegments,
  type AgoraFinalTranscriptSegmentInput,
} from "@/lib/integrations/agora-field-capture/transcript-segment";

export type CaptureAgentIdentity = {
  id: string;
  workspaceId: string;
  name: string;
  tokenPrefix: string;
  transcriptRetention: CaptureTranscriptRetentionMode;
};

type AgoraSessionIdentifiers = Pick<
  AgoraSttStartInput,
  | "channelName"
  | "publisherUid"
  | "subscriberBotUid"
  | "publisherBotUid"
> & { taskName: string };

type AgoraClient = Pick<AgoraSttClient, "start" | "stop">;

type FieldCaptureServiceDependencies = {
  agoraClient?: AgoraClient;
  now?: () => Date;
  createIdentifiers?: () => AgoraSessionIdentifiers;
  waitForTranscriptTail?: () => Promise<void>;
};

const DEFAULT_TRANSCRIPT_TAIL_GRACE_MS = 1_500;

export class FieldCaptureServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number,
  ) {
    super(message);
    this.name = "FieldCaptureServiceError";
  }
}

export function isFieldCaptureServiceError(
  error: unknown,
): error is FieldCaptureServiceError {
  return error instanceof FieldCaptureServiceError;
}

function createDefaultIdentifiers(): AgoraSessionIdentifiers {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 20);
  const used = new Set<number>();
  const nextUid = () => {
    let value = randomInt(1, 2_147_483_647);
    while (used.has(value)) value = randomInt(1, 2_147_483_647);
    used.add(value);
    return value;
  };

  return {
    channelName: `helm_field_${suffix}`,
    taskName: `helm-field-${suffix}`,
    publisherUid: nextUid(),
    subscriberBotUid: nextUid(),
    publisherBotUid: nextUid(),
  };
}

function actorName(credential: CaptureAgentIdentity) {
  return `Capture agent: ${credential.name}`;
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 1000) : "Unknown field capture error";
}

async function recordFieldCaptureUsage(input: {
  credential: CaptureAgentIdentity;
  captureSessionId: string;
  providerSessionId: string;
  operation: "start_field_capture" | "stop_field_capture";
}) {
  try {
    await recordUsageLedgerEntry({
      workspaceId: input.credential.workspaceId,
      userId: null,
      usageType: UsageType.CAPTURE_PROCESSING,
      sourcePage: "/api/capture-agents/sessions",
      metadata: {
        captureSessionId: input.captureSessionId,
        providerSessionId: input.providerSessionId,
        captureAgentCredentialId: input.credential.id,
        operation: input.operation,
        provider: "AGORA",
      },
    });
  } catch (error) {
    await safeWriteAuditLog({
      workspaceId: input.credential.workspaceId,
      userId: null,
      actor: actorName(input.credential),
      actorType: ActorType.SYSTEM,
      actionType: "CAPTURE_USAGE_LEDGER_WRITE_FAILED",
      targetType: "CaptureProviderSession",
      targetId: input.providerSessionId,
      summary: "Field-capture usage ledger write failed",
      payload: {
        captureSessionId: input.captureSessionId,
        operation: input.operation,
        error: safeErrorMessage(error),
      },
      sourcePage: "/api/capture-agents/sessions",
    });
  }
}

function toConversationSegments(
  segments: ReturnType<typeof orderTranscriptSegments>,
) {
  const firstTimestamp = BigInt(segments[0]?.textTsMs ?? "0");
  return segments.map((segment) => {
    const startedAt = Number(
      (BigInt(segment.textTsMs) - firstTimestamp) / BigInt(1000),
    );
    const durationSeconds = Math.max(1, Math.ceil(segment.durationMs / 1000));
    return {
      speaker: `uid:${segment.sourceUid}`,
      startedAt,
      endedAt: startedAt + durationSeconds,
      text: segment.text,
    };
  });
}

export class AgoraFieldCaptureService {
  private readonly agoraClient: AgoraClient;
  private readonly now: () => Date;
  private readonly createIdentifiers: () => AgoraSessionIdentifiers;
  private readonly waitForTranscriptTail: () => Promise<void>;

  constructor(dependencies: FieldCaptureServiceDependencies = {}) {
    this.agoraClient = dependencies.agoraClient ?? new AgoraSttClient();
    this.now = dependencies.now ?? (() => new Date());
    this.createIdentifiers =
      dependencies.createIdentifiers ?? createDefaultIdentifiers;
    this.waitForTranscriptTail =
      dependencies.waitForTranscriptTail ??
      (() =>
        new Promise((resolve) =>
          setTimeout(resolve, DEFAULT_TRANSCRIPT_TAIL_GRACE_MS),
        ));
  }

  async start(input: {
    credential: CaptureAgentIdentity;
    title: string;
    language: string;
    consent: {
      confirmed: boolean;
      counterpartyNotified: boolean;
      noticeTextVersion: string;
    };
  }) {
    try {
      await ensureWorkspaceProcessingAllowed({
        workspaceId: input.credential.workspaceId,
        english: false,
        operation: "CAPTURE_START",
      });
    } catch (error) {
      throw new FieldCaptureServiceError(
        "WORKSPACE_PROCESSING_BLOCKED",
        safeErrorMessage(error),
        402,
      );
    }

    const existing = await db.captureProviderSession.findFirst({
      where: {
        agentCredentialId: input.credential.id,
        activeAgentSlot: input.credential.id,
        status: {
          in: [
            CaptureProviderSessionStatus.STARTING,
            CaptureProviderSessionStatus.RUNNING,
            CaptureProviderSessionStatus.DEGRADED,
            CaptureProviderSessionStatus.STOPPING,
          ],
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new FieldCaptureServiceError(
        "CAPTURE_AGENT_SESSION_ACTIVE",
        "This capture agent already has an active session",
        409,
      );
    }

    const captureSession = await startCaptureSession({
      workspaceId: input.credential.workspaceId,
      actorName: actorName(input.credential),
      actorUserId: null,
      actorType: ActorType.SYSTEM,
      english: false,
      sourcePage: "/api/capture-agents/sessions/start",
      title: input.title,
      sourceType: CaptureSourceType.FIELD_DEVICE,
      sourceId: input.credential.id,
      consent: {
        ...input.consent,
        method: CaptureConsentMethod.EXTERNAL_ATTESTATION,
      },
    });
    const identifiers = this.createIdentifiers();
    let providerSession: { id: string };

    try {
      providerSession = await db.captureProviderSession.create({
        data: {
          workspaceId: input.credential.workspaceId,
          captureSessionId: captureSession.id,
          agentCredentialId: input.credential.id,
          activeAgentSlot: input.credential.id,
          status: CaptureProviderSessionStatus.STARTING,
          channelName: identifiers.channelName,
          taskName: identifiers.taskName,
          publisherUid: String(identifiers.publisherUid),
          subscriberBotUid: String(identifiers.subscriberBotUid),
          publisherBotUid: String(identifiers.publisherBotUid),
          language: input.language,
          transcriptRetention: input.credential.transcriptRetention,
        },
        select: { id: true },
      });
    } catch (error) {
      await db.captureSession.update({
        where: { id: captureSession.id },
        data: {
          status: CaptureSessionStatus.FAILED,
          transcriptStatus: CaptureProcessingStatus.FAILED,
          processingStatus: CaptureProcessingStatus.FAILED,
          errorMessage: "Capture agent already has an active session",
        },
      });
      if ((error as { code?: string })?.code === "P2002") {
        throw new FieldCaptureServiceError(
          "CAPTURE_AGENT_SESSION_ACTIVE",
          "This capture agent already has an active session",
          409,
        );
      }
      throw error;
    }

    let startedProviderAgentId: string | null = null;
    try {
      const started = await this.agoraClient.start({
        ...identifiers,
        language: input.language,
      });
      startedProviderAgentId = started.providerAgentId;
      const status =
        started.providerStatus === "RUNNING"
          ? CaptureProviderSessionStatus.RUNNING
          : started.providerStatus === "RECOVERING"
            ? CaptureProviderSessionStatus.DEGRADED
            : CaptureProviderSessionStatus.STARTING;
      await db.captureProviderSession.update({
        where: { id: providerSession.id },
        data: {
          providerAgentId: started.providerAgentId,
          status,
          mock: started.rtc.mock,
          startedAt: this.now(),
          errorMessage: null,
        },
      });

      await Promise.all([
        recordFieldCaptureUsage({
          credential: input.credential,
          captureSessionId: captureSession.id,
          providerSessionId: providerSession.id,
          operation: "start_field_capture",
        }),
        safeWriteAuditLog({
          workspaceId: input.credential.workspaceId,
          userId: null,
          actor: actorName(input.credential),
          actorType: ActorType.SYSTEM,
          actionType: "AGORA_FIELD_CAPTURE_STARTED",
          targetType: "CaptureProviderSession",
          targetId: providerSession.id,
          summary: "Started a consent-bound Agora field-capture session",
          payload: {
            captureSessionId: captureSession.id,
            providerStatus: started.providerStatus,
            language: input.language,
            retentionMode: input.credential.transcriptRetention,
            mock: started.rtc.mock,
            rawAudioAcceptedByHelm: false,
          },
          sourcePage: "/api/capture-agents/sessions/start",
        }),
      ]);

      return {
        captureSessionId: captureSession.id,
        providerSessionId: providerSession.id,
        status,
        retentionMode: input.credential.transcriptRetention,
        rtc: started.rtc,
      };
    } catch (error) {
      const message = safeErrorMessage(error);
      let compensationError: string | null = null;
      if (startedProviderAgentId) {
        try {
          await this.agoraClient.stop(startedProviderAgentId);
        } catch (stopError) {
          compensationError = safeErrorMessage(stopError);
        }
      }
      await Promise.all([
        db.captureProviderSession.update({
          where: { id: providerSession.id },
          data: {
            status: CaptureProviderSessionStatus.FAILED,
            activeAgentSlot: null,
            degradedReason: compensationError
              ? "AGORA_STT_START_COMPENSATION_FAILED"
              : null,
            errorMessage: compensationError
              ? `${message}; compensation failed: ${compensationError}`.slice(0, 1000)
              : message,
          },
        }),
        db.captureSession.update({
          where: { id: captureSession.id },
          data: {
            status: CaptureSessionStatus.FAILED,
            transcriptStatus: CaptureProcessingStatus.FAILED,
            processingStatus: CaptureProcessingStatus.FAILED,
            errorMessage: message,
          },
        }),
      ]);
      throw new FieldCaptureServiceError(
        "AGORA_STT_START_FAILED",
        "Agora STT session could not be started",
        502,
      );
    }
  }

  async ingestSegments(input: {
    credential: CaptureAgentIdentity;
    providerSessionId: string;
    segments: AgoraFinalTranscriptSegmentInput[];
  }) {
    let normalized: ReturnType<typeof normalizeFinalTranscriptSegments>;
    try {
      normalized = normalizeFinalTranscriptSegments(input.segments);
    } catch (error) {
      throw new FieldCaptureServiceError(
        "INVALID_FINAL_TRANSCRIPT_SEGMENTS",
        safeErrorMessage(error),
        400,
      );
    }
    const receivedAt = this.now();

    return db.$transaction(async (tx) => {
      const locked = await tx.captureProviderSession.updateMany({
        where: {
          id: input.providerSessionId,
          workspaceId: input.credential.workspaceId,
          agentCredentialId: input.credential.id,
          activeAgentSlot: input.credential.id,
          status: {
            in: [
              CaptureProviderSessionStatus.STARTING,
              CaptureProviderSessionStatus.RUNNING,
              CaptureProviderSessionStatus.DEGRADED,
              CaptureProviderSessionStatus.STOPPING,
            ],
          },
        },
        data: { lastSegmentAt: receivedAt },
      });
      if (locked.count === 0) {
        throw new FieldCaptureServiceError(
          "CAPTURE_AGENT_SESSION_NOT_WRITABLE",
          "Capture session is not active for this agent",
          409,
        );
      }

      const providerSession = await tx.captureProviderSession.findUnique({
        where: { id: input.providerSessionId },
        select: {
          captureSessionId: true,
          publisherUid: true,
          language: true,
        },
      });
      if (!providerSession) {
        throw new FieldCaptureServiceError(
          "CAPTURE_AGENT_SESSION_NOT_FOUND",
          "Capture session was not found",
          404,
        );
      }
      if (
        normalized.some(
          (segment) =>
            segment.sourceUid !== providerSession.publisherUid ||
            segment.language !== providerSession.language,
        )
      ) {
        throw new FieldCaptureServiceError(
          "INVALID_FINAL_TRANSCRIPT_SEGMENTS",
          "Transcript source UID and language must match the active provider session",
          400,
        );
      }
      const inserted = await tx.captureTranscriptSegment.createMany({
        data: normalized.map((segment) => ({
          workspaceId: input.credential.workspaceId,
          captureSessionId: providerSession.captureSessionId,
          providerSessionId: input.providerSessionId,
          sourceUid: segment.sourceUid,
          sentenceId: segment.sentenceId,
          text: segment.text,
          textTsMs: segment.textTsMs,
          durationMs: segment.durationMs,
          language: segment.language,
          receivedAt,
        })),
        skipDuplicates: true,
      });

      return {
        accepted: inserted.count,
        duplicates: normalized.length - inserted.count,
      };
    });
  }

  async stop(input: {
    credential: CaptureAgentIdentity;
    providerSessionId: string;
  }) {
    const providerSession = await db.captureProviderSession.findFirst({
      where: {
        id: input.providerSessionId,
        workspaceId: input.credential.workspaceId,
        agentCredentialId: input.credential.id,
      },
    });
    if (!providerSession) {
      throw new FieldCaptureServiceError(
        "CAPTURE_AGENT_SESSION_NOT_FOUND",
        "Capture session was not found",
        404,
      );
    }
    if (providerSession.status === CaptureProviderSessionStatus.STOPPED) {
      return {
        captureSessionId: providerSession.captureSessionId,
        providerSessionId: providerSession.id,
        status: CaptureProviderSessionStatus.STOPPED,
        retainedTranscript:
          providerSession.transcriptRetention === "TRANSCRIPT_AND_DERIVED",
      };
    }
    if (!providerSession.providerAgentId) {
      throw new FieldCaptureServiceError(
        "CAPTURE_AGENT_SESSION_NOT_READY",
        "Agora STT session is not ready to stop",
        409,
      );
    }

    const claimed = await db.captureProviderSession.updateMany({
      where: {
        id: providerSession.id,
        activeAgentSlot: input.credential.id,
        status: {
          in: [
            CaptureProviderSessionStatus.STARTING,
            CaptureProviderSessionStatus.RUNNING,
            CaptureProviderSessionStatus.DEGRADED,
          ],
        },
      },
      data: { status: CaptureProviderSessionStatus.STOPPING },
    });
    if (claimed.count === 0) {
      throw new FieldCaptureServiceError(
        "CAPTURE_AGENT_SESSION_STOP_IN_PROGRESS",
        "Capture session has already stopped or is being stopped",
        409,
      );
    }

    try {
      await this.agoraClient.stop(providerSession.providerAgentId);
    } catch (error) {
      await db.captureProviderSession.updateMany({
        where: {
          id: providerSession.id,
          status: CaptureProviderSessionStatus.STOPPING,
        },
        data: {
          status: CaptureProviderSessionStatus.DEGRADED,
          degradedReason: "AGORA_STT_LEAVE_FAILED",
          errorMessage: safeErrorMessage(error),
        },
      });
      throw new FieldCaptureServiceError(
        "AGORA_STT_STOP_FAILED",
        "Agora STT session could not be stopped; retry is allowed",
        502,
      );
    }

    // The trusted RTC client remains joined while Agora closes the STT task.
    // Accept STOPPING segments and give its bounded delivery worker a short
    // window to persist the final utterance before analysis reads the ledger.
    if (!providerSession.mock) {
      await this.waitForTranscriptTail();
    }

    const storedSegments = await db.captureTranscriptSegment.findMany({
      where: { providerSessionId: providerSession.id },
      select: {
        sourceUid: true,
        sentenceId: true,
        text: true,
        textTsMs: true,
        durationMs: true,
        language: true,
        receivedAt: true,
      },
    });
    const ordered = orderTranscriptSegments(
      storedSegments.map((segment) => ({ ...segment, isFinal: true })),
    );
    if (!ordered.length) {
      await Promise.all([
        db.captureProviderSession.update({
          where: { id: providerSession.id },
          data: {
            status: CaptureProviderSessionStatus.FAILED,
            activeAgentSlot: null,
            stoppedAt: this.now(),
            errorMessage: "No final Agora transcript segments were received",
          },
        }),
        db.captureSession.updateMany({
          where: {
            id: providerSession.captureSessionId,
            status: CaptureSessionStatus.RECORDING,
          },
          data: {
            status: CaptureSessionStatus.FAILED,
            transcriptStatus: CaptureProcessingStatus.FAILED,
            processingStatus: CaptureProcessingStatus.FAILED,
            errorMessage: "No final Agora transcript segments were received",
          },
        }),
      ]);
      throw new FieldCaptureServiceError(
        "CAPTURE_AGENT_NO_FINAL_TRANSCRIPT",
        "No final Agora transcript segments were received",
        422,
      );
    }

    try {
      const processing = await stopCaptureSession({
        workspaceId: input.credential.workspaceId,
        actorName: actorName(input.credential),
        actorUserId: null,
        actorType: ActorType.SYSTEM,
        english: false,
        sourcePage: "/api/capture-agents/sessions/stop",
        captureSessionId: providerSession.captureSessionId,
        transcriptText: ordered.map((segment) => segment.text).join("\n"),
        transcriptSegments: toConversationSegments(ordered),
        transcriptLanguage: providerSession.language,
        transcriptConfidence: 80,
        transcriptProvider: "agora-realtime-stt",
        transcriptModel: "agora-stt",
        transcriptSourceType: TranscriptSourceType.AGORA_REALTIME_ASR,
        audioFile: undefined,
      });

      if (providerSession.transcriptRetention === "DERIVED_ONLY") {
        await db.$transaction([
          db.captureTranscriptSegment.deleteMany({
            where: { providerSessionId: providerSession.id },
          }),
          db.conversationTranscript.update({
            where: { captureSessionId: providerSession.captureSessionId },
            data: {
              fullText: "[Transcript removed after governed processing]",
              segments: null,
            },
          }),
          db.meetingNote.updateMany({
            where: {
              meetingId: processing.meetingId,
              workspaceId: input.credential.workspaceId,
            },
            data: { liveTranscript: null },
          }),
        ]);
        await safeWriteAuditLog({
          workspaceId: input.credential.workspaceId,
          userId: null,
          actor: actorName(input.credential),
          actorType: ActorType.SYSTEM,
          actionType: "CAPTURE_TRANSCRIPT_REMOVED_AFTER_PROCESSING",
          targetType: "CaptureSession",
          targetId: providerSession.captureSessionId,
          summary: "Removed verbatim transcript after governed derived-only processing",
          payload: {
            provider: "AGORA",
            retentionMode: "DERIVED_ONLY",
            removedSegmentCount: ordered.length,
          },
          sourcePage: "/api/capture-agents/sessions/stop",
        });
      }

      await db.captureProviderSession.update({
        where: { id: providerSession.id },
        data: {
          status: CaptureProviderSessionStatus.STOPPED,
          activeAgentSlot: null,
          stoppedAt: this.now(),
          degradedReason: null,
          errorMessage: null,
        },
      });

      await Promise.all([
        recordFieldCaptureUsage({
          credential: input.credential,
          captureSessionId: providerSession.captureSessionId,
          providerSessionId: providerSession.id,
          operation: "stop_field_capture",
        }),
        safeWriteAuditLog({
          workspaceId: input.credential.workspaceId,
          userId: null,
          actor: actorName(input.credential),
          actorType: ActorType.SYSTEM,
          actionType: "AGORA_FIELD_CAPTURE_STOPPED",
          targetType: "CaptureProviderSession",
          targetId: providerSession.id,
          summary: "Stopped Agora field capture and completed Helm analysis",
          payload: {
            captureSessionId: providerSession.captureSessionId,
            finalSegmentCount: ordered.length,
            retainedTranscript:
              providerSession.transcriptRetention === "TRANSCRIPT_AND_DERIVED",
            rawAudioAcceptedByHelm: false,
          },
          sourcePage: "/api/capture-agents/sessions/stop",
        }),
      ]);

      return {
        captureSessionId: providerSession.captureSessionId,
        providerSessionId: providerSession.id,
        status: CaptureProviderSessionStatus.STOPPED,
        retainedTranscript:
          providerSession.transcriptRetention === "TRANSCRIPT_AND_DERIVED",
      };
    } catch (error) {
      await db.captureProviderSession.update({
        where: { id: providerSession.id },
        data: {
          status: CaptureProviderSessionStatus.FAILED,
          activeAgentSlot: null,
          stoppedAt: this.now(),
          errorMessage: safeErrorMessage(error),
        },
      });
      throw error;
    }
  }
}
