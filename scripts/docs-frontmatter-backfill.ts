#!/usr/bin/env tsx
/**
 * docs-frontmatter-backfill — add inferred frontmatter to docs that lack it.
 *
 * Implementation of HELM_DOC_LIFECYCLE_POLICY_V1 §1.2 enforcement for
 * legacy docs. Every doc under docs/ should carry frontmatter:
 *
 *   ---
 *   status: active | dormant | archived | superseded
 *   owner: <team-or-individual>
 *   created: <YYYY-MM-DD>
 *   review_after: <YYYY-MM-DD>
 *   ---
 *
 * This script:
 *   1. Finds docs without frontmatter (via classifier output or fresh scan)
 *   2. Infers reasonable defaults from filename / path / git log
 *   3. Prepends the frontmatter (with marker comment "backfilled by script")
 *   4. Skips files that already have frontmatter
 *
 * Usage:
 *   # Dry run (default): shows what would be added
 *   npx tsx scripts/docs-frontmatter-backfill.ts
 *
 *   # Apply changes
 *   npx tsx scripts/docs-frontmatter-backfill.ts --apply
 *
 *   # Operate only on a specific subset (input list, one path per line)
 *   npx tsx scripts/docs-frontmatter-backfill.ts --paths-file <path>
 *
 *   # Operate from latest lifecycle classification's unfrontmattered_active bucket
 *   npx tsx scripts/docs-frontmatter-backfill.ts --from-classification
 *
 * INVARIANTS:
 *  - Idempotent: re-running on a file that already has frontmatter is a no-op
 *  - Default is dry-run; --apply required for write
 *  - Never overwrites existing content; only PREPENDS frontmatter
 */

import { execSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..");

type InferredStatus = "active" | "dormant" | "archived" | "superseded";

type BackfillPlan = {
  filePath: string;
  inferredStatus: InferredStatus;
  inferredOwner: string;
  inferredCreated: string;
  inferredReviewAfter: string;
  rationale: string;
};

function getFirstCommitDate(filePath: string): string | null {
  try {
    const isoDate = execSync(
      `git log --reverse --format="%aI" -- "${filePath}" | head -n 1`,
      { cwd: REPO_ROOT, encoding: "utf8" },
    ).trim();
    if (!isoDate) return null;
    return isoDate.slice(0, 10);
  } catch {
    return null;
  }
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const t = new Date(isoDate).getTime();
  if (Number.isNaN(t)) return isoDate;
  const d = new Date(t + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function hasFrontmatter(content: string): boolean {
  return content.startsWith("---\n") || content.startsWith("---\r\n");
}

function parseFrontmatterFields(content: string): { fields: Map<string, string>; frontmatter: string; body: string } | null {
  if (!hasFrontmatter(content)) return null;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return null;
  const frontmatter = content.substring(4, end);
  const body = content.substring(end + 4);
  const fields = new Map<string, string>();
  for (const line of frontmatter.split("\n")) {
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.+)$/);
    if (m) fields.set(m[1], m[2].trim());
  }
  return { fields, frontmatter, body };
}

function completePartialFrontmatter(content: string, plan: BackfillPlan): string | null {
  const parsed = parseFrontmatterFields(content);
  if (!parsed) return null;
  const required: Record<string, string> = {
    status: plan.inferredStatus,
    owner: plan.inferredOwner,
    created: plan.inferredCreated,
    review_after: plan.inferredReviewAfter,
  };
  const missing: string[] = [];
  for (const [key, value] of Object.entries(required)) {
    if (!parsed.fields.has(key)) {
      missing.push(`${key}: ${value}`);
    }
  }
  if (missing.length === 0) return null;
  // Append missing fields just before the closing --- of frontmatter
  const auditComment = `# missing required fields backfilled by scripts/docs-frontmatter-backfill.ts on ${todayUTC()}`;
  const newFrontmatter = `${parsed.frontmatter}\n${missing.join("\n")}\n${auditComment}`;
  return `---\n${newFrontmatter}\n---${parsed.body}`;
}

function inferStatus(filePath: string): { status: InferredStatus; rationale: string } {
  const lower = filePath.toLowerCase();
  // Archived patterns
  if (
    lower.includes("_closeout") ||
    lower.includes("_freeze") ||
    lower.includes("_report") ||
    lower.includes("_remediation") ||
    lower.includes("_sprint_") ||
    lower.includes("_audit") ||
    lower.includes("_review_notes") ||
    lower.includes("_run_report")
  ) {
    return { status: "archived", rationale: "filename matches closeout/freeze/report/audit/sprint/run pattern" };
  }
  // Archive directory
  if (lower.includes("/archive/")) {
    return { status: "archived", rationale: "located in archive directory" };
  }
  // Dormant patterns (older transient docs)
  if (
    lower.includes("dark_mode") ||
    lower.includes("ui_ux_quick_start") ||
    lower.includes("improvements") ||
    lower.includes("dependency-update-plan") ||
    lower.includes("dependency-upgrade-report")
  ) {
    return { status: "dormant", rationale: "filename matches transient quick-start / improvements / dependency-update pattern" };
  }
  // Default: assume active (will be reviewed via lifecycle audit)
  return { status: "active", rationale: "default — no archive/dormant signal in path" };
}

function inferOwner(filePath: string): string {
  // Tenant-private subtrees get their tenant as owner (extracted from path
  // at runtime; the script itself stays tenant-agnostic per boundary policy)
  const extensionMatch = filePath.match(/^extensions\/([a-z0-9_-]+)\//i);
  if (extensionMatch) {
    return `${extensionMatch[1]}-tenant`;
  }
  // Default: helm-core
  return "helm-core";
}

function buildBackfillPlan(filePath: string): BackfillPlan {
  const { status, rationale } = inferStatus(filePath);
  const created = getFirstCommitDate(filePath) ?? todayUTC();
  // For archived files, no review needed (180-day grace)
  // For dormant, review_after = created + 60 days
  // For active, review_after = created + 90 days
  const reviewWindow =
    status === "archived" ? 180 : status === "dormant" ? 60 : 90;
  const reviewAfter = addDays(created, reviewWindow);

  return {
    filePath,
    inferredStatus: status,
    inferredOwner: inferOwner(filePath),
    inferredCreated: created,
    inferredReviewAfter: reviewAfter,
    rationale,
  };
}

function buildFrontmatterBlock(plan: BackfillPlan): string {
  return [
    "---",
    `status: ${plan.inferredStatus}`,
    `owner: ${plan.inferredOwner}`,
    `created: ${plan.inferredCreated}`,
    `review_after: ${plan.inferredReviewAfter}`,
    `# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on ${todayUTC()}`,
    `# rationale: ${plan.rationale}`,
    "---",
    "",
  ].join("\n");
}

function loadLatestUnfrontmatteredPaths(): string[] {
  const dir = path.join(REPO_ROOT, "docs", "internal");
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir)
    .filter((f) => f.startsWith("docs-lifecycle-classification-") && f.endsWith(".json"))
    .sort();
  if (files.length === 0) return [];
  const latest = path.join(dir, files[files.length - 1]);
  const report = JSON.parse(readFileSync(latest, "utf8")) as {
    byCategory: Record<string, Array<{ path: string }>>;
  };
  return (report.byCategory.unfrontmattered_active ?? []).map((c) => c.path);
}

const SKIP_BACKFILL_DIRS = new Set([
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

const SKIP_BACKFILL_PREFIXES: ReadonlyArray<string> = [
  "docs/internal/archive/",
  "docs/internal/_pii-mapping/",
  "docs/internal/release-runbook-logs/",
  "docs/internal/llm-spend-reports/",
];

function walkAllDocs(rootRel: string, accumulator: string[]): void {
  const abs = path.join(REPO_ROOT, rootRel);
  if (!existsSync(abs)) return;
  const stat = statSync(abs);
  if (stat.isFile()) {
    if (rootRel.endsWith(".md")) accumulator.push(rootRel);
    return;
  }
  for (const entry of readdirSync(abs)) {
    if (SKIP_BACKFILL_DIRS.has(entry)) continue;
    walkAllDocs(path.join(rootRel, entry), accumulator);
  }
}

function loadAllDocsPaths(): string[] {
  const all: string[] = [];
  walkAllDocs("docs", all);
  return all.filter((p) => !SKIP_BACKFILL_PREFIXES.some((prefix) => p.startsWith(prefix)));
}

function main(): void {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const fromClassification = argv.includes("--from-classification");
  const allDocs = argv.includes("--all-docs");
  const pathsFileIdx = argv.indexOf("--paths-file");

  let candidatePaths: string[] = [];
  if (pathsFileIdx !== -1 && argv[pathsFileIdx + 1]) {
    const content = readFileSync(argv[pathsFileIdx + 1], "utf8");
    candidatePaths = content.split("\n").map((s) => s.trim()).filter(Boolean);
  } else if (allDocs) {
    candidatePaths = loadAllDocsPaths();
  } else if (fromClassification) {
    candidatePaths = loadLatestUnfrontmatteredPaths();
  } else {
    candidatePaths = loadLatestUnfrontmatteredPaths();
  }

  if (candidatePaths.length === 0) {
    console.log("No candidate paths. Run docs-lifecycle-classify-orphans first or provide --paths-file.");
    return;
  }

  console.log(`Processing ${candidatePaths.length} candidate paths (${apply ? "APPLY mode" : "DRY-RUN mode"})...\n`);

  let skippedExistingFrontmatter = 0;
  let skippedNotFound = 0;
  let plannedCount = 0;
  let appliedCount = 0;

  for (const relPath of candidatePaths) {
    const abs = path.join(REPO_ROOT, relPath);
    if (!existsSync(abs)) {
      console.log(`  SKIP ${relPath} (not found)`);
      skippedNotFound += 1;
      continue;
    }
    const content = readFileSync(abs, "utf8");
    const plan = buildBackfillPlan(relPath);

    if (hasFrontmatter(content)) {
      // Try to complete missing fields
      const completed = completePartialFrontmatter(content, plan);
      if (!completed) {
        skippedExistingFrontmatter += 1;
        continue;
      }
      plannedCount += 1;
      if (apply) {
        writeFileSync(abs, completed, "utf8");
        appliedCount += 1;
        console.log(`  COMPLETED ${relPath} (missing fields added)`);
      } else {
        console.log(`  PLAN-COMPLETE ${relPath} (will add missing fields)`);
      }
      continue;
    }
    plannedCount += 1;

    if (apply) {
      const block = buildFrontmatterBlock(plan);
      writeFileSync(abs, block + content, "utf8");
      appliedCount += 1;
      console.log(`  APPLIED ${relPath} → status=${plan.inferredStatus}`);
    } else {
      console.log(
        `  PLAN    ${relPath} → status=${plan.inferredStatus}, created=${plan.inferredCreated}, review_after=${plan.inferredReviewAfter}`,
      );
    }
  }

  console.log("\nSummary:");
  console.log(`  Candidates considered: ${candidatePaths.length}`);
  console.log(`  Already had frontmatter (skipped): ${skippedExistingFrontmatter}`);
  console.log(`  Not found (skipped): ${skippedNotFound}`);
  console.log(`  ${apply ? "Applied" : "Planned"}: ${apply ? appliedCount : plannedCount}`);

  if (!apply && plannedCount > 0) {
    console.log("\n(Dry-run; re-run with --apply to write changes.)");
  }
}

main();
