#!/usr/bin/env tsx
/**
 * Conditional-update compare-and-swap guard.
 *
 * On MySQL, Prisma compiles a conditional `updateMany` into two statements:
 *
 *   SELECT `id` FROM `T` WHERE <predicate>
 *   UPDATE `T` SET ... WHERE `id` IN (?) AND 1=1
 *
 * The predicate is evaluated at READ time and dropped from the write, so the
 * affected-row count proves only that the row still exists — never that it was
 * still in the expected state. Reading that count as a compare-and-swap result
 * is therefore unsound: two concurrent callers both select the row and both
 * write. Measured on mysql:8.4, six concurrent claims passed a limit of three
 * and two concurrent adoptions of one record both succeeded.
 *
 * MariaDB can mask this: it raises error 1020 on the racing id-update, and a
 * retry helper that swallows 1020 serialises the callers by accident. Passing
 * tests on MariaDB are not evidence that the invariant holds.
 *
 * This guard flags a conditional `updateMany` whose `where` carries a STATE
 * predicate (not just a primary key) and whose result count is then compared
 * against a number, unless the call is inside a transaction — an explicit
 * `$transaction` at a serialisable isolation level does hold the row across
 * the split.
 *
 * The sound alternatives are: one atomic `$executeRaw` UPDATE whose own WHERE
 * carries the pre-state, or a serialisable transaction that also takes an
 * explicit lock.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Known pre-existing sites, recorded so this guard blocks NEW occurrences
 * without forcing an out-of-scope refactor of already-merged code. A baselined
 * entry is a known defect awaiting its own slice — never a statement that the
 * site is safe. Removing a line from the baseline is the only supported way to
 * shrink it; the guard fails if a baselined file disappears, so a fix must be
 * accompanied by its removal.
 */
const BASELINE_PATH = "scripts/conditional-update-cas-baseline.json";

export type ConditionalUpdateCasViolation = {
  file: string;
  line: number;
  statePredicates: readonly string[];
  detail: string;
};

const SCAN_ROOTS = ["lib", "features", "app", "scripts"] as const;
const SOURCE_FILE = /\.[cm]?tsx?$/u;
const TEST_FILE = /\.(?:test|spec)\.[cm]?tsx?$/u;
const SELF = "scripts/check-conditional-update-cas.ts";

/**
 * Fields whose presence in a `where` means the caller is asserting a
 * PRE-STATE, i.e. expressing a compare-and-swap rather than addressing a row.
 */
const STATE_PREDICATE_FIELDS = [
  "status",
  "state",
  "revokedAt",
  "deletedAt",
  "claimedAt",
  "consumedAt",
  "usedAt",
  "acceptedAt",
  "approvedAt",
  "completedAt",
  "processedAt",
  "verifiedAt",
  "supersededAt",
  "rotatedAt",
  "expiredAt",
  "adoptedByRef",
  "dispatchClaimedAt",
] as const;

const UPDATE_MANY = /(?:const|let)\s+(\w+)\s*=\s*await\s+[^;]*?\.updateMany\(/gu;
const COUNT_COMPARISON = (variable: string) =>
  new RegExp(String.raw`\b${variable}\.count\s*(?:!==|===|<|>|>=|<=)\s*\d`, "u");
const FUNCTION_BOUNDARY =
  /^(?:export\s+)?(?:async\s+)?function\s|^\s{0,4}async\s+\w+\(|^export\s+const\s+\w+\s*=/u;

function listFiles(root: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".next") continue;
    const absolute = path.join(root, entry);
    if (statSync(absolute).isDirectory()) {
      files.push(...listFiles(absolute));
    } else if (SOURCE_FILE.test(entry) && !TEST_FILE.test(entry)) {
      files.push(absolute);
    }
  }
  return files;
}

function withinTransaction(lines: string[], index: number): boolean {
  for (let cursor = index; cursor >= 0 && cursor > index - 400; cursor -= 1) {
    const line = lines[cursor] ?? "";
    if (line.includes("$transaction")) return true;
    if (cursor < index - 2 && FUNCTION_BOUNDARY.test(line)) return false;
  }
  return false;
}

function statePredicatesIn(whereClause: string): string[] {
  return STATE_PREDICATE_FIELDS.filter((field) =>
    new RegExp(String.raw`\b${field}\s*:`, "u").test(whereClause),
  );
}

function readBaseline(repoRoot: string): ReadonlySet<string> {
  try {
    const parsed: unknown = JSON.parse(
      readFileSync(path.join(repoRoot, BASELINE_PATH), "utf8"),
    );
    const entries =
      typeof parsed === "object" && parsed !== null && "entries" in parsed
        ? (parsed as { entries?: unknown }).entries
        : undefined;
    if (!Array.isArray(entries)) return new Set();
    return new Set(
      entries
        .map((entry) =>
          typeof entry === "object" && entry !== null && "file" in entry
            ? String((entry as { file?: unknown }).file ?? "")
            : "",
        )
        .filter(Boolean),
    );
  } catch {
    return new Set();
  }
}

export function checkConditionalUpdateCas(
  repoRoot: string = process.cwd(),
  options: { readonly ignoreBaseline?: boolean } = {},
): ConditionalUpdateCasViolation[] {
  const baseline = options.ignoreBaseline
    ? new Set<string>()
    : readBaseline(repoRoot);
  const violations: ConditionalUpdateCasViolation[] = [];
  for (const root of SCAN_ROOTS) {
    for (const absolute of listFiles(path.join(repoRoot, root))) {
      const relative = path
        .relative(repoRoot, absolute)
        .split(path.sep)
        .join("/");
      if (relative === SELF) continue;
      const content = readFileSync(absolute, "utf8");
      if (!content.includes(".updateMany(")) continue;
      const lines = content.split("\n");
      for (const match of content.matchAll(UPDATE_MANY)) {
        const variable = match[1];
        if (!variable) continue;
        const tail = content.slice(match.index ?? 0, (match.index ?? 0) + 1200);
        if (!COUNT_COMPARISON(variable).test(tail)) continue;
        const whereStart = tail.indexOf("where:");
        if (whereStart < 0) continue;
        const whereClause = tail.slice(whereStart).split("data:")[0] ?? "";
        const statePredicates = statePredicatesIn(whereClause);
        if (statePredicates.length === 0) continue;
        const line = content.slice(0, match.index ?? 0).split("\n").length;
        if (withinTransaction(lines, line - 1)) continue;
        if (baseline.has(relative)) continue;
        violations.push({
          file: relative,
          line,
          statePredicates,
          detail:
            `\`${variable}.count\` is read as a compare-and-swap result, but the ` +
            `where carries the pre-state (${statePredicates.join(", ")}) and the ` +
            "call is not inside a transaction. On MySQL the predicate is dropped " +
            "from the write, so the count cannot prove the state was unchanged.",
        });
      }
    }
  }
  return violations;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const violations = checkConditionalUpdateCas();
  const baselined = checkConditionalUpdateCas(process.cwd(), {
    ignoreBaseline: true,
  }).length;
  if (violations.length === 0) {
    console.log(
      `conditional-update-cas: PASS - no NEW untransacted conditional updateMany is read as a compare-and-swap; ${baselined} known pre-existing site(s) remain recorded in ${BASELINE_PATH} and are unfixed; this is a concurrency-shape statement, not a proof of production correctness`,
    );
  } else {
    console.error(
      `conditional-update-cas: FAIL - ${violations.length} violation(s)`,
    );
    for (const violation of violations) {
      console.error(`- ${violation.file}:${violation.line} ${violation.detail}`);
    }
    process.exitCode = 1;
  }
}
