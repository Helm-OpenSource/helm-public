import { ActorType, ExternalSyncProvider, ExternalSyncStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { ExternalAgentArtifact } from "@/features/external-agent-intake/artifact-contract";
import {
  evaluateExternalAgentArtifact,
  type ExternalAgentIntakeDecision,
  type IntakeDisposition,
  type IntakeReasonCode,
} from "@/features/external-agent-intake/intake-decision";
import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  parseOpenClawMemoryLine,
  parseOpenClawMemoryPayload,
  type ParsedOpenClawMemoryRecord,
} from "@/lib/integrations/openclaw-memory/parser";

const DEFAULT_BACKUP_DIR = join(homedir(), ".openclaw", "memory", "backups");
const DEFAULT_LANCEDB_PATH = join(homedir(), ".openclaw", "memory", "lancedb-pro");
const DEFAULT_OPENCLAW_BIN = "openclaw";

type SourceMode = "lancedb" | "backup_jsonl";

type Cursor = {
  mode?: SourceMode;
  file: string;
  line: number;
  timestampMs: number;
};

type OpenClawLanceDbListEntry = {
  id: unknown;
  text: unknown;
  category: unknown;
  scope: unknown;
  importance: unknown;
  timestamp: unknown;
  metadata?: unknown;
};

export type OpenClawSyncStats = {
  imported: number;
  updated: number;
  skipped: number;
  quarantined: number;
  failed: number;
  processed: number;
  lastCursor: Cursor | null;
};

export type SyncOpenClawMemoryInput = {
  workspaceId: string;
  sourceMode?: SourceMode;
  sourcePage?: string;
  trigger?: "manual" | "scheduled";
  actorName?: string;
  actorType?: ActorType;
  actorUserId?: string | null;
  maxItems?: number;
};

function normalizeSourceMode(value?: string | null): SourceMode {
  if (value === "backup_jsonl") return "backup_jsonl";
  return "lancedb";
}

function parseCursor(value?: string | null): Cursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<Cursor>;
    if (
      typeof parsed.file === "string" &&
      typeof parsed.line === "number" &&
      Number.isFinite(parsed.line)
    ) {
      return {
        mode: normalizeSourceMode(parsed.mode),
        file: parsed.file,
        line: parsed.line,
        timestampMs:
          typeof parsed.timestampMs === "number" && Number.isFinite(parsed.timestampMs)
            ? parsed.timestampMs
            : 0,
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function listBackupFiles(backupDir: string): Promise<string[]> {
  const fs = await import("node:fs/promises");
  // OpenClaw backups live outside the repo, so Turbopack should not try to
  // trace these runtime-selected paths as project assets.
  const entries = await fs.readdir(/* turbopackIgnore: true */ backupDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function shouldSkipByCursor(fileName: string, lineNo: number, cursor: Cursor | null) {
  if (!cursor) return false;

  const fileCmp = fileName.localeCompare(cursor.file);
  if (fileCmp < 0) return true;
  if (fileCmp > 0) return false;

  return lineNo <= cursor.line;
}

function isLikelyMemoryListItem(value: unknown): value is OpenClawLanceDbListEntry {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.text === "string" && row.timestamp != null;
}

function pickMemoryArrayCandidate(candidates: unknown[][]): OpenClawLanceDbListEntry[] | null {
  let best: OpenClawLanceDbListEntry[] | null = null;

  for (const candidate of candidates) {
    const normalized = candidate.filter(isLikelyMemoryListItem);
    if (!normalized.length) continue;
    if (!best || normalized.length > best.length) {
      best = normalized;
    }
  }

  return best;
}

function extractJsonArrays(text: string): unknown[][] {
  const arrays: unknown[][] = [];
  let depth = 0;
  let start = -1;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "[") {
      if (depth === 0) {
        start = i;
      }
      depth += 1;
      continue;
    }

    if (ch === "]") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        const candidate = text.slice(start, i + 1);
        try {
          const parsed = JSON.parse(candidate);
          if (Array.isArray(parsed)) {
            arrays.push(parsed);
          }
        } catch {
          // ignore non-json segments
        }
        start = -1;
      }
    }
  }

  return arrays;
}

function parseOpenClawMemoryListOutput(stdout: string, stderr: string) {
  const byStdout = pickMemoryArrayCandidate(extractJsonArrays(stdout));
  if (byStdout) return byStdout;

  const byCombined = pickMemoryArrayCandidate(extractJsonArrays(`${stdout}\n${stderr}`));
  if (byCombined) return byCombined;

  return [];
}

async function listLanceDbMemoriesPage(input: {
  openclawBin: string;
  lanceDbPath: string;
  limit: number;
  offset: number;
}) {
  const args = [
    "memory-pro",
    "list",
    "--json",
    "--limit",
    String(input.limit),
    "--offset",
    String(input.offset),
  ];

  const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(input.openclawBin, args, {
      env: {
        ...process.env,
        OPENCLAW_MEMORY_DB_PATH: input.lanceDbPath,
        NODE_NO_WARNINGS: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.once("error", (error) => {
      reject(error);
    });

    child.once("close", (code) => {
      if (code !== 0) {
        reject(new Error(`openclaw exited with code ${code}: ${stderr || stdout}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });

  return parseOpenClawMemoryListOutput(stdout, stderr);
}

function hasRecordChanged(input: {
  existing: {
    checksum: string | null;
    text: string;
    category: string;
    scope: string;
    importance: number | null;
    occurredAt: Date;
    rawMetadata: string | null;
  };
  incoming: {
    checksum: string;
    text: string;
    category: string;
    scope: string;
    importance: number | null;
    occurredAt: Date;
    rawMetadata: string | null;
  };
}) {
  if (input.existing.checksum && input.existing.checksum === input.incoming.checksum) {
    return false;
  }

  return (
    input.existing.text !== input.incoming.text ||
    input.existing.category !== input.incoming.category ||
    input.existing.scope !== input.incoming.scope ||
    input.existing.importance !== input.incoming.importance ||
    input.existing.occurredAt.getTime() !== input.incoming.occurredAt.getTime() ||
    (input.existing.rawMetadata ?? null) !== (input.incoming.rawMetadata ?? null)
  );
}

function buildSyncActor(input: Pick<SyncOpenClawMemoryInput, "actorName" | "actorType" | "actorUserId">) {
  return {
    actor: input.actorName ?? "OpenClaw Memory Sync",
    actorType: input.actorType ?? ActorType.SYSTEM,
    userId: input.actorUserId ?? undefined,
  };
}

function buildOpenClawSyncSourceRef(sourceMode: SourceMode) {
  return sourceMode === "lancedb" ? "openclaw:lancedb" : "openclaw:backup_jsonl";
}

type OpenClawIntakeDisposition = "review_required" | "watch_only" | "quarantine";

type OpenClawIntakeDecision = {
  disposition: OpenClawIntakeDisposition;
  externalAgentDisposition: IntakeDisposition;
  reasonCodes: readonly IntakeReasonCode[];
  boundaryNote: string;
  containment: "downgraded" | "quarantined";
  mayAttachToSignal: false;
  mayCreateMustPushCandidate: false;
  mayCreateMemoryCandidate: false;
  mustRequireReview: true;
};

const OPENCLAW_EXTERNAL_AGENT_PROVIDER_ID = "openclaw_local";
const OPENCLAW_INTAKE_SCOPE = "external_agent:openclaw_local";

function hashNullableText(value: string | null) {
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex");
}

function shortHash(value: string) {
  return value.slice(0, 12);
}

function normalizeOpenClawConfidence(importance: number | null): number | undefined {
  if (importance == null || !Number.isFinite(importance)) {
    return undefined;
  }

  if (importance > 1) {
    return Math.max(0, Math.min(1, importance / 100));
  }

  return Math.max(0, Math.min(1, importance));
}

function buildOpenClawExternalAgentArtifact(input: {
  workspaceId: string;
  sourceFile: string;
  sourceLine: number;
  record: ParsedOpenClawMemoryRecord;
}): ExternalAgentArtifact {
  const providerArtifactRef = `openclaw:${input.record.externalId}`;
  const sourceRef = `${input.sourceFile}:${input.sourceLine}`;
  const providerConfidenceClaim = normalizeOpenClawConfidence(input.record.importance);

  return {
    artifactId: `${OPENCLAW_EXTERNAL_AGENT_PROVIDER_ID}:${input.record.externalId}`,
    workspaceId: input.workspaceId,
    providerId: OPENCLAW_EXTERNAL_AGENT_PROVIDER_ID,
    providerArtifactRef,
    artifactKind: "evidence_candidate",
    createdAt: input.record.occurredAt.toISOString(),
    sourceTimestamp: input.record.occurredAt.toISOString(),
    actorRef: OPENCLAW_EXTERNAL_AGENT_PROVIDER_ID,
    actorVisibleSummary: `OpenClaw local memory artifact ${shortHash(input.record.checksum)}`,
    rawOutputHash: input.record.checksum,
    redactionStatus: "unknown",
    providerTraceRefs: [providerArtifactRef, `source:${sourceRef}`],
    citationsOrEvidenceRefs: [],
    declaredSideEffects: ["read"],
    ...(providerConfidenceClaim === undefined ? {} : { providerConfidenceClaim }),
    contentSummary: input.record.text,
    contentShape: "text",
  };
}

function coerceOpenClawRuntimeIntakeDecision(decision: ExternalAgentIntakeDecision): OpenClawIntakeDecision {
  const reasonCodes = new Set<IntakeReasonCode>(decision.reasonCodes);
  reasonCodes.add("requires_human_review");
  reasonCodes.add("object_ref_unverified");

  const disposition: OpenClawIntakeDisposition =
    decision.disposition === "quarantine" || decision.disposition === "reject"
      ? "quarantine"
      : decision.disposition === "watch_only"
        ? "watch_only"
        : "review_required";

  return {
    disposition,
    externalAgentDisposition: decision.disposition,
    reasonCodes: [...reasonCodes],
    boundaryNote: [
      decision.boundaryNote,
      "OpenClaw host-local sync stores only an external candidate ledger; it cannot promote active Helm memory, Must Push, send, approval, settlement, or official write without review.",
    ].join(" "),
    containment: disposition === "quarantine" ? "quarantined" : "downgraded",
    mayAttachToSignal: false,
    mayCreateMustPushCandidate: false,
    mayCreateMemoryCandidate: false,
    mustRequireReview: true,
  };
}

function evaluateOpenClawRecordForIntake(input: {
  workspaceId: string;
  sourceFile: string;
  sourceLine: number;
  record: ParsedOpenClawMemoryRecord;
  referenceTime?: Date;
}): OpenClawIntakeDecision {
  const artifact = buildOpenClawExternalAgentArtifact(input);
  const decision = evaluateExternalAgentArtifact(artifact, {
    expectedWorkspaceId: input.workspaceId,
    referenceTimeIso: (input.referenceTime ?? new Date()).toISOString(),
  });

  return coerceOpenClawRuntimeIntakeDecision(decision);
}

function buildOpenClawExternalRecordText(record: ParsedOpenClawMemoryRecord, decision: OpenClawIntakeDecision) {
  return [
    `OpenClaw external artifact ${decision.disposition}.`,
    `rawOutputHash=${shortHash(record.checksum)}.`,
    "Raw OpenClaw content is not promoted into Helm active memory.",
    "Review is required before evidence, MemoryCandidate, Must Push, send, approval, settlement, or official write use.",
  ].join(" ");
}

function buildOpenClawExternalRecordMetadata(input: {
  record: ParsedOpenClawMemoryRecord;
  decision: OpenClawIntakeDecision;
  sourceFile: string;
  sourceLine: number;
}) {
  return JSON.stringify({
    providerId: OPENCLAW_EXTERNAL_AGENT_PROVIDER_ID,
    providerArtifactRef: `openclaw:${input.record.externalId}`,
    artifactKind: "evidence_candidate",
    redactionStatus: "unknown",
    declaredSideEffects: ["read"],
    rawOutputHash: input.record.checksum,
    rawMetadataHash: hashNullableText(input.record.rawMetadata),
    sourceFile: input.sourceFile,
    sourceLine: input.sourceLine,
    contentLength: input.record.text.length,
    originalCategory: input.record.category,
    originalScopeHash: hashNullableText(input.record.scope),
    externalAgentEvaluatorDisposition: input.decision.externalAgentDisposition,
    intakeDisposition: input.decision.disposition,
    reasonCodes: input.decision.reasonCodes,
    containment: input.decision.containment,
    boundaryNote: input.decision.boundaryNote,
    mayAttachToSignal: input.decision.mayAttachToSignal,
    mayCreateMustPushCandidate: input.decision.mayCreateMustPushCandidate,
    mayCreateMemoryCandidate: input.decision.mayCreateMemoryCandidate,
    mustRequireReview: input.decision.mustRequireReview,
  });
}

async function claimSyncLock(workspaceId: string) {
  const now = new Date();
  await db.externalMemorySyncState.upsert({
    where: {
      workspaceId_provider: {
        workspaceId,
        provider: ExternalSyncProvider.OPENCLAW,
      },
    },
    create: {
      workspaceId,
      provider: ExternalSyncProvider.OPENCLAW,
      lastRunStatus: ExternalSyncStatus.IDLE,
      isRunning: false,
      updatedAt: now,
    },
    update: {
      updatedAt: now,
    },
  });

  const acquired = await db.externalMemorySyncState.updateMany({
    where: {
      workspaceId,
      provider: ExternalSyncProvider.OPENCLAW,
      isRunning: false,
    },
    data: {
      isRunning: true,
      runStartedAt: now,
      runFinishedAt: null,
      lastRunStatus: ExternalSyncStatus.RUNNING,
      lastError: null,
    },
  });

  if (acquired.count === 0) {
    throw new Error("OpenClaw memory sync is already running");
  }

  return db.externalMemorySyncState.findUniqueOrThrow({
    where: {
      workspaceId_provider: {
        workspaceId,
        provider: ExternalSyncProvider.OPENCLAW,
      },
    },
  });
}

async function processParsedRecord(input: {
  workspaceId: string;
  sourceFile: string;
  sourceLine: number;
  record: ParsedOpenClawMemoryRecord;
}) {
  const record = input.record;
  const decision = evaluateOpenClawRecordForIntake({
    workspaceId: input.workspaceId,
    sourceFile: input.sourceFile,
    sourceLine: input.sourceLine,
    record,
  });
  const externalRecordText = buildOpenClawExternalRecordText(record, decision);
  const externalRecordMetadata = buildOpenClawExternalRecordMetadata({
    record,
    decision,
    sourceFile: input.sourceFile,
    sourceLine: input.sourceLine,
  });
  const externalRecordScope = OPENCLAW_INTAKE_SCOPE;
  const externalRecordCategory = decision.disposition;

  const existing = await db.externalMemoryRecord.findUnique({
    where: {
      workspaceId_provider_externalId: {
        workspaceId: input.workspaceId,
        provider: ExternalSyncProvider.OPENCLAW,
        externalId: record.externalId,
      },
    },
    select: {
      id: true,
      checksum: true,
      text: true,
      category: true,
      scope: true,
      importance: true,
      occurredAt: true,
      rawMetadata: true,
      memoryEntryId: true,
    },
  });

  if (!existing) {
    await db.externalMemoryRecord.create({
      data: {
        workspaceId: input.workspaceId,
        provider: ExternalSyncProvider.OPENCLAW,
        externalId: record.externalId,
        scope: externalRecordScope,
        category: externalRecordCategory,
        importance: record.importance,
        occurredAt: record.occurredAt,
        rawMetadata: externalRecordMetadata,
        text: externalRecordText,
        sourceFile: input.sourceFile,
        sourceLine: input.sourceLine,
        checksum: record.checksum,
        memoryEntryId: null,
      },
    });

    return {
      kind: "imported" as const,
      timestampMs: record.timestampMs,
      decision,
    };
  }

  const changed = hasRecordChanged({
    existing,
    incoming: {
      checksum: record.checksum,
      text: externalRecordText,
      category: externalRecordCategory,
      scope: externalRecordScope,
      importance: record.importance,
      occurredAt: record.occurredAt,
      rawMetadata: externalRecordMetadata,
    },
  });
  const shouldDetachLegacyMemoryEntry = Boolean(existing.memoryEntryId);

  if (!changed && !shouldDetachLegacyMemoryEntry) {
    return {
      kind: "skipped" as const,
      timestampMs: record.timestampMs,
      decision,
    };
  }

  await db.$transaction(async (tx) => {
    if (existing.memoryEntryId) {
      await tx.memoryEntry.update({
        where: { id: existing.memoryEntryId },
        data: {
          deletedAt: new Date(),
        },
      });
    }

    await tx.externalMemoryRecord.update({
      where: {
        workspaceId_provider_externalId: {
          workspaceId: input.workspaceId,
          provider: ExternalSyncProvider.OPENCLAW,
          externalId: record.externalId,
        },
      },
      data: {
        scope: externalRecordScope,
        category: externalRecordCategory,
        importance: record.importance,
        occurredAt: record.occurredAt,
        rawMetadata: externalRecordMetadata,
        text: externalRecordText,
        sourceFile: input.sourceFile,
        sourceLine: input.sourceLine,
        checksum: record.checksum,
        memoryEntryId: null,
        syncedAt: new Date(),
      },
    });
  });

  return {
    kind: "updated" as const,
    timestampMs: record.timestampMs,
    decision,
  };
}

async function processJsonLineRecord(input: {
  workspaceId: string;
  sourceFile: string;
  sourceLine: number;
  line: string;
}) {
  const parsed = parseOpenClawMemoryLine(input.line);
  if (!parsed.ok) {
    return { kind: "failed" as const, error: parsed.error };
  }

  return processParsedRecord({
    workspaceId: input.workspaceId,
    sourceFile: input.sourceFile,
    sourceLine: input.sourceLine,
    record: parsed.record,
  });
}

async function processLanceDbRow(input: {
  workspaceId: string;
  sourceLine: number;
  row: OpenClawLanceDbListEntry;
}) {
  const parsed = parseOpenClawMemoryPayload(input.row);
  if (!parsed.ok) {
    return { kind: "failed" as const, error: parsed.error };
  }

  return processParsedRecord({
    workspaceId: input.workspaceId,
    sourceFile: "lancedb:memories",
    sourceLine: input.sourceLine,
    record: parsed.record,
  });
}

export async function getOpenClawMemorySyncStatus(workspaceId: string) {
  const state = await db.externalMemorySyncState.findUnique({
    where: {
      workspaceId_provider: {
        workspaceId,
        provider: ExternalSyncProvider.OPENCLAW,
      },
    },
  });

  if (!state) {
    return null;
  }

  const [recordCount, lastRecord] = await Promise.all([
    db.externalMemoryRecord.count({
      where: {
        workspaceId,
        provider: ExternalSyncProvider.OPENCLAW,
      },
    }),
    db.externalMemoryRecord.findFirst({
      where: {
        workspaceId,
        provider: ExternalSyncProvider.OPENCLAW,
      },
      orderBy: { occurredAt: "desc" },
      select: {
        occurredAt: true,
        syncedAt: true,
        scope: true,
        category: true,
      },
    }),
  ]);

  return {
    ...state,
    parsedCursor: parseCursor(state.lastCursor),
    recordCount,
    lastRecord,
  };
}

export function buildOpenClawOperatorSafeErrorSummary(lastError?: string | null) {
  if (!lastError) {
    return null;
  }

  if (/already running/i.test(lastError)) {
    return "OpenClaw sync is already running.";
  }

  if (/parse|json/i.test(lastError)) {
    return "OpenClaw source data could not be parsed.";
  }

  return "OpenClaw sync process failed before import completed. Review server-side audit and runtime logs for details.";
}

export function toOperatorSafeOpenClawMemorySyncStatus(
  status: Awaited<ReturnType<typeof getOpenClawMemorySyncStatus>>,
) {
  if (!status) {
    return null;
  }

  const { lastError, ...safeStatus } = status;

  return {
    ...safeStatus,
    lastErrorSummary: buildOpenClawOperatorSafeErrorSummary(lastError),
  };
}

export async function syncOpenClawMemory(input: SyncOpenClawMemoryInput): Promise<OpenClawSyncStats> {
  const sourceMode = normalizeSourceMode(input.sourceMode ?? process.env.OPENCLAW_MEMORY_SOURCE_MODE);
  const backupDir = process.env.OPENCLAW_MEMORY_BACKUP_DIR ?? DEFAULT_BACKUP_DIR;
  const lanceDbPath = process.env.OPENCLAW_MEMORY_DB_PATH ?? DEFAULT_LANCEDB_PATH;
  const openclawBin = process.env.OPENCLAW_BIN ?? DEFAULT_OPENCLAW_BIN;

  const sourceRef = buildOpenClawSyncSourceRef(sourceMode);
  const sourcePage = input.sourcePage ?? "/memory";
  const actor = buildSyncActor(input);

  const state = await claimSyncLock(input.workspaceId);
  const start = new Date();

  await logEvent({
    workspaceId: input.workspaceId,
    userId: input.actorUserId ?? undefined,
    eventName: "openclaw_memory_sync_started",
    eventCategory: "memory_sync",
    targetType: "Workspace",
    targetId: input.workspaceId,
    sourcePage,
    metadata: {
      trigger: input.trigger ?? "manual",
      sourceMode,
      sourceRef,
    },
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.actorUserId ?? undefined,
    actor: actor.actor,
    actorType: actor.actorType,
    actionType: "OPENCLAW_MEMORY_SYNC_STARTED",
    targetType: "ExternalMemorySyncState",
    targetId: state.id,
    summary: `OpenClaw memory sync started (${input.trigger ?? "manual"})`,
    sourcePage,
  });

  const stats: OpenClawSyncStats = {
    imported: 0,
    updated: 0,
    skipped: 0,
    quarantined: 0,
    failed: 0,
    processed: 0,
    lastCursor: parseCursor(state.lastCursor),
  };

  let finalStatus: ExternalSyncStatus = ExternalSyncStatus.SUCCESS;
  let finalError: string | null = null;

  try {
    if (sourceMode === "lancedb") {
      const pageSize = Math.max(10, Math.min(200, input.maxItems ?? 200));
      let offset = 0;

      outerLance: while (true) {
        const rows = await listLanceDbMemoriesPage({
          openclawBin,
          lanceDbPath,
          limit: pageSize,
          offset,
        });

        if (!rows.length) {
          break;
        }

        for (let idx = 0; idx < rows.length; idx += 1) {
          const sourceLine = offset + idx + 1;
          const result = await processLanceDbRow({
            workspaceId: input.workspaceId,
            sourceLine,
            row: rows[idx],
          });

          stats.processed += 1;

          const resultTimestampMs =
            "timestampMs" in result && typeof result.timestampMs === "number"
              ? result.timestampMs
              : stats.lastCursor?.timestampMs ?? 0;

          stats.lastCursor = {
            mode: "lancedb",
            file: "lancedb:memories",
            line: sourceLine,
            timestampMs: Math.max(stats.lastCursor?.timestampMs ?? 0, resultTimestampMs),
          };

          if (result.kind === "imported") stats.imported += 1;
          if (result.kind === "updated") stats.updated += 1;
          if (result.kind === "skipped") stats.skipped += 1;
          if (result.kind === "failed") stats.failed += 1;
          if ("decision" in result && result.decision.disposition === "quarantine") stats.quarantined += 1;

          if (input.maxItems && stats.processed >= input.maxItems) {
            break outerLance;
          }
        }

        if (rows.length < pageSize) {
          break;
        }

        offset += rows.length;
      }
    } else {
      const files = await listBackupFiles(backupDir);
      if (!files.length) {
        stats.lastCursor = parseCursor(state.lastCursor);
      }

      outerBackup: for (const fileName of files) {
        const fullPath = join(/* turbopackIgnore: true */ backupDir, fileName);
        const content = await readFile(/* turbopackIgnore: true */ fullPath, "utf8");
        const lines = content.split(/\r?\n/);

        for (let idx = 0; idx < lines.length; idx += 1) {
          const lineNo = idx + 1;
          const line = lines[idx] ?? "";

          if (!line.trim()) {
            continue;
          }

          if (shouldSkipByCursor(fileName, lineNo, stats.lastCursor)) {
            continue;
          }

          const result = await processJsonLineRecord({
            workspaceId: input.workspaceId,
            sourceFile: basename(fileName),
            sourceLine: lineNo,
            line,
          });

          stats.processed += 1;
          stats.lastCursor = {
            mode: "backup_jsonl",
            file: fileName,
            line: lineNo,
            timestampMs:
              "timestampMs" in result && typeof result.timestampMs === "number"
                ? result.timestampMs
                : stats.lastCursor?.timestampMs ?? 0,
          };

          if (result.kind === "imported") stats.imported += 1;
          if (result.kind === "updated") stats.updated += 1;
          if (result.kind === "skipped") stats.skipped += 1;
          if (result.kind === "failed") stats.failed += 1;
          if ("decision" in result && result.decision.disposition === "quarantine") stats.quarantined += 1;

          if (input.maxItems && stats.processed >= input.maxItems) {
            break outerBackup;
          }
        }
      }
    }

    await db.externalMemorySyncState.update({
      where: {
        workspaceId_provider: {
          workspaceId: input.workspaceId,
          provider: ExternalSyncProvider.OPENCLAW,
        },
      },
      data: {
        lastCursor: stats.lastCursor ? JSON.stringify(stats.lastCursor) : state.lastCursor,
        lastSyncedAt: new Date(),
      },
    });
  } catch (error) {
    finalStatus = ExternalSyncStatus.FAILED;
    finalError = error instanceof Error ? error.message : String(error);
  } finally {
    const end = new Date();
    const safeErrorSummary = buildOpenClawOperatorSafeErrorSummary(finalError);

    await db.externalMemorySyncState.update({
      where: {
        workspaceId_provider: {
          workspaceId: input.workspaceId,
          provider: ExternalSyncProvider.OPENCLAW,
        },
      },
      data: {
        isRunning: false,
        runFinishedAt: end,
        lastRunStatus: finalStatus,
        lastError: finalError,
        lastSyncedAt: finalStatus === ExternalSyncStatus.SUCCESS ? end : undefined,
        lastCursor: stats.lastCursor ? JSON.stringify(stats.lastCursor) : state.lastCursor,
      },
    });

    await logEvent({
      workspaceId: input.workspaceId,
      userId: input.actorUserId ?? undefined,
      eventName:
        finalStatus === ExternalSyncStatus.SUCCESS
          ? "openclaw_memory_sync_completed"
          : "openclaw_memory_sync_failed",
      eventCategory: "memory_sync",
      targetType: "Workspace",
      targetId: input.workspaceId,
      sourcePage,
      metadata: {
        trigger: input.trigger ?? "manual",
        sourceMode,
        sourceRef,
        durationMs: end.getTime() - start.getTime(),
        imported: stats.imported,
        updated: stats.updated,
        skipped: stats.skipped,
        quarantined: stats.quarantined,
        failed: stats.failed,
        processed: stats.processed,
        error: safeErrorSummary,
      },
    });

    await writeAuditLog({
      workspaceId: input.workspaceId,
      userId: input.actorUserId ?? undefined,
      actor: actor.actor,
      actorType: actor.actorType,
      actionType:
        finalStatus === ExternalSyncStatus.SUCCESS
          ? "OPENCLAW_MEMORY_SYNC_COMPLETED"
          : "OPENCLAW_MEMORY_SYNC_FAILED",
      targetType: "ExternalMemorySyncState",
      targetId: state.id,
      summary:
        finalStatus === ExternalSyncStatus.SUCCESS
          ? `OpenClaw memory sync completed: imported=${stats.imported}, updated=${stats.updated}, skipped=${stats.skipped}, quarantined=${stats.quarantined}, failed=${stats.failed}`
          : `OpenClaw memory sync failed: ${safeErrorSummary ?? "unknown error"}`,
      payload: {
        trigger: input.trigger ?? "manual",
        sourceMode,
        sourceRef,
        imported: stats.imported,
        updated: stats.updated,
        skipped: stats.skipped,
        quarantined: stats.quarantined,
        failed: stats.failed,
        processed: stats.processed,
        lastCursor: stats.lastCursor,
        error: safeErrorSummary,
      },
      sourcePage,
    });
  }

  if (finalStatus === ExternalSyncStatus.FAILED) {
    throw new Error(finalError ?? "OpenClaw memory sync failed");
  }

  return stats;
}
