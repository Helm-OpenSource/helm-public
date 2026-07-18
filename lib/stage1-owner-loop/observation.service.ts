import "server-only";

import { ActorType } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { assertWorkspacePolicyServiceAccess } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import { jsonStringify, safeParseJson } from "@/lib/utils";
import {
  authorizeObservation,
  validateEnterpriseObservationProgram,
  validateSourceObservationReceipt,
} from "./contracts";
import type {
  EnterpriseObservationProgram,
  ObservationSource,
  SourceObservationReceipt,
} from "./types";

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

function requireHumanOwner(input: {
  actorUserId?: string | null;
  english?: boolean;
}): string {
  if (input.actorUserId?.trim()) return input.actorUserId;
  throw new ObservationAuthorizationDeniedError(
    input.english
      ? ["A signed-in owner identity is required"]
      : ["必须由已登录的一把手身份完成授权"],
  );
}

function toProgramContract(program: {
  id: string;
  workspaceId: string;
  purpose: string;
  scopeRefs: string;
  dataCategories: string;
  startsAt: Date;
  expiresAt: Date;
  retentionDays: number;
  authorizationRef: string;
  status: string;
  revokedAt: Date | null;
  revokedByRef: string | null;
  revocationReason: string | null;
  auditRefs: string | null;
}): EnterpriseObservationProgram {
  return {
    programId: program.id,
    workspaceRef: `workspace:${program.workspaceId}`,
    purpose: program.purpose,
    scopeRefs: safeParseJson<string[]>(program.scopeRefs, []),
    dataCategories: safeParseJson<string[]>(program.dataCategories, []),
    startsAt: program.startsAt.toISOString(),
    expiresAt: program.expiresAt.toISOString(),
    retentionDays: program.retentionDays,
    authorizationRef: program.authorizationRef,
    status:
      program.status.toLowerCase() as EnterpriseObservationProgram["status"],
    revokedAt: program.revokedAt?.toISOString() ?? null,
    revokedByRef: program.revokedByRef,
    revocationReason: program.revocationReason,
    auditRefs: safeParseJson<string[]>(program.auditRefs, []),
  };
}

function toSourceContract(source: {
  id: string;
  workspaceId: string;
  programId: string;
  sourceKind: string;
  accessMode: string;
  ownerRef: string;
  freshnessSlaMinutes: number;
  sensitivity: string;
  authorizationRef: string;
  secretRef: string;
  retentionDays: number;
  status: string;
}): ObservationSource {
  return {
    sourceId: source.id,
    workspaceRef: `workspace:${source.workspaceId}`,
    programRef: source.programId,
    sourceKind: source.sourceKind,
    accessMode:
      source.accessMode.toLowerCase() as ObservationSource["accessMode"],
    ownerRef: source.ownerRef,
    freshnessSlaMinutes: source.freshnessSlaMinutes,
    sensitivity:
      source.sensitivity.toLowerCase() as ObservationSource["sensitivity"],
    authorizationRef: source.authorizationRef,
    secretRef: source.secretRef,
    retentionDays: source.retentionDays,
    status: source.status.toLowerCase() as ObservationSource["status"],
  };
}

export class ObservationContractError extends Error {
  readonly reasons: string[];

  constructor(reasons: string[]) {
    super(`Invalid observation contract: ${reasons.join(", ")}`);
    this.name = "ObservationContractError";
    this.reasons = reasons;
  }
}

export class ObservationAuthorizationDeniedError extends Error {
  readonly reasons: string[];

  constructor(reasons: string[]) {
    super(`Observation authorization denied: ${reasons.join(", ")}`);
    this.name = "ObservationAuthorizationDeniedError";
    this.reasons = reasons;
  }
}

export async function createEnterpriseObservationProgram(input: {
  workspaceId: string;
  purpose: string;
  scopeRefs: string[];
  dataCategories: string[];
  startsAt: Date;
  expiresAt: Date;
  retentionDays: number;
  authorizationRef: string;
  actorName: string;
  actorUserId: string;
  english?: boolean;
}) {
  const actorUserId = requireHumanOwner(input);
  await assertWorkspacePolicyServiceAccess({
    workspaceId: input.workspaceId,
    userId: actorUserId,
    actorType: ActorType.USER,
    english: input.english ?? false,
  });

  const contract: EnterpriseObservationProgram = {
    programId: "pending",
    workspaceRef: `workspace:${input.workspaceId}`,
    purpose: input.purpose,
    scopeRefs: input.scopeRefs,
    dataCategories: input.dataCategories,
    startsAt: input.startsAt.toISOString(),
    expiresAt: input.expiresAt.toISOString(),
    retentionDays: input.retentionDays,
    authorizationRef: input.authorizationRef,
    status: "active",
    revokedAt: null,
    revokedByRef: null,
    revocationReason: null,
    auditRefs: [],
  };
  const validation = validateEnterpriseObservationProgram(contract);
  if (!validation.valid) throw new ObservationContractError(validation.errors);

  return db.$transaction(async (tx) => {
    const program = await tx.enterpriseObservationProgram.create({
      data: {
        workspaceId: input.workspaceId,
        purpose: input.purpose.trim(),
        scopeRefs: jsonStringify([
          ...new Set(input.scopeRefs.map((value) => value.trim())),
        ]),
        dataCategories: jsonStringify([
          ...new Set(input.dataCategories.map((value) => value.trim())),
        ]),
        startsAt: input.startsAt,
        expiresAt: input.expiresAt,
        retentionDays: input.retentionDays,
        authorizationRef: input.authorizationRef.trim(),
        status: "ACTIVE",
      },
    });
    await writeAuditLog(
      {
        workspaceId: input.workspaceId,
        userId: actorUserId,
        actor: input.actorName,
        actorType: ActorType.USER,
        actionType: "ENTERPRISE_OBSERVATION_AUTHORIZED",
        targetType: "EnterpriseObservationProgram",
        targetId: program.id,
        summary: input.english
          ? "Owner authorized a time-bounded read-only observation program"
          : "一把手已授权有期限的只读企业观察计划",
        payload: {
          authorizationRef: program.authorizationRef,
          startsAt: program.startsAt,
          expiresAt: program.expiresAt,
          retentionDays: program.retentionDays,
          scopeRefs: input.scopeRefs,
          dataCategories: input.dataCategories,
        },
      },
      { client: tx },
    );
    return program;
  });
}

export async function registerObservationSource(input: {
  workspaceId: string;
  programId: string;
  sourceKey: string;
  sourceKind: string;
  accessMode: ObservationSource["accessMode"];
  ownerRef: string;
  freshnessSlaMinutes: number;
  sensitivity: ObservationSource["sensitivity"];
  authorizationRef: string;
  secretRef: string;
  retentionDays: number;
  actorName: string;
  actorUserId: string;
  english?: boolean;
}) {
  const actorUserId = requireHumanOwner(input);
  await assertWorkspacePolicyServiceAccess({
    workspaceId: input.workspaceId,
    userId: actorUserId,
    actorType: ActorType.USER,
    english: input.english ?? false,
  });
  const program = await db.enterpriseObservationProgram.findFirst({
    where: { id: input.programId, workspaceId: input.workspaceId },
  });
  if (!program)
    throw new ObservationAuthorizationDeniedError(["program_not_found"]);

  const sourceContract: ObservationSource = {
    sourceId: input.sourceKey,
    workspaceRef: `workspace:${input.workspaceId}`,
    programRef: program.id,
    sourceKind: input.sourceKind,
    accessMode: input.accessMode,
    ownerRef: input.ownerRef,
    freshnessSlaMinutes: input.freshnessSlaMinutes,
    sensitivity: input.sensitivity,
    authorizationRef: input.authorizationRef,
    secretRef: input.secretRef,
    retentionDays: input.retentionDays,
    status: "active",
  };
  const authorization = authorizeObservation({
    program: toProgramContract(program),
    source: sourceContract,
    now: new Date().toISOString(),
  });
  if (!authorization.allowed) {
    throw new ObservationAuthorizationDeniedError(authorization.reasons);
  }

  return db.$transaction(async (tx) => {
    const source = await tx.observationSource.create({
      data: {
        workspaceId: input.workspaceId,
        programId: program.id,
        sourceKey: input.sourceKey.trim(),
        sourceKind: input.sourceKind.trim(),
        accessMode: input.accessMode.toUpperCase(),
        ownerRef: input.ownerRef.trim(),
        freshnessSlaMinutes: input.freshnessSlaMinutes,
        sensitivity: input.sensitivity.toUpperCase(),
        authorizationRef: input.authorizationRef.trim(),
        secretRef: input.secretRef.trim(),
        retentionDays: input.retentionDays,
        status: "ACTIVE",
      },
    });
    await writeAuditLog(
      {
        workspaceId: input.workspaceId,
        userId: actorUserId,
        actor: input.actorName,
        actorType: ActorType.USER,
        actionType: "OBSERVATION_SOURCE_REGISTERED",
        targetType: "ObservationSource",
        targetId: source.id,
        summary: input.english
          ? "Read-only observation source registered"
          : "只读观察来源已登记",
        payload: {
          sourceKey: source.sourceKey,
          accessMode: source.accessMode,
          secretRef: source.secretRef,
          authorizationRef: source.authorizationRef,
        },
      },
      { client: tx },
    );
    return source;
  });
}

export async function revokeEnterpriseObservationProgram(input: {
  workspaceId: string;
  programId: string;
  reason: string;
  actorName: string;
  actorUserId: string;
  english?: boolean;
}) {
  const actorUserId = requireHumanOwner(input);
  await assertWorkspacePolicyServiceAccess({
    workspaceId: input.workspaceId,
    userId: actorUserId,
    actorType: ActorType.USER,
    english: input.english ?? false,
  });
  if (!input.reason.trim())
    throw new ObservationContractError(["revocation_reason_required"]);
  const now = new Date();

  const result = await db.$transaction(async (tx) => {
    const claimed = await tx.enterpriseObservationProgram.updateMany({
      where: {
        id: input.programId,
        workspaceId: input.workspaceId,
        status: "ACTIVE",
        revokedAt: null,
      },
      data: {
        status: "REVOKED",
        revokedAt: now,
        revokedByRef: actorUserId,
        revocationReason: input.reason.trim(),
        authorizationVersion: { increment: 1 },
      },
    });
    const program = await tx.enterpriseObservationProgram.findFirst({
      where: { id: input.programId, workspaceId: input.workspaceId },
    });
    if (!program)
      throw new ObservationAuthorizationDeniedError(["program_not_found"]);
    if (claimed.count === 0 && program.status !== "REVOKED") {
      throw new ObservationAuthorizationDeniedError(["program_not_active"]);
    }
    if (claimed.count > 0) {
      await tx.observationSource.updateMany({
        where: {
          workspaceId: input.workspaceId,
          programId: input.programId,
          status: "ACTIVE",
        },
        data: { status: "REVOKED" },
      });
      await tx.observationSourceRun.updateMany({
        where: {
          workspaceId: input.workspaceId,
          programId: input.programId,
          status: "RUNNING",
        },
        data: {
          status: "CANCELLED",
          outcome: "FAILURE",
          freshness: "UNKNOWN",
          observedAt: now,
          errorCodes: jsonStringify(["authorization_revoked"]),
        },
      });
    }
    if (claimed.count > 0) {
      await writeAuditLog(
        {
          workspaceId: input.workspaceId,
          userId: actorUserId,
          actor: input.actorName,
          actorType: ActorType.USER,
          actionType: "ENTERPRISE_OBSERVATION_REVOKED",
          targetType: "EnterpriseObservationProgram",
          targetId: program.id,
          summary: input.english
            ? "Owner revoked the observation program; active sources and runs were stopped"
            : "一把手已撤销观察计划，活动来源与运行已停止",
          payload: { reason: input.reason.trim(), revokedAt: now },
        },
        { client: tx },
      );
    }
    return program;
  });
  return result;
}

export async function beginObservationSourceRun(input: {
  workspaceId: string;
  sourceKey: string;
  executionKey: string;
  windowStart: Date;
  windowEnd: Date;
  now?: Date;
}) {
  if (!input.executionKey.trim())
    throw new ObservationContractError(["execution_key_required"]);
  if (input.windowStart > input.windowEnd) {
    throw new ObservationContractError(["observation_window_reversed"]);
  }
  const now = input.now ?? new Date();

  try {
    return await db.$transaction(async (tx) => {
      const source = await tx.observationSource.findUnique({
        where: {
          workspaceId_sourceKey: {
            workspaceId: input.workspaceId,
            sourceKey: input.sourceKey,
          },
        },
        include: { program: true },
      });
      if (!source)
        throw new ObservationAuthorizationDeniedError(["source_not_found"]);

      const existing = await tx.observationSourceRun.findUnique({
        where: {
          sourceId_executionKey: {
            sourceId: source.id,
            executionKey: input.executionKey,
          },
        },
      });
      if (existing) return existing;

      const authorization = authorizeObservation({
        program: toProgramContract(source.program),
        source: toSourceContract(source),
        now: now.toISOString(),
      });
      if (!authorization.allowed) {
        throw new ObservationAuthorizationDeniedError(authorization.reasons);
      }

      const claimed = await tx.enterpriseObservationProgram.updateMany({
        where: {
          id: source.programId,
          workspaceId: input.workspaceId,
          status: "ACTIVE",
          revokedAt: null,
          startsAt: { lte: now },
          expiresAt: { gt: now },
          authorizationVersion: source.program.authorizationVersion,
        },
        data: { runSequence: { increment: 1 } },
      });
      if (claimed.count !== 1) {
        throw new ObservationAuthorizationDeniedError([
          "authorization_claim_lost",
        ]);
      }

      return tx.observationSourceRun.create({
        data: {
          workspaceId: input.workspaceId,
          programId: source.programId,
          sourceId: source.id,
          executionKey: input.executionKey.trim(),
          authorizationVersion: source.program.authorizationVersion,
          windowStart: input.windowStart,
          windowEnd: input.windowEnd,
          status: "RUNNING",
        },
      });
    });
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) throw error;
    const source = await db.observationSource.findUnique({
      where: {
        workspaceId_sourceKey: {
          workspaceId: input.workspaceId,
          sourceKey: input.sourceKey,
        },
      },
    });
    if (!source) throw error;
    const winner = await db.observationSourceRun.findUnique({
      where: {
        sourceId_executionKey: {
          sourceId: source.id,
          executionKey: input.executionKey,
        },
      },
    });
    if (!winner) throw error;
    return winner;
  }
}

export async function completeObservationSourceRun(input: {
  workspaceId: string;
  runId: string;
  observedAt: Date;
  summaryHash: string | null;
  completenessPercent: number | null;
  freshness: SourceObservationReceipt["freshness"];
  outcome: Exclude<SourceObservationReceipt["outcome"], "unknown">;
  evidenceRefs: string[];
  errorCodes: string[];
  actorName?: string;
}) {
  const run = await db.observationSourceRun.findFirst({
    where: { id: input.runId, workspaceId: input.workspaceId },
  });
  if (!run) throw new ObservationContractError(["observation_run_not_found"]);

  const receipt: SourceObservationReceipt = {
    receiptId: run.id,
    workspaceRef: `workspace:${input.workspaceId}`,
    sourceRef: run.sourceId,
    programRef: run.programId,
    windowStart: run.windowStart.toISOString(),
    windowEnd: run.windowEnd.toISOString(),
    observedAt: input.observedAt.toISOString(),
    summaryHash: input.summaryHash,
    completenessPercent: input.completenessPercent,
    freshness: input.freshness,
    outcome: input.outcome,
    evidenceRefs: input.evidenceRefs,
    errorCodes: input.errorCodes,
  };
  const validation = validateSourceObservationReceipt(receipt);
  if (!validation.valid) throw new ObservationContractError(validation.errors);

  const terminalStatus =
    input.outcome === "success"
      ? "SUCCEEDED"
      : input.outcome === "partial_success"
        ? "PARTIAL"
        : "FAILED";
  const updated = await db.$transaction(async (tx) => {
    const claimed = await tx.observationSourceRun.updateMany({
      where: { id: run.id, workspaceId: input.workspaceId, status: "RUNNING" },
      data: {
        status: terminalStatus,
        observedAt: input.observedAt,
        summaryHash: input.summaryHash,
        completenessPercent: input.completenessPercent,
        freshness: input.freshness.toUpperCase(),
        outcome: input.outcome.toUpperCase(),
        evidenceRefs: jsonStringify(input.evidenceRefs),
        errorCodes:
          input.errorCodes.length > 0 ? jsonStringify(input.errorCodes) : null,
      },
    });
    if (claimed.count === 0) {
      const immutable = await tx.observationSourceRun.findUnique({
        where: { id: run.id },
      });
      if (!immutable)
        throw new ObservationContractError(["observation_run_not_found"]);
      return { run: immutable, changed: false };
    }
    await tx.observationSource.updateMany({
      where: {
        id: run.sourceId,
        workspaceId: input.workspaceId,
        status: "ACTIVE",
      },
      data: { lastObservedAt: input.observedAt },
    });
    const completed = await tx.observationSourceRun.findUniqueOrThrow({
      where: { id: run.id },
    });
    await writeAuditLog(
      {
        workspaceId: input.workspaceId,
        actor: input.actorName ?? "Helm Observation Runtime",
        actorType: ActorType.SYSTEM,
        actionType: "OBSERVATION_SOURCE_RECEIPT_RECORDED",
        targetType: "ObservationSourceRun",
        targetId: completed.id,
        summary: `Observation receipt recorded: ${completed.outcome}`,
        payload: {
          sourceId: completed.sourceId,
          summaryHash: completed.summaryHash,
          completenessPercent: completed.completenessPercent,
          freshness: completed.freshness,
          evidenceRefCount: input.evidenceRefs.length,
        },
      },
      { client: tx },
    );
    return { run: completed, changed: true };
  });
  return updated.run;
}
