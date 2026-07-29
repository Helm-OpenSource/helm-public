/**
 * caio-admin — versioned operator CLI core for a macOS Studio deployment.
 *
 * Privilege model (encoded here as contract + preflight checks, never as a
 * real sudo invocation inside this core):
 * - A human operator account performs service operations exclusively through
 *   a controlled `sudo -u helmcaio <command>` channel.
 * - The `helmcaio` service account itself has NO sudo rights, is NOT an admin
 *   and never escalates. Preflight verifies this via injected ports.
 * - All commands in this package are pure functions over injected ports; the
 *   thin bin wrapper maps results to process exit codes. No logic here calls
 *   process.exit or spawns real privileged commands.
 */

import { promises as fs } from "node:fs";

import {
  deepRedact,
  redactPrivatePaths,
} from "@/tools/caio-admin/redaction";

export const EXIT_OK = 0;
export const EXIT_FAILED = 2;
export const EXIT_BLOCKED = 3;

export type CaioAdminStatus = "ok" | "blocked" | "failed";
export type CaioAdminExitCode = typeof EXIT_OK | typeof EXIT_FAILED | typeof EXIT_BLOCKED;
export type BlockedReason = `blocked:${string}`;

export type FindingStatus = "ok" | "warn" | "fail";

export interface CaioAdminFinding {
  checkKey: string;
  status: FindingStatus;
  /** Human-readable detail; must already be free of secret values. */
  detail: string;
}

export interface CaioAdminReceipt {
  receiptKey: string;
  ref: string;
  recordedAt: string;
}

export interface CaioAdminResult {
  command: string;
  status: CaioAdminStatus;
  blockedReason?: BlockedReason;
  exitCode: CaioAdminExitCode;
  findings: CaioAdminFinding[];
  receipts: CaioAdminReceipt[];
  /** Structured extras (release dir, state, sections, ...). */
  detail: Record<string, unknown>;
  /**
   * Paths of private operator inputs (secret files, certs, config roots).
   * Text mode redacts these from rendered output by default.
   */
  privateInputPaths?: string[];
}

const BLOCKED_REASON_PATTERN = /^[a-z][a-z0-9_]*$/;

export function blockedReasonOf(reason: string): BlockedReason {
  if (!BLOCKED_REASON_PATTERN.test(reason)) {
    throw new Error(`invalid blocked reason token: ${reason}`);
  }
  return `blocked:${reason}`;
}

interface ResultExtras {
  findings?: CaioAdminFinding[];
  receipts?: CaioAdminReceipt[];
  detail?: Record<string, unknown>;
  privateInputPaths?: string[];
}

export function okResult(command: string, extras: ResultExtras = {}): CaioAdminResult {
  return {
    command,
    status: "ok",
    exitCode: EXIT_OK,
    findings: extras.findings ?? [],
    receipts: extras.receipts ?? [],
    detail: extras.detail ?? {},
    ...(extras.privateInputPaths ? { privateInputPaths: extras.privateInputPaths } : {}),
  };
}

export function failedResult(command: string, extras: ResultExtras = {}): CaioAdminResult {
  return {
    command,
    status: "failed",
    exitCode: EXIT_FAILED,
    findings: extras.findings ?? [],
    receipts: extras.receipts ?? [],
    detail: extras.detail ?? {},
    ...(extras.privateInputPaths ? { privateInputPaths: extras.privateInputPaths } : {}),
  };
}

export function blockedResult(
  command: string,
  reason: string,
  extras: ResultExtras = {},
): CaioAdminResult {
  return {
    command,
    status: "blocked",
    blockedReason: blockedReasonOf(reason),
    exitCode: EXIT_BLOCKED,
    findings: extras.findings ?? [],
    receipts: extras.receipts ?? [],
    detail: extras.detail ?? {},
    ...(extras.privateInputPaths ? { privateInputPaths: extras.privateInputPaths } : {}),
  };
}

export interface RenderOptions {
  json?: boolean;
}

/**
 * Render a result for the operator. Both modes are scrubbed with the shared
 * redaction helper (so --json output can never carry secret values); text
 * mode additionally redacts the paths of private inputs.
 */
export function renderCaioAdminResult(
  result: CaioAdminResult,
  options: RenderOptions = {},
): string {
  const scrubbed = deepRedact(result);
  if (options.json) {
    return JSON.stringify(scrubbed, null, 2);
  }
  const lines: string[] = [];
  lines.push(`command: ${scrubbed.command}`);
  lines.push(`status: ${scrubbed.status}`);
  if (scrubbed.blockedReason) lines.push(`reason: ${scrubbed.blockedReason}`);
  lines.push(`exit: ${scrubbed.exitCode}`);
  for (const finding of scrubbed.findings) {
    lines.push(`  [${finding.status}] ${finding.checkKey}: ${finding.detail}`);
  }
  for (const receipt of scrubbed.receipts) {
    lines.push(`  receipt ${receipt.receiptKey}: ${receipt.ref} @ ${receipt.recordedAt}`);
  }
  if (Object.keys(scrubbed.detail).length > 0) {
    lines.push(`detail: ${JSON.stringify(scrubbed.detail)}`);
  }
  const text = lines.join("\n");
  return redactPrivatePaths(text, result.privateInputPaths ?? []);
}

// ---------------------------------------------------------------------------
// Shared ports
// ---------------------------------------------------------------------------

export interface CommandRunStep {
  key: string;
  command: string;
  args: readonly string[];
  cwd?: string;
}

export interface CommandRunResult {
  ok: boolean;
  exitCode: number;
  stdoutTail: string;
  stderrTail: string;
}

/**
 * Injected command-runner port. Real adapters route mutating service commands
 * through the controlled `sudo -u helmcaio` channel; tests inject fakes.
 * This core never spawns processes itself.
 */
export interface CommandRunnerPort {
  run(step: CommandRunStep): Promise<CommandRunResult>;
}

export type InspectedPathKind = "file" | "dir" | "symlink" | "other";

export interface InspectedPath {
  kind: InspectedPathKind;
  /** Permission bits only (mode & 0o7777). */
  mode: number;
  uid: number;
  nlink: number;
  size: number;
}

export interface FileInspectorPort {
  inspect(path: string): Promise<InspectedPath | null>;
}

/** Real-filesystem inspector (lstat based; never follows symlinks). */
export const nodeFileInspector: FileInspectorPort = {
  async inspect(path: string): Promise<InspectedPath | null> {
    try {
      const st = await fs.lstat(path);
      const kind: InspectedPathKind = st.isSymbolicLink()
        ? "symlink"
        : st.isDirectory()
          ? "dir"
          : st.isFile()
            ? "file"
            : "other";
      return {
        kind,
        mode: st.mode & 0o7777,
        uid: st.uid,
        nlink: st.nlink,
        size: st.size,
      };
    } catch {
      return null;
    }
  },
};

export interface PackageManifestCompat {
  appVersion: string;
  configSchemaVersion: string;
  dataSchemaCompatibleWith: string[];
}

export type PackageVerification =
  | {
      ok: true;
      packageKey: string;
      manifestSha256: string;
      entryCount: number;
      treeSha256: string;
      compat?: PackageManifestCompat;
    }
  | { ok: false; reason: string };

/** External digest + manifest verifier for distribution packages. */
export interface PackageVerifierPort {
  verify(packagePath: string): Promise<PackageVerification>;
}
