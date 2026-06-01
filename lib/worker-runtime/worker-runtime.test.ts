import { RuntimeEventStatus, WorkerRunStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  evaluateWorkerRuntimeGate,
  launchWorkerRuntime,
  READOUT_ONLY_RUNTIME_WORKER_IDS,
} from "./worker-runtime";

const safeWriteAuditLogMock = vi.hoisted(() => vi.fn().mockResolvedValue(null));

const dbMock = vi.hoisted(() => ({
  runtimeEvent: {
    create: vi.fn(),
    update: vi.fn(),
  },
  workerRun: {
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/audit", () => ({
  safeWriteAuditLog: safeWriteAuditLogMock,
}));

describe("worker runtime gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("only admits readout-only workers in observer mode", () => {
    const gate = evaluateWorkerRuntimeGate({
      workerId: READOUT_ONLY_RUNTIME_WORKER_IDS[0],
      mode: "observer",
      runtimeKind: "readout_only",
    });

    expect(gate.allowed).toBe(true);
    expect(gate.gateCode).toBe("allowed");
    expect(gate.sideEffectAllowed).toBe(false);
  });

  it("rejects preview workers before they enter production observation", () => {
    const gate = evaluateWorkerRuntimeGate({
      workerId: "case-allocation-driver-preview-v0",
      mode: "observer",
      runtimeKind: "preview",
    });

    expect(gate.allowed).toBe(false);
    expect(gate.gateCode).toBe("not_allowlisted");
    expect(gate.reason).toContain("not allowlisted");
  });

  it("rejects non-observer mode even for allowlisted readout workers", () => {
    const gate = evaluateWorkerRuntimeGate({
      workerId: READOUT_ONLY_RUNTIME_WORKER_IDS[0],
      mode: "shadow",
      runtimeKind: "readout_only",
    });

    expect(gate.allowed).toBe(false);
    expect(gate.gateCode).toBe("not_observer_mode");
    expect(gate.reason).toContain("only observer mode");
  });
});

describe("launchWorkerRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.runtimeEvent.create.mockResolvedValue({ id: "runtime-event-1" });
    dbMock.workerRun.create.mockResolvedValue({ id: "worker-run-1" });
    dbMock.runtimeEvent.update.mockResolvedValue({ id: "runtime-event-1" });
    dbMock.workerRun.update.mockResolvedValue({ id: "worker-run-1" });
    safeWriteAuditLogMock.mockResolvedValue(null);
  });

  it("creates a worker run ledger and audit for readout-only observation", async () => {
    const run = vi.fn().mockResolvedValue({
      outputSummary: "readout summary",
      outputPayload: { total: 3 },
      evidenceRefs: ["e-1"],
      openQuestions: ["q-1"],
      confidence: 92,
    });

    const result = await launchWorkerRuntime({
      workspaceId: "workspace-1",
      workerId: READOUT_ONLY_RUNTIME_WORKER_IDS[0],
      workerLabel: "Swarm Search Worker",
      workerVersion: "1.0.0",
      mode: "observer",
      runtimeKind: "readout_only",
      inputSummary: "search readout",
      inputPayload: { query: "hello" },
      run,
    });

    expect(run).toHaveBeenCalledTimes(1);
    expect(dbMock.runtimeEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: "workspace-1",
          eventType: "worker.runtime.launch",
          status: RuntimeEventStatus.RUNNING,
        }),
      }),
    );
    expect(dbMock.workerRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: "workspace-1",
          agentId: READOUT_ONLY_RUNTIME_WORKER_IDS[0],
          status: WorkerRunStatus.RUNNING,
        }),
      }),
    );
    expect(dbMock.workerRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "worker-run-1" },
        data: expect.objectContaining({
          status: WorkerRunStatus.COMPLETED,
          outputSummary: "readout summary",
        }),
      }),
    );
    expect(safeWriteAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "WORKER_RUNTIME_OBSERVED",
        targetType: "Worker",
        targetId: READOUT_ONLY_RUNTIME_WORKER_IDS[0],
      }),
    );
    expect(result.status).toBe(WorkerRunStatus.COMPLETED);
    expect(result.outputSummary).toBe("readout summary");
    expect(result.outputPayload).toEqual({ total: 3 });
  });

  it("blocks preview workers and still writes rejection audit and failed ledger", async () => {
    const run = vi.fn();

    const result = await launchWorkerRuntime({
      workspaceId: "workspace-1",
      workerId: "case-allocation-driver-preview-v0",
      workerLabel: "Case Allocation Driver",
      workerVersion: "0.0.1-preview",
      mode: "observer",
      runtimeKind: "preview",
      inputSummary: "allocation preview",
      inputPayload: { x: 1 },
      run,
    });

    expect(run).not.toHaveBeenCalled();
    expect(dbMock.runtimeEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: RuntimeEventStatus.FAILED,
          errorMessage: expect.stringContaining("not allowlisted"),
        }),
      }),
    );
    expect(dbMock.workerRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: WorkerRunStatus.FAILED,
          errorMessage: expect.stringContaining("not allowlisted"),
        }),
      }),
    );
    expect(safeWriteAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "WORKER_RUNTIME_REJECTED",
        targetId: "case-allocation-driver-preview-v0",
      }),
    );
    expect(result.status).toBe(WorkerRunStatus.FAILED);
    expect(result.outputSummary).toBeNull();
  });
});
