// check:caio-goal-ledger — structural gate for the CAIO goal ledger write path.
//   1. The write service and its controlled CLI entry are reached, directly or through other modules, only from the
//      files listed in WRITE_PATH_IMPORTERS: the CLI, the entry itself and their tests. Nothing under app/, no
//      actions module and no "use server" module may reach either. Every source file is scanned, type-only imports
//      included, except node_modules and, at the root only (as .gitignore has them), dot directories and build output.
//   2. lib/caio-goal-ledger has no index file, so nothing can reach the write service through a barrel.
//   3. lib/caio-goal-ledger never imports lib/caio-governance.
//   4. The read service holds no write call.
// The guard is a code-review aid: the actorUserId the CLI writes with is declared, not authenticated, and the
// database grants and the in-transaction owner re-check stay the enforcing layers.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const WRITE_ENTRIES = ["lib/caio-goal-ledger/write.service.ts", "lib/caio-operator/goal-ledger-operator.ts"];
const WRITE_PATH_IMPORTERS = [
  "lib/caio-goal-ledger/store.mysql.test.ts",
  "lib/caio-goal-ledger/write.service.test.ts",
  "lib/caio-operator/goal-ledger-operator.test.ts",
  "lib/caio-operator/goal-ledger-operator.ts",
  "scripts/caio-goal-ledger.ts",
];
const SOURCE = /\.(?:[cm]?ts|tsx|[cm]?js|jsx)$/u;
const ROOT_SKIPPED_DIRS = new Set(["coverage", "test-results", "playwright-report", "out", "build", "tmp"]);
const RESOLVE_SUFFIXES = ["", ".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", "/index.ts", "/index.tsx", "/index.js"];

function sourceFiles(relativeDir = ""): string[] {
  return readdirSync(path.join(root, relativeDir)).flatMap((name) => {
    const relative = path.posix.join(relativeDir, name);
    if (statSync(path.join(root, relative)).isDirectory()) {
      const skipped = name === "node_modules" || (relativeDir === "" && (name.startsWith(".") || ROOT_SKIPPED_DIRS.has(name)));
      return skipped ? [] : sourceFiles(relative);
    }
    return SOURCE.test(name) ? [relative] : [];
  });
}

/** Static, type-only, export-from, dynamic import() and require() specifiers; comments and strings are not imports. */
function importSpecifiers(text: string): string[] {
  return ts.preProcessFile(text, true, true).importedFiles.map((file) => file.fileName);
}

/** The repo file a relative or `@/` specifier names, or null for a package or a path that does not exist. */
function resolveSpecifier(from: string, specifier: string): string | null {
  const base = specifier.startsWith("@/") ? specifier.slice(2)
    : specifier.startsWith(".") ? path.posix.join(path.posix.dirname(from), specifier) : null;
  if (base === null) return null;
  // TypeScript also resolves a `.js` specifier to the `.ts` source beside it.
  const hit = [base, base.replace(/\.[cm]?jsx?$/u, "")].flatMap((stem) => RESOLVE_SUFFIXES.map((suffix) => `${stem}${suffix}`))
    .find((candidate) => existsSync(path.join(root, candidate)) && statSync(path.join(root, candidate)).isFile());
  return hit ?? null;
}

const files = sourceFiles();
const texts = new Map(files.map((file) => [file, readFileSync(path.join(root, file), "utf8")]));
const importsOf = new Map(files.map((file) => [file,
  importSpecifiers(texts.get(file)!).flatMap((specifier) => resolveSpecifier(file, specifier) ?? [])]));

/** Every file that reaches one of `targets` through any chain of imports. */
function importersReaching(targets: readonly string[]): string[] {
  const reached = new Set<string>();
  let frontier = new Set(targets);
  while (frontier.size > 0) {
    const next = new Set<string>();
    for (const [file, imports] of importsOf) {
      if (!reached.has(file) && imports.some((target) => frontier.has(target))) next.add(file);
    }
    for (const file of next) reached.add(file);
    frontier = next;
  }
  return [...reached].sort();
}

describe("check:caio-goal-ledger", () => {
  it("reads every kind of import specifier and nothing else", () => {
    const text = [
      'import { a } from "@/lib/x";', 'import type { B } from "./y";', 'export { c } from "../z";', 'import "side-effect";',
      'const d = await import("@/lib/dynamic");', 'const e = require("./required");', "// import { f } from \"@/lib/comment\";",
      'const g = "import { h } from \'@/lib/string\'";',
    ].join("\n");
    expect(importSpecifiers(text).sort()).toEqual(["../z", "./required", "./y", "@/lib/dynamic", "@/lib/x", "side-effect"]);
    expect(resolveSpecifier("scripts/a.ts", "@/lib/caio-goal-ledger/write.service")).toBe(WRITE_ENTRIES[0]);
    expect(resolveSpecifier("lib/caio-operator/a.ts", "../caio-goal-ledger/write.service")).toBe(WRITE_ENTRIES[0]);
    expect(resolveSpecifier("app/a/page.tsx", "@/lib/caio-goal-ledger/write.service.js")).toBe(WRITE_ENTRIES[0]);
    expect(resolveSpecifier("scripts/a.ts", "zod")).toBeNull();
  });

  it("scans the whole source tree", () => {
    expect(files).toEqual(expect.arrayContaining([...WRITE_ENTRIES, ...WRITE_PATH_IMPORTERS, "app/layout.tsx"]));
    expect(files.some((file) => file.startsWith("node_modules/"))).toBe(false);
  });

  it("reaches the write path only from the controlled CLI and the tests", () => {
    const reaching = importersReaching(WRITE_ENTRIES);
    expect(reaching).toEqual(WRITE_PATH_IMPORTERS);
    for (const file of reaching) {
      expect(file.startsWith("app/"), file).toBe(false);
      expect(/(^|[/.-])actions?([/.-]|$)/u.test(file), file).toBe(false);
      expect(/^\s*["']use server["']/mu.test(texts.get(file)!), file).toBe(false);
    }
  });

  it("has no barrel, no governance import and no write in the read service", () => {
    const moduleFiles = files.filter((file) => file.startsWith("lib/caio-goal-ledger/"));
    expect(moduleFiles.filter((file) => /\/index\.[a-z]+$/u.test(file))).toEqual([]);
    const governance = moduleFiles.filter((file) => importsOf.get(file)!.some((target) => target.startsWith("lib/caio-governance/")));
    expect(governance).toEqual([]);
    const read = texts.get("lib/caio-goal-ledger/read.service.ts")!;
    expect(read).not.toMatch(/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(|\$execute|writeTransaction/u);
  });
});
