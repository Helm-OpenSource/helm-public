import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  checkDecisionLoopGaps,
  productionReferences,
  RECORDED_REACHABLE,
  RECORDED_PRODUCERS,
  RECORDED_UNREACHABLE,
  REGISTER_PATH,
  wordBoundaryRegExp,
} from "./check-decision-loop-gaps";

/** A throwaway repository shaped like the claims this guard makes. */
function fixtureRepo(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), "gap-register-"));
  for (const [file, contents] of Object.entries(files)) {
    const full = path.join(root, file);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, contents);
  }
  return root;
}

describe("decision loop gap register", () => {
  it("matches this repository as written", () => {
    expect(checkDecisionLoopGaps(process.cwd())).toEqual([]);
  });

  it("is checking a register that exists and records both open and closed items", () => {
    // CONTROL. An empty finding list is what "no gaps" looks like AND what a
    // guard that checks nothing looks like. Only one of them is evidence.
    expect(RECORDED_UNREACHABLE.length).toBeGreaterThanOrEqual(1);
    expect(RECORDED_PRODUCERS.length).toBeGreaterThanOrEqual(1);
    expect(RECORDED_REACHABLE.length).toBeGreaterThanOrEqual(4);
    expect(REGISTER_PATH).toMatch(/\.md$/u);
  });

  describe("a gap that closes must be reported, not silently kept", () => {
    it("reports a recorded-unreachable symbol that gained a caller", () => {
      const entry = RECORDED_UNREACHABLE[0];
      const root = fixtureRepo({
        ...Object.fromEntries(
          RECORDED_UNREACHABLE.map((e) => [e.definedIn, `export function ${e.symbol}() {}\n`]),
        ),
        "lib/caller.ts": `import { ${entry.symbol} } from "x";\n`,
        "lib/producer/writer.ts": `await tx.${RECORDED_PRODUCERS[0].write}({});\n`,
        "prisma/schema.prisma": "",
        [REGISTER_PATH]: "# register\n",
        ...Object.fromEntries(
          RECORDED_REACHABLE.map((fact) => [fact.file, `${fact.needle}\n`]),
        ),
      });
      const findings = checkDecisionLoopGaps(root);
      expect(findings).toHaveLength(1);
      expect(findings[0]?.gap).toBe(entry.gap);
      expect(findings[0]?.detail).toContain("lib/caller.ts");
      expect(findings[0]?.detail).toContain("update");
    });

    it("does not count the definition file or tests as callers", () => {
      // The distinction the whole register is about: a test exercising a
      // function proves it works, it does not put it on a path anything runs.
      const entry = RECORDED_UNREACHABLE[0];
      const root = fixtureRepo({
        ...Object.fromEntries(
          RECORDED_UNREACHABLE.map((e) => [e.definedIn, `export function ${e.symbol}() {}\n`]),
        ),
        "lib/stage1-owner-loop/thing.test.ts": `import { ${entry.symbol} } from "x";\n`,
        "lib/producer/writer.ts": `await tx.${RECORDED_PRODUCERS[0].write}({});\n`,
        "prisma/schema.prisma": "",
        [REGISTER_PATH]: "# register\n",
        ...Object.fromEntries(
          RECORDED_REACHABLE.map((fact) => [fact.file, `${fact.needle}\n`]),
        ),
      });
      expect(checkDecisionLoopGaps(root)).toEqual([]);
      expect(productionReferences(root, entry.symbol, entry.definedIn)).toEqual([]);
    });

    it("reports a Prisma model the register says is absent", () => {
      const root = fixtureRepo({
        ...Object.fromEntries(
          RECORDED_UNREACHABLE.map((e) => [e.definedIn, `export function ${e.symbol}() {}\n`]),
        ),
        "lib/producer/writer.ts": `await tx.${RECORDED_PRODUCERS[0].write}({});\n`,
        "prisma/schema.prisma": "model KnowledgeCard {\n  id String @id\n}\n",
        [REGISTER_PATH]: "# register\n",
        ...Object.fromEntries(
          RECORDED_REACHABLE.map((fact) => [fact.file, `${fact.needle}\n`]),
        ),
      });
      const findings = checkDecisionLoopGaps(root);
      expect(findings).toHaveLength(1);
      expect(findings[0]?.gap).toBe("GAP-3");
    });
  });

  describe("the closed-loop controls", () => {
    it("fails when a recorded-closed fact stops being true", () => {
      const [fact] = RECORDED_REACHABLE;
      const root = fixtureRepo({
        ...Object.fromEntries(
          RECORDED_UNREACHABLE.map((e) => [e.definedIn, `export function ${e.symbol}() {}\n`]),
        ),
        "lib/producer/writer.ts": `await tx.${RECORDED_PRODUCERS[0].write}({});\n`,
        "prisma/schema.prisma": "",
        [REGISTER_PATH]: "# register\n",
        ...Object.fromEntries(
          RECORDED_REACHABLE.map((f) => [f.file, f === fact ? "gone\n" : `${f.needle}\n`]),
        ),
      });
      const findings = checkDecisionLoopGaps(root);
      expect(findings).toHaveLength(1);
      expect(findings[0]?.gap).toBe("control");
      expect(findings[0]?.detail).toContain(fact.file);
    });

    it("matches on a word boundary, so a rename cannot survive the check", () => {
      // Found by mutation: `includes("Stage1DecisionQueue")` is still satisfied
      // by `Stage1DecisionQueueX`, which made this control nearly unbreakable.
      // A control that cannot fail is not a control.
      expect(wordBoundaryRegExp("Stage1DecisionQueue").test("<Stage1DecisionQueue />")).toBe(true);
      expect(wordBoundaryRegExp("Stage1DecisionQueue").test("<Stage1DecisionQueueX />")).toBe(false);
      expect(wordBoundaryRegExp("decisionRecord.create").test("tx.decisionRecord.create({")).toBe(true);
      expect(wordBoundaryRegExp("decisionRecord.create").test("tx.decisionRecord.created")).toBe(false);
    });
  });

  it("reports a producer the register says exists but that is gone", () => {
    // GAP-1 was first recorded as "this symbol has no caller". Closing it
    // through a different in-transaction path left that proxy true while the
    // gap was shut, and the guard reported OK. It now asserts the property
    // itself — that something writes the row — so it fails in both directions.
    const [producer] = RECORDED_PRODUCERS;
    const root = fixtureRepo({
      ...Object.fromEntries(
        RECORDED_UNREACHABLE.map((e) => [e.definedIn, `export function ${e.symbol}() {}\n`]),
      ),
      "prisma/schema.prisma": "",
      [REGISTER_PATH]: "# register\n",
      ...Object.fromEntries(RECORDED_REACHABLE.map((f) => [f.file, `${f.needle}\n`])),
    });
    const findings = checkDecisionLoopGaps(root);
    expect(findings.some((f) => f.gap === producer.gap)).toBe(true);
  });

  it("counts a producer wherever it lives, not only in one named symbol", () => {
    // CONTROL for the case above: with a write present anywhere under the scan
    // roots, the producer claim must hold — otherwise the assertion would also
    // pass for a guard that always reports the gap.
    const [producer] = RECORDED_PRODUCERS;
    const root = fixtureRepo({
      ...Object.fromEntries(
        RECORDED_UNREACHABLE.map((e) => [e.definedIn, `export function ${e.symbol}() {}\n`]),
      ),
      "lib/anywhere/writer.ts": `await tx.${producer.write}({});\n`,
      "prisma/schema.prisma": "",
      [REGISTER_PATH]: "# register\n",
      ...Object.fromEntries(RECORDED_REACHABLE.map((f) => [f.file, `${f.needle}\n`])),
    });
    expect(checkDecisionLoopGaps(root)).toEqual([]);
  });

  it("fails when the register itself is gone", () => {
    // FAIL-CLOSED. Deleting the document must not make the guard vacuously OK.
    const root = fixtureRepo({ "prisma/schema.prisma": "" });
    const findings = checkDecisionLoopGaps(root);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.detail).toContain(REGISTER_PATH);
  });
});
