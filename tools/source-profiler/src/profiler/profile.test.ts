import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runProfile } from "./profile";
import { defaultScopeManifest } from "../contract/scope-manifest";

const fixturesAppDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/sample-app",
);

const fixedNow = () => new Date("2026-06-07T00:00:00.000Z");

describe("runProfile — end to end over synthetic app", () => {
  it("discovers objects and proposes mapping candidates", () => {
    const manifest = defaultScopeManifest(".");
    const { run, codeScan, candidates } = runProfile({
      rootAbs: fixturesAppDir,
      manifest,
      now: fixedNow,
    });

    expect(run.phase).toBe("completed");
    expect(run.modalities).toContain("static_source");

    const objectNames = codeScan.objects.map((o) => o.name);
    expect(objectNames).toEqual(
      expect.arrayContaining(["deals", "companies", "Company", "Contact", "Meeting"]),
    );

    const entities = candidates.map((c) => c.targetEntity);
    expect(entities).toEqual(expect.arrayContaining(["Opportunity", "Company", "Contact"]));
    expect(candidates.every((c) => c.state === "candidate")).toBe(true);
  });
});

describe("runProfile — strict secret preflight", () => {
  it("skips files with embedded secrets in strict mode", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "sp-secret-"));
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        path.join(dir, "clean.sql"),
        "CREATE TABLE x (id INTEGER PRIMARY KEY, name VARCHAR(50));",
      );
      // Fragment-assembled so the committed test source has no contiguous
      // credential literal; the file written to the temp dir does.
      const leakUrl = ["postgres", "://", "user", ":", "pw0", "@host/db"].join("");
      writeFileSync(path.join(dir, "leaky.ts"), `export const dbUrl = "${leakUrl}";`);

      const manifest = defaultScopeManifest(".");
      const { codeScan } = runProfile({ rootAbs: dir, manifest, now: fixedNow });

      const leaky = codeScan.skippedFiles.find((s) => s.path === "leaky.ts");
      expect(leaky?.reason).toBe("secret_preflight");
      expect(codeScan.objects.some((o) => o.name === "x")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
