#!/usr/bin/env tsx
/**
 * Frozen-duplicate consistency guard.
 *
 * Some long literals are deliberately frozen into several files at once: the
 * public projection has to assert the exact command it will emit, a checker has
 * to assert the exact chain it will see, and the fixtures have to assert the
 * exact result. Each copy is load-bearing. None of them knows about the others.
 *
 * The failure mode is not that a copy is wrong — it is how you find out. Adding
 * one script to `check:boundaries` produced four separate red runs, each naming
 * one stale copy, each needing the slow aggregate gate re-run to reach the next:
 *
 *   public-mirror-smoke  -> package-json: not-projected
 *   caio-terminology     -> does not match the frozen boundary chain
 *   fixtures             -> 4 failed expectations
 *
 * One `grep` for the chain had listed all of them at once. This makes that grep
 * a gate: divergence is reported for every copy in a single run, so the work is
 * one edit pass instead of four discover-fix cycles.
 *
 * SCOPE. `check:boundaries` is not special — it is one row of a frozen table.
 * PUBLIC_PACKAGE_SCRIPT_OVERRIDES byte-copies dozens of package.json script
 * values, and the fixtures copy each of those again. So the watched set is
 * derived, not hand-listed: every package.json script value at least
 * MIN_WATCHED_LENGTH long. A hand-listed set would be one more frozen copy of
 * exactly the kind this guard exists to catch.
 *
 * WHY "equals ANY watched value" RATHER THAN "equals THE one it looks like".
 * Sibling scripts share long openings — `eval:operating-harness-p0` is a strict
 * prefix of `-p1`, and six such pairs exist. Attributing an occurrence to the
 * script whose prefix it matches would report p1's copies as stale p0 copies.
 * An occurrence is therefore clean when it equals any current value, and a
 * divergence only when it matches no current value at all. That still catches a
 * stale copy, which by construction equals nothing current.
 *
 * FAIL-CLOSED. Fewer occurrences than the floor throws, because "every copy
 * agrees" and "the scanner found nothing" are the same green otherwise. The
 * floor is a scanner sanity check, not a census: copies may legitimately be
 * added, and adding one is not a defect. Divergence is.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/** Below this, a value is too short to be a distinctive frozen literal. */
export const MIN_WATCHED_LENGTH = 80;
/** How much of a value identifies an occurrence of it, including stale ones. */
export const PREFIX_LENGTH = 60;
/** Below this many occurrences overall, assume the scanner broke. */
export const OCCURRENCE_FLOOR = 20;

export const SCAN_ROOTS = ["scripts", "lib"] as const;

/**
 * This guard and its test quote fragments in order to search for them, so they
 * would be found as truncated occurrences of the literals they look for.
 * Excluding them is not a hole: neither file emits any of these commands, and
 * the copies that matter are the ones the projection and the fixtures assert.
 */
export const SELF_EXCLUDED = [
  "scripts/check-frozen-duplicates.ts",
  "scripts/check-frozen-duplicates.test.ts",
] as const;

export type Occurrence = Readonly<{ file: string; line: number; value: string }>;

export type FrozenDuplicateReport = Readonly<{
  watchedCount: number;
  occurrences: readonly Occurrence[];
  diverging: readonly Occurrence[];
}>;

/** Every package.json script value, which together are the source of truth. */
export function allScriptValues(repoRoot: string): string[] {
  const manifest = JSON.parse(
    readFileSync(path.join(repoRoot, "package.json"), "utf8"),
  ) as { scripts?: Record<string, string> };
  const scripts = manifest.scripts;
  if (!scripts || Object.keys(scripts).length === 0) {
    throw new Error("package.json declares no scripts to take as source of truth");
  }
  return [
    ...new Set(
      Object.values(scripts).filter((value) => typeof value === "string"),
    ),
  ];
}

/**
 * The values long enough to search for. The length threshold decides which
 * PREFIXES are worth scanning, and nothing else: a short script can share a
 * long opening with a watched one — `check:public-release` is 76 characters and
 * opens exactly like a longer sibling — so it is found as an occurrence while
 * being perfectly current. Judging such a hit against the watched subset
 * reports it as stale. Correctness therefore comes from comparing every hit
 * against ALL script values, not against the ones we chose to search for.
 */
export function watchedValues(repoRoot: string): string[] {
  return allScriptValues(repoRoot).filter(
    (value) => value.length >= MIN_WATCHED_LENGTH,
  );
}

function listFiles(repoRoot: string, root: string): string[] {
  const absolute = path.join(repoRoot, root);
  let entries: string[];
  try {
    entries = readdirSync(absolute);
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const relative = path.posix.join(root, entry);
    const full = path.join(repoRoot, relative);
    let stats;
    try {
      stats = statSync(full);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      files.push(...listFiles(repoRoot, relative));
    } else if (/\.(ts|tsx|mjs|json)$/u.test(entry)) {
      files.push(relative);
    }
  }
  return files;
}

/** Every double-quoted string that begins with one of `prefixes`. */
export function findOccurrences(
  source: string,
  prefixes: readonly string[],
  file: string,
): Occurrence[] {
  const found: Occurrence[] = [];
  for (const prefix of prefixes) {
    if (!source.includes(prefix)) continue;
    // The watched values contain no double quote, so the closing quote is the
    // next one. A value that grows a quote stops matching, which the floor
    // catches rather than passing silently.
    const pattern = new RegExp(
      `"(${prefix.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}[^"]*)"`,
      "gu",
    );
    for (const match of source.matchAll(pattern)) {
      const line = source.slice(0, match.index ?? 0).split("\n").length;
      found.push({ file, line, value: match[1] });
    }
  }
  return found;
}

export function checkFrozenDuplicates(
  repoRoot: string = process.cwd(),
  { floor = OCCURRENCE_FLOOR }: { floor?: number } = {},
): FrozenDuplicateReport {
  const watched = watchedValues(repoRoot);
  const current = new Set(allScriptValues(repoRoot));
  const prefixes = [
    ...new Set(watched.map((value) => value.slice(0, PREFIX_LENGTH))),
  ];

  const files = [
    "package.json",
    ...SCAN_ROOTS.flatMap((root) => listFiles(repoRoot, root)),
  ].filter((file) => !SELF_EXCLUDED.includes(file as never));

  const seen = new Set<string>();
  const occurrences: Occurrence[] = [];
  for (const file of files) {
    const source = readFileSync(path.join(repoRoot, file), "utf8");
    for (const entry of findOccurrences(source, prefixes, file)) {
      // Sibling prefixes overlap, so one literal can be found more than once.
      const key = `${entry.file}:${entry.line}:${entry.value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      occurrences.push(entry);
    }
  }

  if (occurrences.length < floor) {
    throw new Error(
      `found only ${occurrences.length} occurrence(s) across ${watched.length} watched value(s), below the floor of ${floor}; the scanner is broken, not the repository`,
    );
  }

  return {
    watchedCount: watched.length,
    occurrences,
    diverging: occurrences.filter((entry) => !current.has(entry.value)),
  };
}

export function main(repoRoot: string = process.cwd()): number {
  const report = checkFrozenDuplicates(repoRoot);
  if (report.diverging.length === 0) {
    console.log(
      `frozen-duplicates: ${report.occurrences.length} copies of ${report.watchedCount} watched package.json script value(s), all current`,
    );
    return 0;
  }
  console.error(
    `frozen-duplicates: ${report.diverging.length} of ${report.occurrences.length} copies match no current package.json script value:`,
  );
  for (const entry of report.diverging) {
    console.error(`  - ${entry.file}:${entry.line}`);
    console.error(`      ${entry.value.slice(0, 110)}`);
  }
  console.error(
    "  every copy above must be updated in the same change; they are listed together so this takes one pass",
  );
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main();
}
