/**
 * Helm Diagnostic Doctor CLI (slice 1) — read-only.
 *
 * Produces a JSON output envelope wrapping a HelmDoctorPacket. It reads only
 * local repo metadata (package name + .git HEAD, read-only) and catalogues the
 * diagnostic command registry; it does NOT execute the registered commands in
 * slice 1 (each is reported with degraded evidence). No network, no DB rows, no
 * file mutation, no auto-fix.
 *
 * `--output <path>`: optional; permitted ONLY under the OS temp dir (a local
 * draft location). Any other path — including inside the repo — is rejected.
 *
 * `ok: true` means the command completed per its own contract — NOT
 * release-ready, deployment-ready, accepted-by-human, or approved.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DIAGNOSTIC_COMMANDS,
  type DiagnosticCommand,
} from "../lib/diagnostics/command-registry";
import {
  buildDoctorPacket,
  type DoctorRepo,
  type HelmDoctorPacket,
} from "../lib/diagnostics/doctor-packet";

function readPackageName(repoRoot: string): string {
  try {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
    return typeof pkg.name === "string" && pkg.name ? pkg.name : "unknown";
  } catch {
    return "unknown";
  }
}

/** Resolve branch + head from .git WITHOUT executing git. Worktree-aware. */
function readGitInfo(repoRoot: string): DoctorRepo {
  const fallback: DoctorRepo = {
    name: readPackageName(repoRoot),
    branch: "unknown",
    head: "unknown",
    dirtyState: "unknown",
  };
  try {
    const dotGit = path.join(repoRoot, ".git");
    let gitDir = dotGit;
    try {
      // In a linked worktree, `.git` is a file: "gitdir: <path>".
      const raw = readFileSync(dotGit, "utf8");
      const m = raw.match(/^gitdir:\s*(.+)\s*$/);
      if (m) gitDir = path.resolve(repoRoot, m[1].trim());
    } catch {
      gitDir = dotGit; // normal checkout: `.git` is a directory
    }
    const headRaw = readFileSync(path.join(gitDir, "HEAD"), "utf8").trim();
    const refMatch = headRaw.match(/^ref:\s*(.+)$/);
    if (refMatch) {
      const ref = refMatch[1].trim();
      const branch = ref.replace(/^refs\/heads\//, "");
      let head = "unknown";
      const refPath = path.join(gitDir, ref);
      if (existsSync(refPath)) head = readFileSync(refPath, "utf8").trim();
      return { name: readPackageName(repoRoot), branch, head: head || "unknown", dirtyState: "unknown" };
    }
    // Detached HEAD: the file holds the SHA directly.
    return {
      name: readPackageName(repoRoot),
      branch: "(detached)",
      head: headRaw || "unknown",
      dirtyState: "unknown",
    };
  } catch {
    return fallback;
  }
}

function catalogResults(commands: readonly DiagnosticCommand[]) {
  return commands.map((cmd) => ({
    commandId: cmd.id,
    ok: true, // catalogued; see degradedEvidence — NOT a pass/approval claim
    risk: cmd.risk,
    outputSummary: `${cmd.command} — ${cmd.sideEffects.join("; ") || "no side effects"}`,
    evidenceRefs: cmd.evidenceRefs,
    degradedEvidence: ["not executed in slice-1 read-only doctor (catalog only)"],
  }));
}

export type DoctorEnvelope = {
  ok: boolean;
  command: string;
  risk: "read";
  data: HelmDoctorPacket;
  warnings: string[];
  evidenceRefs: string[];
  nextActions: string[];
};

export function buildDoctorEnvelope(repoRoot: string, now?: () => Date): DoctorEnvelope {
  const packet = buildDoctorPacket({
    repo: readGitInfo(repoRoot),
    commandResults: catalogResults(DIAGNOSTIC_COMMANDS),
    redactionStatus: "redacted",
    now,
  });
  return {
    ok: true,
    command: "helm:diagnostic-doctor",
    risk: "read",
    data: packet,
    warnings: packet.warnings,
    evidenceRefs: ["lib/diagnostics/command-registry.ts", "lib/diagnostics/doctor-packet.ts"],
    nextActions: packet.nextActions,
  };
}

/** A draft output path is only allowed under the OS temp dir. */
export function isAllowedOutputPath(target: string, cwd: string): boolean {
  const abs = path.resolve(cwd, target);
  const tmp = path.resolve(os.tmpdir());
  const rel = path.relative(tmp, abs);
  return rel === "" ? false : !rel.startsWith("..") && !path.isAbsolute(rel);
}

function parseOutputFlag(argv: readonly string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--output") return argv[i + 1];
    if (argv[i].startsWith("--output=")) return argv[i].slice("--output=".length);
  }
  return undefined;
}

export function main(argv: readonly string[], cwd: string = process.cwd()): number {
  const envelope = buildDoctorEnvelope(cwd);
  const json = `${JSON.stringify(envelope, null, 2)}\n`;
  const output = parseOutputFlag(argv);

  if (output) {
    if (!isAllowedOutputPath(output, cwd)) {
      process.stderr.write(
        `diagnostics:doctor: refusing --output outside the OS temp dir (local-draft only): ${output}\n`,
      );
      return 1;
    }
    writeFileSync(path.resolve(cwd, output), json, "utf8");
    process.stdout.write(`diagnostics:doctor: wrote ${path.resolve(cwd, output)}\n`);
    return 0;
  }

  process.stdout.write(json);
  return 0;
}

const isDirect = process.argv[1] && /helm-diagnostic-doctor\.(ts|js)$/.test(process.argv[1]);
if (isDirect) {
  process.exit(main(process.argv.slice(2)));
}
