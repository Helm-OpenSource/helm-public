#!/usr/bin/env tsx
/**
 * Public README projection.
 *
 * The private worktree's README.md carries a "migration source" banner that
 * names the repo-split target repos (helm-packs / helm-overlays /
 * helm-control-plane) and links the internal execution checklist. That banner is
 * an internal topology note; the public Core mirror must not advertise the
 * commercial repo names. This projection removes ONLY that banner blockquote and
 * leaves the rest of the README (generic Open Core content) byte-for-byte.
 *
 * Deterministic + idempotent: running twice produces the same output; --check
 * exits 1 if the README still contains the banner.
 *
 * Usage:
 *   npx tsx scripts/build-public-readme.ts --repo-root /path/to/mirror
 *   npx tsx scripts/build-public-readme.ts --repo-root /path/to/mirror --check
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type PublicReadmeStatus =
  | "no-readme"
  | "already-clean"
  | "stripped-banner"
  | "needs-strip";

export type PublicReadmeBuildResult = {
  readonly status: PublicReadmeStatus;
  readonly readmePath: string;
  readonly exitCode: 0 | 1;
};

export type PublicReadmeBuildOptions = {
  readonly repoRoot?: string;
  readonly checkMode?: boolean;
};

// A line is the migration-source banner if it is a blockquote that announces the
// repo freeze / split. We match on the stable anchor phrases rather than the
// whole sentence so wording tweaks upstream still get stripped.
const BANNER_ANCHORS = [
  "migration source",
  "迁移源",
];

function isBannerLine(line: string): boolean {
  const trimmed = line.trimStart();
  if (!trimmed.startsWith(">")) return false;
  return BANNER_ANCHORS.some((anchor) => line.includes(anchor));
}

/** Remove the banner blockquote line(s) and any blank line immediately after. */
export function stripReadmeBanner(source: string): { output: string; changed: boolean } {
  const lines = source.split("\n");
  const out: string[] = [];
  let changed = false;
  for (let i = 0; i < lines.length; i += 1) {
    if (isBannerLine(lines[i])) {
      changed = true;
      // Also drop a single trailing blank line so we don't leave a double gap.
      if (i + 1 < lines.length && lines[i + 1].trim() === "") {
        i += 1;
      }
      continue;
    }
    out.push(lines[i]);
  }
  return { output: out.join("\n"), changed };
}

export function resolveReadmePath(repoRoot = process.cwd()): string {
  return path.resolve(repoRoot, "README.md");
}

export function buildPublicReadme(
  options: PublicReadmeBuildOptions = {},
): PublicReadmeBuildResult {
  const readmePath = resolveReadmePath(options.repoRoot);
  if (!existsSync(readmePath)) {
    return { status: "no-readme", readmePath, exitCode: 0 };
  }

  const existing = readFileSync(readmePath, "utf8");
  const { output, changed } = stripReadmeBanner(existing);

  if (!changed) {
    return { status: "already-clean", readmePath, exitCode: 0 };
  }

  if (options.checkMode) {
    return { status: "needs-strip", readmePath, exitCode: 1 };
  }

  writeFileSync(readmePath, output, "utf8");
  return { status: "stripped-banner", readmePath, exitCode: 0 };
}

function main(): number {
  const args = process.argv.slice(2);
  const checkMode = args.includes("--check");
  let repoRoot: string | undefined;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--repo-root") {
      repoRoot = args[i + 1];
      i += 1;
    }
  }

  const result = buildPublicReadme({ repoRoot, checkMode });
  if (result.status === "needs-strip") {
    console.error(
      `needs-strip: ${result.readmePath} still contains the migration-source banner — run \`npx tsx scripts/build-public-readme.ts --repo-root <mirror>\`.`,
    );
    return result.exitCode;
  }
  console.log(`${result.status}: ${result.readmePath}`);
  return result.exitCode;
}

if (require.main === module) {
  process.exitCode = main();
}
