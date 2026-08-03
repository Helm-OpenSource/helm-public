import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, captureServiceMock, auditMock, billingMock } = vi.hoisted(() => {
  const database = {
    captureProviderSession: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    captureTranscriptSegment: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    captureSession: { update: vi.fn(), updateMany: vi.fn() },
    conversationTranscript: { update: vi.fn() },
    meetingNote: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return {
    dbMock: database,
    captureServiceMock: {
      startCaptureSession: vi.fn(),
      stopCaptureSession: vi.fn(),
    },
    auditMock: { safeWriteAuditLog: vi.fn(), writeAuditLog: vi.fn() },
    billingMock: {
      ensureWorkspaceProcessingAllowed: vi.fn(),
      recordUsageLedgerEntry: vi.fn(),
    },
  };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/conversation-capture/capture-session.service", () =>
  captureServiceMock,
);
vi.mock("@/lib/audit", () => auditMock);
vi.mock("@/lib/billing/foundation", () => billingMock);

import { AgoraFieldCaptureService } from "@/lib/integrations/agora-field-capture/field-capture.service";

const credential = {
  id: "credential-1",
  workspaceId: "workspace-1",
  name: "Store pilot Mac",
  tokenPrefix: "public-prefix-1",
  transcriptRetention: "TRANSCRIPT_AND_DERIVED" as const,
};

function createAgoraClient() {
  return {
    start: vi.fn().mockResolvedValue({
      providerAgentId: "agent-1",
      providerStatus: "RUNNING",
      createdAtUnixSeconds: 100,
      rtc: {
        appId: "app-id",
        channelName: "channel-1",
        publisherUid: 101,
        publisherToken: "short-lived-token",
        transcriptBotUid: 301,
        expiresAt: "2026-07-18T01:00:00.000Z",
        mock: false,
      },
    }),
    stop: vi.fn().mockResolvedValue({
      providerAgentId: "agent-1",
      providerStatus: "STOPPED",
      createdAtUnixSeconds: 100,
      mock: false,
    }),
  };
}

function createService(
  agoraClient = createAgoraClient(),
  waitForTranscriptTail = vi.fn().mockResolvedValue(undefined),
) {
  return {
    service: new AgoraFieldCaptureService({
      agoraClient,
      waitForTranscriptTail,
      now: () => new Date("2026-07-18T00:00:00.000Z"),
      createIdentifiers: () => ({
        channelName: "channel-1",
        taskName: "task-1",
        publisherUid: 101,
        subscriberBotUid: 201,
        publisherBotUid: 301,
      }),
    }),
    agoraClient,
    waitForTranscriptTail,
  };
}

describe("Agora field capture service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    billingMock.ensureWorkspaceProcessingAllowed.mockResolvedValue(undefined);
    billingMock.recordUsageLedgerEntry.mockResolvedValue({ id: "usage-1" });
    dbMock.$transaction.mockImplementation(async (input) => {
      if (typeof input === "function") return input(dbMock);
      return Promise.all(input);
    });
  });

  it("starts a consent-bound FIELD_DEVICE session and returns only short-lived RTC material", async () => {
    dbMock.captureProviderSession.findFirst.mockResolvedValue(null);
    captureServiceMock.startCaptureSession.mockResolvedValue({ id: "capture-1" });
    dbMock.captureProviderSession.create.mockResolvedValue({ id: "provider-1" });
    dbMock.captureProviderSession.update.mockResolvedValue({ id: "provider-1" });
    const { service, agoraClient } = createService();

    const result = await service.start({
      credential,
      title: "Store floor pilot",
      language: "zh-CN",
      consent: {
        confirmed: true,
        counterpartyNotified: true,
        noticeTextVersion: "field-capture-consent/v1",
      },
    });

    expect(captureServiceMock.startCaptureSession).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        actorType: "SYSTEM",
        sourceType: "FIELD_DEVICE",
        sourceId: "credential-1",
        consent: expect.objectContaining({
          confirmed: true,
          counterpartyNotified: true,
          method: "EXTERNAL_ATTESTATION",
        }),
      }),
    );
    expect(billingMock.ensureWorkspaceProcessingAllowed).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      english: false,
      operation: "CAPTURE_START",
    });
    expect(dbMock.captureProviderSession.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        captureSessionId: "capture-1",
        agentCredentialId: "credential-1",
        activeAgentSlot: "credential-1",
        transcriptRetention: "TRANSCRIPT_AND_DERIVED",
      }),
    }));
    expect(agoraClient.start).toHaveBeenCalledWith(
      expect.objectContaining({ channelName: "channel-1", publisherUid: 101 }),
    );
    expect(result).toEqual({
      captureSessionId: "capture-1",
      providerSessionId: "provider-1",
      status: "RUNNING",
      retentionMode: "TRANSCRIPT_AND_DERIVED",
      rtc: expect.objectContaining({
        publisherToken: "short-lived-token",
        transcriptBotUid: 301,
      }),
    });
    expect(JSON.stringify(result)).not.toContain("customer-secret");
    expect(JSON.stringify(result)).not.toContain("app-certificate");
    expect(billingMock.recordUsageLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        userId: null,
        usageType: "CAPTURE_PROCESSING",
        metadata: expect.objectContaining({ operation: "start_field_capture" }),
      }),
    );
  });

  it("fails before creating a session when workspace processing is blocked", async () => {
    billingMock.ensureWorkspaceProcessingAllowed.mockRejectedValue(
      new Error("Workspace processing is paused"),
    );
    const { service, agoraClient } = createService();

    await expect(
      service.start({
        credential,
        title: "Blocked session",
        language: "zh-CN",
        consent: {
          confirmed: true,
          counterpartyNotified: true,
          noticeTextVersion: "field-capture-consent/v1",
        },
      }),
    ).rejects.toMatchObject({
      code: "WORKSPACE_PROCESSING_BLOCKED",
      httpStatus: 402,
    });
    expect(dbMock.captureProviderSession.findFirst).not.toHaveBeenCalled();
    expect(captureServiceMock.startCaptureSession).not.toHaveBeenCalled();
    expect(agoraClient.start).not.toHaveBeenCalled();
  });

  it("stops an externally started Agora task when local persistence fails", async () => {
    dbMock.captureProviderSession.findFirst.mockResolvedValue(null);
    captureServiceMock.startCaptureSession.mockResolvedValue({ id: "capture-1" });
    dbMock.captureProviderSession.create.mockResolvedValue({ id: "provider-1" });
    dbMock.captureProviderSession.update
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValue({ id: "provider-1" });
    dbMock.captureSession.update.mockResolvedValue({ id: "capture-1" });
    const { service, agoraClient } = createService();

    await expect(
      service.start({
        credential,
        title: "Compensated session",
        language: "zh-CN",
        consent: {
          confirmed: true,
          counterpartyNotified: true,
          noticeTextVersion: "field-capture-consent/v1",
        },
      }),
    ).rejects.toMatchObject({ code: "AGORA_STT_START_FAILED" });
    expect(agoraClient.stop).toHaveBeenCalledWith("agent-1");
  });

  it("blocks a second active session for the same credential", async () => {
    dbMock.captureProviderSession.findFirst.mockResolvedValue({ id: "provider-active" });
    const { service, agoraClient } = createService();

    await expect(
      service.start({
        credential,
        title: "Second session",
        language: "zh-CN",
        consent: {
          confirmed: true,
          counterpartyNotified: true,
          noticeTextVersion: "field-capture-consent/v1",
        },
      }),
    ).rejects.toMatchObject({ code: "CAPTURE_AGENT_SESSION_ACTIVE" });
    expect(captureServiceMock.startCaptureSession).not.toHaveBeenCalled();
    expect(agoraClient.start).not.toHaveBeenCalled();
  });

  it("ingests only final normalized text with database-level cross-request dedupe", async () => {
    dbMock.captureProviderSession.updateMany.mockResolvedValue({ count: 1 });
    dbMock.captureProviderSession.findUnique.mockResolvedValue({
      id: "provider-1",
      captureSessionId: "capture-1",
      publisherUid: "101",
      language: "zh-CN",
    });
    dbMock.captureTranscriptSegment.createMany.mockResolvedValue({ count: 1 });
    const { service } = createService();

    const result = await service.ingestSegments({
      credential,
      providerSessionId: "provider-1",
      segments: [
        {
          sourceUid: "101",
          sentenceId: "9",
          text: "  需要试一下小一码  ",
          textTsMs: "1784354400123",
          durationMs: 1800,
          language: "zh-CN",
          isFinal: true,
        },
      ],
    });

    expect(result).toEqual({ accepted: 1, duplicates: 0 });
    expect(dbMock.captureProviderSession.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "provider-1",
        status: { in: ["STARTING", "RUNNING", "DEGRADED", "STOPPING"] },
      }),
      data: { lastSegmentAt: new Date("2026-07-18T00:00:00.000Z") },
    });
    expect(dbMock.captureTranscriptSegment.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          text: "需要试一下小一码",
          captureSessionId: "capture-1",
          providerSessionId: "provider-1",
        }),
      ],
      skipDuplicates: true,
    });
  });

  it("rejects final text that does not match the provider publisher or language", async () => {
    dbMock.captureProviderSession.updateMany.mockResolvedValue({ count: 1 });
    dbMock.captureProviderSession.findUnique.mockResolvedValue({
      id: "provider-1",
      captureSessionId: "capture-1",
      publisherUid: "101",
      language: "zh-CN",
    });
    const { service } = createService();
    const segment = {
      sourceUid: "999",
      sentenceId: "9",
      text: "伪造来源",
      textTsMs: "1784354400123",
      durationMs: 800,
      language: "en-US",
      isFinal: true,
    };

    await expect(
      service.ingestSegments({
        credential,
        providerSessionId: "provider-1",
        segments: [segment],
      }),
    ).rejects.toMatchObject({
      code: "INVALID_FINAL_TRANSCRIPT_SEGMENTS",
      httpStatus: 400,
    });
    expect(dbMock.captureTranscriptSegment.createMany).not.toHaveBeenCalled();
  });

  it("maps duplicate sentence IDs to a bounded client error", async () => {
    const { service } = createService();
    const segment = {
      sourceUid: "101",
      sentenceId: "9",
      text: "同一句",
      textTsMs: "1784354400123",
      durationMs: 800,
      language: "zh-CN",
      isFinal: true,
    };

    await expect(
      service.ingestSegments({
        credential,
        providerSessionId: "provider-1",
        segments: [segment, segment],
      }),
    ).rejects.toMatchObject({
      code: "INVALID_FINAL_TRANSCRIPT_SEGMENTS",
      httpStatus: 400,
    });
    expect(dbMock.captureProviderSession.updateMany).not.toHaveBeenCalled();
  });

  it("stops Agora before one-time Helm analysis and preserves transcript when explicitly authorized", async () => {
    dbMock.captureProviderSession.findFirst.mockResolvedValue({
      id: "provider-1",
      workspaceId: "workspace-1",
      captureSessionId: "capture-1",
      agentCredentialId: "credential-1",
      providerAgentId: "agent-1",
      status: "STARTING",
      mock: false,
      transcriptRetention: "TRANSCRIPT_AND_DERIVED",
    });
    dbMock.captureProviderSession.updateMany.mockResolvedValue({ count: 1 });
    dbMock.captureTranscriptSegment.findMany.mockResolvedValue([
      {
        sourceUid: "101",
        sentenceId: "2",
        text: "第二句",
        textTsMs: "2000",
        durationMs: 1000,
        language: "zh-CN",
        receivedAt: new Date("2026-07-18T00:00:02Z"),
      },
      {
        sourceUid: "101",
        sentenceId: "1",
        text: "第一句",
        textTsMs: "1000",
        durationMs: 1000,
        language: "zh-CN",
        receivedAt: new Date("2026-07-18T00:00:01Z"),
      },
    ]);
    captureServiceMock.stopCaptureSession.mockResolvedValue({ meetingId: "meeting-1" });
    dbMock.captureProviderSession.update.mockResolvedValue({ id: "provider-1" });
    const { service, agoraClient, waitForTranscriptTail } = createService();

    const result = await service.stop({ credential, providerSessionId: "provider-1" });

    expect(agoraClient.stop).toHaveBeenCalledWith("agent-1");
    expect(waitForTranscriptTail).toHaveBeenCalledOnce();
    expect(agoraClient.stop.mock.invocationCallOrder[0]).toBeLessThan(
      waitForTranscriptTail.mock.invocationCallOrder[0],
    );
    expect(waitForTranscriptTail.mock.invocationCallOrder[0]).toBeLessThan(
      dbMock.captureTranscriptSegment.findMany.mock.invocationCallOrder[0],
    );
    expect(dbMock.captureProviderSession.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "provider-1",
        status: { in: ["STARTING", "RUNNING", "DEGRADED"] },
      }),
      data: { status: "STOPPING" },
    });
    expect(captureServiceMock.stopCaptureSession).toHaveBeenCalledWith(
      expect.objectContaining({
        captureSessionId: "capture-1",
        transcriptText: "第一句\n第二句",
        transcriptSourceType: "AGORA_REALTIME_ASR",
        transcriptProvider: "agora-realtime-stt",
        audioFile: undefined,
      }),
    );
    expect(result).toEqual({
      captureSessionId: "capture-1",
      providerSessionId: "provider-1",
      status: "STOPPED",
      retainedTranscript: true,
    });
    expect(dbMock.captureTranscriptSegment.deleteMany).not.toHaveBeenCalled();
  });

  it("scrubs verbatim text after derived-only processing", async () => {
    dbMock.captureProviderSession.findFirst.mockResolvedValue({
      id: "provider-1",
      workspaceId: "workspace-1",
      captureSessionId: "capture-1",
      agentCredentialId: "credential-1",
      providerAgentId: "agent-1",
      status: "RUNNING",
      transcriptRetention: "DERIVED_ONLY",
    });
    dbMock.captureProviderSession.updateMany.mockResolvedValue({ count: 1 });
    dbMock.captureTranscriptSegment.findMany.mockResolvedValue([
      {
        sourceUid: "101",
        sentenceId: "1",
        text: "只保留派生结果",
        textTsMs: "1000",
        durationMs: 1000,
        language: "zh-CN",
        receivedAt: new Date("2026-07-18T00:00:01Z"),
      },
    ]);
    captureServiceMock.stopCaptureSession.mockResolvedValue({ meetingId: "meeting-1" });
    dbMock.captureTranscriptSegment.deleteMany.mockResolvedValue({ count: 1 });
    dbMock.conversationTranscript.update.mockResolvedValue({ id: "transcript-1" });
    dbMock.meetingNote.updateMany.mockResolvedValue({ count: 1 });
    dbMock.captureProviderSession.update.mockResolvedValue({ id: "provider-1" });
    const { service } = createService();

    await expect(
      service.stop({
        credential: { ...credential, transcriptRetention: "DERIVED_ONLY" },
        providerSessionId: "provider-1",
      }),
    ).resolves.toMatchObject({ retainedTranscript: false });
    expect(dbMock.captureTranscriptSegment.deleteMany).toHaveBeenCalledWith({
      where: { providerSessionId: "provider-1" },
    });
    expect(dbMock.conversationTranscript.update).toHaveBeenCalledWith({
      where: { captureSessionId: "capture-1" },
      data: {
        fullText: "[Transcript removed after governed processing]",
        segments: null,
      },
    });
    expect(dbMock.meetingNote.updateMany).toHaveBeenCalledWith({
      where: { meetingId: "meeting-1", workspaceId: "workspace-1" },
      data: { liveTranscript: null },
    });
  });

  it("fails closed without final segments and never invokes demo fallback analysis", async () => {
    dbMock.captureProviderSession.findFirst.mockResolvedValue({
      id: "provider-1",
      workspaceId: "workspace-1",
      captureSessionId: "capture-1",
      agentCredentialId: "credential-1",
      providerAgentId: "agent-1",
      status: "RUNNING",
      transcriptRetention: "DERIVED_ONLY",
    });
    dbMock.captureProviderSession.updateMany.mockResolvedValue({ count: 1 });
    dbMock.captureTranscriptSegment.findMany.mockResolvedValue([]);
    dbMock.captureProviderSession.update.mockResolvedValue({ id: "provider-1" });
    dbMock.captureSession.updateMany.mockResolvedValue({ count: 1 });
    const { service } = createService();

    await expect(
      service.stop({ credential, providerSessionId: "provider-1" }),
    ).rejects.toMatchObject({ code: "CAPTURE_AGENT_NO_FINAL_TRANSCRIPT" });
    expect(captureServiceMock.stopCaptureSession).not.toHaveBeenCalled();
  });
});
