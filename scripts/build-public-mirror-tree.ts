#!/usr/bin/env tsx
/**
 * Public mirror tree builder.
 *
 * Creates a public-mirror candidate from a private Helm worktree, applies the
 * deterministic public projections, then runs the public mirror verifier.
 *
 * Safety contract:
 *   - requires an explicit --mirror-root
 *   - refuses to write into the source repo or any nested path under it
 *   - refuses non-empty mirror roots unless --force-clean is explicit
 *   - excludes private tenant/internal/commercial roots and local build output
 *
 * Usage:
 *   npx tsx scripts/build-public-mirror-tree.ts --mirror-root /tmp/helm-public
 *   npx tsx scripts/build-public-mirror-tree.ts --source-root . --mirror-root /tmp/helm-public --force-clean
 */

import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from "node:fs";
import path from "node:path";

import { buildPublicMirrorPreflight } from "./build-public-mirror-preflight";
import { verifyPublicMirrorTree } from "./check-public-mirror-tree";
import {
  PUBLIC_MIRROR_PRIVATE_FILES,
  PUBLIC_MIRROR_PRIVATE_ROOTS,
  type Violation,
} from "./public-release-guard";

export type PublicMirrorTreeBuildOptions = {
  readonly sourceRoot?: string;
  readonly mirrorRoot: string;
  readonly forceClean?: boolean;
};

export type PublicMirrorTreeBuildSkippedEntry = {
  readonly path: string;
  readonly reason:
    | "private-root"
    | "private-file"
    | "local-only-file"
    | "local-artifact-dir"
    | "local-artifact-file"
    | "symlink"
    | "special-file";
};

export type PublicMirrorTreeBuildResult = {
  readonly sourceRoot: string;
  readonly mirrorRoot: string;
  readonly copiedFiles: number;
  readonly copiedDirectories: number;
  readonly skippedEntries: ReadonlyArray<PublicMirrorTreeBuildSkippedEntry>;
  readonly preflightExitCode: 0 | 1;
  readonly verificationScannedFiles: number;
  readonly violations: ReadonlyArray<Violation>;
  readonly exitCode: 0 | 1;
};

const LOCAL_ARTIFACT_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".vercel",
  "playwright-report",
  "test-results",
  ".claude",
  ".codex",
  ".idea",
  ".vscode",
  ".tmp",
  "tmp",
  "generated",
]);

const LOCAL_ARTIFACT_FILES = new Set([
  ".DS_Store",
  "npm-debug.log",
  "yarn-error.log",
  "pnpm-debug.log",
]);

const LOCAL_ARTIFACT_EXTENSIONS = new Set([".db", ".sqlite", ".sqlite3"]);

function normalizeRelativePath(relativePath: string): string {
  return relativePath.split(path.sep).filter(Boolean).join("/");
}

function isSamePath(left: string, right: string): boolean {
  return path.resolve(left) === path.resolve(right);
}

function isPathInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function isInsideConfiguredRoot(
  relativePath: string,
  roots: ReadonlyArray<string>,
): boolean {
  return roots.some(
    (root) => relativePath === root || relativePath.startsWith(`${root}/`),
  );
}

function isPrivateFile(relativePath: string): boolean {
  return PUBLIC_MIRROR_PRIVATE_FILES.includes(relativePath);
}

function isLocalOnlyFile(relativePath: string): boolean {
  const basename = path.basename(relativePath);
  if (basename === ".env") return true;
  if (!basename.startsWith(".env.")) return false;
  return basename !== ".env.example";
}

function getSkipReason(
  relativePath: string,
  entryName: string,
  isDirectory: boolean,
): PublicMirrorTreeBuildSkippedEntry["reason"] | null {
  if (isInsideConfiguredRoot(relativePath, PUBLIC_MIRROR_PRIVATE_ROOTS)) {
    return "private-root";
  }
  if (!isDirectory && isPrivateFile(relativePath)) return "private-file";
  if (!isDirectory && isLocalOnlyFile(relativePath)) return "local-only-file";
  if (isDirectory && LOCAL_ARTIFACT_DIRS.has(entryName)) {
    return "local-artifact-dir";
  }
  if (!isDirectory && LOCAL_ARTIFACT_FILES.has(entryName)) {
    return "local-artifact-file";
  }
  if (!isDirectory && LOCAL_ARTIFACT_EXTENSIONS.has(path.extname(entryName))) {
    return "local-artifact-file";
  }
  return null;
}

function assertDirectory(pathLabel: string, directoryPath: string): void {
  if (!existsSync(directoryPath)) {
    throw new Error(`${pathLabel} does not exist: ${directoryPath}`);
  }
  const stats = lstatSync(directoryPath);
  if (!stats.isDirectory()) {
    throw new Error(`${pathLabel} must be a directory: ${directoryPath}`);
  }
}

function assertSafeMirrorRoot(
  sourceRoot: string,
  mirrorRoot: string,
  forceClean: boolean,
): void {
  if (isSamePath(sourceRoot, mirrorRoot)) {
    throw new Error("--mirror-root must not be the source repo root");
  }
  if (isPathInside(sourceRoot, mirrorRoot)) {
    throw new Error("--mirror-root must not be inside the source repo");
  }
  if (isPathInside(mirrorRoot, sourceRoot)) {
    throw new Error("--mirror-root must not contain the source repo");
  }

  if (!existsSync(mirrorRoot)) return;

  const stats = lstatSync(mirrorRoot);
  if (!stats.isDirectory()) {
    throw new Error("--mirror-root must be a directory when it already exists");
  }

  const entries = readdirSync(mirrorRoot);
  if (entries.length === 0) return;
  if (!forceClean) {
    throw new Error("--mirror-root must be empty; pass --force-clean to replace it");
  }
}

function prepareMirrorRoot(mirrorRoot: string, forceClean: boolean): void {
  if (existsSync(mirrorRoot) && forceClean) {
    rmSync(mirrorRoot, { force: true, recursive: true });
  }
  mkdirSync(mirrorRoot, { recursive: true });
}

function copyPublicTree(sourceRoot: string, mirrorRoot: string): {
  copiedFiles: number;
  copiedDirectories: number;
  skippedEntries: PublicMirrorTreeBuildSkippedEntry[];
} {
  let copiedFiles = 0;
  let copiedDirectories = 0;
  const skippedEntries: PublicMirrorTreeBuildSkippedEntry[] = [];

  function copyEntry(sourcePath: string): void {
    const relativePath = normalizeRelativePath(path.relative(sourceRoot, sourcePath));
    const entryName = path.basename(sourcePath);
    const targetPath = path.join(mirrorRoot, relativePath);
    const stats = lstatSync(sourcePath);

    if (stats.isSymbolicLink()) {
      skippedEntries.push({ path: relativePath, reason: "symlink" });
      return;
    }

    if (stats.isDirectory()) {
      const skipReason = getSkipReason(relativePath, entryName, true);
      if (skipReason) {
        skippedEntries.push({ path: relativePath, reason: skipReason });
        return;
      }

      mkdirSync(targetPath, { recursive: true });
      copiedDirectories += 1;
      for (const child of readdirSync(sourcePath)) {
        copyEntry(path.join(sourcePath, child));
      }
      return;
    }

    if (!stats.isFile()) {
      skippedEntries.push({ path: relativePath, reason: "special-file" });
      return;
    }

    const skipReason = getSkipReason(relativePath, entryName, false);
    if (skipReason) {
      skippedEntries.push({ path: relativePath, reason: skipReason });
      return;
    }

    mkdirSync(path.dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
    copiedFiles += 1;
  }

  for (const entry of readdirSync(sourceRoot)) {
    copyEntry(path.join(sourceRoot, entry));
  }

  return { copiedDirectories, copiedFiles, skippedEntries };
}

export function buildPublicMirrorTree(
  options: PublicMirrorTreeBuildOptions,
): PublicMirrorTreeBuildResult {
  const sourceRoot = path.resolve(options.sourceRoot ?? process.cwd());
  const mirrorRoot = path.resolve(options.mirrorRoot);
  const forceClean = options.forceClean ?? false;

  assertDirectory("source root", sourceRoot);
  assertSafeMirrorRoot(sourceRoot, mirrorRoot, forceClean);
  prepareMirrorRoot(mirrorRoot, forceClean);

  const copyResult = copyPublicTree(sourceRoot, mirrorRoot);
  const preflight = buildPublicMirrorPreflight({ mirrorRoot });
  const verification = verifyPublicMirrorTree({ mirrorRoot });
  const exitCode =
    preflight.exitCode === 0 && verification.exitCode === 0 ? 0 : 1;

  return {
    sourceRoot,
    mirrorRoot,
    copiedFiles: copyResult.copiedFiles,
    copiedDirectories: copyResult.copiedDirectories,
    skippedEntries: copyResult.skippedEntries,
    preflightExitCode: preflight.exitCode,
    verificationScannedFiles: verification.scannedFiles,
    violations: verification.violations,
    exitCode,
  };
}

function parseArgs(args: string[]): PublicMirrorTreeBuildOptions {
  let sourceRoot: string | undefined;
  let mirrorRoot: string | undefined;
  let forceClean = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--source-root") {
      const value = args[index + 1];
      if (!value) throw new Error("--source-root requires a directory path");
      sourceRoot = value;
      index += 1;
      continue;
    }
    if (arg === "--mirror-root") {
      const value = args[index + 1];
      if (!value) throw new Error("--mirror-root requires a directory path");
      mirrorRoot = value;
      index += 1;
      continue;
    }
    if (arg === "--force-clean") {
      forceClean = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!mirrorRoot) {
    throw new Error(
      "--mirror-root is required; choose an empty directory outside the source repo.",
    );
  }

  return { forceClean, mirrorRoot, sourceRoot };
}

function main(): number {
  let result: PublicMirrorTreeBuildResult;
  try {
    result = buildPublicMirrorTree(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  const skippedByReason = new Map<string, number>();
  for (const skipped of result.skippedEntries) {
    skippedByReason.set(
      skipped.reason,
      (skippedByReason.get(skipped.reason) ?? 0) + 1,
    );
  }
  const skippedSummary = [...skippedByReason.entries()]
    .map(([reason, count]) => `${reason}=${count}`)
    .join(", ");

  const summary = [
    `public-mirror-build: ${result.exitCode === 0 ? "PASS" : "FAIL"} — ${result.mirrorRoot}`,
    `source: ${result.sourceRoot}`,
    `copied: ${result.copiedFiles} file(s), ${result.copiedDirectories} directory entry(s)`,
    `skipped: ${result.skippedEntries.length}${skippedSummary ? ` (${skippedSummary})` : ""}`,
    `preflight=${result.preflightExitCode}; verify=${result.exitCode}; scanned=${result.verificationScannedFiles}`,
  ];

  if (result.exitCode === 0) {
    console.log(summary.join("\n"));
    return 0;
  }

  console.error(summary.join("\n"));
  for (const violation of result.violations.slice(0, 40)) {
    console.error(`${violation.path}:${violation.line}: ${violation.rule}`);
    console.error(`  ${violation.excerpt}`);
  }
  if (result.violations.length > 40) {
    console.error(`... ${result.violations.length - 40} more`);
  }
  return result.exitCode;
}

if (require.main === module) {
  process.exitCode = main();
}
