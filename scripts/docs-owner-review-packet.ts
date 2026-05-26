#!/usr/bin/env tsx
/**
 * docs-owner-review-packet — generate a curated review packet for the
 * monthly doc lifecycle audit (T014.exec Step 4).
 *
 * Walks docs/ and produces a markdown + JSON packet listing:
 *   - Dormant candidates: status=active + age > retention window + 0 refs
 *   - Archive-ready: status=dormant + reviewAfter passed
 *   - Pending physical move: status=archived but file still in original path
 *   - Stale frontmatter: status=active + reviewAfter passed
 *   - Suspicious patterns: filename suggests archive but status=active
 *
 * Output: docs/internal/docs-owner-review-packet-<YYYY-MM>.{md,json}
 *
 * Usage:
 *   npx tsx scripts/docs-owner-review-packet.ts
 *   npx tsx scripts/docs-owner-review-packet.ts --retention-days 60
 *
 * Per HELM_DOC_LIFECYCLE_POLICY_V1 §1.4 the audit is meant to run monthly.
 * Owner has 30 days to review/reject candidates; unrejected candidates
 * apply per policy after the window.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  statSync,
} from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..");

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

type DocSummary = {
  path: string;
  status: string | null;
  owner: string | null;
  createdAt: string | null;
  reviewAfter: string | null;
  ageDays: number | null;
  daysPastReview: number | null;
  inboundRefs: number;
};

type ReferenceGraphEntry = {
  referencedBy: string[];
  referencedByCount: number;
};

type ReferenceGraphReport = {
  graph: Record<string, ReferenceGraphEntry>;
};

const ARCHIVE_PATTERN = /(closeout|freeze|sprint_|_audit|_review_notes|run_report|remediation|_report_v1)/i;

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

function extractFrontmatterField(content: string, field: string): string | null {
  if (!content.startsWith("---")) return null;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return null;
  const frontmatter = content.substring(3, end);
  const match = frontmatter.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : null;
}

function dayDiff(fromISO: string, toISO: string): number | null {
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.floor((to - from) / 86_400_000);
}

function findLatestGraph(): ReferenceGraphReport | null {
  const dir = path.join(REPO_ROOT, "docs", "internal");
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((f) => f.startsWith("docs-reference-graph-") && f.endsWith(".json"))
    .sort();
  if (files.length === 0) return null;
  return JSON.parse(readFileSync(path.join(dir, files[files.length - 1]), "utf8")) as ReferenceGraphReport;
}

function buildDocSummary(rel: string, todayISO: string, graph: ReferenceGraphReport | null): DocSummary {
  const abs = path.join(REPO_ROOT, rel);
  const content = readFileSync(abs, "utf8");
  const status = extractFrontmatterField(content, "status");
  const owner = extractFrontmatterField(content, "owner");
  const createdAt = extractFrontmatterField(content, "created");
  const reviewAfter = extractFrontmatterField(content, "review_after");
  const ageDays = createdAt ? dayDiff(createdAt, todayISO) : null;
  const daysPastReview = reviewAfter ? dayDiff(reviewAfter, todayISO) : null;
  const inboundRefs = graph?.graph[rel]?.referencedByCount ?? 0;
  return { path: rel, status, owner, createdAt, reviewAfter, ageDays, daysPastReview, inboundRefs };
}

function main(): void {
  const argv = process.argv.slice(2);
  const retentionIdx = argv.indexOf("--retention-days");
  const retentionDays = retentionIdx !== -1 ? Number(argv[retentionIdx + 1]) : 90;
  const todayISO = new Date().toISOString();
  const monthKey = todayISO.slice(0, 7);

  console.log(`Generating owner review packet for ${monthKey} (retention=${retentionDays}d)...`);

  const allDocs: string[] = [];
  walkDocs("docs", allDocs);

  const graph = findLatestGraph();
  if (!graph) {
    console.warn("No docs-reference-graph found. Inbound ref counts will be 0. Run docs-reference-scan first.");
  }

  const summaries = allDocs.map((rel) => buildDocSummary(rel, todayISO, graph));

  // Buckets
  const dormantCandidates: DocSummary[] = [];
  const archiveReady: DocSummary[] = [];
  const pendingPhysicalMove: DocSummary[] = [];
  const staleFrontmatter: DocSummary[] = [];
  const suspiciousPatternActive: DocSummary[] = [];

  for (const s of summaries) {
    if (!s.status) continue; // unfrontmattered handled by separate audit
    const status = s.status.toLowerCase().trim();

    if (status === "active" || status.startsWith("active")) {
      if (s.ageDays !== null && s.ageDays > retentionDays && s.inboundRefs === 0) {
        dormantCandidates.push(s);
      }
      if (s.daysPastReview !== null && s.daysPastReview > 0) {
        staleFrontmatter.push(s);
      }
      if (ARCHIVE_PATTERN.test(s.path)) {
        suspiciousPatternActive.push(s);
      }
    } else if (status === "dormant" || status.startsWith("dormant")) {
      if (s.daysPastReview !== null && s.daysPastReview > 0) {
        archiveReady.push(s);
      }
    } else if (status === "archived" || status.startsWith("archived")) {
      if (!s.path.startsWith("docs/internal/archive/")) {
        pendingPhysicalMove.push(s);
      }
    }
  }

  const packet = {
    generatedAt: todayISO,
    monthKey,
    retentionDays,
    counts: {
      totalDocs: summaries.length,
      dormantCandidates: dormantCandidates.length,
      archiveReady: archiveReady.length,
      pendingPhysicalMove: pendingPhysicalMove.length,
      staleFrontmatter: staleFrontmatter.length,
      suspiciousPatternActive: suspiciousPatternActive.length,
    },
    buckets: {
      dormantCandidates,
      archiveReady,
      pendingPhysicalMove,
      staleFrontmatter,
      suspiciousPatternActive,
    },
  };

  const outDir = path.join(REPO_ROOT, "docs", "internal");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const jsonOut = path.join(outDir, `docs-owner-review-packet-${monthKey}.json`);
  writeFileSync(jsonOut, JSON.stringify(packet, null, 2), "utf8");

  // Markdown summary
  const md: string[] = [];
  md.push(`# Docs Owner Review Packet — ${monthKey}`);
  md.push("");
  md.push(`Generated: ${todayISO}`);
  md.push(`Retention window: ${retentionDays} days`);
  md.push(`Total docs scanned: ${summaries.length}`);
  md.push("");
  md.push("## Action summary");
  md.push("");
  md.push(`- **Dormant candidates** (active + age > ${retentionDays}d + 0 refs): ${dormantCandidates.length}`);
  md.push(`  - Suggested action: flip status -> dormant via \`scripts/docs-promote-status.ts\``);
  md.push(`- **Archive-ready** (status=dormant + reviewAfter passed): ${archiveReady.length}`);
  md.push(`  - Suggested action: flip status -> archived; then run \`scripts/docs-archive-mover.ts --apply\``);
  md.push(`- **Pending physical move** (status=archived but not in archive/): ${pendingPhysicalMove.length}`);
  md.push(`  - Suggested action: \`scripts/docs-archive-mover.ts --apply\``);
  md.push(`- **Stale frontmatter** (review_after passed, still active): ${staleFrontmatter.length}`);
  md.push(`  - Suggested action: manual review; bump review_after or change status`);
  md.push(`- **Suspicious pattern + active status** (filename suggests archive, status=active): ${suspiciousPatternActive.length}`);
  md.push(`  - Suggested action: manual review; consider flipping to archived`);
  md.push("");

  function bucket(label: string, list: DocSummary[]): void {
    md.push(`## ${label} (${list.length})`);
    md.push("");
    if (list.length === 0) {
      md.push("_None._");
      md.push("");
      return;
    }
    md.push("| path | status | age | days past review | inbound refs |");
    md.push("|---|---|---|---|---|");
    for (const s of list.slice(0, 50)) {
      md.push(
        `| \`${s.path}\` | ${s.status ?? "_none_"} | ${s.ageDays ?? "?"}d | ${
          s.daysPastReview !== null ? `${s.daysPastReview}d` : "-"
        } | ${s.inboundRefs} |`,
      );
    }
    if (list.length > 50) md.push(`\n_…and ${list.length - 50} more (see JSON)_`);
    md.push("");
  }

  bucket("Dormant candidates", dormantCandidates);
  bucket("Archive-ready", archiveReady);
  bucket("Pending physical move", pendingPhysicalMove);
  bucket("Stale frontmatter", staleFrontmatter);
  bucket("Suspicious pattern + active status", suspiciousPatternActive);

  const mdOut = path.join(outDir, `docs-owner-review-packet-${monthKey}.md`);
  writeFileSync(mdOut, md.join("\n"), "utf8");

  console.log(`\nPacket written:`);
  console.log(`  - ${path.relative(REPO_ROOT, jsonOut)}`);
  console.log(`  - ${path.relative(REPO_ROOT, mdOut)}`);
  console.log(`\nCounts:`);
  for (const [k, v] of Object.entries(packet.counts)) {
    console.log(`  ${k}: ${v}`);
  }
}

main();
