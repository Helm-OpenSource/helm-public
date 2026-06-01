#!/usr/bin/env tsx
/**
 * docs-promote-status — flip a doc's frontmatter status field
 * (T014.exec Step 4 helper).
 *
 * Usage:
 *   npx tsx scripts/docs-promote-status.ts --path docs/X.md --to dormant
 *   npx tsx scripts/docs-promote-status.ts --path docs/X.md --to archived
 *   npx tsx scripts/docs-promote-status.ts --path docs/X.md --to superseded --by docs/Y.md
 *
 * Multiple paths from a list file:
 *   npx tsx scripts/docs-promote-status.ts --paths-file <path> --to dormant
 *
 * Defaults:
 *   - Rewrites status: line in frontmatter
 *   - When --to superseded, requires --by <new-path> (writes superseded_by field)
 *   - Adds a comment: "# status promoted from <old> to <new> on YYYY-MM-DD"
 *   - Idempotent: if doc already at target status, no-op
 *
 * Workflow: read docs-owner-review-packet-<YYYY-MM>.md, decide which
 * candidates to promote, run this script with the curated path or list.
 *
 * Reference: HELM_DOC_LIFECYCLE_POLICY_V1.md §1.4
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..");

const VALID_STATUSES = ["active", "dormant", "archived", "superseded"] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseFrontmatter(content: string): { hasFrontmatter: boolean; frontmatter: string; body: string } {
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) {
    return { hasFrontmatter: false, frontmatter: "", body: content };
  }
  const end = content.indexOf("\n---", 3);
  if (end === -1) {
    return { hasFrontmatter: false, frontmatter: "", body: content };
  }
  const frontmatter = content.substring(4, end);
  const body = content.substring(end + 4);
  return { hasFrontmatter: true, frontmatter, body };
}

function rebuildContent(frontmatter: string, body: string): string {
  return `---\n${frontmatter}\n---${body}`;
}

function updateStatusInFrontmatter(
  frontmatter: string,
  newStatus: ValidStatus,
  supersededBy: string | null,
): { updated: string; oldStatus: string | null } {
  const lines = frontmatter.split("\n");
  let foundStatus = false;
  let oldStatus: string | null = null;
  const output: string[] = [];
  for (const line of lines) {
    const statusMatch = line.match(/^status:\s*(.+)$/);
    if (statusMatch) {
      oldStatus = statusMatch[1].trim();
      output.push(`status: ${newStatus}`);
      foundStatus = true;
      continue;
    }
    // Drop existing superseded_by; we'll add fresh
    if (line.match(/^superseded_by:\s*/)) continue;
    output.push(line);
  }
  if (!foundStatus) {
    output.push(`status: ${newStatus}`);
  }
  if (newStatus === "superseded" && supersededBy) {
    output.push(`superseded_by: ${supersededBy}`);
  }
  // Add audit comment (idempotent: drop any previous "# status promoted" comment lines first)
  const auditFiltered = output.filter((l) => !l.match(/^# status (promoted|reset) from .+ to .+ on \d{4}-\d{2}-\d{2}$/));
  auditFiltered.push(
    `# status promoted from ${oldStatus ?? "_unset_"} to ${newStatus} on ${todayUTC()}`,
  );
  return { updated: auditFiltered.join("\n"), oldStatus };
}

function processOnePath(rel: string, newStatus: ValidStatus, supersededBy: string | null): "promoted" | "no-op" | "skipped" {
  const abs = path.join(REPO_ROOT, rel);
  if (!existsSync(abs)) {
    console.log(`  SKIP ${rel} (not found)`);
    return "skipped";
  }
  const content = readFileSync(abs, "utf8");
  const parsed = parseFrontmatter(content);
  if (!parsed.hasFrontmatter) {
    console.log(`  SKIP ${rel} (no frontmatter; run backfill first)`);
    return "skipped";
  }
  const { updated, oldStatus } = updateStatusInFrontmatter(parsed.frontmatter, newStatus, supersededBy);
  if (oldStatus === newStatus) {
    console.log(`  NO-OP ${rel} (already status=${newStatus})`);
    return "no-op";
  }
  const next = rebuildContent(updated, parsed.body);
  writeFileSync(abs, next, "utf8");
  console.log(`  PROMOTED ${rel} (${oldStatus ?? "_unset_"} -> ${newStatus})`);
  return "promoted";
}

function main(): void {
  const argv = process.argv.slice(2);
  const pathIdx = argv.indexOf("--path");
  const pathsFileIdx = argv.indexOf("--paths-file");
  const toIdx = argv.indexOf("--to");
  const byIdx = argv.indexOf("--by");

  if (toIdx === -1 || !argv[toIdx + 1]) {
    console.error("Missing --to <status>. Valid: active | dormant | archived | superseded");
    process.exit(64);
  }
  const newStatus = argv[toIdx + 1] as ValidStatus;
  if (!VALID_STATUSES.includes(newStatus)) {
    console.error(`Invalid --to value: ${newStatus}. Valid: ${VALID_STATUSES.join(", ")}`);
    process.exit(64);
  }
  const supersededBy = byIdx !== -1 ? argv[byIdx + 1] : null;
  if (newStatus === "superseded" && !supersededBy) {
    console.error("--to superseded requires --by <new-path>");
    process.exit(64);
  }

  let paths: string[] = [];
  if (pathIdx !== -1 && argv[pathIdx + 1]) {
    paths = [argv[pathIdx + 1]];
  } else if (pathsFileIdx !== -1 && argv[pathsFileIdx + 1]) {
    const content = readFileSync(argv[pathsFileIdx + 1], "utf8");
    paths = content.split("\n").map((s) => s.trim()).filter(Boolean);
  } else {
    console.error("Missing --path <doc> or --paths-file <list>");
    process.exit(64);
  }

  console.log(`Promoting ${paths.length} path(s) to status=${newStatus}${supersededBy ? ` superseded_by=${supersededBy}` : ""}...\n`);

  let promoted = 0;
  let noop = 0;
  let skipped = 0;
  for (const p of paths) {
    const result = processOnePath(p, newStatus, supersededBy);
    if (result === "promoted") promoted += 1;
    else if (result === "no-op") noop += 1;
    else skipped += 1;
  }

  console.log(`\nSummary: promoted=${promoted} no-op=${noop} skipped=${skipped}`);
}

main();
