/**
 * Phase 3P redacted snapshot collector for Phase 3O calibration.
 *
 * Script-only, read-only, no product runtime integration.
 * It reads selected DB rows, emits only redacted producer-view rows, and then
 * runs the Phase 3O evaluator. It never writes DB/files and never outputs
 * customer names, email subjects, bodies, addresses, or free text.
 */

import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";

import { readEnvVarFromRootFiles } from "@/lib/root-env";
import {
  evaluatePhase3oRealDataCalibrationEvidencePack,
  type Phase3oEvidencePackInput,
  type Phase3oSampleKind,
  type Phase3oTpqr001RedactedRow,
  type Phase3oTpqr003RedactedRow,
  type Phase3oTpqr004RedactedRow,
} from "../features/business-advancement/phase3o-real-data-calibration-evidence-pack";

export const PHASE3P_RULE_VERSION =
  "phase3p-redacted-snapshot-collector/v1" as const;

export const PHASE3P_RUNTIME_ADOPTION_POSTURE = "No-Go" as const;

export interface Phase3pCollectorOptions {
  readonly databaseUrl: string;
  readonly workspaceId: string;
  readonly referenceClockMs: number;
  readonly take: number;
  readonly includeDedupProbeRows: boolean;
  readonly printJson: boolean;
  readonly sampleKind: Phase3oSampleKind;
}

type Phase3pEnv = Record<string, string | undefined>;

interface ActionItemDbRow {
  readonly id: string;
  readonly workspaceId: string;
  readonly updatedAt: Date;
  readonly approvalTask: { readonly id: string } | null;
}

interface CommitmentDbRow {
  readonly id: string;
  readonly workspaceId: string;
  readonly dueDate: Date | null;
  readonly status: string;
  readonly overdueFlag: boolean;
}

interface EmailThreadDbRow {
  readonly id: string;
  readonly workspaceId: string;
  readonly status: string;
  readonly opportunityId: string | null;
}

interface Phase3pCollectedRows {
  readonly actionItems: readonly ActionItemDbRow[];
  readonly commitments: readonly CommitmentDbRow[];
  readonly emailThreads: readonly EmailThreadDbRow[];
}

export function hashOpaqueId(namespace: string, value: string): string {
  return `${namespace}-${createHash("sha256").update(`${namespace}:${value}`).digest("hex").slice(0, 16)}`;
}

function parseNumber(raw: string | undefined, label: string): number | undefined {
  if (!raw) {
    return undefined;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return parsed;
}

function readArg(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return argv[index + 1];
}

function hasFlag(argv: readonly string[], name: string): boolean {
  return argv.includes(name);
}

function resolveDatabaseUrl(env: Phase3pEnv): string | undefined {
  if (env !== process.env) {
    return env.DATABASE_URL;
  }
  return (
    env.DATABASE_URL ??
    readEnvVarFromRootFiles("DATABASE_URL", {
      projectRoot: process.cwd(),
      fileNames: [".env.local", ".env"],
    })
  );
}

function isLocalDatabaseHost(host: string): boolean {
  const normalized = host.toLowerCase().replace(/[\[\]]/g, "");
  return (
    normalized === "localhost" ||
    normalized.startsWith("localhost:") ||
    normalized === "127.0.0.1" ||
    normalized.startsWith("127.0.0.1:") ||
    normalized === "::1" ||
    normalized.startsWith("::1:")
  );
}

export function resolvePhase3pSnapshotSampleKind(
  databaseUrl: string,
): Phase3oSampleKind {
  try {
    const parsed = new URL(databaseUrl);
    return isLocalDatabaseHost(parsed.host)
      ? "local_development_snapshot"
      : "redacted_live_db_snapshot";
  } catch {
    return "redacted_live_db_snapshot";
  }
}

export function resolvePhase3pCollectorOptions(
  argv: readonly string[],
  env: Phase3pEnv = process.env,
): Phase3pCollectorOptions {
  const databaseUrl = resolveDatabaseUrl(env);
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required. Phase 3P does not fall back to a default DB.",
    );
  }

  const workspaceId =
    readArg(argv, "--workspace-id") ??
    env.WORKSPACE_ID ??
    env.HELM_PHASE3P_WORKSPACE_ID;
  if (!workspaceId) {
    throw new Error(
      "WORKSPACE_ID is required. Pass --workspace-id or set WORKSPACE_ID.",
    );
  }

  const referenceClockMs =
    parseNumber(readArg(argv, "--reference-clock-ms"), "--reference-clock-ms") ??
    parseNumber(env.REFERENCE_CLOCK_MS, "REFERENCE_CLOCK_MS") ??
    parseReferenceClockIso(
      readArg(argv, "--reference-clock-iso") ?? env.REFERENCE_CLOCK_ISO,
    );
  if (referenceClockMs === undefined) {
    throw new Error(
      "REFERENCE_CLOCK_MS or REFERENCE_CLOCK_ISO is required. Phase 3P never reads wall-clock time.",
    );
  }

  const take = parseNumber(readArg(argv, "--take"), "--take") ?? 200;
  if (!Number.isInteger(take) || take < 1 || take > 500) {
    throw new Error("--take must be an integer from 1 to 500.");
  }

  return {
    databaseUrl,
    workspaceId,
    referenceClockMs,
    take,
    includeDedupProbeRows: !hasFlag(argv, "--no-dedup-probe-rows"),
    printJson: hasFlag(argv, "--print-json"),
    sampleKind: resolvePhase3pSnapshotSampleKind(databaseUrl),
  };
}

function parseReferenceClockIso(raw: string | undefined): number | undefined {
  if (!raw) {
    return undefined;
  }
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error("REFERENCE_CLOCK_ISO must be a valid ISO datetime.");
  }
  return parsed;
}

function uniqueById<T extends { readonly id: string }>(rows: readonly T[]): T[] {
  const map = new Map<string, T>();
  for (const row of rows) {
    map.set(row.id, row);
  }
  return Array.from(map.values());
}

export function buildPhase3pEvidencePackFromRows(input: {
  readonly workspaceId: string;
  readonly referenceClockMs: number;
  readonly includeDedupProbeRows: boolean;
  readonly rows: Phase3pCollectedRows;
  readonly sampleKind?: Phase3oSampleKind;
}): Phase3oEvidencePackInput {
  const redactedWorkspaceId = hashOpaqueId("workspace", input.workspaceId);

  const tpqr001: Phase3oTpqr001RedactedRow[] = input.rows.actionItems.map(
    (row) => ({
      rowId: hashOpaqueId("actionItem", row.id),
      workspaceId: redactedWorkspaceId,
      updatedAtMs: row.updatedAt.getTime(),
      hasApprovalTask: row.approvalTask !== null,
    }),
  );

  const tpqr003: Phase3oTpqr003RedactedRow[] = input.rows.commitments.map(
    (row) => ({
      rowId: hashOpaqueId("commitmentRow", row.id),
      workspaceId: redactedWorkspaceId,
      commitmentId: hashOpaqueId("commitment", row.id),
      dueDateMs: row.dueDate ? row.dueDate.getTime() : null,
      status: row.status,
      persistedOverdueFlag: row.overdueFlag,
    }),
  );

  const tpqr004: Phase3oTpqr004RedactedRow[] = [];
  for (const row of input.rows.emailThreads) {
    const emailThreadId = hashOpaqueId("emailThread", row.id);
    tpqr004.push({
      rowId: hashOpaqueId("emailThreadRow", row.id),
      workspaceId: redactedWorkspaceId,
      emailThreadId,
      threadStatus: row.status,
      opportunityId: row.opportunityId
        ? hashOpaqueId("opportunity", row.opportunityId)
        : null,
    });

    if (
      input.includeDedupProbeRows &&
      row.status === "WAITING_US" &&
      row.opportunityId !== null
    ) {
      tpqr004.push({
        rowId: hashOpaqueId("emailThreadGenericProbe", row.id),
        workspaceId: redactedWorkspaceId,
        emailThreadId,
        threadStatus: row.status,
        opportunityId: null,
      });
    }
  }

  return {
    sampleKind: input.sampleKind ?? "redacted_live_db_snapshot",
    workspaceId: redactedWorkspaceId,
    referenceClockMs: input.referenceClockMs,
    rows: {
      tpqr001,
      tpqr003,
      tpqr004,
    },
  };
}

async function collectRows(
  prisma: PrismaClient,
  options: Phase3pCollectorOptions,
): Promise<Phase3pCollectedRows> {
  const halfTake = Math.max(1, Math.ceil(options.take / 2));
  const actionItemSelect = {
    id: true,
    workspaceId: true,
    updatedAt: true,
    approvalTask: { select: { id: true } },
  } as const;
  const commitmentSelect = {
    id: true,
    workspaceId: true,
    dueDate: true,
    status: true,
    overdueFlag: true,
  } as const;

  const [oldActionItems, newActionItems, oldCommitments, newCommitments, emailThreads] =
    await Promise.all([
      prisma.actionItem.findMany({
        where: { workspaceId: options.workspaceId },
        select: actionItemSelect,
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
        take: halfTake,
      }),
      prisma.actionItem.findMany({
        where: { workspaceId: options.workspaceId },
        select: actionItemSelect,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: halfTake,
      }),
      prisma.commitment.findMany({
        where: { workspaceId: options.workspaceId },
        select: commitmentSelect,
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
        take: halfTake,
      }),
      prisma.commitment.findMany({
        where: { workspaceId: options.workspaceId },
        select: commitmentSelect,
        orderBy: [{ dueDate: "desc" }, { id: "asc" }],
        take: halfTake,
      }),
      prisma.emailThread.findMany({
        where: { workspaceId: options.workspaceId },
        select: {
          id: true,
          workspaceId: true,
          status: true,
          opportunityId: true,
        },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: options.take,
      }),
    ]);

  return {
    actionItems: uniqueById([...oldActionItems, ...newActionItems]),
    commitments: uniqueById([...oldCommitments, ...newCommitments]),
    emailThreads,
  };
}

function printSummary(input: {
  readonly evidencePack: Phase3oEvidencePackInput;
  readonly evaluation: ReturnType<typeof evaluatePhase3oRealDataCalibrationEvidencePack>;
}): void {
  const { evidencePack, evaluation } = input;
  console.log("=== Phase 3P Redacted Snapshot Collector ===");
  console.log(`ruleVersion:                   ${PHASE3P_RULE_VERSION}`);
  console.log(`runtimeAdoptionPosture:        ${PHASE3P_RUNTIME_ADOPTION_POSTURE}`);
  console.log(`sampleKind:                    ${evidencePack.sampleKind}`);
  console.log(`workspaceId:                   ${evidencePack.workspaceId}`);
  console.log(`referenceClockMs:              ${evidencePack.referenceClockMs}`);
  console.log(`realDataValidated:             ${String(evaluation.realDataValidated)}`);
  console.log(
    `productionCalibrationComplete: ${String(evaluation.productionCalibrationComplete)}`,
  );
  console.log("");
  for (const family of [
    evaluation.tpqr001,
    evaluation.tpqr003,
    evaluation.tpqr004,
  ]) {
    console.log(
      `${family.tpqrId}: rows=${family.rowCount} included=${family.includedCount} excluded=${family.excludedCount} checksPass=${String(family.checksPass)} calibrated=${String(family.calibrated)}`,
    );
  }
  console.log("");
  console.log(`blockers (${evaluation.blockers.length}):`);
  for (const blocker of evaluation.blockers) {
    console.log(`  - ${blocker}`);
  }
  console.log("");
  console.log(
    "No files were written. No DB writes were attempted. Runtime adoption remains No-Go.",
  );
}

export async function runPhase3pCollector(
  options: Phase3pCollectorOptions,
): Promise<{
  readonly evidencePack: Phase3oEvidencePackInput;
  readonly evaluation: ReturnType<typeof evaluatePhase3oRealDataCalibrationEvidencePack>;
}> {
  const prisma = new PrismaClient({
    datasources: { db: { url: options.databaseUrl } },
  });

  try {
    const rows = await collectRows(prisma, options);
    const evidencePack = buildPhase3pEvidencePackFromRows({
      workspaceId: options.workspaceId,
      referenceClockMs: options.referenceClockMs,
      includeDedupProbeRows: options.includeDedupProbeRows,
      sampleKind: options.sampleKind,
      rows,
    });
    return {
      evidencePack,
      evaluation: evaluatePhase3oRealDataCalibrationEvidencePack(evidencePack),
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const options = resolvePhase3pCollectorOptions(process.argv.slice(2));
  const output = await runPhase3pCollector(options);
  if (options.printJson) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    printSummary(output);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
