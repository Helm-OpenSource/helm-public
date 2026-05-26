#!/usr/bin/env tsx
/**
 * Public mirror smoke gate.
 *
 * This is stricter than the source-tree public-release guard. It runs against a
 * prepared public mirror and rejects tenant-private semantic anchors from
 * runtime source/config surfaces. Policy docs can still describe boundaries,
 * but runnable public code must be generic.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import { verifyPublicMirrorTree } from "./check-public-mirror-tree";
export { runPublicMirrorSemanticSmoke } from "./public-mirror-semantic";
import {
  runPublicMirrorSemanticSmoke,
  type PublicMirrorSemanticViolation,
} from "./public-mirror-semantic";

export type PublicMirrorSmokeResult = {
  readonly repoRoot: string;
  readonly scannedFiles: number;
  readonly violations: ReadonlyArray<PublicMirrorSemanticViolation>;
  readonly verificationExitCode: 0 | 1;
  readonly commandFailures: ReadonlyArray<string>;
  readonly exitCode: 0 | 1;
};

function runNpmCommand(
  repoRoot: string,
  scriptName: string,
  args: ReadonlyArray<string> = [],
): string | null {
  const env = {
    ...process.env,
    CONNECTOR_TOKEN_SECRET:
      process.env.CONNECTOR_TOKEN_SECRET ??
      "public-smoke-local-connector-token-secret-0000000000",
  };
  const result = spawnSync("npm", ["run", scriptName, ...args], {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  });
  if (result.status === 0) return null;
  return scriptName;
}

export function runPublicMirrorSmoke(options: {
  readonly repoRoot: string;
  readonly runCommands?: boolean;
  readonly includeBuild?: boolean;
}): PublicMirrorSmokeResult {
  const repoRoot = path.resolve(options.repoRoot);
  const verification = verifyPublicMirrorTree({ mirrorRoot: repoRoot });
  const semantic = runPublicMirrorSemanticSmoke(repoRoot);
  const commandFailures: string[] = [];

  if (options.runCommands) {
    for (const scriptName of ["validate:env", "typecheck"]) {
      const failure = runNpmCommand(repoRoot, scriptName);
      if (failure) commandFailures.push(failure);
    }
    if (options.includeBuild !== false) {
      const failure = runNpmCommand(repoRoot, "build");
      if (failure) commandFailures.push(failure);
    }
    const publicReleaseArgs =
      options.includeBuild !== false
        ? ["--", "--include-local-build-artifacts"]
        : [];
    const failure = runNpmCommand(
      repoRoot,
      "check:public-release",
      publicReleaseArgs,
    );
    if (failure) commandFailures.push(failure);
  }

  const exitCode =
    verification.exitCode === 0 &&
    semantic.violations.length === 0 &&
    commandFailures.length === 0
      ? 0
      : 1;

  return {
    repoRoot,
    scannedFiles: semantic.scannedFiles,
    violations: semantic.violations,
    verificationExitCode: verification.exitCode,
    commandFailures,
    exitCode,
  };
}

function parseArgs(args: string[]): {
  repoRoot: string;
  runCommands: boolean;
  includeBuild: boolean;
} {
  let repoRoot: string | null = null;
  let runCommands = false;
  let includeBuild = true;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--repo-root") {
      const value = args[index + 1];
      if (!value) throw new Error("--repo-root requires a directory path");
      repoRoot = value;
      index += 1;
      continue;
    }
    if (arg === "--run-commands") {
      runCommands = true;
      continue;
    }
    if (arg === "--skip-build") {
      includeBuild = false;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!repoRoot) {
    throw new Error(
      "--repo-root is required; run this against a prepared public mirror tree.",
    );
  }

  if (!existsSync(repoRoot)) {
    throw new Error(`repo root does not exist: ${repoRoot}`);
  }

  return { repoRoot, runCommands, includeBuild };
}

function main(): number {
  let result: PublicMirrorSmokeResult;
  try {
    result = runPublicMirrorSmoke(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  if (result.exitCode === 0) {
    console.log(
      `public-mirror-smoke: PASS — ${result.repoRoot}; semantic scanned ${result.scannedFiles} file(s).`,
    );
    return 0;
  }

  console.error(
    `public-mirror-smoke: FAIL — ${result.repoRoot}; verify=${result.verificationExitCode}; semantic=${result.violations.length}; commands=${result.commandFailures.length}.`,
  );
  for (const violation of result.violations.slice(0, 40)) {
    console.error(`${violation.path}:${violation.line}: ${violation.rule}`);
    console.error(`  ${violation.excerpt}`);
  }
  if (result.violations.length > 40) {
    console.error(`... ${result.violations.length - 40} more`);
  }
  for (const failure of result.commandFailures) {
    console.error(`command failed: npm run ${failure}`);
  }
  return result.exitCode;
}

if (require.main === module) {
  process.exitCode = main();
}
