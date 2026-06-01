/**
 * Phase 3V local calibration rehearsal.
 *
 * Development-only DB-backed rehearsal for the Phase 3P -> 3Q -> 3R -> 3S
 * redacted calibration chain. It accepts only local MySQL targets, performs
 * read-only collection, and treats a blocked Phase 3R/3S result as the expected
 * safe outcome because local snapshots must never unlock production readiness.
 *
 * This is NOT live calibration, NOT production query adoption, NOT a runtime
 * adapter, NOT an API, NOT a page integration, NOT a schema change, NOT an
 * official write path, and NOT automated execution authority.
 */

import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "node:url";

import { readEnvVarFromRootFiles } from "@/lib/root-env";

import {
  runPhase3pCollector,
  type Phase3pCollectorOptions,
} from "./business-advancement-phase3p-redacted-snapshot-collector";
import {
  runPhase3qSnapshotIntakeReview,
  type Phase3qReviewResult,
} from "./business-advancement-phase3q-snapshot-intake-review";
import {
  evaluatePhase3rRuntimeAdoptionPreflight,
  type Phase3rPreflightResult,
} from "./business-advancement-phase3r-runtime-adoption-preflight";
import {
  PHASE3S_PRODUCTION_ADOPTION_DECISION,
  buildPhase3sRuntimeAdoptionReviewPacket,
  type Phase3sReviewPacketResult,
} from "./business-advancement-phase3s-runtime-adoption-review-packet";
import type {
  Phase3oEvaluationResult,
  Phase3oEvidencePackInput,
} from "../features/business-advancement/phase3o-real-data-calibration-evidence-pack";

export const PHASE3V_RULE_VERSION =
  "phase3v-local-calibration-rehearsal/v1" as const;

export const PHASE3V_RUNTIME_ADOPTION_POSTURE = "No-Go" as const;

export const PHASE3V_REHEARSAL_POSTURE =
  "Local-Development-Rehearsal-Only" as const;

export interface Phase3vCollectorOutput {
  readonly evidencePack: Phase3oEvidencePackInput;
  readonly evaluation: Phase3oEvaluationResult;
}

export interface Phase3vLocalCalibrationRehearsalResult {
  readonly ruleVersion: typeof PHASE3V_RULE_VERSION;
  readonly rehearsalPosture: typeof PHASE3V_REHEARSAL_POSTURE;
  readonly runtimeAdoptionPosture: typeof PHASE3V_RUNTIME_ADOPTION_POSTURE;
  readonly localRehearsalPassed: boolean;
  readonly productionAdoptionAllowed: false;
  readonly runtimeIntegrationAllowed: false;
  readonly sampleKind: Phase3oEvidencePackInput["sampleKind"];
  readonly phase3qIntakePassed: boolean;
  readonly phase3rExpectedBlocked: boolean;
  readonly phase3sExpectedNoGo: boolean;
  readonly phase3q: Phase3qReviewResult;
  readonly phase3r: Phase3rPreflightResult;
  readonly phase3s: Phase3sReviewPacketResult;
  readonly blockers: readonly string[];
}

interface Phase3vCliOptions {
  readonly databaseUrl: string;
  readonly workspaceId?: string;
  readonly referenceClockMs: number;
  readonly take: number;
  readonly includeDedupProbeRows: boolean;
}

type Phase3vEnv = Record<string, string | undefined>;

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

function parseReferenceClockIso(raw: string | undefined): number | undefined {
  if (!raw) {
    return undefined;
  }
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error("--reference-clock-iso must be a valid ISO datetime.");
  }
  return parsed;
}

function parseTake(raw: string | undefined): number {
  if (!raw) {
    return 100;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
    throw new Error("--take must be an integer from 1 to 500.");
  }
  return parsed;
}

function resolveDatabaseUrl(env: Phase3vEnv): string {
  const databaseUrl =
    env.DATABASE_URL ??
    readEnvVarFromRootFiles("DATABASE_URL", {
      projectRoot: process.cwd(),
      fileNames: [".env.local", ".env"],
    });
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for Phase 3V local rehearsal.");
  }
  return databaseUrl;
}

function isLocalDatabaseUrl(databaseUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    return false;
  }
  const host = parsed.host.toLowerCase().replace(/[\[\]]/g, "");
  return (
    parsed.protocol === "mysql:" &&
    (host === "localhost" ||
      host.startsWith("localhost:") ||
      host === "127.0.0.1" ||
      host.startsWith("127.0.0.1:") ||
      host === "::1" ||
      host.startsWith("::1:"))
  );
}

export function buildPhase3vLocalCalibrationRehearsalResult(
  collectorOutput: Phase3vCollectorOutput,
): Phase3vLocalCalibrationRehearsalResult {
  const phase3q = runPhase3qSnapshotIntakeReview(collectorOutput);
  const phase3r = evaluatePhase3rRuntimeAdoptionPreflight(collectorOutput);
  const phase3s = buildPhase3sRuntimeAdoptionReviewPacket(collectorOutput);

  const blockers: string[] = [];
  if (phase3q.evidencePack.sampleKind !== "local_development_snapshot") {
    blockers.push(
      `sampleKind is "${phase3q.evidencePack.sampleKind}"; Phase 3V requires local_development_snapshot.`,
    );
  }
  if (!phase3q.validation.valid) {
    blockers.push("Phase 3Q intake validation failed.");
  }
  if (phase3r.productionRuntimeAdoptionReviewReady) {
    blockers.push(
      "Phase 3R unexpectedly became ready; local rehearsal must remain blocked.",
    );
  }
  if (phase3r.productionAdoptionAllowed || phase3r.runtimeIntegrationAllowed) {
    blockers.push("Phase 3R exposed production or runtime authority.");
  }
  if (
    phase3s.productionRuntimeAdoptionReviewPacketReady ||
    phase3s.productionAdoptionDecision !== PHASE3S_PRODUCTION_ADOPTION_DECISION
  ) {
    blockers.push(
      "Phase 3S unexpectedly became ready or changed the No-Go decision.",
    );
  }
  if (phase3s.productionAdoptionAllowed || phase3s.runtimeIntegrationAllowed) {
    blockers.push("Phase 3S exposed production or runtime authority.");
  }

  return {
    ruleVersion: PHASE3V_RULE_VERSION,
    rehearsalPosture: PHASE3V_REHEARSAL_POSTURE,
    runtimeAdoptionPosture: PHASE3V_RUNTIME_ADOPTION_POSTURE,
    localRehearsalPassed: blockers.length === 0,
    productionAdoptionAllowed: false,
    runtimeIntegrationAllowed: false,
    sampleKind: phase3q.evidencePack.sampleKind,
    phase3qIntakePassed: phase3q.validation.valid,
    phase3rExpectedBlocked: !phase3r.productionRuntimeAdoptionReviewReady,
    phase3sExpectedNoGo:
      !phase3s.productionRuntimeAdoptionReviewPacketReady &&
      phase3s.productionAdoptionDecision === PHASE3S_PRODUCTION_ADOPTION_DECISION,
    phase3q,
    phase3r,
    phase3s,
    blockers,
  };
}

async function selectWorkspaceId(databaseUrl: string): Promise<string> {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const workspaces = await prisma.workspace.findMany({
      select: { id: true },
      take: 30,
    });
    let selected: string | null = null;
    let selectedScore = -1;

    for (const workspace of workspaces) {
      const [actionItems, commitments, emailThreads] = await Promise.all([
        prisma.actionItem.count({ where: { workspaceId: workspace.id } }),
        prisma.commitment.count({ where: { workspaceId: workspace.id } }),
        prisma.emailThread.count({ where: { workspaceId: workspace.id } }),
      ]);
      const readyFamilies =
        Number(actionItems >= 4) +
        Number(commitments >= 4) +
        Number(emailThreads >= 4);
      const score =
        readyFamilies * 100000 + actionItems + commitments + emailThreads;
      if (score > selectedScore) {
        selected = workspace.id;
        selectedScore = score;
      }
    }

    if (!selected) {
      throw new Error("No workspace found for local calibration rehearsal.");
    }
    return selected;
  } finally {
    await prisma.$disconnect();
  }
}

function resolveCliOptions(
  argv: readonly string[],
  env: Phase3vEnv = process.env,
): Phase3vCliOptions {
  const databaseUrl = resolveDatabaseUrl(env);
  if (!isLocalDatabaseUrl(databaseUrl)) {
    throw new Error(
      "Phase 3V accepts only local MySQL DATABASE_URL targets. Use Phase 3U/3P for live redacted calibration.",
    );
  }

  const referenceClockMs = parseReferenceClockIso(
    readArg(argv, "--reference-clock-iso") ?? env.REFERENCE_CLOCK_ISO,
  );
  if (referenceClockMs === undefined) {
    throw new Error("--reference-clock-iso or REFERENCE_CLOCK_ISO is required.");
  }

  return {
    databaseUrl,
    workspaceId: readArg(argv, "--workspace-id") ?? env.WORKSPACE_ID,
    referenceClockMs,
    take: parseTake(readArg(argv, "--take")),
    includeDedupProbeRows: !hasFlag(argv, "--no-dedup-probe-rows"),
  };
}

export async function runPhase3vLocalCalibrationRehearsal(
  options: Phase3vCliOptions,
): Promise<Phase3vLocalCalibrationRehearsalResult> {
  const workspaceId =
    options.workspaceId ?? (await selectWorkspaceId(options.databaseUrl));
  const collectorOptions: Phase3pCollectorOptions = {
    databaseUrl: options.databaseUrl,
    workspaceId,
    referenceClockMs: options.referenceClockMs,
    take: options.take,
    includeDedupProbeRows: options.includeDedupProbeRows,
    printJson: false,
    sampleKind: "local_development_snapshot",
  };

  const collectorOutput = await runPhase3pCollector(collectorOptions);
  return buildPhase3vLocalCalibrationRehearsalResult(collectorOutput);
}

function printSummary(result: Phase3vLocalCalibrationRehearsalResult): void {
  console.log("=== Phase 3V Local Calibration Rehearsal ===");
  console.log(`ruleVersion:                 ${result.ruleVersion}`);
  console.log(`rehearsalPosture:            ${result.rehearsalPosture}`);
  console.log(`runtimeAdoptionPosture:      ${result.runtimeAdoptionPosture}`);
  console.log(`localRehearsalPassed:        ${String(result.localRehearsalPassed)}`);
  console.log(`sampleKind:                  ${result.sampleKind}`);
  console.log(`phase3qIntakePassed:         ${String(result.phase3qIntakePassed)}`);
  console.log(`phase3rExpectedBlocked:      ${String(result.phase3rExpectedBlocked)}`);
  console.log(`phase3sExpectedNoGo:         ${String(result.phase3sExpectedNoGo)}`);
  console.log(`productionAdoptionAllowed:   ${String(result.productionAdoptionAllowed)}`);
  console.log(`runtimeIntegrationAllowed:   ${String(result.runtimeIntegrationAllowed)}`);
  console.log("");
  for (const family of [
    result.phase3q.evaluation.tpqr001,
    result.phase3q.evaluation.tpqr003,
    result.phase3q.evaluation.tpqr004,
  ]) {
    console.log(
      `${family.tpqrId}: rows=${family.rowCount} included=${family.includedCount} excluded=${family.excludedCount} checksPass=${String(family.checksPass)} calibrated=${String(family.calibrated)}`,
    );
  }
  console.log("");
  console.log(`phase3rBlockedReasons (${result.phase3r.blockedReasons.length}):`);
  for (const reason of result.phase3r.blockedReasons) {
    console.log(`  - ${reason}`);
  }
  console.log("");
  console.log(`blockers (${result.blockers.length}):`);
  for (const blocker of result.blockers) {
    console.log(`  - ${blocker}`);
  }
  console.log("");
  console.log(
    "Local rehearsal complete. This does not unlock live calibration, runtime integration, production query adoption, page behavior, official write, or auto-execution.",
  );
}

async function main(): Promise<void> {
  const options = resolveCliOptions(process.argv.slice(2));
  const result = await runPhase3vLocalCalibrationRehearsal(options);
  printSummary(result);
  process.exit(result.localRehearsalPassed ? 0 : 2);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
