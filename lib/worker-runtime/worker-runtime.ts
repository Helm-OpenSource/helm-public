import { ActorType, RuntimeEventStatus, WorkerRunStatus } from "@prisma/client";
import { safeWriteAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { jsonStringify } from "@/lib/utils";

export const READOUT_ONLY_RUNTIME_WORKER_IDS = [
  "swarm-search-worker",
  "swarm-grep-worker",
  "swarm-evidence-miner",
] as const;

export type WorkerRuntimeMode = "observer" | "shadow" | "active";

export type WorkerRuntimeKind = "readout_only" | "preview" | "proposal" | "execution";

export type WorkerRuntimeGateDecision = Readonly<{
  allowed: boolean;
  gateCode: "allowed" | "not_allowlisted" | "not_observer_mode" | "not_readout_only";
  reason: string;
  sideEffectAllowed: false;
}>;

export type WorkerRuntimeLaunchInput<TInput, TOutput = unknown> = Readonly<{
  workspaceId: string;
  workerId: string;
  workerLabel: string;
  workerVersion: string;
  mode: WorkerRuntimeMode;
  runtimeKind: WorkerRuntimeKind;
  inputSummary: string;
  inputPayload: TInput;
  sourceProvenance?: unknown;
  evidenceRefs?: readonly string[];
  openQuestions?: readonly string[];
  confidence?: number;
  actorUserId?: string | null;
  actorName?: string;
  sourcePage?: string | null;
  allowlist?: readonly string[];
  run: (context: {
    gate: WorkerRuntimeGateDecision;
    inputPayload: TInput;
    runtimeEventId: string;
    workerRunId: string;
  }) => Promise<{
    outputSummary: string;
    outputPayload?: TOutput;
    evidenceRefs?: readonly string[];
    openQuestions?: readonly string[];
    confidence?: number;
    sourceProvenance?: unknown;
  }>;
}>;

export type WorkerRuntimeLaunchResult<TOutput = unknown> = Readonly<{
  gate: WorkerRuntimeGateDecision;
  runtimeEventId: string;
  workerRunId: string;
  status: WorkerRunStatus;
  outputSummary: string | null;
  outputPayload: TOutput | null;
}>;

export function evaluateWorkerRuntimeGate(input: {
  workerId: string;
  mode: WorkerRuntimeMode;
  runtimeKind: WorkerRuntimeKind;
  allowlist?: readonly string[];
}): WorkerRuntimeGateDecision {
  const allowlist = input.allowlist ?? READOUT_ONLY_RUNTIME_WORKER_IDS;

  if (!allowlist.includes(input.workerId)) {
    return {
      allowed: false,
      gateCode: "not_allowlisted",
      reason: `worker ${input.workerId} is not allowlisted for production observation`,
      sideEffectAllowed: false,
    };
  }

  if (input.mode !== "observer") {
    return {
      allowed: false,
      gateCode: "not_observer_mode",
      reason: `worker ${input.workerId} is in ${input.mode} mode; only observer mode can enter production observation`,
      sideEffectAllowed: false,
    };
  }

  if (input.runtimeKind !== "readout_only") {
    return {
      allowed: false,
      gateCode: "not_readout_only",
      reason: `worker ${input.workerId} is ${input.runtimeKind}; only readout-only workers can enter production observation`,
      sideEffectAllowed: false,
    };
  }

  return {
    allowed: true,
    gateCode: "allowed",
    reason: `worker ${input.workerId} is admitted in observer-only readout mode`,
    sideEffectAllowed: false,
  };
}

function buildRuntimeContext(input: {
  workerId: string;
  workerLabel: string;
  workerVersion: string;
  mode: WorkerRuntimeMode;
  runtimeKind: WorkerRuntimeKind;
  gate: WorkerRuntimeGateDecision;
  inputSummary: string;
  inputPayload: unknown;
  sourceProvenance?: unknown;
  evidenceRefs?: readonly string[];
  openQuestions?: readonly string[];
  confidence?: number;
}) {
  return {
    workerId: input.workerId,
    workerLabel: input.workerLabel,
    workerVersion: input.workerVersion,
    mode: input.mode,
    runtimeKind: input.runtimeKind,
    gate: input.gate,
    inputSummary: input.inputSummary,
    inputPayload: input.inputPayload,
    sourceProvenance: input.sourceProvenance ?? null,
    evidenceRefs: input.evidenceRefs ?? [],
    openQuestions: input.openQuestions ?? [],
    confidence: input.confidence ?? null,
  };
}

export async function launchWorkerRuntime<TInput, TOutput = unknown>(
  input: WorkerRuntimeLaunchInput<TInput, TOutput>,
): Promise<WorkerRuntimeLaunchResult<TOutput>> {
  const gate = evaluateWorkerRuntimeGate({
    workerId: input.workerId,
    mode: input.mode,
    runtimeKind: input.runtimeKind,
    allowlist: input.allowlist,
  });
  const startedAt = new Date();

  const runtimeEvent = await db.runtimeEvent.create({
    data: {
      workspaceId: input.workspaceId,
      eventType: "worker.runtime.launch",
      status: gate.allowed ? RuntimeEventStatus.RUNNING : RuntimeEventStatus.FAILED,
      trustedContext: jsonStringify(
        buildRuntimeContext({
          workerId: input.workerId,
          workerLabel: input.workerLabel,
          workerVersion: input.workerVersion,
          mode: input.mode,
          runtimeKind: input.runtimeKind,
          gate,
          inputSummary: input.inputSummary,
          inputPayload: input.inputPayload,
          sourceProvenance: input.sourceProvenance,
          evidenceRefs: input.evidenceRefs,
          openQuestions: input.openQuestions,
          confidence: input.confidence,
        }),
      ),
      untrustedContext: jsonStringify({
        workerId: input.workerId,
        workerLabel: input.workerLabel,
        workerVersion: input.workerVersion,
        inputSummary: input.inputSummary,
        mode: input.mode,
        runtimeKind: input.runtimeKind,
      }),
      payload: jsonStringify({
        workerId: input.workerId,
        workerLabel: input.workerLabel,
        workerVersion: input.workerVersion,
        inputSummary: input.inputSummary,
        mode: input.mode,
        runtimeKind: input.runtimeKind,
        gate,
      }),
      sourceProvenance: jsonStringify(input.sourceProvenance ?? null),
      triggeredBy: input.actorUserId ? "human" : "system",
      startedAt,
      errorMessage: gate.allowed ? undefined : gate.reason,
      failedAt: gate.allowed ? undefined : startedAt,
      relatedObjectType: "Worker",
      relatedObjectId: input.workerId,
    },
  });

  const workerRun = await db.workerRun.create({
    data: {
      workspaceId: input.workspaceId,
      runtimeEventId: runtimeEvent.id,
      agentId: input.workerId,
      status: gate.allowed ? WorkerRunStatus.RUNNING : WorkerRunStatus.FAILED,
      inputSummary: input.inputSummary,
      evidenceRefs: jsonStringify(input.evidenceRefs ?? []),
      sourceProvenance: jsonStringify(
        input.sourceProvenance ?? {
          workerId: input.workerId,
          workerLabel: input.workerLabel,
          workerVersion: input.workerVersion,
          mode: input.mode,
          runtimeKind: input.runtimeKind,
          gate,
        },
      ),
      confidence: input.confidence ?? undefined,
      openQuestions: jsonStringify(input.openQuestions ?? []),
      errorMessage: gate.allowed ? undefined : gate.reason,
      startedAt,
      failedAt: gate.allowed ? undefined : startedAt,
    },
  });

  if (!gate.allowed) {
    await safeWriteAuditLog({
      workspaceId: input.workspaceId,
      userId: input.actorUserId ?? undefined,
      actor: input.actorName ?? "system:worker-runtime",
      actorType: input.actorUserId ? ActorType.USER : ActorType.SYSTEM,
      actionType: "GUANGPU_WORKER_RUNTIME_REJECTED",
      targetType: "Worker",
      targetId: input.workerId,
      summary: `Worker runtime blocked in observer-only gate: ${gate.reason}`,
      payload: {
        workerId: input.workerId,
        workerLabel: input.workerLabel,
        workerVersion: input.workerVersion,
        gate,
        runtimeEventId: runtimeEvent.id,
        workerRunId: workerRun.id,
        inputSummary: input.inputSummary,
      },
      sourcePage: input.sourcePage ?? null,
    });

    return {
      gate,
      runtimeEventId: runtimeEvent.id,
      workerRunId: workerRun.id,
      status: WorkerRunStatus.FAILED,
      outputSummary: null,
      outputPayload: null,
    };
  }

  try {
    const result = await input.run({
      gate,
      inputPayload: input.inputPayload,
      runtimeEventId: runtimeEvent.id,
      workerRunId: workerRun.id,
    });
    const completedAt = new Date();
    const evidenceRefs = result.evidenceRefs ?? input.evidenceRefs ?? [];
    const openQuestions = result.openQuestions ?? input.openQuestions ?? [];
    const confidence = result.confidence ?? input.confidence ?? undefined;
    const sourceProvenance = result.sourceProvenance ?? input.sourceProvenance ?? {
      workerId: input.workerId,
      workerLabel: input.workerLabel,
      workerVersion: input.workerVersion,
      mode: input.mode,
      runtimeKind: input.runtimeKind,
      gate,
    };

    await db.workerRun.update({
      where: { id: workerRun.id },
      data: {
        status: WorkerRunStatus.COMPLETED,
        outputSummary: result.outputSummary,
        evidenceRefs: jsonStringify(evidenceRefs),
        sourceProvenance: jsonStringify(sourceProvenance),
        confidence,
        openQuestions: jsonStringify(openQuestions),
        completedAt,
      },
    });

    await db.runtimeEvent.update({
      where: { id: runtimeEvent.id },
      data: {
        status: RuntimeEventStatus.COMPLETED,
        completedAt,
      },
    });

    await safeWriteAuditLog({
      workspaceId: input.workspaceId,
      userId: input.actorUserId ?? undefined,
      actor: input.actorName ?? "system:worker-runtime",
      actorType: input.actorUserId ? ActorType.USER : ActorType.SYSTEM,
      actionType: "GUANGPU_WORKER_RUNTIME_OBSERVED",
      targetType: "Worker",
      targetId: input.workerId,
      summary: `Worker runtime observed ${input.workerId} in readout-only mode.`,
      payload: {
        workerId: input.workerId,
        workerLabel: input.workerLabel,
        workerVersion: input.workerVersion,
        gate,
        runtimeEventId: runtimeEvent.id,
        workerRunId: workerRun.id,
        outputSummary: result.outputSummary,
        sideEffectAllowed: gate.sideEffectAllowed,
      },
      sourcePage: input.sourcePage ?? null,
    });

    return {
      gate,
      runtimeEventId: runtimeEvent.id,
      workerRunId: workerRun.id,
      status: WorkerRunStatus.COMPLETED,
      outputSummary: result.outputSummary,
      outputPayload: (result.outputPayload ?? null) as TOutput | null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const failedAt = new Date();

    await db.workerRun.update({
      where: { id: workerRun.id },
      data: {
        status: WorkerRunStatus.FAILED,
        errorMessage,
        failedAt,
      },
    });

    await db.runtimeEvent.update({
      where: { id: runtimeEvent.id },
      data: {
        status: RuntimeEventStatus.FAILED,
        errorMessage,
        failedAt,
      },
    });

    await safeWriteAuditLog({
      workspaceId: input.workspaceId,
      userId: input.actorUserId ?? undefined,
      actor: input.actorName ?? "system:worker-runtime",
      actorType: input.actorUserId ? ActorType.USER : ActorType.SYSTEM,
      actionType: "GUANGPU_WORKER_RUNTIME_FAILED",
      targetType: "Worker",
      targetId: input.workerId,
      summary: `Worker runtime failed for ${input.workerId}: ${errorMessage}`,
      payload: {
        workerId: input.workerId,
        workerLabel: input.workerLabel,
        workerVersion: input.workerVersion,
        gate,
        runtimeEventId: runtimeEvent.id,
        workerRunId: workerRun.id,
        errorMessage,
        sideEffectAllowed: gate.sideEffectAllowed,
      },
      sourcePage: input.sourcePage ?? null,
    });

    return {
      gate,
      runtimeEventId: runtimeEvent.id,
      workerRunId: workerRun.id,
      status: WorkerRunStatus.FAILED,
      outputSummary: null,
      outputPayload: null,
    };
  }
}
