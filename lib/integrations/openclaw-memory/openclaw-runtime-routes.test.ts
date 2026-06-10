import { ExternalSyncProvider, ExternalSyncStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessionMock, openClawServiceMock } = vi.hoisted(() => ({
  sessionMock: {
    getCurrentWorkspaceSession: vi.fn(),
  },
  openClawServiceMock: {
    getOpenClawMemorySyncStatus: vi.fn(),
    syncOpenClawMemory: vi.fn(),
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentWorkspaceSession: sessionMock.getCurrentWorkspaceSession,
}));

vi.mock("@/lib/integrations/openclaw-memory", async () => {
  const actual = await vi.importActual<typeof import("@/lib/integrations/openclaw-memory")>(
    "@/lib/integrations/openclaw-memory",
  );

  return {
    ...actual,
    getOpenClawMemorySyncStatus: openClawServiceMock.getOpenClawMemorySyncStatus,
    syncOpenClawMemory: openClawServiceMock.syncOpenClawMemory,
  };
});

import { POST as syncOpenClawRoute } from "@/app/api/memory/openclaw/sync/route";
import { GET as openClawStatusRoute } from "@/app/api/memory/openclaw/status/route";

describe("OpenClaw runtime routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMock.getCurrentWorkspaceSession.mockResolvedValue({
      user: { id: "user-1", name: "Taylor" },
      membership: { role: "MEMBER" },
      workspace: { id: "workspace-1", defaultLocale: "en-US" },
    });
    openClawServiceMock.syncOpenClawMemory.mockResolvedValue({
      imported: 1,
      updated: 0,
      skipped: 0,
      quarantined: 0,
      failed: 0,
      processed: 1,
      lastCursor: null,
    });
    openClawServiceMock.getOpenClawMemorySyncStatus.mockResolvedValue(null);
  });

  it("rejects host-local sync and status read for ordinary members", async () => {
    const [syncResponse, statusResponse] = await Promise.all([
      syncOpenClawRoute(
        new Request("http://localhost/api/memory/openclaw/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sourceMode: "backup_jsonl", maxItems: 20 }),
        }),
      ),
      openClawStatusRoute(),
    ]);

    expect(syncResponse.status).toBe(403);
    await expect(syncResponse.json()).resolves.toMatchObject({
      success: false,
      message: "Only owner, admin, or operator can manage OpenClaw host-local sync runtime.",
    });

    expect(statusResponse.status).toBe(403);
    await expect(statusResponse.json()).resolves.toMatchObject({
      success: false,
      message: "Only owner, admin, or operator can manage OpenClaw host-local sync runtime.",
    });

    expect(openClawServiceMock.syncOpenClawMemory).not.toHaveBeenCalled();
    expect(openClawServiceMock.getOpenClawMemorySyncStatus).not.toHaveBeenCalled();
  });

  it("allows an operator to trigger sync without caller-controlled host path overrides", async () => {
    sessionMock.getCurrentWorkspaceSession.mockResolvedValue({
      user: { id: "user-1", name: "Taylor" },
      membership: { role: "OPERATOR" },
      workspace: { id: "workspace-1", defaultLocale: "en-US" },
    });

    const response = await syncOpenClawRoute(
      new Request("http://localhost/api/memory/openclaw/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceMode: "backup_jsonl",
          maxItems: 20,
          backupDir: "/tmp/evil-backups",
          lanceDbPath: "/tmp/evil-db",
          openclawBin: "/tmp/evil-openclaw",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      message: "OpenClaw memory sync completed",
    });
    expect(openClawServiceMock.syncOpenClawMemory).toHaveBeenCalledTimes(1);

    const syncInput = openClawServiceMock.syncOpenClawMemory.mock.calls[0]?.[0];
    expect(syncInput).toMatchObject({
      workspaceId: "workspace-1",
      sourcePage: "/memory",
      trigger: "manual",
      actorName: "Taylor",
      actorType: "USER",
      actorUserId: "user-1",
      sourceMode: "backup_jsonl",
      maxItems: 20,
    });
    expect(syncInput).not.toHaveProperty("backupDir");
    expect(syncInput).not.toHaveProperty("lanceDbPath");
    expect(syncInput).not.toHaveProperty("openclawBin");
  });

  it("uses workspace default locale for OpenClaw sync success messages", async () => {
    sessionMock.getCurrentWorkspaceSession.mockResolvedValue({
      user: { id: "user-1", name: "Taylor" },
      membership: { role: "OPERATOR" },
      workspace: { id: "workspace-1", defaultLocale: "zh-CN" },
    });

    const response = await syncOpenClawRoute(
      new Request("http://localhost/api/memory/openclaw/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceMode: "backup_jsonl", maxItems: 20 }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      message: "OpenClaw 记忆同步已完成",
    });
  });

  it("redacts raw sync errors from the sync route response", async () => {
    sessionMock.getCurrentWorkspaceSession.mockResolvedValue({
      user: { id: "user-1", name: "Taylor" },
      membership: { role: "OPERATOR" },
      workspace: { id: "workspace-1", defaultLocale: "en-US" },
    });
    openClawServiceMock.syncOpenClawMemory.mockRejectedValue(
      new Error(
        "openclaw exited with code 1: spawn /Users/tommyqian/.local/bin/openclaw --db /private/tmp/lancedb-pro",
      ),
    );

    const response = await syncOpenClawRoute(
      new Request("http://localhost/api/memory/openclaw/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceMode: "lancedb", maxItems: 20 }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({
      success: false,
      message:
        "OpenClaw sync process failed before import completed. Review server-side audit and runtime logs for details.",
      errorCode: "OPENCLAW_MEMORY_SYNC_FAILED",
    });
    expect(JSON.stringify(payload)).not.toContain("/Users/tommyqian");
    expect(JSON.stringify(payload)).not.toContain("/private/tmp");
    expect(JSON.stringify(payload)).not.toContain("spawn");
  });

  it("allows an admin to read status while redacting raw sync errors", async () => {
    sessionMock.getCurrentWorkspaceSession.mockResolvedValue({
      user: { id: "user-1", name: "Taylor" },
      membership: { role: "ADMIN" },
      workspace: { id: "workspace-1", defaultLocale: "en-US" },
    });
    openClawServiceMock.getOpenClawMemorySyncStatus.mockResolvedValue({
      id: "sync-1",
      workspaceId: "workspace-1",
      provider: ExternalSyncProvider.OPENCLAW,
      lastSyncedAt: new Date("2026-04-21T08:00:00.000Z"),
      lastCursor: JSON.stringify({
        mode: "lancedb",
        file: "lancedb:memories",
        line: 42,
        timestampMs: 123,
      }),
      lastRunStatus: ExternalSyncStatus.FAILED,
      lastError:
        "openclaw exited with code 1: spawn /Users/tommyqian/.local/bin/openclaw --db /private/tmp/lancedb-pro",
      isRunning: false,
      runStartedAt: new Date("2026-04-21T07:59:00.000Z"),
      runFinishedAt: new Date("2026-04-21T08:00:00.000Z"),
      createdAt: new Date("2026-04-21T07:58:00.000Z"),
      updatedAt: new Date("2026-04-21T08:00:00.000Z"),
      parsedCursor: {
        mode: "lancedb",
        file: "lancedb:memories",
        line: 42,
        timestampMs: 123,
      },
      recordCount: 9,
      lastRecord: null,
    });

    const response = await openClawStatusRoute();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.status.lastRunStatus).toBe("FAILED");
    expect(payload.data.status.lastError).toBeUndefined();
    expect(payload.data.status.lastErrorSummary).toBe(
      "OpenClaw sync process failed before import completed. Review server-side audit and runtime logs for details.",
    );
    expect(JSON.stringify(payload.data.status)).not.toContain("/Users/tommyqian");
    expect(JSON.stringify(payload.data.status)).not.toContain("/private/tmp");
  });
});
