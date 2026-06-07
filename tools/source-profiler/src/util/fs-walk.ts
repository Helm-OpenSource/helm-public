/**
 * Source Profiler — scope-enforced file enumeration.
 *
 * Walks a source root, honoring the ScopeManifest include/exclude prefixes, an
 * optional .gitignore merge, a max file size, and binary detection. Returns the
 * readable files plus a record of everything skipped and why.
 *
 * gitignore handling is a pragmatic subset (segment / prefix / trailing-slash
 * directory match), not full git semantics — documented and good enough for a
 * read-only structural profile.
 */

import { readdirSync, readFileSync, statSync, existsSync, type Dirent } from "node:fs";
import path from "node:path";
import type { ScopeManifest } from "../contract/scope-manifest";
import type { SkippedFile } from "../contract/code-scan";

export type WalkResult = {
  /** POSIX-relative paths (to root) of files safe to read. */
  files: string[];
  skipped: SkippedFile[];
  /** Total files encountered (read + skipped). */
  total: number;
};

export type WalkOptions = {
  /** Absolute path of the scan root. */
  rootAbs: string;
  manifest: ScopeManifest;
};

export function enumerateFiles({ rootAbs, manifest }: WalkOptions): WalkResult {
  const excludePrefixes = normalizePrefixes(manifest.exclude);
  const includePrefixes = normalizePrefixes(manifest.include);
  const gitignore = manifest.respectGitignore
    ? loadGitignore(rootAbs)
    : [];

  const files: string[] = [];
  const skipped: SkippedFile[] = [];
  let total = 0;

  const stack: string[] = [rootAbs];
  while (stack.length > 0) {
    const dirAbs = stack.pop() as string;
    let entries: Dirent[];
    try {
      entries = readdirSync(dirAbs, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const childAbs = path.join(dirAbs, entry.name);
      const rel = toPosix(path.relative(rootAbs, childAbs));
      if (entry.isDirectory()) {
        if (isExcluded(`${rel}/`, excludePrefixes, gitignore)) continue;
        stack.push(childAbs);
        continue;
      }
      if (!entry.isFile()) continue;
      total++;

      if (isExcluded(rel, excludePrefixes, gitignore)) {
        skipped.push({ path: rel, reason: matchReason(rel, excludePrefixes) });
        continue;
      }
      if (includePrefixes.length > 0 && !includePrefixes.some((p) => rel.startsWith(p))) {
        skipped.push({ path: rel, reason: "excluded" });
        continue;
      }

      let size = 0;
      try {
        size = statSync(childAbs).size;
      } catch {
        skipped.push({ path: rel, reason: "unreadable" });
        continue;
      }
      if (size > manifest.maxFileSizeBytes) {
        skipped.push({ path: rel, reason: "too_large" });
        continue;
      }
      if (manifest.skipBinary && isBinary(childAbs)) {
        skipped.push({ path: rel, reason: "binary" });
        continue;
      }
      files.push(rel);
    }
  }

  files.sort();
  skipped.sort((a, b) => a.path.localeCompare(b.path));
  return { files, skipped, total };
}

export function readTextFile(rootAbs: string, rel: string): string {
  return readFileSync(path.join(rootAbs, rel), "utf8");
}

function isBinary(absPath: string): boolean {
  try {
    const sample = readFileSync(absPath).subarray(0, 8000);
    return sample.includes(0);
  } catch {
    return true;
  }
}

function normalizePrefixes(prefixes: readonly string[]): string[] {
  return prefixes.map((p) => toPosix(p).replace(/^\.\//, "")).filter(Boolean);
}

function isExcluded(
  rel: string,
  excludePrefixes: readonly string[],
  gitignore: readonly string[],
): boolean {
  if (excludePrefixes.some((p) => rel === p || rel.startsWith(p))) return true;
  return gitignore.some((g) => matchesGitignore(rel, g));
}

function matchReason(rel: string, excludePrefixes: readonly string[]): SkippedFile["reason"] {
  return excludePrefixes.some((p) => rel === p || rel.startsWith(p))
    ? "excluded"
    : "gitignored";
}

function matchesGitignore(rel: string, pattern: string): boolean {
  if (pattern.endsWith("/")) {
    const dir = pattern.slice(0, -1);
    return rel === dir || rel.startsWith(`${dir}/`) || rel.split("/").includes(dir);
  }
  // Bare name: match any path segment; prefix: match from root.
  if (!pattern.includes("/")) {
    return rel.split("/").includes(pattern) || rel === pattern;
  }
  return rel === pattern || rel.startsWith(`${pattern}/`);
}

function loadGitignore(rootAbs: string): string[] {
  const file = path.join(rootAbs, ".gitignore");
  if (!existsSync(file)) return [];
  try {
    return readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && !l.startsWith("!"))
      .map((l) => l.replace(/^\//, ""));
  } catch {
    return [];
  }
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}
