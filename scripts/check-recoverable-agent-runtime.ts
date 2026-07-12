import fs from "node:fs";
import path from "node:path";

export type RecoverableAgentRuntimeBoundaryViolation = Readonly<{
  file: string;
  rule: string;
  detail: string;
}>;

export type RecoverableAgentRuntimeBoundaryCheckResult = Readonly<{
  ok: boolean;
  violations: readonly RecoverableAgentRuntimeBoundaryViolation[];
}>;

const REQUIRED_FILES = {
  runner: "lib/agent-runtime/recoverable-runner.ts",
  store: "lib/agent-runtime/recoverable-run-store.ts",
  mysqlStore: "lib/agent-runtime/recoverable-run-store-mysql.ts",
  schema: "lib/agent-runtime/agent-run-store-schema.sql",
  migration: "lib/agent-runtime/agent-run-store-recoverable-migration.sql",
} as const;

const RUNNER_READ_ONLY_MARKERS = [
  'canInvokeTool: (tool) => tool.riskLevel === "read"',
  'if (tool.riskLevel !== "read")',
  'kind: "read_tool"',
] as const;

const RUNNER_ATOMIC_PROGRESS_MARKER = "store.commitProgressWithLease";
const RUNNER_SPLIT_PROGRESS_PATTERN =
  /\bstore\.(?:appendStepWithLease|setLifecycleWithLease|writeCheckpoint)\b/;

const RUNNER_FORBIDDEN_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  detail: string;
}> = [
  {
    pattern: /from\s+["']@\/lib\/db["']/,
    detail: "Recoverable runner must not hold a database client.",
  },
  {
    pattern: /\b(?:runCrmImport|activateConnector|externalSend|sendEmail|fetch)\s*\(/,
    detail: "Recoverable runner must not invoke import, activation, send, or network paths.",
  },
  {
    pattern:
      /\b(?:RecommendationFeedback|PreferenceSignal|PatternFact|ApprovalTask|MemoryPromotion)\b/,
    detail: "Recoverable runner must not own feedback, approval, pattern, or memory writes.",
  },
  {
    pattern:
      /(?:recommendation-feedback|crm-orchestrator|features\/connectors\/actions|nodemailer)/,
    detail: "Recoverable runner must not import a governed side-effect module.",
  },
];

const STORE_CONSTANT_MARKERS = [
  "AGENT_RUN_LEASE_DURATION_MS = 60_000 as const",
  "AGENT_RUN_HEARTBEAT_INTERVAL_MS = 20_000 as const",
  "AGENT_RUN_MAX_ATTEMPTS = 3 as const",
] as const;

const MYSQL_CONCURRENCY_MARKERS = [
  "$transaction",
  "FOR UPDATE",
  "StaleAgentRunLeaseError",
  "fencingEpoch",
  "sameLease",
  "atomic-progress",
] as const;

const SQL_RECOVERY_MARKERS = [
  "lease_owner_ref",
  "lease_heartbeat_at_ms",
  "lease_expires_at_ms",
  "fencing_epoch",
  "cancel_requested_by_ref",
  "checkpoint_ref",
  "checkpoint_next_step_index",
  "agent_run_attempts",
  "attempt_count",
] as const;

function readRequiredFile(
  repoRoot: string,
  relativePath: string,
  violations: RecoverableAgentRuntimeBoundaryViolation[],
): string | null {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    violations.push({
      file: relativePath,
      rule: "RECOVERABLE-RUNTIME-MISSING",
      detail: "Required recoverable runtime boundary file is missing.",
    });
    return null;
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function requireMarkers(input: {
  file: string;
  content: string | null;
  markers: readonly string[];
  rule: string;
  detail: string;
  violations: RecoverableAgentRuntimeBoundaryViolation[];
}): void {
  if (input.content === null) return;
  const missing = input.markers.filter((marker) => !input.content?.includes(marker));
  if (missing.length === 0) return;
  input.violations.push({
    file: input.file,
    rule: input.rule,
    detail: `${input.detail} Missing: ${missing.join(", ")}.`,
  });
}

/**
 * Defense-in-depth drift check for the recoverable runtime. This lexical guard
 * does not replace process isolation, least-privilege credentials, or an
 * independent side-effect executor.
 */
export function runRecoverableAgentRuntimeCheck(
  repoRoot = process.cwd(),
): RecoverableAgentRuntimeBoundaryCheckResult {
  const violations: RecoverableAgentRuntimeBoundaryViolation[] = [];
  const runner = readRequiredFile(repoRoot, REQUIRED_FILES.runner, violations);
  const store = readRequiredFile(repoRoot, REQUIRED_FILES.store, violations);
  const mysqlStore = readRequiredFile(
    repoRoot,
    REQUIRED_FILES.mysqlStore,
    violations,
  );
  const schema = readRequiredFile(repoRoot, REQUIRED_FILES.schema, violations);
  const migration = readRequiredFile(
    repoRoot,
    REQUIRED_FILES.migration,
    violations,
  );

  requireMarkers({
    file: REQUIRED_FILES.runner,
    content: runner,
    markers: RUNNER_READ_ONLY_MARKERS,
    rule: "RECOVERABLE-RUNTIME-A",
    detail: "Recoverable runner must keep both policy and invocation-time read-only checks.",
    violations,
  });
  if (runner !== null) {
    for (const forbidden of RUNNER_FORBIDDEN_PATTERNS) {
      if (!forbidden.pattern.test(runner)) continue;
      violations.push({
        file: REQUIRED_FILES.runner,
        rule: "RECOVERABLE-RUNTIME-B",
        detail: forbidden.detail,
      });
    }
    if (
      !runner.includes(RUNNER_ATOMIC_PROGRESS_MARKER) ||
      RUNNER_SPLIT_PROGRESS_PATTERN.test(runner)
    ) {
      violations.push({
        file: REQUIRED_FILES.runner,
        rule: "RECOVERABLE-RUNTIME-F",
        detail:
          "Runner progress must commit lifecycle, optional step, and checkpoint through the atomic store primitive.",
      });
    }
  }

  requireMarkers({
    file: REQUIRED_FILES.store,
    content: store,
    markers: STORE_CONSTANT_MARKERS,
    rule: "RECOVERABLE-RUNTIME-C",
    detail: "Lease, heartbeat, and retry ceilings must remain at the v4 frozen values.",
    violations,
  });
  requireMarkers({
    file: REQUIRED_FILES.mysqlStore,
    content: mysqlStore,
    markers: MYSQL_CONCURRENCY_MARKERS,
    rule: "RECOVERABLE-RUNTIME-D",
    detail: "MySQL state transitions must retain transaction locks and fencing checks.",
    violations,
  });
  for (const [file, content] of [
    [REQUIRED_FILES.schema, schema],
    [REQUIRED_FILES.migration, migration],
  ] as const) {
    requireMarkers({
      file,
      content,
      markers: SQL_RECOVERY_MARKERS,
      rule: "RECOVERABLE-RUNTIME-E",
      detail: "Fresh schema and one-time migration must carry the same recovery controls.",
      violations,
    });
  }

  return Object.freeze({
    ok: violations.length === 0,
    violations: Object.freeze(violations),
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runRecoverableAgentRuntimeCheck();
  if (!result.ok) {
    console.error("Recoverable agent runtime boundary violations:");
    for (const violation of result.violations) {
      console.error(`- [${violation.rule}] ${violation.file}: ${violation.detail}`);
    }
    process.exit(1);
  }

  console.log("Recoverable agent runtime boundary check passed.");
}
