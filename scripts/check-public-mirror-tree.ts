#!/usr/bin/env tsx
/**
 * Public mirror tree verifier.
 *
 * Run only against a prepared public mirror candidate. Unlike
 * `check:public-release`, this verifier requires tenant/internal/commercial
 * private roots to be physically absent from the mirror tree.
 */

import path from "node:path";

import { buildPublicMirrorPreflight } from "./build-public-mirror-preflight";
import {
  runPublicReleaseGuard,
  type Violation,
} from "./public-release-guard";
import { runPublicMirrorSemanticSmoke } from "./public-mirror-semantic";

export type PublicMirrorTreeVerificationOptions = {
  readonly mirrorRoot: string;
};

export type PublicMirrorTreeVerificationResult = {
  readonly mirrorRoot: string;
  readonly preflightExitCode: 0 | 1;
  readonly scannedFiles: number;
  readonly violations: ReadonlyArray<Violation>;
  readonly exitCode: 0 | 1;
};

function resolveMirrorRoot(mirrorRoot: string): string {
  return path.resolve(mirrorRoot);
}

export function verifyPublicMirrorTree(
  options: PublicMirrorTreeVerificationOptions,
): PublicMirrorTreeVerificationResult {
  const mirrorRoot = resolveMirrorRoot(options.mirrorRoot);
  const preflight = buildPublicMirrorPreflight({
    mirrorRoot,
    checkMode: true,
  });
  const guard = runPublicReleaseGuard({
    repoRoot: mirrorRoot,
    requirePrivateRootsAbsent: true,
  });
  const semantic = runPublicMirrorSemanticSmoke(mirrorRoot);
  const violations: Violation[] = [
    ...guard.violations,
    ...semantic.violations,
  ];
  const exitCode =
    preflight.exitCode === 0 && violations.length === 0 ? 0 : 1;

  return {
    mirrorRoot,
    preflightExitCode: preflight.exitCode,
    scannedFiles: guard.scannedFiles,
    violations,
    exitCode,
  };
}

function parseArgs(args: string[]): PublicMirrorTreeVerificationOptions {
  let mirrorRoot: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--mirror-root") {
      const value = args[index + 1];
      if (!value) throw new Error("--mirror-root requires a directory path");
      mirrorRoot = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!mirrorRoot) {
    throw new Error(
      "--mirror-root is required; run this only against a prepared public mirror tree.",
    );
  }

  return { mirrorRoot };
}

function main(): number {
  let result: PublicMirrorTreeVerificationResult;
  try {
    result = verifyPublicMirrorTree(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  if (result.exitCode === 0) {
    console.log(
      `public-mirror-tree: PASS — ${result.mirrorRoot}; scanned ${result.scannedFiles} files.`,
    );
    return 0;
  }

  console.error(
    `public-mirror-tree: FAIL — ${result.mirrorRoot}; preflight=${result.preflightExitCode}; violations=${result.violations.length}.`,
  );
  for (const violation of result.violations.slice(0, 40)) {
    console.error(`${violation.path}:${violation.line}: ${violation.rule}`);
    console.error(`  ${violation.excerpt}`);
  }
  if (result.violations.length > 40) {
    console.error(`... ${result.violations.length - 40} more`);
  }
  return 1;
}

if (require.main === module) {
  process.exitCode = main();
}
