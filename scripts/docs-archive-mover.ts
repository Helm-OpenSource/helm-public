#!/usr/bin/env tsx
/**
 * docs-archive-mover — move status=archived / status=superseded docs to
 * docs/internal/archive/<YYYY-MM>/<original-path>/ (T014.exec Step 5).
 *
 * Safety scope: ONLY moves files that are simultaneously:
 *   1. status=archived OR status=superseded (frontmatter)
 *   2. 0 inbound references (orphan per docs-reference-scan)
 *
 * Rationale: moving a referenced doc breaks links. Pass 1 conservatively
 * skips docs with inbound references; a future Pass 2 will rewrite
 * inbound refs and then move.
 *
 * Usage:
 *   # Dry-run (default): show plan
 *   npx tsx scripts/docs-archive-mover.ts
 *
 *   # Apply moves via git mv
 *   npx tsx scripts/docs-archive-mover.ts --apply
 *
 *   # Use a specific classification report
 *   npx tsx scripts/docs-archive-mover.ts --classification <path>
 *
 * Output: console plan + (on --apply) actual git mv operations
 * Side effect: creates docs/internal/archive/<YYYY-MM>/ subdirectories
 *
 * Reference: HELM_DOC_LIFECYCLE_POLICY_V1.md §四 Step 5
 */

import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..");

type ClassifiedOrphan = {
  path: string;
  classification: string;
  status: string | null;
  createdAt: string | null;
  reviewAfter: string | null;
  ageDays: number | null;
  recommendation: string;
};

type ClassificationReport = {
  sourceGraph: string;
  scannedAt: string;
  classifiedAt: string;
  retentionDays: number;
  totalOrphans: number;
  counts: Record<string, number>;
  byCategory: Record<string, ClassifiedOrphan[]>;
};

function findLatestClassification(): string | null {
  const dir = path.join(REPO_ROOT, "docs", "internal");
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((f) => f.startsWith("docs-lifecycle-classification-") && f.endsWith(".json"))
    .sort();
  if (files.length === 0) return null;
  return path.join("docs", "internal", files[files.length - 1]);
}

function archiveTargetPath(originalRelPath: string, archiveMonth: string): string {
  // docs/architecture/R8_X.md → docs/internal/archive/2026-05/architecture/R8_X.md
  // docs/X.md → docs/internal/archive/2026-05/X.md (strip leading "docs/")
  const stripped = originalRelPath.startsWith("docs/")
    ? originalRelPath.slice("docs/".length)
    : originalRelPath;
  return path.join("docs", "internal", "archive", archiveMonth, stripped);
}

function gitMoveFile(fromRel: string, toRel: string): void {
  const toAbs = path.join(REPO_ROOT, toRel);
  const toDir = path.dirname(toAbs);
  if (!existsSync(toDir)) {
    mkdirSync(toDir, { recursive: true });
  }
  execSync(`git mv "${fromRel}" "${toRel}"`, { cwd: REPO_ROOT, stdio: "inherit" });
}

function main(): void {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const classifyIdx = argv.indexOf("--classification");
  const archiveMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  const classifyRel = classifyIdx !== -1 ? argv[classifyIdx + 1] : findLatestClassification();
  if (!classifyRel) {
    console.error("No classification report found. Run docs-lifecycle-classify-orphans first.");
    process.exit(64);
  }
  const classifyAbs = path.isAbsolute(classifyRel) ? classifyRel : path.join(REPO_ROOT, classifyRel);
  const report = JSON.parse(readFileSync(classifyAbs, "utf8")) as ClassificationReport;

  console.log(`Loaded classification: ${classifyRel} (classifiedAt=${report.classifiedAt})`);
  console.log(`Archive target directory: docs/internal/archive/${archiveMonth}/\n`);

  const archivedCandidates = report.byCategory.archived_pending_move ?? [];
  const supersededCandidates = report.byCategory.superseded_pending_move ?? [];
  const allCandidates = [...archivedCandidates, ...supersededCandidates];

  if (allCandidates.length === 0) {
    console.log("No archived/superseded orphan docs found. Nothing to move.");
    return;
  }

  console.log(`Found ${allCandidates.length} archive candidates (archived=${archivedCandidates.length} + superseded=${supersededCandidates.length}):`);
  console.log("");

  let movedCount = 0;
  let skippedNotFound = 0;
  let skippedAlreadyInArchive = 0;

  for (const c of allCandidates) {
    const target = archiveTargetPath(c.path, archiveMonth);
    const fromAbs = path.join(REPO_ROOT, c.path);

    if (!existsSync(fromAbs)) {
      console.log(`  SKIP ${c.path} (not found)`);
      skippedNotFound += 1;
      continue;
    }

    if (c.path.startsWith("docs/internal/archive/")) {
      console.log(`  SKIP ${c.path} (already in archive)`);
      skippedAlreadyInArchive += 1;
      continue;
    }

    if (apply) {
      try {
        gitMoveFile(c.path, target);
        movedCount += 1;
        console.log(`  MOVED ${c.path} → ${target}`);
      } catch (err) {
        console.error(`  FAIL  ${c.path} → ${target}: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      console.log(`  PLAN  ${c.path} → ${target}`);
    }
  }

  console.log("");
  console.log("Summary:");
  console.log(`  Candidates: ${allCandidates.length}`);
  console.log(`  Skipped (not found): ${skippedNotFound}`);
  console.log(`  Skipped (already in archive): ${skippedAlreadyInArchive}`);
  console.log(`  ${apply ? "Moved" : "Planned"}: ${apply ? movedCount : allCandidates.length - skippedNotFound - skippedAlreadyInArchive}`);

  if (!apply) {
    console.log("\n(Dry-run; re-run with --apply to execute git mv.)");
  } else {
    console.log("\nDone. Inspect with `git status` and verify before committing.");
  }
}

main();
