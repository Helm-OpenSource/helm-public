#!/usr/bin/env tsx
/**
 * docs-lifecycle-classify-orphans — classify the orphan list from
 * docs-reference-scan into actionable lifecycle buckets.
 *
 * Reads the most recent docs-reference-graph-*.json under docs/internal/
 * (or a path you pass via --graph) and produces a classification:
 *
 *  - active_recent: status=active + created within retention window
 *    → no action (just hasn't been linked yet)
 *  - dormant_candidate: status=active + created beyond retention window
 *    → propose status change to dormant
 *  - archived_pending_move: status=archived (already flagged) but still
 *    in original path → propose move to docs/internal/archive/<month>/
 *  - superseded_pending_move: status=superseded → propose move
 *  - unfrontmattered_active: file has NO frontmatter status field
 *    → propose backfill (cannot auto-classify)
 *  - protected_root_index: special root navigation docs (e.g. docs/README.md)
 *  - protected_high_value: matches HELM_DOC_LIFECYCLE_POLICY_V1 §五 list
 *  - unknown_status: frontmatter status outside policy taxonomy
 *
 * Usage:
 *   npx tsx scripts/docs-lifecycle-classify-orphans.ts
 *   npx tsx scripts/docs-lifecycle-classify-orphans.ts --graph <path>
 *   npx tsx scripts/docs-lifecycle-classify-orphans.ts --retention-days 90
 *
 * Output: docs/internal/docs-lifecycle-classification-<YYYY-MM-DD>.json
 *
 * Reference: docs/internal/HELM_DOC_LIFECYCLE_POLICY_V1.md §1.1 + §五
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..");

const ROOT_INDEX_DOCS = new Set([
  "docs/README.md",
  "docs/STATUS.md",
]);

// Per HELM_DOC_LIFECYCLE_POLICY_V1.md §五 high-protection list. These
// must never be auto-classified as dormant even if no inbound link
// happens to be found by the scanner.
const NEVER_AUTO_DORMANT_PREFIXES: ReadonlyArray<string> = [
  "docs/positioning/",
  "docs/legal/",
  "docs/internal/HELM_GRANDFATHERED_",
  "docs/internal/HELM_FOUNDER_DECISIONS",
  "docs/internal/_pii-mapping/",
  "docs/product/HELM_OPEN_",
  "docs/integrations/INTEGRATION_TEMPLATE.md",
];

type OrphanClassification =
  | "active_recent"
  | "dormant_candidate"
  | "archived_pending_move"
  | "superseded_pending_move"
  | "unfrontmattered_active"
  | "protected_root_index"
  | "protected_high_value"
  | "unknown_status";

type DocEntry = {
  referencedBy: string[];
  referencedByCount: number;
  status: string | null;
  createdAt: string | null;
  reviewAfter: string | null;
};

type GraphReport = {
  scannedAt: string;
  totalDocs: number;
  totalReferences: number;
  totalOrphans: number;
  orphans: string[];
  graph: Record<string, DocEntry>;
};

type ClassifiedOrphan = {
  path: string;
  classification: OrphanClassification;
  status: string | null;
  createdAt: string | null;
  reviewAfter: string | null;
  ageDays: number | null;
  recommendation: string;
};

function findLatestGraphPath(): string | null {
  const dir = path.join(REPO_ROOT, "docs", "internal");
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((f) => f.startsWith("docs-reference-graph-") && f.endsWith(".json"))
    .sort();
  if (files.length === 0) return null;
  return path.join("docs", "internal", files[files.length - 1]);
}

function dayDiff(fromISO: string, toISO: string): number {
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return NaN;
  return Math.floor((to - from) / 86_400_000);
}

function isProtected(docPath: string): boolean {
  if (ROOT_INDEX_DOCS.has(docPath)) return true;
  return NEVER_AUTO_DORMANT_PREFIXES.some((prefix) => docPath.startsWith(prefix));
}

function classifyOrphan(
  doc: string,
  entry: DocEntry,
  scannedAt: string,
  retentionDays: number,
): ClassifiedOrphan {
  if (ROOT_INDEX_DOCS.has(doc)) {
    return {
      path: doc,
      classification: "protected_root_index",
      status: entry.status,
      createdAt: entry.createdAt,
      reviewAfter: entry.reviewAfter,
      ageDays: null,
      recommendation: "Root-level index doc; never auto-dormant. Verify by hand if obsolete.",
    };
  }

  if (isProtected(doc)) {
    return {
      path: doc,
      classification: "protected_high_value",
      status: entry.status,
      createdAt: entry.createdAt,
      reviewAfter: entry.reviewAfter,
      ageDays: null,
      recommendation: "High-protection prefix per policy §五. Never auto-classify dormant.",
    };
  }

  const status = entry.status?.toLowerCase().trim() ?? null;
  const ageDays =
    entry.createdAt && /^\d{4}-\d{2}-\d{2}/.test(entry.createdAt)
      ? dayDiff(entry.createdAt, scannedAt)
      : null;

  if (status === "archived" || status?.startsWith("archived")) {
    return {
      path: doc,
      classification: "archived_pending_move",
      status: entry.status,
      createdAt: entry.createdAt,
      reviewAfter: entry.reviewAfter,
      ageDays,
      recommendation: `Already status=archived; move to docs/internal/archive/${scannedAt.slice(0, 7)}/ per policy.`,
    };
  }

  if (status === "superseded" || status?.startsWith("superseded")) {
    return {
      path: doc,
      classification: "superseded_pending_move",
      status: entry.status,
      createdAt: entry.createdAt,
      reviewAfter: entry.reviewAfter,
      ageDays,
      recommendation: `Already status=superseded; move to archive immediately.`,
    };
  }

  if (!status) {
    return {
      path: doc,
      classification: "unfrontmattered_active",
      status: null,
      createdAt: entry.createdAt,
      reviewAfter: entry.reviewAfter,
      ageDays,
      recommendation: "No frontmatter status field. Backfill required before lifecycle action.",
    };
  }

  if (status === "active" || status.startsWith("active")) {
    if (ageDays !== null && ageDays > retentionDays) {
      return {
        path: doc,
        classification: "dormant_candidate",
        status: entry.status,
        createdAt: entry.createdAt,
        reviewAfter: entry.reviewAfter,
        ageDays,
        recommendation: `Active + ${ageDays}d old + 0 inbound refs; propose status -> dormant.`,
      };
    }
    return {
      path: doc,
      classification: "active_recent",
      status: entry.status,
      createdAt: entry.createdAt,
      reviewAfter: entry.reviewAfter,
      ageDays,
      recommendation: `Active + ${ageDays ?? "unknown"}d old; recently created, no action.`,
    };
  }

  return {
    path: doc,
    classification: "unknown_status",
    status: entry.status,
    createdAt: entry.createdAt,
    reviewAfter: entry.reviewAfter,
    ageDays,
    recommendation: `Status "${entry.status}" not in policy taxonomy; needs manual review.`,
  };
}

function main(): void {
  const argv = process.argv.slice(2);
  const graphIdx = argv.indexOf("--graph");
  const retentionIdx = argv.indexOf("--retention-days");
  const retentionDays = retentionIdx !== -1 ? Number(argv[retentionIdx + 1]) : 90;
  const graphRel = graphIdx !== -1 ? argv[graphIdx + 1] : findLatestGraphPath();

  if (!graphRel) {
    console.error("No docs-reference-graph-*.json found; run docs-reference-scan first.");
    process.exit(64);
  }

  const absGraph = path.isAbsolute(graphRel) ? graphRel : path.join(REPO_ROOT, graphRel);
  const report = JSON.parse(readFileSync(absGraph, "utf8")) as GraphReport;
  console.log(`Loaded graph: ${graphRel} (scannedAt=${report.scannedAt}, orphans=${report.orphans.length})`);

  const classifications = report.orphans.map((doc) =>
    classifyOrphan(doc, report.graph[doc], report.scannedAt, retentionDays),
  );

  const byCategory: Record<OrphanClassification, ClassifiedOrphan[]> = {
    active_recent: [],
    dormant_candidate: [],
    archived_pending_move: [],
    superseded_pending_move: [],
    unfrontmattered_active: [],
    protected_root_index: [],
    protected_high_value: [],
    unknown_status: [],
  };

  for (const c of classifications) {
    byCategory[c.classification].push(c);
  }

  const summary = {
    sourceGraph: graphRel,
    scannedAt: report.scannedAt,
    classifiedAt: new Date().toISOString(),
    retentionDays,
    totalOrphans: report.orphans.length,
    counts: {
      active_recent: byCategory.active_recent.length,
      dormant_candidate: byCategory.dormant_candidate.length,
      archived_pending_move: byCategory.archived_pending_move.length,
      superseded_pending_move: byCategory.superseded_pending_move.length,
      unfrontmattered_active: byCategory.unfrontmattered_active.length,
      protected_root_index: byCategory.protected_root_index.length,
      protected_high_value: byCategory.protected_high_value.length,
      unknown_status: byCategory.unknown_status.length,
    },
    byCategory,
  };

  const today = new Date().toISOString().slice(0, 10);
  const outRel = path.join("docs", "internal", `docs-lifecycle-classification-${today}.json`);
  const outAbs = path.join(REPO_ROOT, outRel);
  const outDir = path.dirname(outAbs);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }
  writeFileSync(outAbs, JSON.stringify(summary, null, 2), "utf8");

  console.log(`\nClassification written to ${outRel}`);
  console.log(`\nCounts by category:`);
  for (const [k, v] of Object.entries(summary.counts)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log("\nFirst 5 dormant candidates:");
  for (const c of byCategory.dormant_candidate.slice(0, 5)) {
    console.log(`  - ${c.path} (age ${c.ageDays}d, status=${c.status})`);
  }
  console.log("\nFirst 5 unfrontmattered:");
  for (const c of byCategory.unfrontmattered_active.slice(0, 5)) {
    console.log(`  - ${c.path}`);
  }
}

main();
