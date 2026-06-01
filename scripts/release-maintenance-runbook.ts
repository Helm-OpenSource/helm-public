#!/usr/bin/env tsx
/**
 * release-maintenance-runbook — orchestrate the public-release maintenance
 * window in a single auditable runner.
 *
 * Purpose: lower the single-owner risk during the maintenance window by
 * (a) presenting every step in fixed order, (b) requiring explicit confirm
 * before each destructive action, (c) running existing npm scripts (NOT
 * inventing new release logic), (d) capturing evidence into
 * `docs/internal/release-runbook-logs/<run-id>.json`.
 *
 * This script does NOT auto-execute destructive actions. Force-push,
 * `git filter-repo`, and Aliyun credential rotation remain manual steps;
 * the runner only:
 *   1. prompts owner to confirm
 *   2. records the timestamp + evidence each step produces
 *   3. runs the safe verification commands (check:secret-history,
 *      check:public-release, etc.) and refuses to advance if they fail
 *
 * Usage:
 *   npx tsx scripts/release-maintenance-runbook.ts --run-id <id>
 *   npx tsx scripts/release-maintenance-runbook.ts --run-id <id> --resume <step>
 *   npx tsx scripts/release-maintenance-runbook.ts --run-id <id> --dry-run
 *
 * Each run produces:
 *   docs/internal/release-runbook-logs/<run-id>.json   # structured evidence
 *   docs/internal/release-runbook-logs/<run-id>.log    # human-readable transcript
 *
 * INVARIANTS:
 *  - Never writes raw secrets to the log
 *  - Never auto-confirms a destructive step
 *  - Refuses to advance if a verification check fails
 *  - Resumable: re-running with same run-id continues from last completed step
 */

import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import readline from "node:readline";

export type StepStatus = "pending" | "running" | "passed" | "failed" | "skipped";

export type StepEvidence = {
  stepId: string;
  title: string;
  status: StepStatus;
  startedAt: string | null;
  finishedAt: string | null;
  notes: string[];
  commandsRun: Array<{ command: string; exitCode: number | null; capturedAt: string }>;
};

export type RunbookState = {
  runId: string;
  startedAt: string;
  ownerConfirmedAt: string | null;
  currentStepIndex: number;
  steps: StepEvidence[];
  dryRun: boolean;
};

/**
 * Build a fresh RunbookState in memory. Exported for testing the
 * canonical step sequence + dry-run flag plumbing without touching
 * the filesystem.
 */
export function buildFreshRunbookState(runId: string, dryRun: boolean, nowISO?: string): RunbookState {
  return {
    runId,
    startedAt: nowISO ?? new Date().toISOString(),
    ownerConfirmedAt: null,
    currentStepIndex: 0,
    steps: STEPS.map((s) => ({
      stepId: s.id,
      title: s.title,
      status: "pending" as StepStatus,
      startedAt: null,
      finishedAt: null,
      notes: [],
      commandsRun: [],
    })),
    dryRun,
  };
}

const REPO_ROOT = path.resolve(__dirname, "..");
const LOGS_DIR = path.join(REPO_ROOT, "docs", "internal", "release-runbook-logs");

export type StepSpec = { id: string; title: string; kind: "manual" | "verify" | "orchestrate" };

export const STEPS: ReadonlyArray<StepSpec> = [
  { id: "preflight", title: "Preflight: ensure on main, clean tree, latest origin/main fetched", kind: "verify" },
  { id: "rotation-confirm", title: "Confirm RDS root credential rotation done in Aliyun console (manual, outside this script)", kind: "manual" },
  { id: "rehearsal-mirror", title: "Run history-rewrite rehearsal in fresh mirror clone (recorded, not pushed)", kind: "manual" },
  { id: "collaborator-freeze", title: "Notify collaborators to stop main merges + lock branch protection for window", kind: "manual" },
  { id: "real-rewrite", title: "Execute real history rewrite via git-filter-repo on mirror clone", kind: "manual" },
  { id: "force-push", title: "Controlled force-push of rewritten history to origin/main (requires admin)", kind: "manual" },
  { id: "post-rewrite-verify", title: "npm run check:secret-history MUST pass post-push", kind: "verify" },
  { id: "post-rewrite-grep", title: "git log --all -S <fingerprint> + object DB scan MUST return 0 hits", kind: "manual" },
  { id: "mirror-build", title: "npm run public-mirror:build -- --mirror-root <candidate>", kind: "orchestrate" },
  { id: "mirror-verify", title: "npm run public-mirror:verify -- --mirror-root <candidate>", kind: "orchestrate" },
  { id: "clean-receipt", title: "npm run public-mirror:clean-receipt -- --receipt-id <id> --source-ref <ref> --mirror-root <candidate>", kind: "orchestrate" },
  { id: "release-check", title: "npm run release:check MUST pass with all public Core automatic checks green", kind: "verify" },
  { id: "go-nogo", title: "Final Go/No-Go evidence checklist (6 items) — owner signoff", kind: "manual" },
];

function timestamp(): string {
  return new Date().toISOString();
}

function ensureLogsDir(): void {
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function statePath(runId: string): string {
  return path.join(LOGS_DIR, `${runId}.json`);
}

function transcriptPath(runId: string): string {
  return path.join(LOGS_DIR, `${runId}.log`);
}

function loadOrInitState(runId: string, dryRun: boolean): RunbookState {
  const p = statePath(runId);
  if (existsSync(p)) {
    const raw = JSON.parse(readFileSync(p, "utf8")) as RunbookState;
    raw.dryRun = dryRun;
    return raw;
  }
  return buildFreshRunbookState(runId, dryRun, timestamp());
}

function saveState(state: RunbookState): void {
  writeFileSync(statePath(state.runId), JSON.stringify(state, null, 2), "utf8");
}

function appendTranscript(state: RunbookState, line: string): void {
  const p = transcriptPath(state.runId);
  const stamped = `[${timestamp()}] ${line}\n`;
  if (existsSync(p)) {
    writeFileSync(p, readFileSync(p, "utf8") + stamped, "utf8");
  } else {
    writeFileSync(p, stamped, "utf8");
  }
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function runVerifyCommand(state: RunbookState, command: string): { exitCode: number; stdoutTail: string } {
  appendTranscript(state, `EXEC ${command}`);
  try {
    const stdout = execSync(command, { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "pipe"] }).toString();
    const tail = stdout.split("\n").slice(-5).join("\n");
    appendTranscript(state, `PASS exitCode=0\n${tail}`);
    return { exitCode: 0, stdoutTail: tail };
  } catch (err) {
    const e = err as { status?: number; stdout?: Buffer; stderr?: Buffer };
    const stdoutText = e.stdout ? e.stdout.toString() : "";
    const stderrText = e.stderr ? e.stderr.toString() : "";
    const tail = (stdoutText + stderrText).split("\n").slice(-10).join("\n");
    appendTranscript(state, `FAIL exitCode=${e.status ?? "unknown"}\n${tail}`);
    return { exitCode: e.status ?? -1, stdoutTail: tail };
  }
}

async function executeStep(state: RunbookState, stepIdx: number): Promise<boolean> {
  const stepSpec = STEPS[stepIdx];
  const evidence = state.steps[stepIdx];
  evidence.status = "running";
  evidence.startedAt = timestamp();

  console.log(`\n=== Step ${stepIdx + 1}/${STEPS.length}: ${stepSpec.title} ===`);
  appendTranscript(state, `STEP-BEGIN ${stepSpec.id}: ${stepSpec.title}`);

  if (stepSpec.kind === "verify") {
    // Auto-runnable verification steps
    let command = "";
    if (stepSpec.id === "preflight") {
      command = "git status --porcelain && git fetch origin main && git log -1 --format='HEAD: %h %s'";
    } else if (stepSpec.id === "post-rewrite-verify") {
      command = "npm run check:secret-history";
    } else if (stepSpec.id === "release-check") {
      command = "npm run release:check";
    }
    if (command) {
      console.log(`Will run: ${command}`);
      const cont = await prompt("Proceed? [y/N]: ");
      if (cont !== "y" && cont !== "yes") {
        evidence.status = "skipped";
        evidence.notes.push("Skipped by owner");
        appendTranscript(state, `SKIP ${stepSpec.id}`);
        return false;
      }
      if (state.dryRun) {
        console.log("(dry-run: skipping actual execution)");
        evidence.status = "skipped";
        evidence.notes.push("dry-run mode: would have executed");
        return true;
      }
      const result = runVerifyCommand(state, command);
      evidence.commandsRun.push({ command, exitCode: result.exitCode, capturedAt: timestamp() });
      if (result.exitCode !== 0) {
        evidence.status = "failed";
        evidence.notes.push(`Command failed: ${command}; tail:\n${result.stdoutTail}`);
        evidence.finishedAt = timestamp();
        return false;
      }
      evidence.status = "passed";
      evidence.finishedAt = timestamp();
      return true;
    }
  }

  if (stepSpec.kind === "manual") {
    console.log("This step is manual — owner must perform it outside this script.");
    console.log("After completion, paste evidence reference (e.g. commit SHA, receipt id, screenshot path).");
    const proceed = await prompt("Has this step been completed externally? [y/N]: ");
    if (proceed !== "y" && proceed !== "yes") {
      evidence.status = "skipped";
      evidence.notes.push("Not yet completed; runbook paused");
      return false;
    }
    const ref = await prompt("Evidence reference (free-form): ");
    evidence.notes.push(`Evidence: ${ref}`);
    evidence.status = "passed";
    evidence.finishedAt = timestamp();
    return true;
  }

  if (stepSpec.kind === "orchestrate") {
    console.log(`This step runs an npm script; you may need to provide args (e.g. --mirror-root, --receipt-id).`);
    const command = await prompt(`Full command to run (or 'skip'): `);
    if (command === "skip") {
      evidence.status = "skipped";
      evidence.notes.push("Owner chose to skip");
      return false;
    }
    if (!command.startsWith("npm run")) {
      console.log("Refusing: command must start with 'npm run' for runbook auditability.");
      evidence.status = "skipped";
      evidence.notes.push(`Refused non-npm command: ${command}`);
      return false;
    }
    if (state.dryRun) {
      console.log("(dry-run: skipping actual execution)");
      evidence.status = "skipped";
      evidence.notes.push(`dry-run: would have run ${command}`);
      return true;
    }
    const result = runVerifyCommand(state, command);
    evidence.commandsRun.push({ command, exitCode: result.exitCode, capturedAt: timestamp() });
    if (result.exitCode !== 0) {
      evidence.status = "failed";
      evidence.notes.push(`Command failed; tail:\n${result.stdoutTail}`);
      evidence.finishedAt = timestamp();
      return false;
    }
    evidence.status = "passed";
    evidence.finishedAt = timestamp();
    return true;
  }

  evidence.status = "skipped";
  evidence.notes.push(`Unknown step kind: ${stepSpec.kind}`);
  return false;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const runIdIdx = argv.indexOf("--run-id");
  const resumeIdx = argv.indexOf("--resume");
  const dryRun = argv.includes("--dry-run");

  if (runIdIdx === -1 || !argv[runIdIdx + 1]) {
    console.error("Usage: tsx scripts/release-maintenance-runbook.ts --run-id <id> [--resume <step-id>] [--dry-run]");
    process.exit(64);
  }
  const runId = argv[runIdIdx + 1];
  if (!/^[a-zA-Z0-9_\-]+$/.test(runId)) {
    console.error("run-id must be alphanumeric / dash / underscore only");
    process.exit(64);
  }

  ensureLogsDir();
  const state = loadOrInitState(runId, dryRun);

  if (resumeIdx !== -1 && argv[resumeIdx + 1]) {
    const targetStep = argv[resumeIdx + 1];
    const idx = STEPS.findIndex((s) => s.id === targetStep);
    if (idx === -1) {
      console.error(`Unknown resume step: ${targetStep}`);
      process.exit(64);
    }
    state.currentStepIndex = idx;
  }

  if (!state.ownerConfirmedAt) {
    console.log(`Release Maintenance Runbook — run-id: ${runId} ${dryRun ? "(DRY-RUN)" : ""}`);
    console.log(`Steps: ${STEPS.length}; logs at ${LOGS_DIR}/${runId}.{json,log}`);
    console.log("This runbook does NOT auto-execute destructive actions. Each step requires explicit owner confirm.");
    const ok = await prompt("Owner confirms starting runbook? [y/N]: ");
    if (ok !== "y" && ok !== "yes") {
      console.log("Aborted.");
      process.exit(0);
    }
    state.ownerConfirmedAt = timestamp();
  }

  saveState(state);

  for (let i = state.currentStepIndex; i < STEPS.length; i += 1) {
    state.currentStepIndex = i;
    const advanced = await executeStep(state, i);
    saveState(state);
    if (!advanced) {
      console.log(`\nRunbook paused at step ${STEPS[i].id}. Resume with --resume ${STEPS[i].id}.`);
      console.log(`Evidence so far: ${statePath(runId)}`);
      process.exit(state.steps[i].status === "failed" ? 1 : 0);
    }
  }

  console.log("\n✅ All runbook steps completed.");
  console.log(`Final evidence: ${statePath(runId)}`);
}

// Only auto-run main() when invoked directly (e.g. via `npx tsx`). When
// vitest imports this module to test its exports, skip the entrypoint so
// the test runner does not block on prompt() / fail on missing argv.
const invokedDirectly =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  process.argv[1].endsWith("release-maintenance-runbook.ts");

if (invokedDirectly) {
  main().catch((err) => {
    console.error("Runbook crashed:", err);
    process.exit(1);
  });
}
