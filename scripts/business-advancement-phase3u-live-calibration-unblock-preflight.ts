/**
 * Phase 3U no-DB-access live calibration unblock preflight.
 *
 * Pure function that evaluates whether the environment has the exact conditions
 * needed to re-run Phase 3P → Phase 3Q → Phase 3R → Phase 3S once
 * DB/network/workspaceId are available. Does not touch DB, filesystem, or
 * network. Only reads argv/env.
 *
 * Resolves:
 *   - DATABASE_URL from env only (never filesystem fallback)
 *   - workspaceId from --workspace-id, env.WORKSPACE_ID, or env.HELM_PHASE3P_WORKSPACE_ID
 *   - referenceClockIso from --reference-clock-iso or env.REFERENCE_CLOCK_ISO
 *   - take from --take (default 200)
 *
 * Requires:
 *   - DATABASE_URL present and mysql protocol
 *   - Non-empty real workspaceId (dummy "db-reachability-probe-only" explicitly rejected)
 *   - Valid ISO reference clock
 *   - take integer 1..500
 *
 * Never authorizes runtime adoption.
 *
 * Exit codes:
 *   0 — liveCalibrationReady true
 *   1 — unexpected invalid CLI/format error
 *   2 — valid input but not ready (blockers present)
 */

import { pathToFileURL } from "node:url";

export const PHASE3U_RULE_VERSION =
  "phase3u-live-calibration-unblock-preflight/v1" as const;

export const PHASE3U_RUNTIME_ADOPTION_POSTURE = "No-Go" as const;

const DUMMY_WORKSPACE_ID = "db-reachability-probe-only" as const;

export const PHASE3U_NEXT_STEP_READY =
  "Run the safeCommandChain in order: Phase 3P collector → Phase 3Q intake → Phase 3R preflight → Phase 3S review packet. Then hold a manual production runtime adoption review meeting and draft a separate implementation plan. No direct runtime adoption, no production path modification, no auto-execution, no auto-approve." as const;

export const PHASE3U_NEXT_STEP_NOT_READY =
  "Resolve all blockers listed above, then re-run this preflight to obtain the safe command chain." as const;

export interface Phase3uRedactedDatabaseTarget {
  readonly protocol: string;
  readonly host: string;
  readonly database: string;
}

export interface Phase3uPreflightResult {
  readonly ruleVersion: typeof PHASE3U_RULE_VERSION;
  readonly runtimeAdoptionPosture: typeof PHASE3U_RUNTIME_ADOPTION_POSTURE;
  readonly liveCalibrationReady: boolean;
  readonly productionAdoptionAllowed: false;
  readonly runtimeIntegrationAllowed: false;
  readonly dbAccessAttempted: false;
  readonly filesWritten: false;
  readonly blockers: readonly string[];
  readonly redactedDatabaseTarget: Phase3uRedactedDatabaseTarget | null;
  readonly resolvedWorkspaceIdPresence: boolean;
  readonly referenceClockIso: string | null;
  readonly take: number;
  readonly safeCommandChain: readonly string[] | null;
  readonly allowedNextStep: string;
}

type Phase3uEnv = Record<string, string | undefined>;

function readArg(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  return argv[index + 1];
}

function parseTake(raw: string): number | Error {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 500) {
    return new Error(
      `--take must be an integer from 1 to 500; got "${raw}".`,
    );
  }
  return n;
}

function parseReferenceClockIso(raw: string): Date | Error {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    return new Error(
      `--reference-clock-iso / REFERENCE_CLOCK_ISO must be an ISO datetime with time component: "${raw}".`,
    );
  }
  const d = new Date(raw);
  if (isNaN(d.getTime())) {
    return new Error(
      `--reference-clock-iso / REFERENCE_CLOCK_ISO is not a valid ISO datetime: "${raw}".`,
    );
  }
  return d;
}

function redactDatabaseUrl(
  url: string,
): Phase3uRedactedDatabaseTarget | Error {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new Error("DATABASE_URL is not a valid URL.");
  }
  const protocol = parsed.protocol.replace(/:$/, "");
  const host = parsed.host;
  const database = parsed.pathname.replace(/^\//, "");
  return { protocol, host, database };
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

function buildSafeCommandChain(
  referenceClockIso: string,
  take: number,
): readonly string[] {
  return [
    `DATABASE_URL='\${DATABASE_URL}' npx tsx scripts/business-advancement-phase3p-redacted-snapshot-collector.ts --workspace-id '\${WORKSPACE_ID}' --reference-clock-iso '${referenceClockIso}' --take ${String(take)} --print-json > /tmp/phase3p-snapshot.json`,
    `npx tsx scripts/business-advancement-phase3q-snapshot-intake-review.ts --input /tmp/phase3p-snapshot.json`,
    `npx tsx scripts/business-advancement-phase3r-runtime-adoption-preflight.ts --input /tmp/phase3p-snapshot.json`,
    `npx tsx scripts/business-advancement-phase3s-runtime-adoption-review-packet.ts --input /tmp/phase3p-snapshot.json`,
  ];
}

/**
 * Pure preflight evaluator. Reads only argv and env. Never touches DB,
 * filesystem, or network. Never throws; all validation issues go into blockers.
 *
 * Even a passing result has productionAdoptionAllowed=false always.
 */
export function evaluatePhase3uLiveCalibrationUnblockPreflight(
  argv: readonly string[],
  env: Phase3uEnv = process.env,
): Phase3uPreflightResult {
  const blockers: string[] = [];

  // DATABASE_URL — env only, no filesystem fallback
  const databaseUrl = env.DATABASE_URL;
  let redactedDatabaseTarget: Phase3uRedactedDatabaseTarget | null = null;

  if (!databaseUrl) {
    blockers.push(
      "DATABASE_URL is not set in env. Phase 3U reads env only and never falls back to filesystem.",
    );
  } else {
    const redacted = redactDatabaseUrl(databaseUrl);
    if (redacted instanceof Error) {
      blockers.push(`DATABASE_URL parse error: ${redacted.message}`);
    } else {
      redactedDatabaseTarget = redacted;
      if (redacted.protocol !== "mysql") {
        blockers.push(
          `DATABASE_URL protocol is "${redacted.protocol}"; must be "mysql" for Phase 3P calibration.`,
        );
      }
      if (isLocalDatabaseHost(redacted.host)) {
        blockers.push(
          "DATABASE_URL points to a local database host. Local DB is allowed for development validation only and cannot unlock live calibration readiness.",
        );
      }
    }
  }

  // workspaceId — --workspace-id > WORKSPACE_ID > HELM_PHASE3P_WORKSPACE_ID
  const workspaceId =
    readArg(argv, "--workspace-id") ??
    env.WORKSPACE_ID ??
    env.HELM_PHASE3P_WORKSPACE_ID;

  const resolvedWorkspaceIdPresence = Boolean(workspaceId);

  if (!workspaceId) {
    blockers.push(
      "workspaceId is not set. Pass --workspace-id or set WORKSPACE_ID or HELM_PHASE3P_WORKSPACE_ID.",
    );
  } else if (workspaceId === DUMMY_WORKSPACE_ID) {
    blockers.push(
      `workspaceId is the dummy probe sentinel "${DUMMY_WORKSPACE_ID}". A real workspaceId is required; re-run with a valid workspace.`,
    );
  }

  // referenceClockIso — --reference-clock-iso > REFERENCE_CLOCK_ISO
  const rawRefClock =
    readArg(argv, "--reference-clock-iso") ?? env.REFERENCE_CLOCK_ISO;

  let referenceClockIso: string | null = null;

  if (!rawRefClock) {
    blockers.push(
      "referenceClockIso is not set. Pass --reference-clock-iso or set REFERENCE_CLOCK_ISO. Phase 3U never reads wall-clock time.",
    );
  } else {
    const parsedClock = parseReferenceClockIso(rawRefClock);
    if (parsedClock instanceof Error) {
      blockers.push(parsedClock.message);
    } else {
      referenceClockIso = rawRefClock;
    }
  }

  // take — --take (default 200)
  const rawTake = readArg(argv, "--take");
  let take = 200;

  if (rawTake !== undefined) {
    const parsedTake = parseTake(rawTake);
    if (parsedTake instanceof Error) {
      blockers.push(parsedTake.message);
    } else {
      take = parsedTake;
    }
  }

  const liveCalibrationReady = blockers.length === 0;

  const safeCommandChain =
    liveCalibrationReady && referenceClockIso !== null
      ? buildSafeCommandChain(referenceClockIso, take)
      : null;

  return {
    ruleVersion: PHASE3U_RULE_VERSION,
    runtimeAdoptionPosture: PHASE3U_RUNTIME_ADOPTION_POSTURE,
    liveCalibrationReady,
    productionAdoptionAllowed: false,
    runtimeIntegrationAllowed: false,
    dbAccessAttempted: false,
    filesWritten: false,
    blockers,
    redactedDatabaseTarget,
    resolvedWorkspaceIdPresence,
    referenceClockIso,
    take,
    safeCommandChain,
    allowedNextStep: liveCalibrationReady
      ? PHASE3U_NEXT_STEP_READY
      : PHASE3U_NEXT_STEP_NOT_READY,
  };
}

function printSummary(result: Phase3uPreflightResult): void {
  console.log("=== Phase 3U Live Calibration Unblock Preflight ===");
  console.log(`ruleVersion:                 ${result.ruleVersion}`);
  console.log(`runtimeAdoptionPosture:      ${result.runtimeAdoptionPosture}`);
  console.log(`liveCalibrationReady:        ${String(result.liveCalibrationReady)}`);
  console.log(`productionAdoptionAllowed:   ${String(result.productionAdoptionAllowed)}`);
  console.log(`runtimeIntegrationAllowed:   ${String(result.runtimeIntegrationAllowed)}`);
  console.log(`dbAccessAttempted:           ${String(result.dbAccessAttempted)}`);
  console.log(`filesWritten:                ${String(result.filesWritten)}`);
  console.log(`resolvedWorkspaceIdPresence: ${String(result.resolvedWorkspaceIdPresence)}`);
  console.log(`referenceClockIso:           ${result.referenceClockIso ?? "(not set)"}`);
  console.log(`take:                        ${String(result.take)}`);

  if (result.redactedDatabaseTarget) {
    const t = result.redactedDatabaseTarget;
    console.log(
      `redactedDatabaseTarget:      protocol=${t.protocol} host=${t.host} database=${t.database}`,
    );
  } else {
    console.log("redactedDatabaseTarget:      (not available)");
  }

  console.log("");
  console.log(`blockers (${result.blockers.length}):`);
  for (const blocker of result.blockers) {
    console.log(`  - ${blocker}`);
  }

  if (result.safeCommandChain) {
    console.log("");
    console.log(`safeCommandChain (${result.safeCommandChain.length} commands — run in order):`);
    for (let i = 0; i < result.safeCommandChain.length; i++) {
      console.log(`  [${String(i + 1)}] ${result.safeCommandChain[i]}`);
    }
  }

  console.log("");
  console.log(`allowedNextStep: ${result.allowedNextStep}`);
  console.log("");
  console.log(
    "No DB access attempted. No files written. Runtime adoption remains No-Go.",
  );
}

function main(): void {
  const argv = process.argv.slice(2);

  let result: Phase3uPreflightResult;
  try {
    result = evaluatePhase3uLiveCalibrationUnblockPreflight(argv);
  } catch (error) {
    console.error(
      `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }

  const printJson = argv.includes("--print-json");

  if (printJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printSummary(result);
  }

  if (result.liveCalibrationReady) {
    process.exit(0);
  } else {
    process.exit(2);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
