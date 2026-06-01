#!/usr/bin/env tsx
/**
 * Public docs curation guard.
 *
 * `helm-public` is the public Core repository, not a broad source-repo mirror.
 * This guard keeps the public docs surface explicit: every file under `docs/`
 * must be named in `docs/public-docs-manifest.json`, and public entry docs may
 * only link to existing files that are either outside `docs/` or also allowed by
 * the manifest.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const MANIFEST_PATH = "docs/public-docs-manifest.json";

const ROOT_ENTRY_DOCS = [
  "README.md",
  "README.en.md",
  "AGENTS.md",
  "AGENTS.en.md",
  "CONTRIBUTING.md",
  "CONTRIBUTING.en.md",
  "SECURITY.md",
  "SECURITY.en.md",
  "GOVERNANCE.md",
  "GOVERNANCE.en.md",
];

export type PublicDocsCurationViolation = {
  readonly rule:
    | "docs:manifest-missing"
    | "docs:manifest-invalid"
    | "docs:unexpected-file"
    | "docs:missing-allowed-file"
    | "docs:broken-link"
    | "docs:unapproved-doc-link"
    | "docs:absolute-local-link";
  readonly path: string;
  readonly target?: string;
  readonly line?: number;
};

export type PublicDocsCurationResult = {
  readonly repoRoot: string;
  readonly allowedDocs: ReadonlyArray<string>;
  readonly actualDocs: ReadonlyArray<string>;
  readonly checkedLinkSources: ReadonlyArray<string>;
  readonly violations: ReadonlyArray<PublicDocsCurationViolation>;
  readonly exitCode: 0 | 1;
};

type Manifest = {
  readonly allowedDocs?: unknown;
};

function normalizeRelativePath(value: string): string {
  return value.split(path.sep).join("/");
}

function walkFiles(root: string, relativeDir: string): string[] {
  const absoluteDir = path.join(root, relativeDir);
  if (!existsSync(absoluteDir)) return [];

  const files: string[] = [];
  for (const entry of readdirSync(absoluteDir)) {
    const relativePath = path.posix.join(relativeDir, entry);
    const absolutePath = path.join(root, relativePath);
    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      files.push(...walkFiles(root, relativePath));
      continue;
    }
    if (stat.isFile()) files.push(relativePath);
  }
  return files.sort();
}

function readManifest(repoRoot: string): {
  allowedDocs: string[];
  violations: PublicDocsCurationViolation[];
} {
  const absoluteManifestPath = path.join(repoRoot, MANIFEST_PATH);
  if (!existsSync(absoluteManifestPath)) {
    return {
      allowedDocs: [],
      violations: [{ rule: "docs:manifest-missing", path: MANIFEST_PATH }],
    };
  }

  let parsed: Manifest;
  try {
    parsed = JSON.parse(readFileSync(absoluteManifestPath, "utf8")) as Manifest;
  } catch {
    return {
      allowedDocs: [],
      violations: [{ rule: "docs:manifest-invalid", path: MANIFEST_PATH }],
    };
  }

  if (
    !Array.isArray(parsed.allowedDocs) ||
    parsed.allowedDocs.some((item) => typeof item !== "string")
  ) {
    return {
      allowedDocs: [],
      violations: [{ rule: "docs:manifest-invalid", path: MANIFEST_PATH }],
    };
  }

  const allowedDocs = [...new Set(parsed.allowedDocs as string[])].sort();
  return { allowedDocs, violations: [] };
}

function lineNumberForIndex(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function stripAnchor(target: string): string {
  return target.split("#", 1)[0] ?? "";
}

function isExternalLink(target: string): boolean {
  return (
    /^[a-z][a-z0-9+.-]*:/i.test(target) ||
    target.startsWith("#") ||
    target.startsWith("mailto:")
  );
}

function resolveLocalLink(sourcePath: string, target: string): string {
  const targetWithoutAnchor = stripAnchor(target);
  if (!targetWithoutAnchor) return "";
  return normalizeRelativePath(
    path
      .normalize(path.join(path.dirname(sourcePath), targetWithoutAnchor))
      .replace(/^\.\//, ""),
  );
}

function collectLinkViolations(options: {
  readonly repoRoot: string;
  readonly sourcePath: string;
  readonly allowedDocs: ReadonlySet<string>;
}): PublicDocsCurationViolation[] {
  const absoluteSourcePath = path.join(options.repoRoot, options.sourcePath);
  if (!existsSync(absoluteSourcePath)) return [];

  const content = readFileSync(absoluteSourcePath, "utf8");
  const violations: PublicDocsCurationViolation[] = [];
  const linkPattern = /\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

  for (const match of content.matchAll(linkPattern)) {
    const rawTarget = match[1] ?? "";
    if (isExternalLink(rawTarget)) continue;
    if (/^\/Users\//.test(rawTarget) || /^file:\/\//i.test(rawTarget)) {
      violations.push({
        rule: "docs:absolute-local-link",
        path: options.sourcePath,
        target: rawTarget,
        line: lineNumberForIndex(content, match.index ?? 0),
      });
      continue;
    }
    if (rawTarget.startsWith("/")) {
      continue;
    }

    const resolved = resolveLocalLink(options.sourcePath, rawTarget);
    if (!resolved) continue;
    const absoluteTarget = path.join(options.repoRoot, resolved);
    if (!existsSync(absoluteTarget)) {
      violations.push({
        rule: "docs:broken-link",
        path: options.sourcePath,
        target: rawTarget,
        line: lineNumberForIndex(content, match.index ?? 0),
      });
      continue;
    }

    if (resolved.startsWith("docs/") && !options.allowedDocs.has(resolved)) {
      violations.push({
        rule: "docs:unapproved-doc-link",
        path: options.sourcePath,
        target: resolved,
        line: lineNumberForIndex(content, match.index ?? 0),
      });
    }
  }

  return violations;
}

export function runPublicDocsCurationCheck(options: {
  readonly repoRoot?: string;
} = {}): PublicDocsCurationResult {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const manifest = readManifest(repoRoot);
  const allowedDocs = manifest.allowedDocs;
  const allowedSet = new Set(allowedDocs);
  const actualDocs = walkFiles(repoRoot, "docs");
  const actualSet = new Set(actualDocs);
  const violations: PublicDocsCurationViolation[] = [...manifest.violations];

  for (const file of actualDocs) {
    if (!allowedSet.has(file)) {
      violations.push({ rule: "docs:unexpected-file", path: file });
    }
  }

  for (const file of allowedDocs) {
    if (!actualSet.has(file)) {
      violations.push({ rule: "docs:missing-allowed-file", path: file });
    }
  }

  const checkedLinkSources = [
    ...ROOT_ENTRY_DOCS.filter((file) => existsSync(path.join(repoRoot, file))),
    ...allowedDocs.filter((file) => file.endsWith(".md")),
  ].sort();

  for (const sourcePath of checkedLinkSources) {
    violations.push(
      ...collectLinkViolations({ repoRoot, sourcePath, allowedDocs: allowedSet }),
    );
  }

  return {
    repoRoot,
    allowedDocs,
    actualDocs,
    checkedLinkSources,
    violations,
    exitCode: violations.length === 0 ? 0 : 1,
  };
}

function main(): number {
  const result = runPublicDocsCurationCheck();
  if (result.exitCode === 0) {
    console.log(
      `public-docs-curation: PASS — ${result.actualDocs.length} docs allowed by ${MANIFEST_PATH}; checked ${result.checkedLinkSources.length} link source(s).`,
    );
    return 0;
  }

  console.error(
    `public-docs-curation: FAIL — ${result.violations.length} violation(s).`,
  );
  for (const violation of result.violations.slice(0, 80)) {
    const location = violation.line ? `${violation.path}:${violation.line}` : violation.path;
    const target = violation.target ? ` -> ${violation.target}` : "";
    console.error(`${location}: ${violation.rule}${target}`);
  }
  if (result.violations.length > 80) {
    console.error(`... ${result.violations.length - 80} more`);
  }
  return 1;
}

if (require.main === module) {
  process.exitCode = main();
}
