import { describe, it, expect } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "./args";
import { runInit } from "./init";
import { runProfileCommand } from "./profile";

describe("parseArgs", () => {
  it("defaults to profile when the first token is a flag", () => {
    const o = parseArgs(["--source", "."]);
    expect(o.command).toBe("profile");
    expect(o.source).toBe(".");
  });

  it("recognizes the init command and --force", () => {
    const o = parseArgs(["init", "--force"]);
    expect(o.command).toBe("init");
    expect(o.force).toBe(true);
  });

  it("parses --key=value and help", () => {
    expect(parseArgs(["profile", "--output=out"]).output).toBe("out");
    expect(parseArgs(["--help"]).command).toBe("help");
  });
});

describe("runInit", () => {
  it("scaffolds a scope manifest and gitignores .helm-profiler/", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "sp-init-"));
    try {
      const result = runInit({ cwd: dir, force: false });
      expect(result.scopeWritten).toBe(true);
      expect(existsSync(result.scopePath)).toBe(true);
      const gitignore = readFileSync(path.join(dir, ".gitignore"), "utf8");
      expect(gitignore).toContain(".helm-profiler/");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("is idempotent on a second run", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "sp-init2-"));
    try {
      runInit({ cwd: dir, force: false });
      const second = runInit({ cwd: dir, force: false });
      expect(second.scopeWritten).toBe(false);
      expect(second.gitignoreUpdated).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("runProfileCommand", () => {
  it("writes a run directory with the three artifacts", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "sp-run-"));
    try {
      writeFileSync(
        path.join(dir, "schema.sql"),
        "CREATE TABLE deals (id INTEGER PRIMARY KEY, name VARCHAR(99), amount DECIMAL(10,2), stage VARCHAR(20));",
      );
      const { runDir, artifactRefs, result } = runProfileCommand({
        cwd: dir,
        source: ".",
        output: "out",
        now: () => new Date("2026-06-07T00:00:00.000Z"),
      });
      expect(artifactRefs).toEqual(
        expect.arrayContaining(["run.json", "code-scan.json", "mapping-candidates.json", "review-packet.json"]),
      );
      for (const ref of artifactRefs) {
        expect(existsSync(path.join(runDir, ref))).toBe(true);
      }
      expect(result.codeScan.objects.some((o) => o.name === "deals")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
