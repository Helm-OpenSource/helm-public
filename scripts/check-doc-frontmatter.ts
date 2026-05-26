#!/usr/bin/env tsx
/**
 * check-doc-frontmatter — CI guard for HELM_DOC_LIFECYCLE_POLICY_V1 §1.2.
 *
 * Every doc under docs/ must carry frontmatter with at least the required
 * fields: status / owner / created / review_after.
 *
 * This script:
 *   - Walks docs/ for .md files (skips docs/internal/archive/* — those
 *     are sealed historical snapshots not subject to active lifecycle)
 *   - For each file, parses frontmatter and verifies required fields
 *   - Exits non-zero if any required field is missing
 *
 * Wire into:
 *   - .github/workflows/preflight.yml (fast PR feedback)
 *   - .github/workflows/ci.yml repo-guards job
 *
 * Skip rules (no frontmatter required):
 *   - docs/internal/archive/** (sealed history)
 *   - docs/internal/_pii-mapping/** (data file, not editorial doc)
 *   - docs/internal/release-runbook-logs/** (runtime evidence, machine-written)
 *   - docs/internal/llm-spend-reports/** (machine-generated reports)
 *
 * Allowlist (special cases that may legitimately lack frontmatter):
 *   - Files explicitly listed in ALLOWLIST below
 *
 * Reference: HELM_DOC_LIFECYCLE_POLICY_V1.md §1.2
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..");

const REQUIRED_FIELDS = ["status", "owner", "created", "review_after"] as const;

const SKIP_PREFIXES: ReadonlyArray<string> = [
  "docs/internal/archive/",
  "docs/internal/_pii-mapping/",
  "docs/internal/release-runbook-logs/",
  "docs/internal/llm-spend-reports/",
];

const ALLOWLIST: ReadonlySet<string> = new Set<string>([
  // Add specific files here ONLY with justification. Prefer adding the
  // missing frontmatter over allowlisting.
]);

const VALID_STATUSES = new Set(["active", "dormant", "archived", "superseded"]);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

const SKIP_DIRS = new Set([
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

type Violation = {
  path: string;
  reasons: string[];
};

function walkDocs(rootRel: string, accumulator: string[]): void {
  const abs = path.join(REPO_ROOT, rootRel);
  if (!existsSync(abs)) return;
  const stat = statSync(abs);
  if (stat.isFile()) {
    if (rootRel.endsWith(".md")) accumulator.push(rootRel);
    return;
  }
  for (const entry of readdirSync(abs)) {
    if (SKIP_DIRS.has(entry)) continue;
    walkDocs(path.join(rootRel, entry), accumulator);
  }
}

function shouldSkip(rel: string): boolean {
  if (ALLOWLIST.has(rel)) return true;
  return SKIP_PREFIXES.some((prefix) => rel.startsWith(prefix));
}

function parseFrontmatterFields(content: string): Map<string, string> {
  const fields = new Map<string, string>();
  if (!content.startsWith("---")) return fields;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return fields;
  const frontmatter = content.substring(3, end);
  for (const line of frontmatter.split("\n")) {
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.+)$/);
    if (m) {
      fields.set(m[1], m[2].trim());
    }
  }
  return fields;
}

function validate(rel: string): Violation | null {
  const abs = path.join(REPO_ROOT, rel);
  const content = readFileSync(abs, "utf8");
  if (!content.startsWith("---")) {
    return { path: rel, reasons: ["missing frontmatter block (---)"] };
  }
  const fields = parseFrontmatterFields(content);
  const reasons: string[] = [];
  for (const field of REQUIRED_FIELDS) {
    if (!fields.has(field)) {
      reasons.push(`missing required field: ${field}`);
    }
  }
  const rawStatus = fields.get("status") ?? "";
  const statusPrefix = rawStatus.toLowerCase().trim().split(/[\s/]/)[0];
  // Lenient: accept any value whose first token is in the taxonomy.
  // e.g. "active / draft", "spec / awaiting implementation" → first token
  // must be a valid status to pass.
  if (rawStatus && !VALID_STATUSES.has(statusPrefix) && !["spec", "planning", "draft", "v1", "v2"].includes(statusPrefix)) {
    reasons.push(`status "${rawStatus}" first token "${statusPrefix}" not in policy taxonomy (active|dormant|archived|superseded) or extended prefix (spec|planning|draft|v1|v2)`);
  }
  const created = fields.get("created") ?? "";
  if (created && !ISO_DATE_RE.test(created)) {
    reasons.push(`created "${created}" not ISO-8601 YYYY-MM-DD`);
  }
  const reviewAfter = fields.get("review_after") ?? "";
  if (reviewAfter && !ISO_DATE_RE.test(reviewAfter)) {
    reasons.push(`review_after "${reviewAfter}" not ISO-8601 YYYY-MM-DD`);
  }
  return reasons.length > 0 ? { path: rel, reasons } : null;
}

function main(): void {
  const allMd: string[] = [];
  walkDocs("docs", allMd);
  const inScope = allMd.filter((p) => !shouldSkip(p));

  const violations: Violation[] = [];
  for (const p of inScope) {
    const v = validate(p);
    if (v) violations.push(v);
  }

  console.log(`check-doc-frontmatter: scanned ${inScope.length} doc files; ${violations.length} violations.`);
  if (violations.length === 0) {
    console.log("PASS");
    return;
  }
  console.error("");
  console.error("Doc lifecycle frontmatter violations (per HELM_DOC_LIFECYCLE_POLICY_V1.md §1.2):");
  console.error("");
  for (const v of violations) {
    console.error(`  ${v.path}`);
    for (const r of v.reasons) {
      console.error(`    - ${r}`);
    }
  }
  console.error("");
  console.error(`Fix: add frontmatter (status/owner/created/review_after) to each file, or run`);
  console.error(`scripts/docs-frontmatter-backfill.ts --apply for bulk inference.`);
  process.exit(1);
}

main();
