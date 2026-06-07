import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runSourceProfilerBoundariesCheck } from "./check-source-profiler-boundaries";

describe("source-profiler boundary guard", () => {
  it("passes on the real tool source", () => {
    const violations = runSourceProfilerBoundariesCheck(process.cwd());
    expect(violations).toEqual([]);
  });

  it("flags code execution (SP-A) and network in the core (SP-B)", () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), "sp-guard-"));
    try {
      const coreDir = path.join(repo, "tools/source-profiler/src/profiler");
      mkdirSync(coreDir, { recursive: true });
      writeFileSync(
        path.join(coreDir, "bad.ts"),
        ["export function run(x: string) {", "  eval(x);", "  return fetch('http://x');", "}"].join("\n"),
      );
      const violations = runSourceProfilerBoundariesCheck(repo);
      const rules = violations.map((v) => v.rule);
      expect(rules).toContain("SP-A");
      expect(rules).toContain("SP-B");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("honors @bypass-SP-B and allows network under src/ai and src/db", () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), "sp-guard2-"));
    try {
      const aiDir = path.join(repo, "tools/source-profiler/src/ai");
      mkdirSync(aiDir, { recursive: true });
      writeFileSync(path.join(aiDir, "client.ts"), "export const f = () => fetch('https://api');\n");
      const coreDir = path.join(repo, "tools/source-profiler/src/util");
      mkdirSync(coreDir, { recursive: true });
      writeFileSync(
        path.join(coreDir, "ok.ts"),
        "export const g = () => fetch('https://x'); // @bypass-SP-B justified\n",
      );
      const violations = runSourceProfilerBoundariesCheck(repo);
      expect(violations.filter((v) => v.rule === "SP-B")).toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("flags AI output claiming deterministic origin (SP-C)", () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), "sp-guard3-"));
    try {
      const aiDir = path.join(repo, "tools/source-profiler/src/ai");
      mkdirSync(aiDir, { recursive: true });
      writeFileSync(
        path.join(aiDir, "overlay.ts"),
        'export const c = { origin: "deterministic" };\n',
      );
      const violations = runSourceProfilerBoundariesCheck(repo);
      expect(violations.some((v) => v.rule === "SP-C")).toBe(true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("closes the B5 false-negatives: Function(), import(net), accepted state, bare bypass", () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), "sp-guard5-"));
    try {
      const coreDir = path.join(repo, "tools/source-profiler/src/profiler");
      mkdirSync(coreDir, { recursive: true });
      // Function(...) without `new`, dynamic import of a net module, and a
      // hardcoded human-accepted state — all in a core (non-ai) file.
      writeFileSync(
        path.join(coreDir, "evil.ts"),
        [
          "export const f = Function('return 1');",
          "export const g = async () => await import('https');",
          'export const c = { state: "accepted_by_human" };',
        ].join("\n"),
      );
      const rules = runSourceProfilerBoundariesCheck(repo).map((v) => v.rule);
      expect(rules).toContain("SP-A"); // Function() + dynamic import
      expect(rules).toContain("SP-B"); // import('https')
      expect(rules).toContain("SP-C"); // accepted_by_human anywhere
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("flags a @bypass without justification (SP-BYPASS)", () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), "sp-guard6-"));
    try {
      const dir = path.join(repo, "tools/source-profiler/src/util");
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, "x.ts"), "export const x = 1; // @bypass-SP-A\n");
      const rules = runSourceProfilerBoundariesCheck(repo).map((v) => v.rule);
      expect(rules).toContain("SP-BYPASS");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
