#!/usr/bin/env tsx
/**
 * docs-reference-scan — build a graph of which docs reference which docs.
 *
 * Output enables docs lifecycle policy (T014) to identify dormant docs.
 *
 * A doc is "referenced" if any of the following points to it:
 *   1. Another `.md` file links to it via `[...](path)`
 *   2. README.md / AGENTS.md / WORKING-CONTEXT.md / docs/README.md /
 *      docs/STATUS.md indexes it
 *   3. package.json npm scripts mention its path
 *   4. Source code (.ts / .tsx) comments cite its path
 *
 * Usage:
 *   npx tsx scripts/docs-reference-scan.ts
 *   npx tsx scripts/docs-reference-scan.ts --output <path>
 *   npx tsx scripts/docs-reference-scan.ts --orphans-only
 *
 * Default output: docs/internal/docs-reference-graph-<YYYY-MM-DD>.json
 *
 * The graph has shape:
 *   {
 *     scannedAt: ISO-8601,
 *     totalDocs: N,
 *     totalReferences: M,
 *     graph: {
 *       "docs/path/to/doc.md": {
 *         referencedBy: ["referrer/path1", "referrer/path2", ...],
 *         referencedByCount: 2,
 *         status: "frontmatter status field value or null",
 *         createdAt: "frontmatter created field or null",
 *         reviewAfter: "frontmatter review_after field or null"
 *       },
 *       ...
 *     },
 *     orphans: ["docs/path1.md", "docs/path2.md", ...]
 *   }
 */

import {
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..");

const SCAN_TARGETS_FOR_REFERRERS: ReadonlyArray<string> = [
  "docs",
  "README.md",
  "README.en.md",
  "AGENTS.md",
  "AGENTS.en.md",
  "WORKING-CONTEXT.md",
  "DESIGN.md",
  "GOVERNANCE.md",
  "CONTRIBUTING.md",
  "CONTRIBUTING.en.md",
  "SECURITY.md",
  "CHANGELOG.md",
  "PLANS.md",
  "package.json",
  "lib",
  "features",
  "app",
  "scripts",
  "extensions",
];

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

const REFERRER_EXTENSIONS = new Set([".md", ".ts", ".tsx", ".json"]);

type DocEntry = {
  referencedBy: string[];
  referencedByCount: number;
  status: string | null;
  createdAt: string | null;
  reviewAfter: string | null;
};

type Graph = Record<string, DocEntry>;

function walkFiles(rootRel: string, accumulator: string[]): void {
  const abs = path.join(REPO_ROOT, rootRel);
  if (!existsSync(abs)) return;
  const stat = statSync(abs);
  if (stat.isFile()) {
    accumulator.push(rootRel);
    return;
  }
  for (const entry of readdirSync(abs)) {
    if (SKIP_DIRS.has(entry)) continue;
    walkFiles(path.join(rootRel, entry), accumulator);
  }
}

function findAllDocs(): string[] {
  const docs: string[] = [];
  walkFiles("docs", docs);
  return docs.filter((p) => p.endsWith(".md"));
}

function extractFrontmatterField(content: string, field: string): string | null {
  if (!content.startsWith("---")) return null;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return null;
  const frontmatter = content.substring(3, end);
  const match = frontmatter.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : null;
}

function extractMarkdownLinkTargets(content: string): string[] {
  const targets: string[] = [];
  const re = /\[[^\]]*\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const target = m[1].split("#")[0].trim();
    if (target.endsWith(".md")) {
      targets.push(target);
    }
  }
  return targets;
}

function extractRawPathMentions(content: string): string[] {
  const targets: string[] = [];
  // Match docs/.../*.md mentions in code comments / TS strings / JSON values
  const re = /([a-zA-Z0-9_./\-]+\.md)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m[1].startsWith("docs/")) {
      targets.push(m[1]);
    }
  }
  return targets;
}

function normalizeTargetToRepoPath(referrerRel: string, target: string): string | null {
  if (!target.endsWith(".md")) return null;
  if (target.startsWith("docs/")) return target;
  if (target.startsWith("/")) return null; // absolute path on local machine — skip
  if (target.startsWith("http")) return null;
  // Resolve relative to referrer
  const referrerDir = path.dirname(referrerRel);
  const normalized = path.normalize(path.join(referrerDir, target));
  if (!normalized.startsWith("docs/") && normalized !== "README.md") return null;
  return normalized;
}

function gatherAllReferrers(): string[] {
  const referrers: string[] = [];
  for (const target of SCAN_TARGETS_FOR_REFERRERS) {
    const abs = path.join(REPO_ROOT, target);
    if (!existsSync(abs)) continue;
    const stat = statSync(abs);
    if (stat.isFile()) {
      referrers.push(target);
      continue;
    }
    walkFiles(target, referrers);
  }
  return referrers.filter((p) => REFERRER_EXTENSIONS.has(path.extname(p)));
}

function main(): void {
  const argv = process.argv.slice(2);
  const outIdx = argv.indexOf("--output");
  const orphansOnly = argv.includes("--orphans-only");
  const today = new Date().toISOString().slice(0, 10);
  const defaultOutPath = path.join("docs", "internal", `docs-reference-graph-${today}.json`);
  const outputPath = outIdx !== -1 ? argv[outIdx + 1] : defaultOutPath;

  console.log("Scanning docs/...");
  const allDocs = findAllDocs();
  console.log(`Found ${allDocs.length} doc files.`);

  console.log("Scanning referrers...");
  const referrers = gatherAllReferrers();
  console.log(`Found ${referrers.length} referrer files.`);

  const graph: Graph = {};
  for (const doc of allDocs) {
    const absDoc = path.join(REPO_ROOT, doc);
    let content = "";
    try {
      content = readFileSync(absDoc, "utf8");
    } catch {
      // ignore unreadable
    }
    graph[doc] = {
      referencedBy: [],
      referencedByCount: 0,
      status: extractFrontmatterField(content, "status"),
      createdAt: extractFrontmatterField(content, "created"),
      reviewAfter: extractFrontmatterField(content, "review_after"),
    };
  }

  let totalReferences = 0;
  for (const referrerRel of referrers) {
    const absRef = path.join(REPO_ROOT, referrerRel);
    let content = "";
    try {
      content = readFileSync(absRef, "utf8");
    } catch {
      continue;
    }

    const targets = new Set<string>();
    if (referrerRel.endsWith(".md")) {
      for (const link of extractMarkdownLinkTargets(content)) {
        const normalized = normalizeTargetToRepoPath(referrerRel, link);
        if (normalized) targets.add(normalized);
      }
    }
    // Also do raw path mention extraction for ALL referrer types
    for (const mention of extractRawPathMentions(content)) {
      targets.add(mention);
    }

    for (const target of targets) {
      if (graph[target] && referrerRel !== target) {
        graph[target].referencedBy.push(referrerRel);
        totalReferences += 1;
      }
    }
  }

  for (const doc of Object.keys(graph)) {
    graph[doc].referencedByCount = graph[doc].referencedBy.length;
  }

  const orphans = Object.keys(graph)
    .filter((d) => graph[d].referencedByCount === 0)
    .sort();

  const report = {
    scannedAt: new Date().toISOString(),
    totalDocs: allDocs.length,
    totalReferences,
    totalOrphans: orphans.length,
    orphans,
    graph,
  };

  const outAbs = path.join(REPO_ROOT, outputPath);
  const outDir = path.dirname(outAbs);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }
  if (orphansOnly) {
    const orphansReport = {
      scannedAt: report.scannedAt,
      totalDocs: report.totalDocs,
      totalOrphans: report.totalOrphans,
      orphans: orphans,
    };
    writeFileSync(outAbs, JSON.stringify(orphansReport, null, 2), "utf8");
  } else {
    writeFileSync(outAbs, JSON.stringify(report, null, 2), "utf8");
  }

  console.log(`\nReport written to ${outputPath}`);
  console.log(`Total docs: ${report.totalDocs}`);
  console.log(`Total references: ${report.totalReferences}`);
  console.log(`Total orphans (0 references): ${report.totalOrphans}`);
  if (orphans.length > 0) {
    console.log("\nFirst 10 orphans:");
    for (const o of orphans.slice(0, 10)) {
      console.log(`  - ${o}`);
    }
  }
}

main();
