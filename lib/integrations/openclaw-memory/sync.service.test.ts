import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ExternalSyncProvider, ExternalSyncStatus } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, logEventMock, writeAuditLogMock } = vi.hoisted(() => ({
  dbMock: {
    $transaction: vi.fn(),
    externalMemorySyncState: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    externalMemoryRecord: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    memoryEntry: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  logEventMock: vi.fn(),
  writeAuditLogMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/analytics", () => ({
  logEvent: logEventMock,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: writeAuditLogMock,
}));

import {
  resolveOpenClawHostDefaults,
  syncOpenClawMemory,
  toOperatorSafeOpenClawMemorySyncStatus,
} from "@/lib/integrations/openclaw-memory/sync.service";

function writeBackupRecord(dir: string, record: Record<string, unknown>) {
  writeFileSync(join(dir, "openclaw-memory.jsonl"), `${JSON.stringify(record)}\n`);
}

describe("OpenClaw memory sync intake boundary", () => {
  let backupDir: string;
  const originalBackupDir = process.env.OPENCLAW_MEMORY_BACKUP_DIR;
  const originalLanceDbPath = process.env.OPENCLAW_MEMORY_DB_PATH;
  const originalOpenClawHome = process.env.OPENCLAW_HOME;
  const originalOpenClawBin = process.env.OPENCLAW_BIN;

  beforeEach(() => {
    vi.clearAllMocks();
    backupDir = mkdtempSync(join(tmpdir(), "helm-openclaw-sync-"));
    process.env.OPENCLAW_MEMORY_BACKUP_DIR = backupDir;

    dbMock.$transaction.mockImplementation(async (callback: (tx: typeof dbMock) => Promise<unknown>) =>
      callback(dbMock),
    );
    dbMock.externalMemorySyncState.upsert.mockResolvedValue({});
    dbMock.externalMemorySyncState.updateMany.mockResolvedValue({ count: 1 });
    dbMock.externalMemorySyncState.findUniqueOrThrow.mockResolvedValue({
      id: "state-1",
      lastCursor: null,
    });
    dbMock.externalMemorySyncState.update.mockResolvedValue({});
    dbMock.externalMemoryRecord.create.mockResolvedValue({});
    dbMock.externalMemoryRecord.update.mockResolvedValue({});
    dbMock.memoryEntry.update.mockResolvedValue({});
    logEventMock.mockResolvedValue(undefined);
    writeAuditLogMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    rmSync(backupDir, { recursive: true, force: true });
    if (originalBackupDir === undefined) {
      delete process.env.OPENCLAW_MEMORY_BACKUP_DIR;
    } else {
      process.env.OPENCLAW_MEMORY_BACKUP_DIR = originalBackupDir;
    }
    if (originalLanceDbPath === undefined) {
      delete process.env.OPENCLAW_MEMORY_DB_PATH;
    } else {
      process.env.OPENCLAW_MEMORY_DB_PATH = originalLanceDbPath;
    }
    if (originalOpenClawHome === undefined) {
      delete process.env.OPENCLAW_HOME;
    } else {
      process.env.OPENCLAW_HOME = originalOpenClawHome;
    }
    if (originalOpenClawBin === undefined) {
      delete process.env.OPENCLAW_BIN;
    } else {
      process.env.OPENCLAW_BIN = originalOpenClawBin;
    }
  });

  it("imports OpenClaw output as sanitized external-agent evidence without creating active memory", async () => {
    writeBackupRecord(backupDir, {
      id: "oc-1",
      text: "Customer Alpha said the renewal risk needs follow-up.",
      category: "fact",
      scope: "agent:main",
      importance: 0.8,
      timestamp: "2999-05-01T01:00:00.000Z",
      metadata: { rawCustomerName: "Customer Alpha" },
    });
    dbMock.externalMemoryRecord.findUnique.mockResolvedValue(null);

    const stats = await syncOpenClawMemory({
      workspaceId: "workspace-1",
      sourceMode: "backup_jsonl",
      maxItems: 1,
    });

    expect(stats).toMatchObject({
      imported: 1,
      updated: 0,
      skipped: 0,
      failed: 0,
      processed: 1,
    });
    expect(dbMock.memoryEntry.create).not.toHaveBeenCalled();

    const createData = dbMock.externalMemoryRecord.create.mock.calls[0]?.[0]?.data;
    expect(createData).toMatchObject({
      workspaceId: "workspace-1",
      provider: "OPENCLAW",
      externalId: "oc-1",
      scope: "external_agent:openclaw_local",
      category: "review_required",
      memoryEntryId: null,
    });
    expect(createData.text).toContain("rawOutputHash=");
    expect(createData.text).not.toContain("Customer Alpha");
    expect(createData.rawMetadata).toContain('"providerId":"openclaw_local"');
    expect(createData.rawMetadata).toContain('"externalAgentEvaluatorDisposition":"review_required"');
    expect(createData.rawMetadata).toContain('"mayCreateMemoryCandidate":false');
    expect(createData.rawMetadata).not.toContain("Customer Alpha");
  });

  it("quarantines authority-exceeded OpenClaw output through the shared external-agent evaluator", async () => {
    writeBackupRecord(backupDir, {
      id: "oc-authority",
      text: "Customer Alpha was sent the official renewal commitment and CRM updated.",
      category: "fact",
      scope: "agent:main",
      importance: 0.8,
      timestamp: "2999-05-01T01:00:00.000Z",
      metadata: { rawCustomerName: "Customer Alpha" },
    });
    dbMock.externalMemoryRecord.findUnique.mockResolvedValue(null);

    const stats = await syncOpenClawMemory({
      workspaceId: "workspace-1",
      sourceMode: "backup_jsonl",
      maxItems: 1,
    });

    expect(stats).toMatchObject({
      imported: 1,
      quarantined: 1,
      failed: 0,
      processed: 1,
    });

    const createData = dbMock.externalMemoryRecord.create.mock.calls[0]?.[0]?.data;
    expect(createData).toMatchObject({
      workspaceId: "workspace-1",
      provider: "OPENCLAW",
      externalId: "oc-authority",
      scope: "external_agent:openclaw_local",
      category: "quarantine",
      memoryEntryId: null,
    });
    expect(createData.rawMetadata).toContain('"externalAgentEvaluatorDisposition":"quarantine"');
    expect(createData.rawMetadata).toContain('"authority_exceeded"');
    expect(createData.rawMetadata).not.toContain("Customer Alpha");
    expect(createData.text).not.toContain("Customer Alpha");
  });

  it("detaches legacy OpenClaw active memory entries on the next matching sync", async () => {
    writeBackupRecord(backupDir, {
      id: "oc-legacy",
      text: "Legacy OpenClaw memory that used to be active.",
      category: "decision",
      scope: "agent:main",
      importance: 70,
      timestamp: "2999-05-01T01:00:00.000Z",
      metadata: {},
    });
    dbMock.externalMemoryRecord.findUnique.mockResolvedValue({
      id: "external-1",
      checksum: null,
      text: "Legacy OpenClaw memory that used to be active.",
      category: "decision",
      scope: "agent:main",
      importance: 70,
      occurredAt: new Date("2999-05-01T01:00:00.000Z"),
      rawMetadata: "{}",
      memoryEntryId: "memory-entry-1",
    });

    const stats = await syncOpenClawMemory({
      workspaceId: "workspace-1",
      sourceMode: "backup_jsonl",
      maxItems: 1,
    });

    expect(stats.updated).toBe(1);
    expect(dbMock.memoryEntry.update).toHaveBeenCalledWith({
      where: { id: "memory-entry-1" },
      data: {
        deletedAt: expect.any(Date),
      },
    });
    expect(dbMock.externalMemoryRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          memoryEntryId: null,
          text: expect.not.stringContaining("Legacy OpenClaw memory"),
        }),
      }),
    );
  });

  it("redacts raw sync errors down to an operator-safe summary", () => {
    const status = toOperatorSafeOpenClawMemorySyncStatus({
      id: "sync-1",
      workspaceId: "workspace-1",
      provider: ExternalSyncProvider.OPENCLAW,
      lastSyncedAt: new Date("2026-04-21T08:00:00.000Z"),
      lastCursor: "{\"file\":\"lancedb:memories\"}",
      lastRunStatus: ExternalSyncStatus.FAILED,
      lastError:
        "openclaw exited with code 1: spawn /Users/tommyqian/.local/bin/openclaw --db /private/tmp/lancedb-pro",
      isRunning: false,
      runStartedAt: new Date("2026-04-21T07:59:00.000Z"),
      runFinishedAt: new Date("2026-04-21T08:00:00.000Z"),
      createdAt: new Date("2026-04-21T07:58:00.000Z"),
      updatedAt: new Date("2026-04-21T08:00:00.000Z"),
      parsedCursor: null,
      recordCount: 3,
      lastRecord: null,
    });

    expect(status).not.toBeNull();
    if (!status) {
      throw new Error("Expected sanitized OpenClaw status");
    }
    expect("lastError" in status).toBe(false);
    expect(status.lastErrorSummary).toBe(
      "OpenClaw sync process failed before import completed. Review server-side audit and runtime logs for details.",
    );
    expect(JSON.stringify(status)).not.toContain("/Users/tommyqian");
    expect(JSON.stringify(status)).not.toContain("/private/tmp");
    expect(JSON.stringify(status)).not.toContain("spawn");
  });

  it("derives host-local defaults from OPENCLAW_HOME instead of a machine-specific hardcoded path", () => {
    delete process.env.OPENCLAW_MEMORY_BACKUP_DIR;
    delete process.env.OPENCLAW_MEMORY_DB_PATH;
    process.env.OPENCLAW_HOME = "/tmp/openclaw-home";

    expect(resolveOpenClawHostDefaults()).toEqual({
      backupDir: "/tmp/openclaw-home/memory/backups",
      lanceDbPath: "/tmp/openclaw-home/memory/lancedb-pro",
      openclawBin: "openclaw",
    });
  });

  it("keeps sync audit and analytics payloads operator-safe when host-local sync fails", async () => {
    const missingBackupDir = join(backupDir, "missing");
    process.env.OPENCLAW_MEMORY_BACKUP_DIR = missingBackupDir;

    await expect(
      syncOpenClawMemory({
        workspaceId: "workspace-1",
        sourceMode: "backup_jsonl",
        maxItems: 1,
      }),
    ).rejects.toThrow("ENOENT");

    const failedAnalytics = logEventMock.mock.calls.find(
      ([event]) => event.eventName === "openclaw_memory_sync_failed",
    )?.[0];
    const failedAudit = writeAuditLogMock.mock.calls.find(
      ([event]) => event.actionType === "OPENCLAW_MEMORY_SYNC_FAILED",
    )?.[0];

    expect(failedAnalytics?.metadata).toMatchObject({
      sourceRef: "openclaw:backup_jsonl",
      error:
        "OpenClaw sync process failed before import completed. Review server-side audit and runtime logs for details.",
    });
    expect(failedAudit?.payload).toMatchObject({
      sourceRef: "openclaw:backup_jsonl",
      error:
        "OpenClaw sync process failed before import completed. Review server-side audit and runtime logs for details.",
    });
    expect(JSON.stringify(failedAnalytics)).not.toContain(missingBackupDir);
    expect(JSON.stringify(failedAudit)).not.toContain(missingBackupDir);
  });
});
