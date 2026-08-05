import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  allScriptValues,
  checkFrozenDuplicates,
  findOccurrences,
  MIN_WATCHED_LENGTH,
  SELF_EXCLUDED,
  watchedValues,
} from "./check-frozen-duplicates";

/** A literal long enough to be watched, distinctive enough not to collide. */
const LONG = "npm run frozen-fixture-alpha && npm run frozen-fixture-beta && npm run frozen-fixture-gamma";

/**
 * A throwaway repository, so the defect cases run against a tree this test
 * controls rather than against the real one.
 */
function fixtureRepo(
  scripts: Readonly<Record<string, string>>,
  files: Readonly<Record<string, string>> = {},
): string {
  const root = mkdtempSync(path.join(tmpdir(), "frozen-dup-"));
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ scripts }, null, 2));
  for (const [file, contents] of Object.entries(files)) {
    const full = path.join(root, file);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, contents);
  }
  return root;
}

describe("frozen duplicate consistency", () => {
  it("every copy in this repository matches a current package.json script", () => {
    const report = checkFrozenDuplicates(process.cwd());
    expect(
      report.diverging.map((entry) => `${entry.file}:${entry.line}`),
    ).toEqual([]);
  });

  it("is actually finding the copies, not passing on an empty scan", () => {
    // CONTROL. "all copies are current" and "no copies found" are the same
    // green. This repository freezes these values into the projection and the
    // fixtures, so the counts must be substantial and spread across files.
    const report = checkFrozenDuplicates(process.cwd());
    expect(report.watchedCount).toBeGreaterThanOrEqual(20);
    expect(report.occurrences.length).toBeGreaterThanOrEqual(50);
    const files = new Set(report.occurrences.map((entry) => entry.file));
    expect(files.has("package.json")).toBe(true);
    expect(files.size).toBeGreaterThanOrEqual(4);
  });

  it("watches only the long values, but judges against all of them", () => {
    const all = allScriptValues(process.cwd());
    const watched = watchedValues(process.cwd());
    expect(watched.length).toBeLessThan(all.length);
    expect(watched.every((value) => value.length >= MIN_WATCHED_LENGTH)).toBe(true);
  });

  it("reports every diverging copy in one run, which is the point", () => {
    const stale = `${LONG.slice(0, 70)} && npm run gone`;
    const root = fixtureRepo(
      { boundaries: LONG },
      {
        "scripts/a.ts": `const a = "${stale}";\n`,
        "lib/b.ts": `const b = "${stale}";\n`,
        "lib/c.ts": `const c = "${LONG}";\n`,
      },
    );
    const report = checkFrozenDuplicates(root, { floor: 1 });
    expect(report.diverging.map((entry) => entry.file).sort()).toEqual([
      "lib/b.ts",
      "scripts/a.ts",
    ]);
    // Four discover-fix cycles collapse into one only if BOTH are named at once.
    expect(report.diverging).toHaveLength(2);
  });

  it("compares copies that were edited in place, rather than losing them", () => {
    // A stale copy still opens like the current one, so it is still found and
    // still judged. If matching required the whole literal, a stale copy would
    // silently stop being an occurrence — passing by disappearing.
    const root = fixtureRepo(
      { boundaries: `${LONG} && npm run added` },
      { "scripts/a.ts": `const a = "${LONG}";\n` },
    );
    const report = checkFrozenDuplicates(root, { floor: 1 });
    expect(report.diverging).toHaveLength(1);
    expect(report.diverging[0]?.value).toBe(LONG);
  });

  it("passes when every copy is current", () => {
    // CONTROL for the two cases above: the same shape with nothing wrong must
    // be clean, or they would also hold for a guard that always reports.
    const root = fixtureRepo(
      { boundaries: LONG },
      { "scripts/a.ts": `const a = "${LONG}";\n`, "lib/b.ts": `const b = "${LONG}";\n` },
    );
    expect(checkFrozenDuplicates(root, { floor: 1 }).diverging).toEqual([]);
  });

  describe("values that share a long opening", () => {
    it("does not report a sibling whose value is a prefix of another", () => {
      // `eval:operating-harness-p0` is a strict prefix of `-p1`, and six such
      // pairs exist here. Attributing a hit to the value whose prefix it
      // matches would report p1's copies as stale p0 copies.
      const p0 = LONG;
      const p1 = `${LONG} && npm run frozen-fixture-delta`;
      const root = fixtureRepo(
        { p0, p1 },
        { "scripts/a.ts": `const a = "${p0}";\nconst b = "${p1}";\n` },
      );
      expect(checkFrozenDuplicates(root, { floor: 1 }).diverging).toEqual([]);
    });

    it("does not report a SHORT script that opens like a watched one", () => {
      // Found the honest way: check:public-release is 76 characters, under the
      // watch threshold, and opens exactly like a longer sibling. Judging hits
      // against the watched subset reported all seven of its copies as stale,
      // including the one in package.json itself.
      const short = "npm run check:public-docs && node --import tsx scripts/x.ts";
      const long = `${short} --strict --and-more-to-pass-the-length-threshold`;
      expect(short.length).toBeLessThan(MIN_WATCHED_LENGTH);
      expect(long.length).toBeGreaterThanOrEqual(MIN_WATCHED_LENGTH);
      const root = fixtureRepo(
        { "check:short": short, "check:long": long },
        { "scripts/a.ts": `const a = "${short}";\n` },
      );
      expect(checkFrozenDuplicates(root, { floor: 1 }).diverging).toEqual([]);
    });
  });

  it("excludes only itself and its own test", () => {
    // The exclusion is a real hole if it grows. Hold it to exactly two files.
    expect([...SELF_EXCLUDED]).toEqual([
      "scripts/check-frozen-duplicates.ts",
      "scripts/check-frozen-duplicates.test.ts",
    ]);
  });

  describe("fail-closed", () => {
    it("throws below the floor instead of reporting all-current", () => {
      const root = fixtureRepo({ boundaries: LONG });
      expect(() => checkFrozenDuplicates(root)).toThrow(/below the floor of/u);
    });

    it("throws when package.json declares no scripts", () => {
      const root = mkdtempSync(path.join(tmpdir(), "frozen-dup-"));
      writeFileSync(path.join(root, "package.json"), JSON.stringify({}));
      expect(() => checkFrozenDuplicates(root, { floor: 1 })).toThrow(
        /declares no scripts/u,
      );
    });
  });

  describe("the occurrence scanner", () => {
    it("reads to the closing quote and reports the line", () => {
      const found = findOccurrences(`x\nconst a = "${LONG}";\n`, [LONG.slice(0, 60)], "f.ts");
      expect(found).toHaveLength(1);
      expect(found[0]?.line).toBe(2);
      expect(found[0]?.value).toBe(LONG);
    });

    it("does not match a string that merely contains the prefix later", () => {
      expect(
        findOccurrences(`"prefixed by ${LONG}"`, [LONG.slice(0, 60)], "f.ts"),
      ).toEqual([]);
    });
  });
});
